// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 — looks: the scan prompts, reading their answers, and deciding
// what a scan may change. Pure: no SillyTavern, testable under node.
//
// A look is a character's PERMANENT appearance (hair, eyes, body, permanent
// features). Never clothing: the outfit comes from World State.
// ────────────────────────────────────────────────────────────────────────────

import { stripCountTags, dedupeTags, splitTags } from "./resolve.js";

// ── Prompts (background task calls; they describe their own job, never an extension) ──

export const LOOK_SCAN_SYSTEM =
    "You read story text and write each character's permanent physical appearance as booru tags for an image model.";

/**
 * @param {{ source: string, sourceLabel?: string, names?: string[] }} args
 *   names — only these characters; empty = everyone described in the source
 */
export function renderLookScanPrompt({ source, sourceLabel = "Source", names = [] }) {
    const who = names.length
        ? `these characters: ${names.join(", ")}. Skip anyone the text does not describe.`
        : "every character the text describes.";
    return [
        `<${sourceLabel}>`,
        String(source || "").trim(),
        `</${sourceLabel}>`,
        "",
        `Write the permanent appearance of ${who}`,
        "Use booru tags: sex and apparent age (male, female, young adult, mature female…), hair (colour, length, style), eyes, skin, face, body type and build, and permanent features (scars, tattoos, horns, animal ears, tails, wings).",
        "Never include: clothing or accessories they can take off, expressions, poses, actions, the place, count tags (1girl, 1boy, solo) or quality tags.",
        "Only what the text states or clearly shows; do not invent features.",
        "If a character has a nickname, write the name as: Name \"Nickname\".",
        "",
        "Output one block per character and nothing else:",
        "<Character_Visual name=\"Name\">tag, tag, tag</Character_Visual>"
    ].join("\n");
}

export const NATURAL_SYSTEM =
    "You turn booru appearance tags into short, plain descriptions for an image model that reads sentences.";

/** @param {Array<{ name: string, tags: string }>} looks */
export function renderNaturalPrompt(looks) {
    return [
        "For each character, turn the tags into ONE short descriptive phrase (15 to 35 words) that starts with \"a\" or \"an\".",
        "Describe only their permanent appearance. No clothing, no names, no actions.",
        "Example: <Character_Natural name=\"Mira\">a slender young woman with long wavy red hair, bright green eyes and freckled pale skin</Character_Natural>",
        "",
        ...looks.map(l => `${l.name}: ${l.tags}`),
        "",
        "Output one block per character and nothing else:",
        "<Character_Natural name=\"Name\">a …</Character_Natural>"
    ].join("\n");
}

// ── Reading answers ──────────────────────────────────────────────────────

