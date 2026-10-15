// ────────────────────────────────────────────────────────────────────────────
// The notebook's tab in a reply's card (plan 010).
//
// The tab shows what THIS reply did to the notebook (the truths it wrote, the
// clues, who learned what, what came out), drawn from the store, behind a
// blur. Clicking asks first, because reading it spoils what the story is
// building toward; only "Show it" takes the blur off. A card redraw (a swipe,
// an image landing) keeps a pane the reader already opened open.
// ────────────────────────────────────────────────────────────────────────────

import { Popup, POPUP_TYPE } from "../../st.js";
import { renderBody } from "../../blocks/text.js";
import { notebookCardInfo, notebookSetEntryDisabled } from "../../state/index.js";
import { describeNotebookChange, renderTruthCard } from "../../state/modules/notebook/render.js";

// Drawn by the card renderer like any block, so the raw text is hidden from the
// chat and the tab appears. Not in the block stack: the notebook has its own tab.
export const NOTEBOOK_CARD_DEFS = [
    { id: "notebook", tag: "Notebook", label: "Notebook", emoji: "📓", visibility: "open" },
    { id: "notebookUpdate", tag: "Notebook_Update", label: "Notebook", emoji: "📓", visibility: "open" }
];

/** What the pane is drawn from, for the card's redraw stamp. */
export function notebookCardStamp(msgIndex) {
    try {
        const info = notebookCardInfo(msgIndex);
        return info ? JSON.stringify([info.entry.id, info.disabled, info.applied, info.notes]) : "";
    } catch (e) { return ""; }
}

// Panes the reader chose to see, by journal entry (or message) so a redraw keeps them open.
const revealed = new Set();

function contentFor(info, fallbackHtml) {
    if (!info) return fallbackHtml;
    if (info.disabled) return renderBody("*This reply's notebook changes are reverted.*");
    const parts = [];
    const lines = [];
    for (const a of info.applied) {
        if (a.op === "entry" && info.truths[a.id]) parts.push(renderTruthCard(info.truths[a.id]));
        else {
            const line = describeNotebookChange(a);
            if (line) lines.push(`* ${line}`);
        }
    }
    if (lines.length) parts.push(lines.join("\n"));
    for (const n of info.notes) parts.push(`*Left out: ${n}*`);
    if (!parts.length) return fallbackHtml;
    return renderBody(parts.join("\n\n---\n\n"));
}

/**
 * @param {HTMLElement} pane  the notebook pane of one message's card
 * @param {number} msgIndex
 * @param {{ onChanged?: () => void }} [hooks]
 */
export function notebookDecoratePane(pane, msgIndex, hooks = {}) {
    if (!pane || pane.dataset.megNotebook === "1") return;
    pane.dataset.megNotebook = "1";
    let info = null;
    try { info = notebookCardInfo(msgIndex); } catch (e) { console.warn("[Megumin Suite] Notebook card:", e); }
    const key = info?.entry?.id || `msg:${msgIndex}`;
    const shown = revealed.has(key);

    const wrap = document.createElement("div");
    wrap.className = `meg-nb-spoiler${shown ? "" : " is-hidden"}`;
    const content = document.createElement("div");
    content.className = "meg-nb-content";
    content.innerHTML = contentFor(info, pane.innerHTML);
    wrap.appendChild(content);

    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "meg-nb-reveal";
    reveal.innerHTML = `<i class="fa-solid fa-eye"></i> Show what the story is hiding`;
    wrap.appendChild(reveal);

    const actions = document.createElement("div");
    actions.className = "meg-nb-actions";
    const hide = document.createElement("button");
    hide.type = "button";
    hide.className = "menu_button";
    hide.innerHTML = `<i class="fa-solid fa-eye-slash"></i> Hide`;
    hide.style.display = shown ? "" : "none";
    hide.addEventListener("click", e => {
        e.stopPropagation();
        revealed.delete(key);
        wrap.classList.add("is-hidden");
        hide.style.display = "none";
    });
    actions.appendChild(hide);
    if (info?.entry) {
        const undo = document.createElement("button");
        undo.type = "button";
        undo.className = "menu_button";
        undo.title = info.disabled ? "Count this reply's notebook changes again" : "Undo what this reply did to the notebook";
        undo.innerHTML = `<i class="fa-solid ${info.disabled ? "fa-rotate-right" : "fa-rotate-left"}"></i> ${info.disabled ? "Restore" : "Revert"}`;
        undo.addEventListener("click", e => {
            e.stopPropagation();
            notebookSetEntryDisabled(info.entry.id, !info.disabled);
            if (hooks.onChanged) hooks.onChanged();
        });
        actions.appendChild(undo);
    }

    reveal.addEventListener("click", async e => {
        e.stopPropagation();
        const popup = new Popup(
            "<h3>Show the notebook?</h3><p>This shows what the story is hiding. Reading it spoils the truths it is building toward.</p>",
            POPUP_TYPE.CONFIRM, "", { okButton: "Show it", cancelButton: "Keep it hidden" }
        );
        if (!(await popup.show())) return;
        revealed.add(key);
        wrap.classList.remove("is-hidden");
        hide.style.display = "";
    });

    pane.innerHTML = "";
    pane.appendChild(wrap);
    pane.appendChild(actions);
}
