// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 — @Name substitution.
//
// The model writes who is in the shot as @Name; this puts in each character's
// stored look and current outfit, word for word, every time. That is the whole
// point of V2: the ~70% of the prompt that describes the characters never
// passes through the model, so it cannot drift.
//
//   @Aqua          → look, then outfit
//   @Aqua.look     → look only (the model describes clothing that is different
//                    right now: a towel, undressing, soaked…)
//   @Aqua.outfit   → outfit only
//
// Pure: no SillyTavern, no DOM. The caller builds the cast.
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CastMember
 * @property {string}   name
 * @property {string[]} [aliases]   nicknames that also resolve (@Matt → Matthew)
 * @property {string}   [look]      appearance tags ("long blue hair, blue eyes, slender")
 * @property {string}   [lookNatural] appearance as a phrase, for Natural style
 * @property {string}   [outfit]    current outfit (World State text, or outfit tags)
 */

// Count and focus tags belong to the model, which writes them once at the front.
// Inside a stored look they would repeat or land mid-prompt, so they come out.
const COUNT_TAG = /^(?:\d+\+?\s*(?:girls?|boys?|others?|males?|females?)|solo|solo focus|multiple (?:girls|boys|others)|(?:male|female|other) focus|no humans)$/i;

const PART_SYNONYMS = {
    look: "look", looks: "look", appearance: "look", body: "look", face: "look",
    outfit: "outfit", clothes: "outfit", clothing: "outfit", attire: "outfit", wearing: "outfit"
};

const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/** Splits a tag string on commas that are not inside ( ) or [ ] weights. */
export function splitTags(text) {
    const out = [];
    let depth = 0;
    let cur = "";
    for (const ch of String(text || "")) {
        if (ch === "(" || ch === "[" || ch === "{") depth++;
        else if ((ch === ")" || ch === "]" || ch === "}") && depth > 0) depth--;
        if (ch === "," && depth === 0) {
            if (cur.trim()) out.push(cur.trim());
            cur = "";
        } else {
            cur += ch;
        }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

/** A stored look with the count/focus tags taken out. */
export function stripCountTags(look) {
    return splitTags(look).filter(t => !COUNT_TAG.test(t.replace(/^\(|\)$|:[\d.]+\)?$/g, "").trim())).join(", ");
}

/** Keeps the first of each tag (case-insensitive), in order. */
export function dedupeTags(text) {
    const seen = new Set();
    const out = [];
    for (const t of splitTags(text)) {
        const k = norm(t);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(t);
    }
    return out.join(", ");
}

// Every name and nickname, longest first, so "@Lady Darkness" beats "@Lady".
function nameIndex(cast) {
    const entries = [];
    for (const c of cast || []) {
        if (!c || !c.name) continue;
        for (const n of [c.name, ...(c.aliases || [])]) {
            const k = norm(n);
            if (k) entries.push({ key: k, len: k.length, member: c });
        }
    }
    return entries.sort((a, b) => b.len - a.len);
}

const isNameChar = ch => /[\p{L}\p{N}_'-]/u.test(ch || "");

/**
 * Replaces every @Name in an image prompt.
 * @param {string} prompt
 * @param {{ cast: CastMember[], style?: "tags"|"natural" }} opts
 * @returns {{ prompt: string, filled: Array<{name: string, part: string}>, unknown: string[], noLook: string[] }}
 */
export function resolveImagePrompt(prompt, { cast = [], style = "tags" } = {}) {
    const text = String(prompt || "");
    const index = nameIndex(cast);
    const lower = text.toLowerCase();
    const filled = [];
    const unknown = [];
    const noLook = [];
    let out = "";
    let i = 0;

    while (i < text.length) {
        const at = text.indexOf("@", i);
        if (at < 0) { out += text.slice(i); break; }
        out += text.slice(i, at);
        // An @ inside a word (an email address, "user@host") is not a placeholder.
        if (at > 0 && isNameChar(text[at - 1])) { out += "@"; i = at + 1; continue; }

        // The longest known name that starts here and ends on a word boundary.
        let hit = null;
        for (const e of index) {
            const cand = lower.slice(at + 1, at + 1 + e.len).replace(/\s+/g, " ");
            if (cand === e.key && !isNameChar(text[at + 1 + e.len])) { hit = e; break; }
        }

        let end;
        let member = null;
        let displayName;
        if (hit) {
            member = hit.member;
            end = at + 1 + hit.len;
            displayName = member.name;
        } else {
            // Unknown: one word. It becomes the plain word, never a raw "@".
            let j = at + 1;
            while (j < text.length && isNameChar(text[j])) j++;
            if (j === at + 1) { out += "@"; i = at + 1; continue; }
            displayName = text.slice(at + 1, j);
            end = j;
            unknown.push(displayName);
        }

        // Optional .look / .outfit
        let part = "all";
        const suffix = text.slice(end).match(/^\.([A-Za-z]+)/);
        if (suffix && PART_SYNONYMS[suffix[1].toLowerCase()]) {
            part = PART_SYNONYMS[suffix[1].toLowerCase()];
            end += suffix[0].length;
        }

        if (!member) {
            out += displayName;
        } else {
            out += renderMember(member, part, style, noLook);
            filled.push({ name: member.name, part });
        }
        i = end;
    }

    let result = out;
    if (style === "tags") {
        result = dedupeTags(result);
    } else {
        result = result.replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/[ \t]{2,}/g, " ").trim();
    }
    return { prompt: result, filled, unknown, noLook };
}

function renderMember(m, part, style, noLook) {
    const lookTags = stripCountTags(m.look || "");
    const outfit = String(m.outfit || "").trim();
    if (!lookTags && !m.lookNatural && part !== "outfit" && !noLook.includes(m.name)) noLook.push(m.name);

    if (style === "natural") {
        // "Aqua (a slender young woman…, wearing a blue dress) leans on the bar":
        // the description sits in parentheses so the sentence around @Name still
        // reads. Natural-language models give parentheses no weight meaning.
        const desc = String(m.lookNatural || "").trim() || lookTags;
        if (part === "outfit") return outfit ? `wearing ${outfit}` : "";
        const bits = [];
        if (desc) bits.push(desc);
        if (part === "all" && outfit) bits.push(`wearing ${outfit}`);
        return bits.length ? `${m.name} (${bits.join(", ")})` : m.name;
    }

    // Tags: the look and outfit ARE the tags; the name goes nowhere, since an
    // image model draws a character from tags, not from a name it never saw.
    if (part === "look") return lookTags || m.name;
    if (part === "outfit") return outfit;
    const bits = [lookTags, outfit].filter(Boolean);
    return bits.length ? bits.join(", ") : m.name;
}
