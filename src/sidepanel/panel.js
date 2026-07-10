/* eslint-disable no-undef */
/*
 * Megumin Suite — Side Panel (orchestrator)
 *
 * Mounts a dockable/floatable panel that mirrors the trackers Megumin emits
 * inline in chat (World State, NPC Inner Chatter, Summary, New NPC dossiers)
 * plus profile-stored data (Story Planner, NPC Bank, Ban List).
 *
 * Section content lives in sections.js (SECTION_REGISTRY); window management
 * (drag/resize/dock-float/scale) lives in chrome.js; shared DOM helpers in
 * dom.js. This module owns: settings + migration, the panel skeleton, the
 * render loop, SillyTavern event wiring, inline-block stripping, and the
 * public API consumed by index.js.
 */

import { extension_settings, getContext } from "../../../../../extensions.js";
import {
    eventSource,
    event_types,
    saveSettingsDebounced,
} from "../../../../../../script.js";

import { findLastAssistantMessage, parseMessage } from "./parsers.js";
import { el } from "./dom.js";
import { SECTION_REGISTRY } from "./sections.js";
import {
    initPanelChrome,
    applyLayout,
    applyScale,
    setMode,
    clampToViewport,
} from "./chrome.js";
import {
    initPresentBar,
    refreshPresentBar,
    getPresentBarSettings,
    applyPresentBarChange,
} from "./presentBar.js";

const EXT_NAME = "Megumin-Suite";
const PANEL_ID = "meg-sp-panel";
const FAB_ID = "meg-sp-fab";
const BODY_HIDE_CLASS = "meg-sp-hide-inline";
const BODY_OPEN_CLASS = "meg-sp-panel-open";
const SETTINGS_KEY = "sidePanel";

const DEFAULTS = Object.freeze({
    schemaVersion: 2,
    enabled: false,
    mode: "docked",              // "docked" | "floating"
    position: "right",           // docked edge
    width: 340,                  // docked width px
    collapsed: false,
    hideInline: true,
    scale: 1.0,                  // 0.8–1.4
    autoHideEmpty: true,
    float: { x: null, y: null, w: 620, h: 720 },
    sections: {
        worldState:   { visible: true, open: true,  order: 0 },
        innerChatter: { visible: true, open: true,  order: 1 },
        newNpcs:      { visible: true, open: true,  order: 2 },
        storyPlan:    { visible: true, open: false, order: 3 },
        npcBank:      { visible: true, open: true,  order: 4 },
        banList:      { visible: true, open: false, order: 5 },
    },
});

let initialised = false;
let getProfile = () => ({});   // Injected by index.js
let pendingRender = null;
const lastBadgeCounts = new Map();

// -----------------------------------------------------------------------------
// Settings + migration
// -----------------------------------------------------------------------------
const LEGACY_DEFAULTS = Object.freeze({
    width: [360], // historic default widths
});

function migrateSidePanelSettings(cur) {
    // v1 → v2: sections were booleans; now {visible, open, order}.
    // Keyed on the actual saved shape, NOT schemaVersion — the generic
    // defaults backfill stamps schemaVersion: 2 before we run, so a
    // version check would always pass and the migration would never fire.
    for (const def of SECTION_REGISTRY) {
        const v = cur.sections[def.id];
        if (typeof v === "boolean") {
            cur.sections[def.id] = { visible: v, open: def.defaultOpen, order: def.order };
        } else if (v === undefined) {
            cur.sections[def.id] = { visible: true, open: def.defaultOpen, order: def.order };
        }
    }
    cur.schemaVersion = 2;
}

function settings() {
    if (!extension_settings[EXT_NAME]) extension_settings[EXT_NAME] = {};
    if (!extension_settings[EXT_NAME][SETTINGS_KEY]) {
        extension_settings[EXT_NAME][SETTINGS_KEY] = structuredClone(DEFAULTS);
    } else {
        const cur = extension_settings[EXT_NAME][SETTINGS_KEY];
        const def = DEFAULTS;
        for (const k of Object.keys(def)) {
            if (cur[k] === undefined) cur[k] = structuredClone(def[k]);
        }
        if (!cur.sections) cur.sections = structuredClone(def.sections);
        for (const [k, legacyVals] of Object.entries(LEGACY_DEFAULTS)) {
            if (legacyVals.includes(cur[k]) && cur[k] !== def[k]) cur[k] = def[k];
        }
        migrateSidePanelSettings(cur);
        // Backfill sections added after migration stamped v2
        for (const sd of SECTION_REGISTRY) {
            if (cur.sections[sd.id] === undefined) {
                cur.sections[sd.id] = { visible: true, open: sd.defaultOpen, order: sd.order };
            }
        }
        if (!cur.float || typeof cur.float !== "object") cur.float = structuredClone(def.float);
    }
    return extension_settings[EXT_NAME][SETTINGS_KEY];
}

