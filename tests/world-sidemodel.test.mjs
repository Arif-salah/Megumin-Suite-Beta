// node --test "tests/*.test.mjs"
// Phase 4: side-model extraction (prompt D) and how its results are filed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStateStore } from "../src/state/store.js";
import { worldModule } from "../src/state/modules/world/index.js";
import { parseWorldBlocks } from "../src/state/modules/world/parse.js";
import { findCast } from "../src/state/modules/world/model.js";
import { renderWorldExtractPrompt } from "../src/state/modules/world/render.js";

const OFF_FRAME = /\b(extension|plugin|app|ledger|database|tracker|interface|record[- ]?keep\w*|keeps? (the )?records?)\b/i;

test("prompt D (update): notes, exchange, reader wording, update template", () => {
    const d = renderWorldExtractPrompt({
        notes: "<Current_World_State>\nLoc: Tavern\n</Current_World_State>",
        exchange: "Kazuma: I take off my cape.\n\nAqua: She laughs.",
        mode: "update"
    });
    assert.equal(d.tag, "World_Update");
    assert.equal(d.prefill, "<World_Update>\n");
    assert.match(d.user, /^<Current_World_State>\nLoc: Tavern/);
    assert.match(d.user, /<Latest_Exchange>\nKazuma: I take off my cape\.\n\nAqua: She laughs\.\n<\/Latest_Exchange>/);
    assert.match(d.user, /record ONLY what the latest exchange changed/);
    assert.doesNotMatch(d.user, /your reply|your prose/, "the clerk did not write the reply");
    assert.match(d.user, /Output ONLY the <World_Update> block/);
    assert.match(d.user, /<World_Update>\n\[change lines, or: No changes\]\n<\/World_Update>/);
    for (const t of [d.system, d.user]) assert.doesNotMatch(t, OFF_FRAME);
});

test("prompt D (bootstrap): placeholder notes and the full template", () => {
    const d = renderWorldExtractPrompt({ notes: "", exchange: "Aqua: Hi.", mode: "bootstrap" });
    assert.equal(d.tag, "World_State");
    assert.match(d.user, /Nothing has been noted about this story yet/);
    assert.match(d.user, /at the END of the latest exchange/);
    assert.match(d.user, /\+ \[NPC Name\]/);
});

test("an answer without its opening tag parses once the prefill is put back", () => {
    const d = renderWorldExtractPrompt({ notes: "", exchange: "x", mode: "update" });
    const answer = "Aqua.Outfit: towel\n</World_Update>";
    assert.equal(parseWorldBlocks(answer), null);
    const p = parseWorldBlocks(d.prefill + answer);
    assert.equal(p.changes[0].value, "towel");
});

// ── Filing results ───────────────────────────────────────────────────────

const U = b => `<World_Update>\n${b}\n</World_Update>`;
const S = b => `<World_State>\n${b}\n</World_State>`;
const ai = text => ({ is_user: false, mes: text, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} });

function env() {
    const e = { chat: [], meta: {} };
    e.store = createStateStore({
        adapter: { getChat: () => e.chat, getMeta: () => e.meta, saveMeta() {}, saveChat() {}, getUserNames: () => [] },
        modules: { world: worldModule }
    });
    return e;
}

test("a side-model result lands under its own swipe even after the user swiped away", () => {
    const e = env();
    e.chat.push(ai(S("Loc: Tavern\n+ Aqua\nAqua.Outfit: blue dress")));
    e.store.recordMessage(0, { expect: true });
    e.chat.push(ai("She wraps herself in a towel."));        // side-model mode: no block
    const m = e.chat[1];
    e.store.stamp(m);
    // The read of swipe 0 is still running when the user swipes to a new reply.
    m.swipes.push("She puts on pajamas."); m.swipe_info.push({ extra: structuredClone(m.extra) });
    m.swipe_id = 1; m.mes = m.swipes[1]; m.extra = structuredClone(m.extra);
    e.store.onSwiped(1);
    e.store.recordMessage(1, { source: "sidemodel", expect: true, swipe: 0, parsed: parseWorldBlocks(U("Aqua.Outfit: towel")) });
    assert.equal(findCast(e.store.getState("world"), "Aqua").fields.outfit, "blue dress", "swipe 1 is showing, not swipe 0");
    e.store.recordMessage(1, { source: "sidemodel", expect: true, swipe: 1, parsed: parseWorldBlocks(U("Aqua.Outfit: pajamas")) });
    assert.equal(findCast(e.store.getState("world"), "Aqua").fields.outfit, "pajamas");
    m.swipe_id = 0; m.mes = m.swipes[0]; e.store.onSwiped(1);
    assert.equal(findCast(e.store.getState("world"), "Aqua").fields.outfit, "towel");
});

test("a failed side-model read is recorded as missing, and a re-read replaces it", () => {
    const e = env();
    e.chat.push(ai(S("Loc: Tavern\n+ Aqua\nAqua.Outfit: blue dress")));
    e.store.recordMessage(0, { expect: true });
    e.chat.push(ai("She wraps herself in a towel."));
    e.store.recordMessage(1, { source: "sidemodel", expect: true, parsed: null });
    const uid = e.chat[1].extra.megumin_uid;
    assert.equal(e.store.getEntryFor("world", uid, 0).missing, true);
    e.store.recordMessage(1, { source: "sidemodel", expect: true, parsed: parseWorldBlocks(U("Aqua.Outfit: towel")) });
    const entry = e.store.getEntryFor("world", uid, 0);
    assert.equal(entry.missing, false);
    assert.equal(entry.source, "sidemodel");
    assert.equal(e.store.listEntries("world").filter(r => r.entry.uid === uid).length, 1);
    assert.equal(findCast(e.store.getState("world"), "Aqua").fields.outfit, "towel");
});

test("the side model's notes are the state BEFORE the reply it reads", () => {
    const e = env();
    e.chat.push(ai(S("Loc: Tavern\n+ Aqua\nAqua.Outfit: blue dress")));
    e.store.recordMessage(0, { expect: true });
    e.chat.push(ai("x"));
    e.store.recordMessage(1, { source: "sidemodel", expect: true, parsed: parseWorldBlocks(U("Aqua.Outfit: towel")) });
    const seq = e.chat[1].extra.megumin_seq;
    // A re-read of message 1 must start from blue dress, not from its own towel.
    assert.equal(findCast(e.store.getStateAt("world", seq - 0.5), "Aqua").fields.outfit, "blue dress");
});
