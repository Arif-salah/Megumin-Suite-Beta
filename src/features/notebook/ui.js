// ────────────────────────────────────────────────────────────────────────────
// The Notebook tab (plan 010): the Author's Notebook switch, the per-chat
// pause, where the story stands, and the notebook itself:
//
//   Active — the live truths, blurred. Opening one asks first (it spoils the
//            story); an open truth can be edited, marked revealed or deleted.
//   Past   — the truths that came out, as a timeline: the truth, every clue
//            with its turn, and the turn it came out.
//
// Every change here is the user's own entry: swipes and rewinds never undo it.
// ────────────────────────────────────────────────────────────────────────────

import { getContext, Popup, POPUP_TYPE } from "../../st.js";
import { localProfile } from "../../core/state.js";
import { saveProfileToMemory } from "../../core/profile.js";
import { meguminScheduleBlocksRefresh } from "../blocks/chat.js";
import {
    notebookEnabled, notebookForcedByEngine, notebookPaused, setNotebookPaused, notebookCurrentPhase, notebookState,
    notebookEdit
} from "../../state/index.js";
import { liveTruths, pastTruths, LIVE_CAP } from "../../state/modules/notebook/model.js";
import { splitNames } from "../../state/modules/notebook/parse.js";

const esc = v => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Truths the reader chose to open, by chat + id, so a redraw keeps them open.
const opened = new Set();

const HOW = {
    out: "came out to everyone it was hidden from",
    learned: "the last person it was hidden from found out",
    user: "you marked it revealed"
};

const FIELDS = [
    { key: "truth", label: "Truth", rows: 3 },
    { key: "hiddenFrom", label: "Hidden from", rows: 0, hint: "names, separated by commas; add \"the reader\" if the page hasn't shown it" },
    { key: "when", label: "Comes out when", rows: 2 },
    { key: "changes", label: "What it changes", rows: 2 },
    { key: "clueIdeas", label: "Clue ideas", rows: 2 }
];

function clueList(t, { removable = false } = {}) {
    if (!t.clues.length) return `<div class="meg-nb-none">No clues planted yet.</div>`;
    return `<ul class="meg-nb-clues">${t.clues.map((c, i) => `
        <li>
            <span class="meg-nb-turn">turn ${esc(c.seq)}</span>
            <span>${esc(c.text)}${c.found === false ? ` <span class="meg-nb-flag" title="The clue's words were not found in the story of its reply"><i class="fa-solid fa-triangle-exclamation"></i> not found in the reply</span>` : ""}</span>
            ${removable ? `<button type="button" class="meg-nb-mini meg-nb-clue-del" data-i="${i}" title="Remove this clue"><i class="fa-solid fa-xmark"></i></button>` : ""}
        </li>`).join("")}</ul>`;
}

function liveCard(t, isOpen) {
    const value = f => f.key === "hiddenFrom" ? t.hiddenFrom.join(", ") : (t[f.key] || "");
    const field = f => `
        <label class="meg-nb-field"><span>${f.label}</span>
            ${f.rows
                ? `<textarea class="ps-modern-input meg-nb-input" data-key="${f.key}" rows="${f.rows}">${esc(value(f))}</textarea>`
                : `<input type="text" class="ps-modern-input meg-nb-input" data-key="${f.key}" value="${esc(value(f))}" placeholder="${esc(f.hint || "")}" />`}
        </label>`;
    return `
        <div class="meg-nb-truth" data-id="${esc(t.id)}">
            <div class="meg-nb-truth-head">
                <b>${esc(t.id)}</b>
                <span class="meg-nb-turn">written turn ${esc(t.createdSeq)}</span>
                <span class="meg-nb-turn">${t.clues.length} clue${t.clues.length === 1 ? "" : "s"}</span>
            </div>
            <div class="meg-nb-spoiler${isOpen ? "" : " is-hidden"}">
                <div class="meg-nb-content">
                    <div class="meg-nb-none">Changes save as soon as you leave a box.</div>
                    ${FIELDS.map(field).join("")}
                    <div class="meg-nb-field"><span>Clues planted</span>${clueList(t, { removable: true })}</div>
                </div>
                <button type="button" class="meg-nb-reveal"><i class="fa-solid fa-eye"></i> Show this truth</button>
            </div>
            ${isOpen ? `
            <div class="meg-nb-actions">
                <button type="button" class="menu_button meg-nb-hide"><i class="fa-solid fa-eye-slash"></i> Hide</button>
                <button type="button" class="menu_button meg-nb-out" title="The truth is out: it leaves the story's notebook and joins Past"><i class="fa-solid fa-flag-checkered"></i> Mark revealed</button>
                <button type="button" class="menu_button meg-nb-del" title="Delete this truth. Its id is never used again."><i class="fa-solid fa-trash"></i> Delete</button>
            </div>` : ""}
        </div>`;
}

