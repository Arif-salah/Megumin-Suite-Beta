// ────────────────────────────────────────────────────────────────────────────
// Prompt texts edited in Dev Mode that are built by pure modules (World State,
// Bonds, Character Sheet rules). The edits live in the shared fragments
// (core/sharedFragments.js), which pure code can't import, so index.js hands
// over a reader at startup, the same way data/slots.js gets the engine clones.
//
// An edited text can hold {{tokens}} that are filled in when it is sent, so a
// setting (a World State limit, a field's starting value) still reaches it.
// Pure: runs under plain node.
// ────────────────────────────────────────────────────────────────────────────

let read = () => "";

/** @param {(key: string) => string} fn */
export function setPromptEditReader(fn) {
    read = typeof fn === "function" ? fn : () => "";
}

/** The edited text for a key, or "" when it is not edited. */
export function promptEdit(key) {
    let v = "";
    try { v = read(key) || ""; } catch { v = ""; }
    return String(v).trim() ? String(v) : "";
}

/** Fills {{name}} for the names given; any other {{…}} ({{user}}) is left alone. */
export function fillPromptTokens(text, values) {
    return String(text || "").replace(/\{\{(\w+)\}\}/g, (m, name) =>
        Object.prototype.hasOwnProperty.call(values || {}, name) ? String(values[name]) : m);
}
