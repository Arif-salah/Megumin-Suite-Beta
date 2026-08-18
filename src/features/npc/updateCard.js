// ────────────────────────────────────────────────────────────────────────────
// The NPC Update tab inside the chat card.
//
// The block registry gets the tab drawn for free — that is what the registry is
// for. What it draws by default is the model's raw text, which is the wrong
// thing here: the reader wants to know what ACTUALLY changed, and the raw block
// includes operations that were refused (a field that is not updatable, a
// removal that matched nothing). So the pane is redrawn from the changelog.
//
// WHY THIS IS ITS OWN FILE, and not part of updates.js: undoing writes the
// profile, so this needs core/profile.js — and core/profile.js imports
// updates.js for the rewind rollback. Putting the button here keeps that edge
// one-way. updates.js stays pure data; this is the only part that saves.
// ────────────────────────────────────────────────────────────────────────────

import { saveProfileToMemory } from "../../core/profile.js";
import { fireRefreshHook, REFRESH } from "../../core/refreshHooks.js";
import { npcHistoryForMessage, npcUndoHistoryEntry } from "./updates.js";

const OP_LABEL = { "+": "added", "-": "removed", "~": "replaced" };
const OP_ICON = { "+": "fa-plus", "-": "fa-minus", "~": "fa-arrow-right-arrow-left" };
const OP_COLOR = { "+": "#10b981", "-": "#ef4444", "~": "#fbbf24" };

function esc(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Redraw one message's NPC Update pane from what was actually applied.
//
// Called with the pane element the card renderer produced. Leaves it exactly as
// it was if there is no changelog for this message — which covers a card drawn
// for an older reply from before updates existed, and a block whose operations
// were all refused. Showing the model's raw text in that case is the honest
// outcome: something was written, and none of it took.
export function npcDecorateUpdatePane(paneEl, msgIndex) {
    if (!paneEl || typeof msgIndex !== "number") return;

    const entries = npcHistoryForMessage(msgIndex);
    if (!entries.length) return;

    const doc = paneEl.ownerDocument || document;
    const rows = entries.map(h => `
        <div class="meg-npcupd-row" data-entry="${esc(h.id)}">
            <div class="meg-npcupd-head">
                <i class="fa-solid ${OP_ICON[h.op] || "fa-pen"}" style="color:${OP_COLOR[h.op] || "#94a3b8"};"></i>
                <b>${esc(h.npc)}</b>
                <span class="meg-npcupd-field">${esc(h.label)}</span>
                <span class="meg-npcupd-op" style="color:${OP_COLOR[h.op] || "#94a3b8"};">${OP_LABEL[h.op] || h.op}</span>
                <button type="button" class="meg-npcupd-undo" title="Put this back the way it was">
                    <i class="fa-solid fa-rotate-left"></i> Undo
                </button>
            </div>
            <div class="meg-npcupd-text">${esc(h.text)}</div>
        </div>
    `).join("");

    paneEl.innerHTML = `
        <div class="meg-npcupd">
            ${rows}
            ${entries.length > 1
            ? `<button type="button" class="meg-npcupd-undo-all"><i class="fa-solid fa-rotate-left"></i> Undo all ${entries.length} changes</button>`
            : ""}
        </div>
    `;

    const refresh = () => {
        saveProfileToMemory();
        fireRefreshHook(REFRESH.NPC_LIST);
        // Redraw this pane in place rather than the whole chat: the reader is
        // looking at it, and rebuilding every card would scroll under them.
        paneEl.innerHTML = "";
        npcDecorateUpdatePane(paneEl, msgIndex);
        if (!paneEl.innerHTML.trim()) {
            paneEl.innerHTML = `<div class="meg-npcupd-empty">All changes from this reply were undone.</div>`;
        }
    };

    paneEl.querySelectorAll(".meg-npcupd-undo").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const id = btn.closest(".meg-npcupd-row")?.dataset.entry;
            if (!id) return;
            const done = npcUndoHistoryEntry(id);
            if (!done) return;
            if (typeof toastr !== "undefined") {
                // A later change to the same field had to go with it. Saying so
                // is the difference between an undo the reader can trust and one
                // that quietly loses work.
                toastr.info(
                    done.alsoDropped > 0
                        ? `${done.label} restored. ${done.alsoDropped} later change${done.alsoDropped === 1 ? "" : "s"} to the same field went with it.`
                        : `${done.label} restored.`,
                    `Megumin Suite — ${done.npc}`
                );
            }
            refresh();
        });
    });

    const undoAll = paneEl.querySelector(".meg-npcupd-undo-all");
    if (undoAll) {
        undoAll.addEventListener("click", e => {
            e.stopPropagation();
            // Newest first, so undoing one never has to drop another in this set.
            [...entries].reverse().forEach(h => npcUndoHistoryEntry(h.id));
            if (typeof toastr !== "undefined") {
                toastr.info(`${entries.length} changes from this reply were undone.`, "Megumin Suite");
            }
            refresh();
        });
    }
}
