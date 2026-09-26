// ────────────────────────────────────────────────────────────────────────────
// World State model.
//
// The state itself and the one function that changes it. Pure: the store
// replays journal entries through `applyWorldChanges` to get the state at any
// message, so the same changes must always produce the same result.
//
// A character who leaves the scene is NOT deleted. `present` goes false and
// their fields stay, so when they come back 90 messages later their last
// outfit and agenda are still known.
// ────────────────────────────────────────────────────────────────────────────

import { PC, nameKey } from "./parse.js";

const LISTS = ["threads", "seeds", "timers"];

export function emptyWorld() {
    return {
        scene: { time: "", location: "", weather: "" },
        pc: { name: "", fields: {} },
        cast: {},          // nameKey → { name, present, fields, offscreen, lastSeenSeq }
        threads: [],
        seeds: [],
        timers: [],
        arcPhase: "",
        scenePhase: ""
    };
}

const SCENE_LABEL = { time: "Time", location: "Loc", weather: "Wx" };
const PHASE_LABEL = { arcPhase: "Arc", scenePhase: "Scene" };
const LIST_LABEL = { threads: "Thread", seeds: "Seed", timers: "Timer" };

export function fieldLabel(field) {
    return String(field || "").replace(/\b\p{L}/gu, c => c.toUpperCase());
}