function persist() {
    try { saveSettingsDebounced(); } catch (e) { /* noop */ }
}

// -----------------------------------------------------------------------------
// Panel skeleton
// -----------------------------------------------------------------------------
function buildPanelSkeleton() {
    const cfg = settings();

    const fab = el("button", {
        id: FAB_ID,
        class: "meg-sp-fab",
        title: "Megumin Suite Trackers",
    }, el("i", { class: "fa-solid fa-clipboard-list" }));
    fab.addEventListener("click", () => togglePanel());

    const panel = el("aside", {
        id: PANEL_ID,
        class: `meg-sp-panel${cfg.collapsed ? " meg-sp-collapsed" : ""}`,
    });

    const header = el("div", { class: "meg-sp-header" },
        el("div", { class: "meg-sp-header-bg", id: "meg-sp-header-bg" }),
        el("div", { class: "meg-sp-header-overlay" }),
        el("div", { class: "meg-sp-title" },
            el("i", { class: "fa-solid fa-wand-magic-sparkles" }),
            " Megumin Trackers"),
        el("div", { class: "meg-sp-header-actions" },
            el("button", {
                class: "meg-sp-icon-btn",
                title: "Open NPC Book",
                onclick: () => openNpcBook(),
            }, el("i", { class: "fa-solid fa-book-open" })),
            el("button", {
                class: "meg-sp-icon-btn",
                title: "Refresh from latest message",
                onclick: () => render(),
            }, el("i", { class: "fa-solid fa-rotate" })),
            el("button", {
                class: "meg-sp-icon-btn",
                title: "Collapse panel",
                onclick: () => togglePanel(false),
            }, el("i", { class: "fa-solid fa-xmark" })),
        ),
    );

    const body = el("div", { class: "meg-sp-body" });
    body.appendChild(el("div", { class: "meg-sp-empty", id: "meg-sp-empty" },
        el("i", { class: "fa-solid fa-hat-wizard" }),
        el("p", {}, "No tracker data yet. The panel updates whenever the AI emits a World State or NPC Inner Chatter block."),
    ));
    body.appendChild(el("div", { class: "meg-sp-sections", id: "meg-sp-sections" }));

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(fab);
    document.body.appendChild(panel);

    initPanelChrome(panel, {
        getSettings: settings,
        persist,
        onLayoutChange: () => syncBodyClasses(),
    });
}

// -----------------------------------------------------------------------------
// NPC Book bridge — opens the existing Megumin Suite modal on the NPCs Bank tab
// -----------------------------------------------------------------------------
function clickNpcBankDot() {
    // Title-based lookup so upstream tab reorders don't break us
    const dock = document.querySelectorAll("#ps_dynamic_dots .dock-icon");
    for (let i = 0; i < dock.length; i++) {
        if ((dock[i].getAttribute("title") || "").trim() === "NPCs Bank") {
            const dot = document.getElementById("dot_" + i);
            if (dot) { dot.click(); return true; }
        }
    }
    return false;
}