const unescape = s => String(s || "").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/\\(["'])/g, "$1");

// 'Matthew "Matt"' → { name: "Matthew", aliases: ["Matt"] }
function splitName(raw) {
    const s = unescape(raw).trim();
    const m = s.match(/^(.+?)\s+["“‘']([^"”’']{1,32})["”’']\s*$/);
    if (m) return { name: m[1].trim(), aliases: [m[2].trim()] };
    const p = s.match(/^(.+?)\s*\(([^)]{1,32})\)\s*$/);
    if (p) return { name: p[1].trim(), aliases: [p[2].trim()] };
    return { name: s, aliases: [] };
}

function blocks(text, tag) {
    const clean = String(text || "")
        .replace(/<think\b[^>]*>[\s\S]*?(<\/think\s*>|$)/gi, "")
        .replace(/```[a-z]*|```/gi, "");
    const re = new RegExp(`<${tag}\\b[^>]*?name\\s*=\\s*(?:"((?:\\\\.|&quot;|[^"])*)"|'((?:\\\\.|[^'])*)')[^>]*>([\\s\\S]*?)(?:<\\/${tag}\\s*>|(?=<${tag}\\b)|$)`, "gi");
    const out = [];
    let m;
    while ((m = re.exec(clean)) !== null) out.push({ rawName: m[1] ?? m[2] ?? "", body: m[3] || "" });
    return out;
}

/**
 * @returns {Array<{ name: string, aliases: string[], tags: string }>} one per character, first wins
 */
export function parseLookBlocks(text) {
    const seen = new Set();
    const out = [];
    for (const b of blocks(text, "Character_Visual")) {
        const { name, aliases } = splitName(b.rawName);
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;
        const tags = dedupeTags(stripCountTags(
            splitTags(b.body.replace(/\s*\n\s*/g, ", ").replace(/^["'\s]+|["'\s]+$/g, "")).join(", ")
        ));
        if (!tags) continue;
        seen.add(key);
        out.push({ name, aliases, tags });
    }
    return out;
}

/** @returns {Array<{ name: string, natural: string }>} */
export function parseNaturalBlocks(text) {
    return blocks(text, "Character_Natural")
        .map(b => ({ name: splitName(b.rawName).name, natural: b.body.replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "") }))
        .filter(x => x.name && x.natural);
}

/**
 * Keeps only the results for the characters asked for, filed under THEIR name:
 * asking for Matthew and getting a block named "Matt" is still Matthew (and
 * "Matt" is kept as a nickname).
 * @param {Array<{ name: string, aliases: string[], tags: string }>} scanned
 * @param {Array<{ name: string, aliases?: string[] }>} targets
 */
export function matchScanToTargets(scanned, targets) {
    if (!targets || !targets.length) return scanned;
    const k = s => String(s || "").toLowerCase().trim();
    const out = [];
    for (const s of scanned) {
        const said = [s.name, ...(s.aliases || [])].map(k);
        const t = targets.find(t => [t.name, ...(t.aliases || [])].map(k).some(n => said.includes(n)));
        if (!t || out.some(o => k(o.name) === k(t.name))) continue;
        const aliases = [...new Set([...(s.aliases || []), s.name].filter(a => k(a) !== k(t.name)))];
        out.push({ ...s, name: t.name, aliases });
    }
    return out;
}

// ── What a scan may change ───────────────────────────────────────────────

const key = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const sameTags = (a, b) => {
    const set = t => new Set(splitTags(t).map(key));
    const A = set(a), B = set(b);
    return A.size === B.size && [...A].every(x => B.has(x));
};

/** The stored look a scanned name refers to (by name or nickname), or null. */
export function findLookKey(looks, name, aliases = []) {
    const wanted = [name, ...aliases].map(key).filter(Boolean);
    for (const [k, v] of Object.entries(looks || {})) {
        if (!v) continue;
        const have = [k, ...(v.aliases || [])].map(key);
        if (wanted.some(w => have.includes(w))) return k;
    }
    return null;
}

/**
 * Sorts a scan's results against the stored looks.
 *   add     — no stored look (or an empty one): safe to add without asking
 *   change  — an established look would change: the user decides (popup)
 *   locked  — would change, but the look is locked: never touched
 *   same    — nothing new
 * @param {Record<string, {tags?: string, locked?: boolean, aliases?: string[]}>} looks
 * @param {Array<{ name: string, aliases: string[], tags: string }>} scanned
 */
export function planLookUpdates(looks, scanned) {
    const plan = { add: [], change: [], locked: [], same: [] };
    for (const s of scanned || []) {
        const k = findLookKey(looks, s.name, s.aliases);
        const cur = k ? looks[k] : null;
        // A stored look is its always part plus its body part.
        const old = cur ? [cur.tags, cur.body].map(t => String(t || "").trim()).filter(Boolean).join(", ") : "";
        const item = { key: k || s.name, name: s.name, aliases: s.aliases || [], tags: s.tags, old };
        if (!old) plan.add.push(item);
        else if (sameTags(old, s.tags)) plan.same.push(item);
        else if (cur.locked) plan.locked.push(item);
        else plan.change.push(item);
    }
    return plan;
}