function pastItem(t) {
    const hidden = t.hiddenFrom.length ? `<div class="meg-nb-line"><i>Was still hidden from:</i> ${esc(t.hiddenFrom.join(", "))}</div>` : "";
    return `
        <div class="meg-nb-past" data-id="${esc(t.id)}">
            <div class="meg-nb-past-dot"></div>
            <div class="meg-nb-past-body">
                <div class="meg-nb-truth-head">
                    <b>${esc(t.id)}</b>
                    <span class="meg-nb-turn">written turn ${esc(t.createdSeq)}</span>
                    <span class="meg-nb-turn">came out turn ${esc(t.revealedSeq)}</span>
                </div>
                <div class="meg-nb-line">${esc(t.truth)}</div>
                ${hidden}
                <div class="meg-nb-line meg-nb-how">${esc(HOW[t.revealedHow] || "came out")}</div>
                ${clueList(t)}
                <div class="meg-nb-actions">
                    <button type="button" class="menu_button meg-nb-restore" title="Put it back in the story as a live truth"><i class="fa-solid fa-rotate-left"></i> Activate again</button>
                    <button type="button" class="menu_button meg-nb-del" title="Delete this truth"><i class="fa-solid fa-trash"></i> Delete</button>
                </div>
            </div>
        </div>`;
}

function notebookSections(state, chatId, on) {
    const live = liveTruths(state).sort((a, b) => a.createdSeq - b.createdSeq);
    const past = pastTruths(state).sort((a, b) => (a.revealedSeq - b.revealedSeq) || (a.createdSeq - b.createdSeq));
    if (!live.length && !past.length) return "";
    const kept = on ? "" : `<div class="meg-nb-none">The notebook is off, so these are kept but not handed to the story.</div>`;
    return `
        <div class="mtab-panel" style="margin-bottom:16px;">
            <div class="mtab-panel-title purple"><i class="fa-solid fa-mask"></i> Active <span class="meg-nb-count">${live.length} of ${LIVE_CAP} live</span></div>
            ${kept}
            ${live.length ? `
            <div class="mtab-callout red" style="margin-bottom:12px;">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>These are the truths the story is still hiding. Opening one spoils what the story is building toward.</span>
            </div>
            ${live.map(t => liveCard(t, opened.has(`${chatId}|${t.id}`))).join("")}` : `<div class="meg-nb-none">No truth is live. The next reply writes new ones.</div>`}
        </div>
        ${past.length ? `
        <div class="mtab-panel" style="margin-bottom:16px;">
            <div class="mtab-panel-title green"><i class="fa-solid fa-timeline"></i> Past <span class="meg-nb-count">${past.length}</span></div>
            <div class="meg-nb-timeline">${past.map(pastItem).join("")}</div>
        </div>` : ""}`;
}

// The box the tab scrolls in, so a redraw after an edit keeps the place.
function scrollParent(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
        const o = getComputedStyle(n).overflowY;
        if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return n;
    }
    return null;
}

export function renderNotebookTab(c) {
    const scrollBox = c[0] ? scrollParent(c[0]) : null;
    const keepScroll = scrollBox ? scrollBox.scrollTop : 0;
    c.empty();
    const forced = notebookForcedByEngine();
    const on = notebookEnabled();
    const chatId = getContext()?.chatId;
    const hasChat = Boolean(chatId);
    const paused = hasChat && notebookPaused();
    const phase = hasChat ? notebookCurrentPhase() : "off";
    const state = hasChat ? notebookState() : null;
    const live = state ? liveTruths(state).length : 0;
    const past = state ? pastTruths(state).length : 0;

    const status = !on ? "The notebook is off."
        : !hasChat ? "Open a chat to see its notebook."
        : paused ? "Paused in this chat: nothing is sent and no new truths are written. The truths already written are kept."
        : phase === "setup" ? "The next reply writes the notebook: two or three hidden truths."
        : `${live} of ${LIVE_CAP} truths are live in this chat${past ? `, ${past} came out` : ""}.`;

    c.append(`
        <div class="mtab-header">
            <div class="mtab-header-left">
                <div class="mtab-header-icon" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9);"><i class="fa-solid fa-book"></i></div>
                <div>
                    <h2>The Notebook</h2>
                    <p>The truths the story is hiding, the clues it plants, and when they come out.</p>
                </div>
            </div>
            <div class="mtab-header-badge" style="background: ${on ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)"}; color: ${on ? "#10b981" : "var(--text-muted)"}; border: 1px solid ${on ? "rgba(16,185,129,0.25)" : "var(--border-color)"};">
                <i class="fa-solid fa-${on ? "circle-check" : "circle-xmark"}" style="font-size:0.6rem;"></i> ${on ? "Enabled" : "Disabled"}
            </div>
        </div>

        <div class="mtab-toggle-row ${on ? "active" : ""}" id="nb_enable_card" style="margin-bottom: 12px; ${forced ? "cursor: default; opacity: 0.85;" : ""}">
            <div class="toggle-info">
                <div class="toggle-label"><i class="fa-solid fa-book" style="color:#8b5cf6;"></i> Author's Notebook${forced ? " (your engine keeps one)" : ""}</div>
                <div class="toggle-desc">The story decides a few hidden truths, keeps them from turn to turn, plants clues, and reveals them when the story is ready. World State stops asking for a Secret while this is on.</div>
            </div>
            <div class="ps-switch"></div>
        </div>

        <div class="mtab-toggle-row ${paused ? "active" : ""}" id="nb_pause_card" style="margin-bottom: 16px; ${on && hasChat ? "" : "opacity: 0.5; cursor: default;"}">
            <div class="toggle-info">
                <div class="toggle-label"><i class="fa-solid fa-pause" style="color:#8b5cf6;"></i> Pause in this chat</div>
                <div class="toggle-desc">Stops the notebook in this chat only: no setup, nothing sent.</div>
            </div>
            <div class="ps-switch"></div>
        </div>

        <div class="mtab-callout" style="margin-bottom: 16px;">
            <i class="fa-solid fa-circle-info"></i>
            <span>${status}</span>
        </div>

        ${state ? notebookSections(state, chatId, on) : ""}
    `);

    c.find("#nb_enable_card").on("click", () => {
        if (forced) return;
        localProfile.notebook = { ...(localProfile.notebook || {}), enabled: !on };
        saveProfileToMemory();
        meguminScheduleBlocksRefresh();
        renderNotebookTab(c);
    });
    c.find("#nb_pause_card").on("click", () => {
        if (!on || !hasChat) return;
        setNotebookPaused(!paused);
        renderNotebookTab(c);
    });
    if (state) bindNotebook(c, state, chatId);
    if (scrollBox) scrollBox.scrollTop = keepScroll;
}

