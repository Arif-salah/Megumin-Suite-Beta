// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 — the image cast: everyone who can be written as @Name, with the
// look and outfit that @Name turns into.
//
//   look    ← the stored look (Image Gen tab), else the NPC Bank's Image Tags
//   outfit  ← World State (current for those present, last known for the rest)
//   who is present / nicknames ← World State
//
// Pure: the caller hands in the stored looks, the World State and the NPC Bank.
// ────────────────────────────────────────────────────────────────────────────

import { splitLookTags, sexOf } from "./lookParts.js";

const key = s => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, "").replace(/\s+/g, " ").trim();

// A stored look in two parts. Looks saved before the split (one tag list) are
// split on the fly; nothing is written back until the user edits them.
function lookParts(entry) {
    if (typeof entry.body === "string") return { always: String(entry.tags || "").trim(), body: entry.body.trim() };
    return splitLookTags(entry.tags || "");
}

/**
 * @param {{
 *   looks?: Record<string, { tags?: string, natural?: string, aliases?: string[] }>,
 *   world?: object|null,           // World State (state store shape) or null
 *   npcs?: Array<{ name: string, imageTags?: string }>,
 *   userName?: string,             // persona name
 *   recentText?: string            // for "mentioned" (absent but just named)
 * }} src
 * @returns {Array<{ name: string, aliases: string[], look: string, body: string, sex: string, lookNatural: string,
 *                   outfit: string, isPc: boolean, inScene: boolean, mentioned: boolean, lookSource: string }>}
 *   look = the always part; body = build and proportions (full-body shots only)
 */
export function buildImageCast({ looks = {}, world = null, npcs = [], userName = "", recentText = "" } = {}) {
    const members = [];
    const find = name => {
        const k = key(name);
        if (!k) return null;
        return members.find(m => key(m.name) === k || m.aliases.some(a => key(a) === k)) || null;
    };
    const add = m => { members.push(m); return m; };
    const blank = (name, extra = {}) => ({
        name, aliases: [], look: "", body: "", sex: "", lookNatural: "", outfit: "",
        isPc: false, inScene: false, mentioned: false, lookSource: "", ...extra
    });

    // 1. The player.
    const pcName = (world && world.pc && world.pc.name) || userName || "";
    if (pcName) {
        add(blank(pcName, {
            isPc: true,
            inScene: true,
            outfit: (world && world.pc && world.pc.fields && world.pc.fields.outfit) || "",
            aliases: userName && key(userName) !== key(pcName) ? [userName] : []
        }));
    }

    // 2. Everyone World State knows, present or not.
    for (const c of Object.values((world && world.cast) || {})) {
        if (!c || !c.name || find(c.name)) continue;
        add(blank(c.name, {
            aliases: [...(c.aliases || [])],
            inScene: Boolean(c.present),
            outfit: (c.fields && c.fields.outfit) || ""
        }));
    }

    // 3. Stored looks: attach to a known member, or add them as absent.
    for (const [name, entry] of Object.entries(looks || {})) {
        if (!entry) continue;
        const lookName = name === "{{user}}" ? pcName : name;
        if (!lookName) continue;
        let m = find(lookName) || (entry.aliases || []).map(find).find(Boolean) || null;
        if (!m) m = add(blank(lookName));
        const parts = lookParts(entry);
        if (parts.always || parts.body || String(entry.natural || "").trim()) {
            m.look = parts.always;
            m.body = parts.body;
            m.lookNatural = String(entry.natural || "").trim();
            m.lookSource = entry.source || "manual";
        }
        for (const a of entry.aliases || []) {
            if (a && key(a) !== key(m.name) && !m.aliases.some(x => key(x) === key(a))) m.aliases.push(a);
        }
    }

    // 4. NPC Bank Image Tags where there is no stored look.
    for (const n of npcs || []) {
        if (!n || !n.name) continue;
        const tags = String(n.imageTags || "").trim();
        if (!tags) continue;
        const m = find(n.name);
        if (m && !m.look && !m.body && !m.lookNatural) {
            const parts = splitLookTags(tags);
            m.look = parts.always;
            m.body = parts.body;
            m.lookSource = "npc";
        }
    }

    for (const m of members) m.sex = sexOf(`${m.look}, ${m.body}`);

    // 5. Absent characters named in the recent text may be about to appear.
    const text = " " + key(recentText) + " ";
    for (const m of members) {
        if (m.isPc || m.inScene) continue;
        m.mentioned = [m.name, ...m.aliases].some(n => key(n) && text.includes(" " + key(n) + " "));
    }
    return members;
}