function openNpcBook(focusIdx) {
    const $overlay = window.jQuery ? window.jQuery("#prompt-slot-modal-overlay") : null;
    if (!$overlay || !$overlay.length) {
        try { (window.toastr || console).info("Open Megumin Suite (wand icon) at least once first.", "NPC Book"); } catch (e) { /* */ }
        return;
    }

    // The dock icons are only injected by Megumin's own open path (wand
    // click → switchTab). If the modal has never been opened this session,
    // the dock is empty and fading the overlay in shows a blank stage —
    // so go through the wand's click handler, which runs the full init.
    const dockEmpty = !document.querySelector("#ps_dynamic_dots .dock-icon");
    if (dockEmpty) {
        const wand = document.getElementById("prompt-slot-fixed-btn");
        if (wand) wand.click();
        // switchTab(0) has now rendered the dock; hop to the bank tab.
        setTimeout(clickNpcBankDot, 50);
    } else {
        $overlay.fadeIn(200).css("display", "flex");
        clickNpcBankDot();
    }

    if (typeof focusIdx === "number" && focusIdx >= 0) {
        setTimeout(() => {
            const cards = document.querySelectorAll("#ps_stage_content .npc-card");
            const targetName = (getProfile().npcBank?.npcs || [])[focusIdx]?.name;
            if (!targetName) return;
            for (const card of cards) {
                if ((card.textContent || "").includes(targetName)) {
                    const header = card.querySelector(".npc-card-header");
                    const body = card.querySelector(".npc-card-body");
                    if (header && body && body.style.display === "none") header.click();
                    // Scroll ONLY the modal's stage container. scrollIntoView
                    // walks every scrollable ancestor — including the
                    // overflow-hidden but programmatically-scrollable body —
                    // which shifted ST's whole layout (the "grey bar" bug).
                    const stage = document.getElementById("ps_stage_content");
                    if (stage && stage.contains(card)) {
                        const top = card.offsetTop - stage.clientHeight / 2 + card.offsetHeight / 2;
                        stage.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
                    }
                    break;
                }
            }
            // Defensive: undo any stray document scroll from earlier sessions
            if (document.documentElement.scrollTop) document.documentElement.scrollTop = 0;
            if (document.body.scrollTop) document.body.scrollTop = 0;
        }, dockEmpty ? 450 : 300);
    }
}

// -----------------------------------------------------------------------------
// Banked NPC lookup (shared with sections + present bar cast)
// -----------------------------------------------------------------------------
function lookupBankedNpc(name) {
    if (!name) return null;
    const npcs = getProfile()?.npcBank?.npcs;
    if (!Array.isArray(npcs)) return null;
    const target = name.trim().toLowerCase();
    for (const n of npcs) {
        const nm = (n.name || "").trim().toLowerCase();
        if (!nm) continue;
        if (nm === target) return n;
        if (nm.split(/\s+/)[0] === target.split(/\s+/)[0]) return n;
    }
    return null;
}

// -----------------------------------------------------------------------------
// Render loop
// -----------------------------------------------------------------------------
function buildSectionCtx() {
    let parsed = { hasAny: false };
    try {
        const ctx = getContext();
        const found = findLastAssistantMessage(ctx?.chat);
        if (found) parsed = parseMessage(found.msg.mes);
    } catch (e) {
        console.warn("[Megumin Side Panel] parse failure", e);
    }
    return {
        parsed,
        profile: getProfile() || {},
        cfg: settings(),
        openNpcBook,
        lookupBankedNpc,
    };
}

export function getOrderedSections(cfg) {
    return [...SECTION_REGISTRY].sort((a, b) =>
        (cfg.sections[a.id]?.order ?? a.order) - (cfg.sections[b.id]?.order ?? b.order));
}

function onGripKeydown(e, sectionId) {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    e.stopPropagation();
    const cfg = settings();
    const ordered = getOrderedSections(cfg).filter(d => cfg.sections[d.id]?.visible !== false);
    const idx = ordered.findIndex(d => d.id === sectionId);
    if (idx < 0) return;
    const swapWith = e.key === "ArrowUp" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= ordered.length) return;
    const ids = ordered.map(d => d.id);
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
    applySectionOrder(ids);
    // Restore focus to the moved grip after re-render
    requestAnimationFrame(() => {
        document.querySelector(`#meg-sp-section-${sectionId} .meg-sp-drag-handle`)?.focus();
    });
}

function buildSectionShell(def, st, contentNode, badgeVal) {
    const d = el("details", {
        class: "meg-sp-section",
        id: "meg-sp-section-" + def.id,
        "data-section-id": def.id,
    });
    d.open = !!st.open;

    const grip = el("span", {
        class: "meg-sp-drag-handle",
        tabindex: "0",
        role: "button",
        title: "Alt+↑/↓ to reorder",
        onkeydown: (e) => onGripKeydown(e, def.id),
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); },
    }, el("i", { class: "fa-solid fa-grip-vertical" }));

    let badgeNode = null;
    if (badgeVal !== null && badgeVal !== undefined) {
        badgeNode = el("span", { class: "meg-sp-badge" }, String(badgeVal));
        const prev = lastBadgeCounts.get(def.id);
        if (prev !== undefined && prev !== badgeVal) {
            badgeNode.classList.add("meg-sp-badge-pulse");
            badgeNode.addEventListener("animationend", () => badgeNode.classList.remove("meg-sp-badge-pulse"), { once: true });
        }
        lastBadgeCounts.set(def.id, badgeVal);
    }

    const sum = el("summary", { class: "meg-sp-summary" },
        grip,
        el("span", { class: "meg-sp-summary-title" },
            el("i", { class: "fa-solid " + def.icon }),
            " ",
            def.title),
        badgeNode,
        el("i", { class: "fa-solid fa-chevron-down meg-sp-chevron" }),
    );
    d.appendChild(sum);
    d.appendChild(contentNode);

    d.addEventListener("toggle", () => {
        // <details> toggle events are macrotasks, so a render-time flag can't
        // distinguish rebuild-triggered events from user clicks. Compare the
        // persisted value instead: rebuild events fire with open === saved
        // state (a no-op write we skip); only real user toggles differ.
        const cfg = settings();
        const st2 = cfg.sections[def.id];
        if (st2 && typeof st2 === "object" && st2.open !== d.open) {
            st2.open = d.open;
            persist();
        }
    });

    return d;
}