function normText(s) {
    return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

// "copied as written" is a hope, not a guarantee: a removal also matches when
// one text contains the other, as long as both are long enough to mean it.
function findListItem(list, value) {
    const v = normText(value);
    if (!v) return -1;
    let i = list.findIndex(x => normText(x) === v);
    if (i >= 0) return i;
    if (v.length < 12) return -1;
    const hits = list
        .map((x, idx) => ({ idx, n: normText(x) }))
        .filter(({ n }) => n.length >= 12 && (n.includes(v) || v.includes(n)));
    return hits.length === 1 ? hits[0].idx : -1;
}

/**
 * @param {object} ctx { userNames?: string[] } — persona names that mean the PC
 */
function isPcName(state, who, ctx) {
    if (who === PC) return true;
    const k = nameKey(who);
    if (!k) return false;
    if (k === "{{user}}" || k === "user" || k === "pc" || k === "player") return true;
    if (state.pc.name && k === nameKey(state.pc.name)) return true;
    return (ctx.userNames || []).some(n => n && nameKey(n) === k);
}

function castEntry(state, name, seq, createPresent) {
    const k = nameKey(name);
    if (!state.cast[k]) {
        state.cast[k] = { name, present: createPresent, fields: {}, offscreen: "", lastSeenSeq: seq };
        return { entry: state.cast[k], created: true };
    }
    return { entry: state.cast[k], created: false };
}

// Longest known cast name that starts the text: "Wiz restocking her shop" → Wiz.
function matchCastPrefix(state, text) {
    const t = nameKey(text);
    let best = null;
    for (const c of Object.values(state.cast)) {
        const k = nameKey(c.name);
        if (k && (t === k || t.startsWith(k + " ")) && (!best || k.length > nameKey(best.name).length)) best = c;
    }
    return best;
}

/**
 * Applies one parsed reply to a state.
 * @param {object} prev     world state (not mutated)
 * @param {{kind: string, changes: object[]}} parsed
 * @param {{seq?: number, userNames?: string[]}} [ctx]
 * @returns {{ state: object, applied: Array<{label: string, before: string, after: string}>, notes: string[] }}
 */
export function applyWorldChanges(prev, parsed, ctx = {}) {
    const state = structuredClone(prev || emptyWorld());
    const applied = [];
    const notes = [];
    const seq = typeof ctx.seq === "number" ? ctx.seq : 0;
    if (!parsed || !Array.isArray(parsed.changes)) return { state, applied, notes };

    const note = (label, before, after) => {
        if (before !== after) applied.push({ label, before: before || "", after: after || "" });
    };

    // A full snapshot describes who is present now: everyone else has left.
    if (parsed.kind === "snapshot") {
        for (const c of Object.values(state.cast)) c.present = false;
    }

    // Items listed under a section header replace that list as a whole.
    const listItems = {};

    const pcName = () => state.pc.name || "{{user}}";

    for (const ch of parsed.changes) {
        switch (ch.type) {
            case "scene": {
                const before = state.scene[ch.key] || "";
                state.scene[ch.key] = ch.value;
                note(SCENE_LABEL[ch.key] || ch.key, before, ch.value);
                break;
            }
            case "phase": {
                const before = state[ch.key] || "";
                state[ch.key] = ch.value;
                note(PHASE_LABEL[ch.key] || ch.key, before, ch.value);
                break;
            }
            case "pcname": {
                if (!state.pc.name && ch.name) state.pc.name = ch.name;
                break;
            }
            case "field": {
                if (isPcName(state, ch.who, ctx)) {
                    const before = state.pc.fields[ch.field] || "";
                    state.pc.fields[ch.field] = ch.value;
                    note(`${pcName()} · ${fieldLabel(ch.field)}`, before, ch.value);
                    break;
                }
                const { entry, created } = castEntry(state, ch.who, seq, true);
                if (created) {
                    notes.push(`${entry.name} had no "+ ${entry.name}" line; treated as entering the scene.`);
                    note(`${entry.name} entered`, "", "present");
                } else if (!entry.present) {
                    entry.present = true;
                    entry.offscreen = "";
                    note(`${entry.name} entered`, "", "present");
                }
                entry.lastSeenSeq = seq;
                const before = entry.fields[ch.field] || "";
                entry.fields[ch.field] = ch.value;
                note(`${entry.name} · ${fieldLabel(ch.field)}`, before, ch.value);
                break;
            }
            case "enter": {
                if (isPcName(state, ch.who, ctx)) break;
                const { entry } = castEntry(state, ch.who, seq, false);
                entry.lastSeenSeq = seq;
                if (!entry.present) {
                    entry.present = true;
                    entry.offscreen = "";
                    note(`${entry.name} entered`, "", "present");
                }
                break;
            }
            case "leave": {
                if (isPcName(state, ch.who, ctx)) {
                    notes.push(`Ignored "- ${ch.who}": the player character cannot leave the scene.`);
                    break;
                }
                const { entry } = castEntry(state, ch.who, seq, false);
                const wasPresent = entry.present;
                entry.present = false;
                entry.lastSeenSeq = seq;
                if (ch.where) entry.offscreen = ch.where;
                if (wasPresent) note(`${entry.name} left`, "present", ch.where || "gone");
                break;
            }
            case "offscreen": {
                let entry = null;
                let value = ch.value;
                if (ch.who) {
                    entry = castEntry(state, ch.who, seq, false).entry;
                } else {
                    const hit = matchCastPrefix(state, ch.value);
                    if (hit) {
                        entry = hit;
                        value = ch.value.slice(hit.name.length).replace(/^[\s:=—–-]+/, "").trim() || ch.value;
                    } else {
                        const first = ch.value.split(/\s+/)[0];
                        entry = castEntry(state, first, seq, false).entry;
                        value = ch.value.slice(first.length).trim() || ch.value;
                    }
                }
                if (isPcName(state, entry.name, ctx)) break;
                const before = entry.offscreen || "";
                if (entry.present) {
                    entry.present = false;
                    note(`${entry.name} left`, "present", value);
                }
                entry.offscreen = value;
                note(`${entry.name} · Off-screen`, before, value);
                break;
            }
            case "list": {
                if (!LISTS.includes(ch.list)) break;
                const list = state[ch.list];
                const label = LIST_LABEL[ch.list];
                if (ch.op === "item") {
                    (listItems[ch.list] = listItems[ch.list] || []).push(ch.value);
                } else if (ch.op === "add") {
                    if (findListItem(list, ch.value) < 0) {
                        list.push(ch.value);
                        note(`${label} +`, "", ch.value);
                    }
                } else if (ch.op === "remove") {
                    const i = findListItem(list, ch.value);
                    if (i >= 0) {
                        const [gone] = list.splice(i, 1);
                        note(`${label} −`, gone, "");
                    } else {
                        notes.push(`Could not find ${label.toLowerCase()} to remove: "${ch.value}"`);
                    }
                }
                break;
            }
        }
    }

    for (const [key, items] of Object.entries(listItems)) {
        const deduped = [];
        for (const it of items) if (findListItem(deduped, it) < 0) deduped.push(it);
        const before = state[key].join(" · ");
        state[key] = deduped;
        note(`${LIST_LABEL[key]}s`, before, deduped.join(" · "));
    }

    return { state, applied, notes };
}

/** Everyone currently in the scene, in insertion order. */
export function presentCast(state) {
    return Object.values((state && state.cast) || {}).filter(c => c.present);
}

/** Looks a character up by any spelling of their name. */
export function findCast(state, name) {
    return (state && state.cast && state.cast[nameKey(name)]) || null;
}