function bindNotebook(c, state, chatId) {
    const commit = op => {
        notebookEdit(op);
        meguminScheduleBlocksRefresh();
        renderNotebookTab(c);
    };
    const idOf = el => $(el).closest("[data-id]").attr("data-id");
    const truthOf = el => state.truths[idOf(el)];

    c.find(".meg-nb-truth .meg-nb-reveal").on("click", async function () {
        const id = idOf(this);
        const popup = new Popup(
            "<h3>Show this truth?</h3><p>This shows what the story is hiding. Reading it spoils what the story is building toward.</p>",
            POPUP_TYPE.CONFIRM, "", { okButton: "Show it", cancelButton: "Keep it hidden" }
        );
        if (!(await popup.show())) return;
        opened.add(`${chatId}|${id}`);
        renderNotebookTab(c);
    });
    c.find(".meg-nb-hide").on("click", function () {
        opened.delete(`${chatId}|${idOf(this)}`);
        renderNotebookTab(c);
    });

    // Saved as soon as the reader leaves a box, like the Bonds editor.
    c.find(".meg-nb-input").on("change", function () {
        const t = truthOf(this);
        if (!t) return;
        const key = this.dataset.key;
        const raw = String($(this).val() || "").trim();
        const fields = {};
        if (key === "hiddenFrom") {
            const names = splitNames(raw);
            if (names.join("|") !== t.hiddenFrom.join("|")) fields.hiddenFrom = names;
        } else if (raw !== (t[key] || "")) {
            fields[key] = raw;
        }
        if (fields.truth === "") {
            toastr.warning("A truth can't be empty. Delete it instead.", "Megumin Suite");
            $(this).val(t.truth);
            return;
        }
        if (!Object.keys(fields).length) return;
        commit({ op: "edit", id: t.id, fields });
        if (fields.hiddenFrom && !fields.hiddenFrom.length) toastr.info(`${t.id} is hidden from no one now, so it came out.`, "Megumin Suite");
    }).on("keydown", function (e) { if (e.key === "Enter" && this.tagName === "INPUT") this.blur(); });

    c.find(".meg-nb-clue-del").on("click", function () {
        const t = truthOf(this);
        if (!t) return;
        const i = Number(this.dataset.i);
        commit({ op: "edit", id: t.id, fields: { clues: t.clues.filter((_, j) => j !== i) } });
    });

    c.find(".meg-nb-out").on("click", function () {
        const t = truthOf(this);
        if (t) commit({ op: "reveal", id: t.id });
    });

    c.find(".meg-nb-restore").on("click", function () {
        const t = truthOf(this);
        if (!t) return;
        if (liveTruths(state).length >= LIVE_CAP) {
            toastr.warning(`${LIVE_CAP} truths are already live. Mark one revealed or delete one first.`, "Megumin Suite");
            return;
        }
        commit({ op: "restore", id: t.id });
    });

    // Delete asks twice: click once to arm, again within 3 s to delete.
    c.find(".meg-nb-del").on("click", function () {
        const $b = $(this);
        if ($b.attr("data-armed") !== "1") {
            $b.attr("data-armed", "1").addClass("armed").html(`<i class="fa-solid fa-trash"></i> Delete for good?`);
            setTimeout(() => $b.attr("data-armed", "0").removeClass("armed").html(`<i class="fa-solid fa-trash"></i> Delete`), 3000);
            return;
        }
        const t = truthOf(this);
        if (!t) return;
        opened.delete(`${chatId}|${t.id}`);
        commit({ op: "forget", id: t.id });
    });
}
