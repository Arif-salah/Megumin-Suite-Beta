// ────────────────────────────────────────────────────────────────────────────
// The Gemini Pro loadout asks for a ^ before every word of the reply. The
// user's SillyTavern regex hides them in the chat, but our blocks are read
// from the saved text, so the reply is cleaned here as soon as it lands.
// Pure: no SillyTavern imports.
// ────────────────────────────────────────────────────────────────────────────

/** True while this profile asks the story for ^ before every word. */
export const usesCaretWords = p => Boolean(p) && p.loadout === "gemini-pro";

export const stripCarets = text => String(text ?? "").replace(/\^/g, "");

/** Removes the ^ from a chat message: its text and the swipe it shows.
 *  Returns true when anything changed. */
export function stripMessageCarets(msg) {
    if (!msg || msg.is_user || msg.is_system || typeof msg.mes !== "string") return false;
    let changed = false;
    if (msg.mes.includes("^")) {
        msg.mes = stripCarets(msg.mes);
        changed = true;
    }
    const i = msg.swipe_id;
    if (Array.isArray(msg.swipes) && typeof msg.swipes[i] === "string" && msg.swipes[i].includes("^")) {
        msg.swipes[i] = stripCarets(msg.swipes[i]);
        changed = true;
    }
    return changed;
}
