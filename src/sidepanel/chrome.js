/* eslint-disable no-undef */
/*
 * Megumin Suite — Side Panel chrome (window management)
 *
 * Dock/float mode, header drag (floating), edge/corner resize, viewport
 * clamping, and UI scale. Pointer Events only; geometry is applied to the
 * DOM every rAF during a gesture and persisted once on pointerup.
 *
 * Owns these DOM pieces on #meg-sp-panel:
 *   data-mode="docked"|"floating"
 *   .meg-sp-rz-dock  (docked: full-height resize strip on the chat-facing edge)
 *   .meg-sp-rz-se    (floating: SE corner grip)
 *   float geometry via --meg-sp-float-x/y/w/h inline vars
 */

const MIN_W = 320;
const MIN_H = 240;
const VIEW_MARGIN = 8;
const FIRST_FLOAT_GUTTER = 48;
const FIRST_FLOAT_TOP = 96;

let panelEl = null;
let getSettings = () => ({});
let persist = () => {};
let onLayoutChange = () => {};
let modeBtn = null;
let resizeTimer = null;
// True while a resize gesture holds pointer capture on a handle. Renders can
// fire mid-gesture (streaming completes while dragging); rebuilding handles
// then would remove the captured element and orphan the gesture.
let gestureActive = false;
let handleRebuildQueued = false;

function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
}

function coarsePointer() {
    return window.matchMedia("(pointer: coarse)").matches;
}

// -----------------------------------------------------------------------------
// Layout application
// -----------------------------------------------------------------------------
export function applyLayout() {
    if (!panelEl) return;
    const cfg = getSettings();

    // Mobile guard: floating renders docked without mutating the setting
    const effectiveMode = (cfg.mode === "floating" && !isMobile()) ? "floating" : "docked";
    panelEl.dataset.mode = effectiveMode;

    if (effectiveMode === "floating") {
        const f = cfg.float || {};
        if (f.x === null || f.x === undefined) {
            f.w = f.w || 620;
            f.h = f.h || 720;
            f.x = Math.max(VIEW_MARGIN, window.innerWidth - f.w - FIRST_FLOAT_GUTTER);
            f.y = FIRST_FLOAT_TOP;
            cfg.float = f;
        }
        panelEl.classList.remove("meg-sp-pos-left", "meg-sp-pos-right");
        panelEl.style.setProperty("--meg-sp-float-x", f.x + "px");
        panelEl.style.setProperty("--meg-sp-float-y", f.y + "px");
        panelEl.style.setProperty("--meg-sp-float-w", (f.w || 620) + "px");
        panelEl.style.setProperty("--meg-sp-float-h", (f.h || 720) + "px");
    } else {
        panelEl.style.removeProperty("--meg-sp-float-x");
        panelEl.style.removeProperty("--meg-sp-float-y");
        panelEl.style.removeProperty("--meg-sp-float-w");
        panelEl.style.removeProperty("--meg-sp-float-h");
        panelEl.classList.remove("meg-sp-pos-left", "meg-sp-pos-right");
        panelEl.classList.add("meg-sp-pos-" + (cfg.position || "right"));
        panelEl.style.setProperty("--meg-sp-width", (cfg.width || 620) + "px");
    }

    panelEl.style.setProperty("--meg-sp-scale", String(cfg.scale || 1));
    updateModeButton();
    rebuildHandles();
}

export function applyScale() {
    if (!panelEl) return;
    panelEl.style.setProperty("--meg-sp-scale", String(getSettings().scale || 1));
}

// -----------------------------------------------------------------------------
// Mode switching
// -----------------------------------------------------------------------------
export function setMode(mode) {
    const cfg = getSettings();
    cfg.mode = mode === "floating" ? "floating" : "docked";
    applyLayout();
    persist();
    onLayoutChange();
}

function updateModeButton() {
    if (!modeBtn) return;
    const cfg = getSettings();
    const floating = cfg.mode === "floating";
    modeBtn.title = floating ? "Dock panel" : "Float panel";
    modeBtn.innerHTML = floating
        ? '<i class="fa-solid fa-thumbtack"></i>'
        : '<i class="fa-solid fa-up-right-from-square"></i>';
}