function syncBodyClasses() {
    const cfg = settings();
    // Only the FAB's dim/shrink cue consumes this class (no layout depends
    // on it), so it applies in both docked and floating modes.
    document.body.classList.toggle(BODY_OPEN_CLASS, cfg.enabled && !cfg.collapsed);
    document.body.classList.toggle(BODY_HIDE_CLASS, cfg.enabled && !!cfg.hideInline);
}

function render() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const cfg = settings();
    if (!cfg.enabled) {
        panel.style.display = "none";
        document.body.classList.remove(BODY_OPEN_CLASS);
        return;
    }
    panel.classList.toggle("meg-sp-collapsed", !!cfg.collapsed);

    // Update chevron/icon direction on toggle button (FAB)
    const fab = panel.querySelector("#" + FAB_ID);
    if (fab) {
        const icon = fab.querySelector("i");
        if (icon) {
            const position = cfg.position || "right";
            const collapsed = !!cfg.collapsed;
            const floating = cfg.mode === "floating";
            icon.className = "fa-solid";
            if (floating) {
                icon.classList.add("fa-clipboard-list");
            } else if (position === "right") {
                icon.classList.add(collapsed ? "fa-chevron-left" : "fa-chevron-right");
            } else {
                icon.classList.add(collapsed ? "fa-chevron-right" : "fa-chevron-left");
            }
        }
    }

    applyLayout();
    syncBodyClasses();

    const host = panel.querySelector("#meg-sp-sections");
    const empty = panel.querySelector("#meg-sp-empty");
    const bodyEl = panel.querySelector(".meg-sp-body");
    if (!host) return;

    const savedScroll = bodyEl ? bodyEl.scrollTop : 0;

    const ctx = buildSectionCtx();

    host.innerHTML = "";

    for (const def of getOrderedSections(cfg)) {
        const st = cfg.sections[def.id];
        if (!st || st.visible === false) continue;

        let content = null;
        try {
            content = def.render(ctx);
        } catch (e) {
            console.warn(`[Megumin Side Panel] section ${def.id} render failed`, e);
        }

        if (!content) {
            if (cfg.autoHideEmpty) continue;
            content = el("div", { class: "meg-sp-muted" }, "—");
        }

        const badgeVal = typeof def.badge === "function" ? def.badge(ctx) : null;
        host.appendChild(buildSectionShell(def, st, content, badgeVal));
    }


    if (empty) {
        if (host.children.length) {
            empty.style.display = "none";
        } else {
            // Distinguish "no data yet" from "data exists but every section
            // is hidden" — the old panel keyed off actual data presence.
            const prof = ctx.profile || {};
            const hasData = ctx.parsed?.hasAny
                || (ctx.parsed?.newNpcs && ctx.parsed.newNpcs.length)
                || (prof.storyPlan?.currentPlan && prof.storyPlan.currentPlan.trim())
                || (prof.npcBank?.npcs && prof.npcBank.npcs.length)
                || (prof.banList && prof.banList.length);
            const p = empty.querySelector("p");
            if (p) {
                p.textContent = hasData
                    ? "All sections are hidden. Re-enable them in the Side Panel settings tab."
                    : "No tracker data yet. The panel updates whenever the AI emits a World State or NPC Inner Chatter block.";
            }
            empty.style.display = "";
        }
    }
    if (bodyEl) bodyEl.scrollTop = savedScroll;
}

function scheduleRender(delay = 0) {
    if (pendingRender) clearTimeout(pendingRender);
    pendingRender = setTimeout(() => {
        pendingRender = null;
        render();
        try { refreshPresentBar(); } catch (e) { /* */ }
    }, delay);
}

