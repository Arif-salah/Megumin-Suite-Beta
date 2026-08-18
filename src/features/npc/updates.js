// ────────────────────────────────────────────────────────────────────────────
// <NPC_Update> — applying a dossier change the model wrote mid-story.
//
// The dossier used to be written once and locked forever ("NEVER regenerate for
// an NPC who already has a dossier"). That is still right for most of it — an
// appearance or a background that drifts every scene is not a character. But a
// few fields are ABOUT change: what someone wants, what they think of the PC,
// what they are hiding. Those are marked `updatable` in the field list, and this
// is what lets the model move them.
//
// Rather than rewriting the whole dossier, the model sends operations:
//
//     ~ Agenda: get her mother out before winter
//     + Secrets: Tier 2 — forging the ledger since spring
//     - Secrets: the rumour she was fired
//
// EVERY APPLIED OPERATION KEEPS THE PREVIOUS VALUE. That one decision is what
// makes both features below possible: the undo button on the chat card, and the
// rollback when the chat is rewound past the message that made the change. A
// changelog that only recorded what arrived could do neither.
// ────────────────────────────────────────────────────────────────────────────

import { localProfile } from "../../core/state.js";
import { npcUpdatableFields, npcFieldAllowsOp, npcFieldByRole } from "./fields.js";

// ── Parsing ─────────────────────────────────────────────────────────────────