// -----------------------------------------------------------------------------
// Drag (floating only)
// -----------------------------------------------------------------------------
function setupHeaderDrag(headerEl) {
    let dragging = false;
    let moved = false;
    let startX = 0, startY = 0, baseX = 0, baseY = 0;
    let curX = 0, curY = 0;
    let raf = 0;
    let escHandler = null;

    const threshold = () => (coarsePointer() ? 8 : 4);

    const clampX = (x, w) => Math.max(-(w - 96), Math.min(window.innerWidth - 96, x));
    const clampY = (y, headerH) => Math.max(0, Math.min(window.innerHeight - headerH, y));

    const apply = () => {
        raf = 0;
        if (!dragging) return;
        panelEl.style.transform = `translate3d(${curX - baseX}px, ${curY - baseY}px, 0)`;
    };

    const abort = () => {
        if (!dragging) return;
        dragging = false;
        moved = false;
        gestureActive = false;
        panelEl.style.transform = "";
        panelEl.classList.remove("meg-sp-dragging");
        document.body.classList.remove("meg-sp-gesturing");
        if (escHandler) { document.removeEventListener("keydown", escHandler); escHandler = null; }
        if (handleRebuildQueued) { handleRebuildQueued = false; rebuildHandles(); }
    };

    headerEl.addEventListener("pointerdown", (e) => {
        const cfg = getSettings();
        if (cfg.mode !== "floating" || isMobile()) return;
        if (e.button !== 0) return;
        if (e.target.closest(".meg-sp-icon-btn")) return;

        const rect = panelEl.getBoundingClientRect();
        dragging = true;
        moved = false;
        gestureActive = true;
        startX = e.clientX;
        startY = e.clientY;
        baseX = rect.left;
        baseY = rect.top;
        curX = baseX;
        curY = baseY;
        headerEl.setPointerCapture(e.pointerId);

        escHandler = (ke) => { if (ke.key === "Escape") abort(); };
        document.addEventListener("keydown", escHandler);
    });

    headerEl.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < threshold()) return;
        if (!moved) {
            moved = true;
            panelEl.classList.add("meg-sp-dragging");
            document.body.classList.add("meg-sp-gesturing");
        }
        const rect = panelEl.getBoundingClientRect();
        const headerH = headerEl.getBoundingClientRect().height || 44;
        curX = clampX(baseX + dx, rect.width);
        curY = clampY(baseY + dy, headerH);
        if (!raf) raf = requestAnimationFrame(apply);
    });

    const finish = () => {
        if (!dragging) return;
        const didMove = moved;
        dragging = false;
        moved = false;
        gestureActive = false;
        panelEl.classList.remove("meg-sp-dragging");
        document.body.classList.remove("meg-sp-gesturing");
        if (escHandler) { document.removeEventListener("keydown", escHandler); escHandler = null; }
        if (didMove) {
            const cfg = getSettings();
            cfg.float.x = Math.round(curX);
            cfg.float.y = Math.round(curY);
            panelEl.style.transform = "";
            panelEl.style.setProperty("--meg-sp-float-x", cfg.float.x + "px");
            panelEl.style.setProperty("--meg-sp-float-y", cfg.float.y + "px");
            persist();
        }
        if (handleRebuildQueued) { handleRebuildQueued = false; rebuildHandles(); }
    };

    headerEl.addEventListener("pointerup", finish);
    headerEl.addEventListener("pointercancel", abort);
}

// -----------------------------------------------------------------------------
// Resize handles
// -----------------------------------------------------------------------------
function removeHandles() {
    panelEl.querySelectorAll(".meg-sp-rz").forEach(h => h.remove());
}

function rebuildHandles() {
    if (!panelEl) return;
    if (gestureActive) {
        // Defer until the in-flight gesture finishes
        handleRebuildQueued = true;
        return;
    }
    removeHandles();
    const cfg = getSettings();
    if (isMobile()) return;

    if (cfg.mode === "floating") {
        const grip = document.createElement("div");
        grip.className = "meg-sp-rz meg-sp-rz-se";
        panelEl.appendChild(grip);
        setupResize(grip, "se");
    } else {
        const strip = document.createElement("div");
        strip.className = "meg-sp-rz meg-sp-rz-dock";
        // Chat-facing edge: left strip when docked right, right strip when docked left
        strip.style[cfg.position === "left" ? "right" : "left"] = "0";
        panelEl.appendChild(strip);
        setupResize(strip, "dock");
    }
}