// -----------------------------------------------------------------------------
// Section order API (used by grip keyboard reorder + settings tab)
// -----------------------------------------------------------------------------
export function applySectionOrder(ids) {
    const cfg = settings();
    ids.forEach((id, i) => {
        if (cfg.sections[id]) cfg.sections[id].order = i;
    });
    // Push hidden sections after the visible ones, preserving relative order
    let tail = ids.length;
    for (const def of getOrderedSections(cfg)) {
        if (!ids.includes(def.id)) {
            if (cfg.sections[def.id]) cfg.sections[def.id].order = tail++;
        }
    }
    persist();
    render();
}

export function resetSectionLayout() {
    const cfg = settings();
    for (const def of SECTION_REGISTRY) {
        cfg.sections[def.id] = { visible: true, open: def.defaultOpen, order: def.order };
    }
    persist();
    render();
}

// -----------------------------------------------------------------------------
// Present Characters cast
// -----------------------------------------------------------------------------
function buildPresentCast() {
    try {
        const ctx = getContext();
        const found = findLastAssistantMessage(ctx?.chat);
        const parsed = found ? parseMessage(found.msg.mes) : null;
        const npcs = parsed?.worldState?.npcs || [];
        const out = [];
        const seen = new Set();
        for (const npc of npcs) {
            const name = (npc.name || "").trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ name, fields: npc.fields || {}, banked: lookupBankedNpc(name) });
        }
        return out;
    } catch (e) {
        return [];
    }
}

// -----------------------------------------------------------------------------
// Inline-hiding: hide tracker <details> in the rendered chat DOM.
// Raw chat[].mes stays intact so re-parsing on swipe/edit keeps working.
// -----------------------------------------------------------------------------
function stripInlineFromMessage(mesId) {
    const cfg = settings();
    if (!cfg.enabled || !cfg.hideInline) return;
    let root;
    if (mesId !== undefined && mesId !== null) {
        root = document.querySelector(`.mes[mesid="${mesId}"] .mes_text`);
    }
    if (!root) {
        const all = document.querySelectorAll(".mes .mes_text");
        root = all[all.length - 1];
    }
    if (!root) return;

    root.querySelectorAll("details").forEach(d => {
        const sum = d.querySelector("summary");
        if (!sum) return;
        if (/📌|💭|🆕/.test(sum.textContent || "")) {
            d.style.display = "none";
            d.classList.add("meg-sp-tracker-block");
        }
    });
}

