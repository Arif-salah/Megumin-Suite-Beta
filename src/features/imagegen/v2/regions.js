// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 — looks and outfits sorted by where they sit on the body
// (plan 027). Pure.
//
//   look:   Core | Head | Upper | Lower | Feet
//   outfit:        Head | Upper | Lower | Feet
//
// A model answers with one "Label: tag, tag" line per part. An answer with no
// such lines (older prompts, a weak model) is read as before: one tag list.
// A sorted look also keeps its two old parts (tags = Core + Head, body =
// Upper + Lower + Feet), so everything that reads those keeps working.
// ────────────────────────────────────────────────────────────────────────────

import { splitTags, stripCountTags, dedupeTags } from "./resolve.js";

export const LOOK_REGIONS = ["core", "head", "upper", "lower", "feet"];
export const OUTFIT_REGIONS = ["head", "upper", "lower", "feet"];

const LABEL = /^\s*[-*•]?\s*\**\s*(core|head|upper|lower|feet)\s*\**\s*:\s*\**\s*(.*)$/i;

const clean = s => dedupeTags(stripCountTags(splitTags(String(s || "").replace(/^["'\s]+|["'\s]+$/g, "")).join(", ")));

/**
 * The "Label: tags" lines of an answer, or null when it has none.
 * Lines without a label follow the line above them; a label written twice
 * keeps its first line.
 * @returns {Record<string, string> | null}
 */
export function parseRegionLines(body, regions = LOOK_REGIONS) {
    const lines = String(body || "").split(/\r?\n/);
    if (!lines.some(l => LABEL.test(l))) return null;
    const out = Object.fromEntries(regions.map(r => [r, ""]));
    const seen = new Set();
    let current = null;
    for (const line of lines) {
        const m = line.match(LABEL);
        if (m) {
            const r = m[1].toLowerCase();
            current = regions.includes(r) && !seen.has(r) ? r : null;
            if (current) { seen.add(current); out[current] = m[2]; }
            continue;
        }
        if (current && line.trim()) out[current] = [out[current], line].filter(s => s.trim()).join(", ");
    }
    for (const r of regions) out[r] = clean(out[r]);
    // A tag the model put on two lines stays on the first.
    const taken = new Set();
    for (const r of regions) {
        out[r] = splitTags(out[r]).filter(t => {
            const k = t.toLowerCase();
            if (taken.has(k)) return false;
            taken.add(k);
            return true;
        }).join(", ");
    }
    return regions.some(r => out[r]) ? out : null;
}

/** Every tag of a sorted look or outfit, in body order. */
export function joinRegions(regions, order = LOOK_REGIONS) {
    if (!regions) return "";
    return order.map(r => String(regions[r] || "").trim()).filter(Boolean).join(", ");
}

/** The old two parts of a sorted look: what shows in any shot, and the body. */
export function regionsToParts(regions) {
    return {
        always: joinRegions(regions, ["core", "head"]),
        body: joinRegions(regions, ["upper", "lower", "feet"])
    };
}

/** Does a stored look have its parts sorted? */
export const isSorted = entry => Boolean(entry && entry.regions && LOOK_REGIONS.some(r => String(entry.regions[r] || "").trim()));

/**
 * A model's sorting of an old look, held to the look's own tags: a tag it
 * made up is dropped, a tag it left out goes in Core. null = nothing usable.
 */
export function holdToOriginal(sorted, originalTags) {
    if (!sorted) return null;
    const original = splitTags(originalTags);
    const want = new Map(original.map(t => [t.toLowerCase(), t]));
    const used = new Set();
    const out = {};
    for (const r of LOOK_REGIONS) {
        out[r] = splitTags(sorted[r] || "").filter(t => {
            const k = t.toLowerCase();
            if (!want.has(k) || used.has(k)) return false;
            used.add(k);
            return true;
        }).map(t => want.get(t.toLowerCase())).join(", ");
    }
    const missed = original.filter(t => !used.has(t.toLowerCase()));
    if (missed.length) out.core = [out.core, ...missed].filter(Boolean).join(", ");
    return used.size ? out : null;
}