function setupResize(handleEl, kind) {
    let resizing = false;
    let moved = false;
    let startX = 0, startY = 0, startW = 0, startH = 0;
    let raf = 0;
    let curW = 0, curH = 0;

    const apply = () => {
        raf = 0;
        if (!resizing) return;
        if (kind === "dock") {
            panelEl.style.setProperty("--meg-sp-width", curW + "px");
        } else {
            panelEl.style.setProperty("--meg-sp-float-w", curW + "px");
            panelEl.style.setProperty("--meg-sp-float-h", curH + "px");
        }
    };

    handleEl.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const rect = panelEl.getBoundingClientRect();
        resizing = true;
        moved = false;
        gestureActive = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = rect.width;
        startH = rect.height;
        curW = startW;
        curH = startH;
        panelEl.classList.add("meg-sp-resizing");
        document.body.classList.add("meg-sp-gesturing");
        handleEl.setPointerCapture(e.pointerId);
        e.preventDefault();
    });

    handleEl.addEventListener("pointermove", (e) => {
        if (!resizing) return;
        const cfg = getSettings();
        if (kind === "dock") {
            // Dragging the chat-facing edge: right-docked grows leftward
            const dx = e.clientX - startX;
            const sign = (cfg.position === "left") ? 1 : -1;
            curW = Math.round(Math.max(MIN_W, Math.min(
                Math.min(1100, window.innerWidth - FIRST_FLOAT_GUTTER),
                startW + sign * dx)));
        } else {
            curW = Math.round(Math.max(MIN_W, Math.min(window.innerWidth - 2 * VIEW_MARGIN, startW + (e.clientX - startX))));
            curH = Math.round(Math.max(MIN_H, Math.min(window.innerHeight - 2 * VIEW_MARGIN, startH + (e.clientY - startY))));
        }
        if (!moved && (Math.abs(e.clientX - startX) > 1 || Math.abs(e.clientY - startY) > 1)) moved = true;
        if (!raf) raf = requestAnimationFrame(apply);
    });

    const finish = () => {
        if (!resizing) return;
        resizing = false;
        gestureActive = false;
        panelEl.classList.remove("meg-sp-resizing");
        document.body.classList.remove("meg-sp-gesturing");
        // A plain click (no movement) must not persist geometry: measured
        // rect can differ from the stored value (max-width clamps etc.),
        // so writing it back would silently change the setting.
        if (moved) {
            const cfg = getSettings();
            if (kind === "dock") {
                cfg.width = curW;
            } else {
                cfg.float.w = curW;
                cfg.float.h = curH;
            }
            persist();
        }
        onLayoutChange();
        if (handleRebuildQueued) {
            handleRebuildQueued = false;
            rebuildHandles();
        }
    };

    handleEl.addEventListener("pointerup", finish);
    handleEl.addEventListener("pointercancel", finish);
    // If anything removes/steals the capture mid-gesture, close out cleanly
    handleEl.addEventListener("lostpointercapture", finish);
}

// -----------------------------------------------------------------------------
// Viewport clamping — rescue off-screen floating panels on window resize
// -----------------------------------------------------------------------------
export function clampToViewport() {
    if (!panelEl) return;
    const cfg = getSettings();
    if (cfg.mode !== "floating" || isMobile()) return;
    const f = cfg.float || {};
    if (f.x === null || f.x === undefined) return;

    let changed = false;
    const maxW = window.innerWidth - 2 * VIEW_MARGIN;
    const maxH = window.innerHeight - 2 * VIEW_MARGIN;
    if (f.w > maxW) { f.w = Math.max(MIN_W, maxW); changed = true; }
    if (f.h > maxH) { f.h = Math.max(MIN_H, maxH); changed = true; }

    const maxX = window.innerWidth - f.w - VIEW_MARGIN;
    const maxY = window.innerHeight - 44; // keep at least the header on screen
    if (f.x > maxX) { f.x = Math.max(VIEW_MARGIN, maxX); changed = true; }
    if (f.x < VIEW_MARGIN - (f.w - 96)) { f.x = VIEW_MARGIN; changed = true; }
    if (f.y > maxY) { f.y = Math.max(VIEW_MARGIN, maxY); changed = true; }
    if (f.y < 0) { f.y = VIEW_MARGIN; changed = true; }

    if (changed) {
        applyLayout();
        persist();
    }
}

// -----------------------------------------------------------------------------
// Init / teardown
// -----------------------------------------------------------------------------
export function initPanelChrome(panel, opts = {}) {
    panelEl = panel;
    if (typeof opts.getSettings === "function") getSettings = opts.getSettings;
    if (typeof opts.persist === "function") persist = opts.persist;
    if (typeof opts.onLayoutChange === "function") onLayoutChange = opts.onLayoutChange;

    // Mode toggle button — inserted before the ✕ in the header actions
    const actions = panel.querySelector(".meg-sp-header-actions");
    if (actions) {
        modeBtn = document.createElement("button");
        modeBtn.className = "meg-sp-icon-btn meg-sp-mode-btn";
        modeBtn.addEventListener("click", () => {
            setMode(getSettings().mode === "floating" ? "docked" : "floating");
        });
        const closeBtn = actions.lastElementChild;
        actions.insertBefore(modeBtn, closeBtn);
    }

    const header = panel.querySelector(".meg-sp-header");
    if (header) setupHeaderDrag(header);

    const onWinResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            clampToViewport();
            // Mode may flip between mobile-docked and floating on resize
            applyLayout();
        }, 150);
    };
    window.addEventListener("resize", onWinResize);
    window.addEventListener("orientationchange", onWinResize);

    applyLayout();
}

export function destroyPanelChrome() {
    if (panelEl) removeHandles();
    panelEl = null;
    modeBtn = null;
}
