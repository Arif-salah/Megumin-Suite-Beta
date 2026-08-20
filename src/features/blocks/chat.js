// ────────────────────────────────────────────────────────────────────────────
// Drawing the master block card into chat messages.
//
// The chat side of blocks, kept apart from the Blocks TAB: the tab's preview
// renders through the dict builder, which sits at the top of the dependency
// graph, while this only needs the registry. Splitting there lets image gen
// ask for a redraw without pulling the settings UI in behind it.
// ────────────────────────────────────────────────────────────────────────────

import { getContext } from "../../st.js";
import { extensionName } from "../../core/constants.js";
import { applyBlocksToMessage, clearBlocksFromMessage } from "../../blocks/render.js";
import { meguminRenderRegistry, meguminBlocksTakenByPanel } from "./registry.js";
// One directed edge from the blocks feature to the NPC feature. No cycle:
// nothing under features/npc/ imports the block card.
import { npcDecorateUpdatePane } from "../npc/updateCard.js";

// ── Clicking a choice ────────────────────────────────────────────────────────
//
// The card renderer knows nothing about SillyTavern — it is handed a callback
// and calls it. This is that callback, and it lives here because this is the
// chat side, which is the only surface where a choice means anything. The
// BLOCKS tab preview passes no callback, so its buttons are inert by
// construction rather than by a flag someone has to remember to set.
//
// Plain click FILLS the input rather than sending. A choice is a suggestion,
// and the reader almost always wants to add to it — "3. Follow her out" becomes
// "Follow her out, but hang back at the door". Shift sends as-is for the times
// they do not.
function meguminApplyChoice(text, { send = false } = {}) {
    const ta = document.getElementById("send_textarea");
    if (!ta) return;

    // Appended, not replaced. Something half-typed in the box is the reader's
    // work and must not be thrown away by a click.
    const existing = String(ta.value || "").replace(/\s+$/, "");
    ta.value = existing ? `${existing} ${text}` : text;

    // SillyTavern's auto-resize and its send-button state both hang off input.
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
    try { ta.selectionStart = ta.selectionEnd = ta.value.length; } catch (e) { /* not fatal */ }

    if (!send) return;

    // SillyTavern reads a leading slash as a command, so a choice that starts
    // with one is not a suggestion to the story, it is an instruction to the
    // app — and shift is one key away from an ordinary click. The text still
    // goes in the box, where the reader can see it and decide; what it will not
    // do is send itself. Tested on the composed message rather than on the
    // choice, because a slash only commands when it leads the line.
    if (/^\s*\//.test(ta.value)) {
        console.debug(`[${extensionName}] choice not sent: the message would lead with a slash command`);
        return;
    }

    // #send_but is the paper plane; #send_but_sheld is the holder around it and
    // is what the rest of this extension clicks. Either one starts a generation,
    // so try the specific one first and fall back.
    const btn = document.getElementById("send_but") || document.getElementById("send_but_sheld");
    if (btn) btn.click();
}

// One message body, decorated or put back the way SillyTavern drew it.
//
// `msgIndex` is optional and only used to redraw the NPC Update tab from the
// changelog instead of from the model's raw text — see npcDecorateUpdatePane.
// A caller that does not know the index still gets a correct card, just without
// the undo buttons on that one tab.
export function meguminDecorateMessageBody(bodyEl, mesText, msgIndex) {
    try {
        applyBlocksToMessage(bodyEl, mesText, meguminRenderRegistry(), {
            omit: meguminBlocksTakenByPanel(),
            onChoice: meguminApplyChoice
        });
        if (typeof msgIndex === "number") {
            // The card renderer stays generic — it knows nothing about NPCs. The
            // pane it produced is found by the block id and handed to the NPC
            // feature to fill in.
            const pane = bodyEl.querySelector('.meg-block-body[data-block-id="npcUpdate"]');
            if (pane) npcDecorateUpdatePane(pane, msgIndex);
        }
    } catch (e) {
        // Fail visible: the reader keeps the raw block text, which is exactly
        // what they had before this existed.
        try { clearBlocksFromMessage(bodyEl); } catch (e2) { /* nothing left to do */ }
        console.debug(`[${extensionName}] block renderer skipped a message`, e);
    }
}

// Every rendered message in the chat, matched back to its raw text by mesid.
// The DOM is only ever the place the card goes — what gets rendered is read from
// chat[i].mes, because the tags this all keys on are gone from the DOM.
export function meguminRefreshBlocksInChat() {
    let ctx = null;
    try { ctx = typeof getContext === "function" ? getContext() : null; } catch (e) { return; }
    const chat = ctx && ctx.chat;
    if (!Array.isArray(chat)) return;

    document.querySelectorAll("#chat .mes").forEach(mesEl => {
        const idx = parseInt(mesEl.getAttribute("mesid"), 10);
        if (Number.isNaN(idx) || !chat[idx]) return;
        const msg = chat[idx];
        if (msg.is_user || msg.is_system) return;

        const bodyEl = mesEl.querySelector(".mes_text");
        if (!bodyEl) return;
        // A message being edited has SillyTavern's textarea parked in its body.
        // Decorating that would fight the editor and could eat the edit.
        if (bodyEl.querySelector("textarea")) { clearBlocksFromMessage(bodyEl); return; }

        meguminDecorateMessageBody(bodyEl, msg.mes, idx);
    });
}

export let meguminBlocksRefreshTimer = null;
// Several things rebuild .mes_text — image generation through updateMessageBlock,
// SillyTavern on edit and swipe, other extensions on their own timers. Every one
// of them drops the card and the hiding with it, so every path that can rebuild
// a body funnels through here, and the coalescing keeps a burst of them to one
// pass rather than one pass each.
export function meguminScheduleBlocksRefresh(delay = 60) {
    if (meguminBlocksRefreshTimer) clearTimeout(meguminBlocksRefreshTimer);
    meguminBlocksRefreshTimer = setTimeout(() => {
        meguminBlocksRefreshTimer = null;
        meguminRefreshBlocksInChat();
    }, delay);
}