// Every <NPC_Update> block in a piece of text.
//
// Not searched inside an envelope, and a reply cut off before </NPC_Update> is
// still read for whatever it managed to write — the same rule the block parsers
// and the dossier finder follow, for the same reason.
export function npcParseUpdateBlocks(text) {
    const out = [];
    if (!text || typeof text !== "string") return out;

    const re = /<NPC_Update\b([^>]*)>([\s\S]*?)(?:<\/NPC_Update\s*>|$)/ig;
    let m;
    while ((m = re.exec(text)) !== null) {
        const attrs = m[1] || "";
        const nameAttr = attrs.match(/name\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const name = (nameAttr ? (nameAttr[1] ?? nameAttr[2] ?? nameAttr[3] ?? "") : "")
            .replace(/\*\*/g, "").replace(/<\/?b>/ig, "").trim();
        if (!name) continue;

        const ops = [];
        (m[2] || "").split(/\r?\n/).forEach(line => {
            // "~ Agenda: text" — the operator, the field label, then the value.
            const om = line.match(/^\s*([+~-])\s*([^:]+?)\s*:\s*(.+)\s*$/);
            if (!om) return;
            const value = om[3].trim();
            // A line left as the template's own placeholder is not a change.
            if (!value || /^\[.*\]$/.test(value)) return;
            ops.push({ op: om[1], label: om[2].trim().replace(/\*\*/g, ""), text: value });
        });

        if (ops.length) out.push({ name, ops });
    }
    return out;
}

// ── Matching a list entry for removal ───────────────────────────────────────

// The model is asked for "enough of an existing entry's wording to identify
// which one", not for a word-perfect copy — quoting a secret back exactly is a
// thing models are bad at, and a removal that silently does nothing is worse
// than one that is a little fuzzy.
function normalizeForMatch(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, "-")
        .replace(/[^a-z0-9' ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// The index of the line that best matches `needle`, or -1.
function findMatchingLine(lines, needle) {
    const want = normalizeForMatch(needle);
    if (!want) return -1;

    // Containment either way first: the model quoted the line, or quoted a
    // fragment of it.
    for (let i = 0; i < lines.length; i++) {
        const have = normalizeForMatch(lines[i]);
        if (have && (have.includes(want) || want.includes(have))) return i;
    }

    // Otherwise the line sharing the most distinctive words, and only if it
    // shares enough of them to be a real match rather than the nearest miss.
    const wantWords = new Set(want.split(" ").filter(w => w.length > 3));
    if (wantWords.size === 0) return -1;

    let best = -1, bestScore = 0;
    lines.forEach((line, i) => {
        const haveWords = new Set(normalizeForMatch(line).split(" ").filter(w => w.length > 3));
        let hits = 0;
        wantWords.forEach(w => { if (haveWords.has(w)) hits++; });
        const score = hits / wantWords.size;
        if (score > bestScore) { bestScore = score; best = i; }
    });
    return bestScore >= 0.5 ? best : -1;
}

// ── Applying ────────────────────────────────────────────────────────────────

function npcFindByName(name) {
    const bank = localProfile && localProfile.npcBank;
    if (!bank || !Array.isArray(bank.npcs)) return null;
    const want = String(name || "").trim().toLowerCase();
    if (!want) return null;
    return bank.npcs.find(n => String(n.name || "").trim().toLowerCase() === want)
        // A model that writes "Maya" for "Maya Torres" is addressing the same
        // person, and refusing the update over a surname helps nobody.
        || bank.npcs.find(n => {
            const have = String(n.name || "").trim().toLowerCase();
            return have && (have.startsWith(want + " ") || want.startsWith(have + " "));
        })
        || null;
}

let _historySeq = 0;
function nextHistoryId() {
    return `h${Date.now().toString(36)}${(_historySeq++).toString(36)}`;
}

// Apply every parsed update. Returns the changelog entries it actually wrote, so
// the caller can report on them; an operation the field list does not permit is
// dropped and counted rather than applied.
export function npcApplyUpdates(updates, { messageIndex = 0 } = {}) {
    const applied = [];
    const refused = [];
    if (!Array.isArray(updates) || !updates.length) return { applied, refused };

    const updatable = npcUpdatableFields();
    const byLabel = new Map();
    updatable.forEach(f => byLabel.set(String(f.label).toLowerCase(), f));

    updates.forEach(u => {
        const npc = npcFindByName(u.name);
        if (!npc) { refused.push({ name: u.name, reason: "no NPC by that name in the bank" }); return; }
        if (!Array.isArray(npc.history)) npc.history = [];

        u.ops.forEach(({ op, label, text }) => {
            const field = byLabel.get(String(label).toLowerCase());
            // Not updatable, or not a field at all. Either way the model was told
            // the list and went outside it, so this is dropped, not guessed at.
            if (!field) { refused.push({ name: u.name, reason: `"${label}" is not an updatable field` }); return; }
            if (!npcFieldAllowsOp(field, op)) {
                refused.push({ name: u.name, reason: `"${op}" is not allowed on ${field.label}` });
                return;
            }

            const before = String(npc[field.id] || "");
            let after = before;

            if (op === "~") {
                after = text;
            } else if (op === "+") {
                const lines = before.split(/\r?\n/).filter(l => l.trim() !== "");
                // Keep the bullet style the field already uses, so an added entry
                // does not sit visibly apart from the ones around it.
                const bulleted = lines.length > 0 && /^\s*[*-]\s/.test(lines[0]);
                lines.push(bulleted ? `* ${text}` : text);
                after = lines.join("\n");
            } else if (op === "-") {
                const lines = before.split(/\r?\n/).filter(l => l.trim() !== "");
                const idx = findMatchingLine(lines, text);
                if (idx === -1) {
                    refused.push({ name: u.name, reason: `nothing in ${field.label} matched "${text.slice(0, 40)}"` });
                    return;
                }
                lines.splice(idx, 1);
                after = lines.join("\n");
            }

            if (after === before) return;

            npc[field.id] = after;
            const entry = {
                id: nextHistoryId(),
                msgIndex: messageIndex,
                at: Date.now(),
                npc: npc.name,
                field: field.id,
                label: field.label,
                op,
                text,
                before
            };
            npc.history.push(entry);
            applied.push(entry);
        });
    });

    return { applied, refused };
}

// ── Undo ────────────────────────────────────────────────────────────────────

// Revert one change.
//
// Later changes to the SAME field were written on top of this one, so restoring
// this entry's `before` would silently discard them. They are dropped too, and
// the count comes back so the caller can say so rather than letting the reader
// discover it.
export function npcUndoHistoryEntry(entryId) {
    const bank = localProfile && localProfile.npcBank;
    if (!bank || !Array.isArray(bank.npcs)) return null;

    for (const npc of bank.npcs) {
        if (!Array.isArray(npc.history)) continue;
        const i = npc.history.findIndex(h => h && h.id === entryId);
        if (i === -1) continue;

        const entry = npc.history[i];
        npc[entry.field] = entry.before;

        const laterSameField = npc.history.filter((h, j) => j > i && h.field === entry.field);
        npc.history = npc.history.filter((h, j) => !(j >= i && h.field === entry.field));

        return { npc: npc.name, label: entry.label, alsoDropped: laterSameField.length };
    }
    return null;
}

// Every change that arrived in one message, across all NPCs, oldest first.
// What the chat card's NPC Update tab is drawn from.
export function npcHistoryForMessage(msgIndex) {
    const bank = localProfile && localProfile.npcBank;
    if (!bank || !Array.isArray(bank.npcs)) return [];
    const out = [];
    bank.npcs.forEach(npc => {
        (npc.history || []).forEach(h => {
            if (h && h.msgIndex === msgIndex) out.push(h);
        });
    });
    return out.sort((a, b) => a.at - b.at);
}

// Every change still on file for an NPC, newest first.
export function npcHistoryFor(npcName) {
    const npc = npcFindByName(npcName);
    if (!npc || !Array.isArray(npc.history)) return [];
    return [...npc.history].reverse();
}

// ── Rewind ──────────────────────────────────────────────────────────────────

// Undo every change that arrived at or after `chatLength`, because those
// messages no longer exist.
//
// THE ORDER MATTERS. If messages 70 and 80 both changed Secrets and the chat is
// rewound to 60, the value to restore is the one from BEFORE message 70 — the
// oldest dropped entry for that field, not the newest. Restoring the newest
// would leave message 70's change in a chat that never reaches message 70.
//
// Returns true when it changed something, so pruneFutureData knows to save.
export function npcRollbackHistoryFrom(chatLength) {
    const bank = localProfile && localProfile.npcBank;
    if (!bank || !Array.isArray(bank.npcs)) return false;

    let changed = false;
    bank.npcs.forEach(npc => {
        if (!Array.isArray(npc.history) || npc.history.length === 0) return;

        const doomed = npc.history.filter(h => h && h.msgIndex >= chatLength);
        if (doomed.length === 0) return;

        // Oldest first per field, so the first one seen carries the value that
        // was true before any of this happened.
        const restoreTo = new Map();
        [...doomed].sort((a, b) => (a.msgIndex - b.msgIndex) || (a.at - b.at)).forEach(h => {
            if (!restoreTo.has(h.field)) restoreTo.set(h.field, h.before);
        });

        restoreTo.forEach((before, fieldId) => { npc[fieldId] = before; });
        npc.history = npc.history.filter(h => h && h.msgIndex < chatLength);
        changed = true;
    });

    return changed;
}
