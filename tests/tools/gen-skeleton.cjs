// Writes data/skeleton.js from the shipped preset (Dev Mode's Document view).
//
//     node tests/tools/gen-skeleton.cjs
//
// Replaces the old tools/gen-skeleton.py. Run it again whenever the preset's
// messages change. Order = the preset's prompt_order for character 100001,
// the order SillyTavern sends them in.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const SOURCE = "Megumin Suite V11 Universal.json";
const preset = JSON.parse(fs.readFileSync(path.join(ROOT, "Presets", SOURCE), "utf8"));

const order = (preset.prompt_order.find(o => String(o.character_id) === "100001") || preset.prompt_order[0]).order;
const byId = Object.fromEntries(preset.prompts.map(p => [p.identifier, p]));

const cards = order.map(entry => {
    const p = byId[entry.identifier] || { identifier: entry.identifier };
    return {
        id: p.identifier,
        name: p.name || p.identifier,
        role: p.role || "system",
        marker: !!p.marker,
        enabled: entry.enabled !== false,
        content: (p.content || "").replace(/\r\n/g, "\n"),
    };
});

// One card per line, spaced like the old Python output so diffs stay readable.
const cardLine = c => "{" + Object.entries(c).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ") + "}";

const out = `// ─────────────────────────────────────────────────────────────────────────────
// SKELETON — the real shape of the outgoing prompt.
//
// GENERATED FILE. Do not edit by hand; run:
//
//     node tests/tools/gen-skeleton.cjs
//
// Dev Mode's Document view draws this top to bottom, so the reader sees where a
// [[slot]] actually lands rather than an invented running order. That matters
// more than it sounds: [[thinking]] and [[this_turn]] live in "Thinking" and
// "This turn", which are sent AFTER the chat history.
//
// Cards with marker:true are SillyTavern's own (chat history, world info,
// character description). We neither own nor fill those, so the editor renders
// them greyed out as fixed landmarks.
//
// Source: ${SOURCE}
// ─────────────────────────────────────────────────────────────────────────────

export const SKELETON_SOURCE = ${JSON.stringify(SOURCE)};

export const SKELETON = [
${cards.map(c => "    " + cardLine(c) + ",").join("\n")}
];

/** Every [[trigger]] the skeleton actually contains, in the order it hits them. */
export function skeletonTriggersInOrder() {
    const seen = new Set();
    const out = [];
    SKELETON.forEach(card => {
        const matches = card.content.match(/\\[\\[[^\\]]+\\]\\]/g) || [];
        matches.forEach(t => {
            if (seen.has(t)) return;
            seen.add(t);
            out.push(t);
        });
    });
    return out;
}
`;

fs.writeFileSync(path.join(ROOT, "data", "skeleton.js"), out.replace(/\n/g, "\r\n"));
console.log(`data/skeleton.js: ${cards.length} cards from ${SOURCE}`);