function stripInlineFromAll() {
    const cfg = settings();
    // When the panel is disabled the trackers must stay visible in chat —
    // hiding them with no panel to show them would make the data vanish
    // everywhere. Still run the loop so mid-session disables un-hide.
    const hide = cfg.enabled && cfg.hideInline;
    document.querySelectorAll(".mes .mes_text").forEach(root => {
        root.querySelectorAll("details").forEach(d => {
            const sum = d.querySelector("summary");
            if (!sum) return;
            if (/📌|💭|🆕/.test(sum.textContent || "")) {
                d.style.display = hide ? "none" : "";
                d.classList.add("meg-sp-tracker-block");
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Panel collapse toggle (FAB + ✕)
// -----------------------------------------------------------------------------
function togglePanel(force) {
    const cfg = settings();
    cfg.collapsed = (typeof force === "boolean") ? !force : !cfg.collapsed;
    persist();
    render();
}

function injectStylesheet() {
    if (document.getElementById("meg-sp-styles")) return;
    const link = document.createElement("link");
    link.id = "meg-sp-styles";
    link.rel = "stylesheet";
    try {
        link.href = new URL("./styles.css", import.meta.url).toString();
    } catch (e) {
        link.href = "scripts/extensions/third-party/Megumin-Suite-Beta/src/sidepanel/styles.css";
    }
    document.head.appendChild(link);
}

// -----------------------------------------------------------------------------
// Debug handle
// -----------------------------------------------------------------------------
function installDebugHandle() {
    try {
        window.LukaSuite = Object.freeze({
            refresh: () => { render(); refreshPresentBar(); },
            settings,
            parseLast: () => buildSectionCtx().parsed,
            cast: buildPresentCast,
            sections: {
                registry: SECTION_REGISTRY,
                order: () => getOrderedSections(settings()).map(d => d.id),
                setOrder: applySectionOrder,
                reset: resetSectionLayout,
            },
            panel: {
                el: () => document.getElementById(PANEL_ID),
                toggle: togglePanel,
                setMode,
            },
            openNpcBook,
            presentBar: {
                settings: getPresentBarSettings,
                refresh: refreshPresentBar,
            },
        });
    } catch (e) { /* non-fatal */ }
}

function updateHeaderImage() {
    const bg = document.getElementById("meg-sp-header-bg");
    if (!bg) return;
    const ctx = getContext();
    let imgUrl = "";
    if (ctx.groupId !== undefined && ctx.groupId !== null) {
        imgUrl = `/scripts/extensions/third-party/Megumin-Suite-Beta/img/group.png`;
    } else if (ctx.characterId !== undefined && ctx.characterId !== null && ctx.characters && ctx.characters[ctx.characterId]) {
        imgUrl = `/characters/${ctx.characters[ctx.characterId].avatar}`;
    }
    if (imgUrl) {
        bg.style.backgroundImage = `url('${imgUrl}')`;
    } else {
        bg.style.backgroundImage = "none";
    }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------
export function initSidePanel({ profileGetter } = {}) {
    if (initialised) return;
    initialised = true;

    if (typeof profileGetter === "function") getProfile = profileGetter;

    injectStylesheet();
    initPresentBar({
        castGetter: buildPresentCast,
        onOpenInBook: (npcName) => {
            const list = getProfile()?.npcBank?.npcs || [];
            const idx = list.findIndex(n => (n.name || "").trim().toLowerCase() === (npcName || "").trim().toLowerCase());
            openNpcBook(idx >= 0 ? idx : undefined);
        },
    });

    const mount = () => {
        if (document.getElementById(PANEL_ID)) return;
        settings().collapsed = true;
        persist();
        buildPanelSkeleton();
        updateHeaderImage();
        render();
        stripInlineFromAll();
        refreshPresentBar();
        installDebugHandle();
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mount, { once: true });
    } else {
        mount();
    }

    if (typeof eventSource !== "undefined" && typeof event_types !== "undefined") {
        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
            scheduleRender(50);
            setTimeout(() => stripInlineFromMessage(mesId), 0);
        });
        eventSource.on(event_types.USER_MESSAGE_RENDERED, (mesId) => {
            setTimeout(() => stripInlineFromMessage(mesId), 0);
        });
        eventSource.on(event_types.MESSAGE_EDITED, () => scheduleRender(50));
        eventSource.on(event_types.MESSAGE_DELETED, () => scheduleRender(50));
        eventSource.on(event_types.MESSAGE_SWIPED, () => {
            scheduleRender(50);
            setTimeout(stripInlineFromAll, 50);
        });
        eventSource.on(event_types.CHAT_CHANGED, () => {
            updateHeaderImage();
            scheduleRender(50);
            setTimeout(stripInlineFromAll, 100);
        });
        eventSource.on(event_types.MORE_MESSAGES_LOADED, () => {
            setTimeout(stripInlineFromAll, 50);
        });
        eventSource.on(event_types.APP_READY, () => {
            scheduleRender(100);
            setTimeout(stripInlineFromAll, 150);
            setTimeout(clampToViewport, 200);
        });
    }
}

export function refreshSidePanel() { render(); }
export { getPresentBarSettings, applyPresentBarChange, refreshPresentBar };
export function getSidePanelSettings() { return settings(); }

export function applyInlineHidingChange() {
    syncBodyClasses();
    stripInlineFromAll();
    if (!settings().hideInline) {
        document.querySelectorAll(".mes .mes_text details.meg-sp-tracker-block").forEach(d => {
            d.style.display = "";
        });
    }
}

// Thin delegates — index.js call sites keep working
export function applyPositionChange() { applyLayout(); }
export function applyWidthChange() { applyLayout(); }
export function applyModeChange() { setMode(settings().mode); }
export function applyScaleChange() { applyScale(); }

export function applyEnabledChange() {
    const panel = document.getElementById(PANEL_ID);
    const fab = document.getElementById(FAB_ID);
    const cfg = settings();
    if (panel) panel.style.display = cfg.enabled ? "" : "none";
    if (fab) fab.style.display = cfg.enabled ? "" : "none";
    syncBodyClasses();
    if (cfg.enabled) {
        render();
        stripInlineFromAll();
    } else {
        document.querySelectorAll(".mes .mes_text details.meg-sp-tracker-block").forEach(d => {
            d.style.display = "";
        });
        document.body.classList.remove(BODY_HIDE_CLASS);
    }
}
