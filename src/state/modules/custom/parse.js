// ────────────────────────────────────────────────────────────────────────────
// Custom blocks parser (plan 023). The blocks are the user's, so the list is
// handed in. Fields read like the Character Sheet ("Label: value | …"), free
// text like Inner Chatter (the last copy, as written).
// Pure: runs under plain node.
// ────────────────────────────────────────────────────────────────────────────

import { parseFields, parseLatest } from "../stats/parse.js";
import { customBlockTags } from "./model.js";

/**
 * @param {string} text   a reply, or Chomusuke's answer
 * @param {object[]} blocks  normalized custom blocks
 * @returns {null | { kind: "delta", blocks: Record<string, { kind: "fields", fields: object[] } | { kind: "text", text: string }> }}
 */
export function parseCustomBlocks(text, blocks) {
    const out = {};
    for (const b of blocks || []) {
        for (const tag of customBlockTags(b)) {
            const p = b.kind === "fields" ? parseFields(text, tag) : parseLatest(text, tag);
            if (!p) continue;
            out[b.id] = b.kind === "fields" ? { kind: "fields", fields: p.fields } : { kind: "text", text: p.text };
            break;   // the current tag first, then old ones
        }
    }
    return Object.keys(out).length ? { kind: "delta", blocks: out } : null;
}
