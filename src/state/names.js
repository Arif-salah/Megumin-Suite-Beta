// ────────────────────────────────────────────────────────────────────────────
// One name finder for every module (plan 022): World State's cast, Bonds and
// Image V2's cast all find a character the same way.
//
//   people: { key: { name, aliases? } }   (any record with a name)
//
// whoIs, in this order, stopping at the first step that finds anyone:
//   1. the name, a nickname, or a name in brackets ("Dominic" for
//      "Dom (Dominic Morin)"), possessives dropped ("Chloe's")
//   2. the one character whose name starts this one or is started by it, in
//      whole words ("Matt" ↔ "Matt Reyes", "Resha Helios" ↔ "Resha")
//   3. only with { nickname: true }: the one first name this starts ("Cat"
//      for Cathleen), for names we know are in the scene
// Two characters at one step → nobody: a name is never guessed between two.
// A surname alone never picks anyone here ("Emma" is not "Uncle Emma"); it
// only counts in namedIn, where it brings someone's details into the prompt.
// Pure: runs under plain node.
// ────────────────────────────────────────────────────────────────────────────

/** Lowercase words, possessives dropped, every other mark a space. */
export function nameWords(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/[’‘`´]/g, "'")
        .replace(/(\p{L})'s\b/gu, "$1")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

// Every full spelling of a character: name, nicknames, the name with and
// without its brackets, and the name in brackets.
function formsOf(rec) {
    const out = new Set();
    for (const raw of [rec && rec.name, ...((rec && rec.aliases) || [])]) {
        const s = String(raw || "");
        for (const f of [s, s.replace(/\([^)]*\)/g, " "), ...(s.match(/\(([^)]+)\)/g) || []).map(x => x.slice(1, -1))]) {
            const w = nameWords(f);
            if (w) out.add(w);
        }
    }
    return [...out];
}

// "resha" starts "resha helios" in whole words (either way round).
function prefixOf(a, b) {
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.length > 2 && short !== long && long.startsWith(short + " ");
}

// The last word of a name with two or more words, brackets left out.
function surnameOf(name) {
    const w = nameWords(String(name || "").replace(/\([^)]*\)/g, " ")).split(" ").filter(Boolean);
    const last = w.length >= 2 ? w[w.length - 1] : "";
    return last.length > 2 ? last : "";
}

function only(hits) {
    const u = [...new Set(hits)];
    return u.length === 1 ? u[0] : u.length ? undefined : null;
}

/**
 * The key of the character a name refers to, or null.
 * @param {Record<string, {name: string, aliases?: string[]}>} people
 * @param {string} name
 * @param {{ nickname?: boolean, exactOnly?: boolean }} [opts]
 * @returns {string|null}
 */
export function whoIs(people, name, opts = {}) {
    const n = nameWords(name);
    if (!n || !people) return null;
    const entries = Object.entries(people).filter(([, r]) => r && r.name);
    const forms = entries.map(([k, r]) => [k, formsOf(r)]);
    const steps = [
        () => forms.filter(([, f]) => f.includes(n)).map(([k]) => k),
        () => forms.filter(([, f]) => f.some(x => prefixOf(x, n))).map(([k]) => k),
        () => !opts.nickname || n.length < 3 || n.includes(" ") ? [] : entries.filter(([, r]) => {
            const first = nameWords(r.name).split(" ")[0];
            return first !== n && first.startsWith(n);
        }).map(([k]) => k)
    ];
    for (const step of opts.exactOnly ? steps.slice(0, 1) : steps) {
        const hit = only(step());
        if (hit === undefined) return null;   // two people fit: don't guess
        if (hit) return hit;
    }
    return null;
}

/**
 * The characters a text names: a full spelling or a first name, and a surname
 * when only one character has it ("Cairns" could be Duncan or Cathleen).
 * @param {string} text
 * @param {Record<string, {name: string, aliases?: string[]}>} people
 * @returns {string[]} keys, in the order of `people`
 */
export function namedIn(text, people) {
    const t = ` ${nameWords(text)} `;
    if (t.length <= 2) return [];
    const entries = Object.entries(people || {}).filter(([, r]) => r && r.name);
    const surnames = {};
    for (const [k, r] of entries) {
        const sn = surnameOf(r.name);
        if (sn) (surnames[sn] = surnames[sn] || []).push(k);
    }
    const out = [];
    for (const [k, r] of entries) {
        // A whole name counts from two letters ("Jo"); part of one from three.
        const names = new Set();
        for (const f of formsOf(r)) {
            if (f.length > 1) names.add(f);
            const first = f.split(" ")[0];
            if (first.length > 2) names.add(first);
        }
        const sn = surnameOf(r.name);
        if (sn && surnames[sn].length === 1) names.add(sn);
        if ([...names].some(x => t.includes(` ${x} `))) out.push(k);
    }
    return out;
}

/**
 * The simplest way to write a character that finds them and nobody else:
 * their first name, else their full name, else a nickname. "Lona", but
 * "Matt Reyes" when there is also a Matt Cole.
 * @returns {string} as written in their name or nickname
 */
export function shortName(people, key) {
    const rec = people && people[key];
    if (!rec || !rec.name) return "";
    const plain = s => String(s || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    const full = plain(rec.name);
    const tries = [full.split(" ")[0], full, ...(rec.aliases || []).map(plain), rec.name];
    return tries.find(x => x && x.length > 2 && whoIs(people, x) === key) || rec.name;
}
