// Small HTML helpers shared across the settings UI.
//
// escapeHtmlAttr lived next to the Story Config renderer, which made the Blocks
// tab import from Story Config just to escape an attribute. It belongs to
// neither; it belongs here.

export function fieldPlaceholder(f) {
    return `${f.placeholder || ""} — leave empty for preset default`;
}

export function escapeHtmlAttr(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
