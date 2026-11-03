// node --test "tests/*.test.mjs"
// Plan 023: custom blocks in the state store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStateStore } from "../src/state/store.js";
import { createCustomModule } from "../src/state/modules/custom/index.js";
import { parseCustomBlocks, joinCustomRead, customReadPart } from "../src/state/modules/custom/parse.js";
import { renderWorkerNotes } from "../src/state/modules/stats/worker.js";
import { normalizeCustomBlock, applyCustom, customBlockDue, customTagsToHide, customTagsToKeep } from "../src/state/modules/custom/model.js";
import { customInfoSections, customInfoTag } from "../src/state/modules/custom/render.js";
import { stripBlocksForModel } from "../src/engine/hideBlocks.js";
import { parseSheet } from "../src/state/modules/stats/parse.js";

const trust = normalizeCustomBlock({ id: "blk_1", label: "Trust", tag: "Trust", kind: "fields", memory: "info" });
const quest = normalizeCustomBlock({ id: "blk_2", label: "Quest Log", tag: "Quest_Log", memory: "info" });
const reply = blocks => `Prose here.\n<Blocks>\n${blocks}\n</Blocks>`;

// ── Settings ─────────────────────────────────────────────────────────────

test("settings: a block saved before plan 023 keeps working as it did", () => {
    const b = normalizeCustomBlock({ id: "blk_0", label: "Old", tag: "Old", content: "x" });
    assert.equal(b.kind, "text");
    assert.equal(b.memory, "fresh");
    assert.equal(b.writer, "story");
    assert.equal(b.when, "every");
    assert.deepEqual(b.tags, []);
});

test("settings: 'only when it changes' needs the story to see the block; N stays in 2–20", () => {
    assert.equal(normalizeCustomBlock({ memory: "fresh", when: "changes" }).when, "every");
    assert.equal(normalizeCustomBlock({ memory: "info", when: "changes" }).when, "changes");
    assert.equal(normalizeCustomBlock({ when: "everyN", everyN: 1 }).everyN, 2);
    assert.equal(normalizeCustomBlock({ when: "everyN", everyN: 99 }).everyN, 20);
    assert.equal(normalizeCustomBlock({ when: "everyN", everyN: "x" }).everyN, 3);
});

// ── Reading a reply ──────────────────────────────────────────────────────

test("parse: fields read like the Sheet, free text as the last copy", () => {
    const p = parseCustomBlocks(reply("<Trust>\n[Start from <Trust_Now>.]\nTrust: 45/100 (+5 she kept her word) | Mood: wary\n</Trust>\n<Quest_Log>\n1. Find the key\n2. Open the gate\n</Quest_Log>"), [trust, quest]);
    assert.deepEqual(p.blocks.blk_1.fields.map(f => [f.label, f.text]), [["Trust", "45/100"], ["Mood", "wary"]]);
    assert.equal(p.blocks.blk_2.text, "1. Find the key\n2. Open the gate");
    assert.equal(parseCustomBlocks("No blocks.", [trust, quest]), null);
    assert.equal(parseCustomBlocks(reply("<Trust>\nTrust: [0-100]/100 [(±N reason) or (=)]\n</Trust>"), [trust]), null, "an unfilled template is nothing");
});

test("parse: a renamed block still reads its old tag; the new tag comes first", () => {
    const renamed = normalizeCustomBlock({ ...quest, tag: "Quests", tags: ["Quest_Log"] });
    assert.equal(parseCustomBlocks(reply("<Quest_Log>\nold name\n</Quest_Log>"), [renamed]).blocks.blk_2.text, "old name");
    assert.equal(parseCustomBlocks(reply("<Quest_Log>\nold</Quest_Log>\n<Quests>\nnew\n</Quests>"), [renamed]).blocks.blk_2.text, "new");
});

test("parse: the Sheet reads as before", () => {
    const p = parseSheet("<Character_Sheet>\nHP: 80/100 (-20 the fall) | Gold: 120\n</Character_Sheet>");
    assert.deepEqual(p.fields.map(f => f.text), ["80/100", "120"]);
});

// ── Keeping the values ───────────────────────────────────────────────────

test("model: a field left out keeps its value, a bare change moves it, text is replaced", () => {
    let s = applyCustom(null, parseCustomBlocks(reply("<Trust>\nTrust: 40/100 | Mood: wary\n</Trust>\n<Quest_Log>\nFind the key\n</Quest_Log>"), [trust, quest]), { seq: 1 }).state;
    const r = applyCustom(s, parseCustomBlocks(reply("<Trust>\nTrust: +5 she kept her word\n</Trust>\n<Quest_Log>\nOpen the gate\n</Quest_Log>"), [trust, quest]), { seq: 2 });
    s = r.state;
    assert.equal(s.blocks.blk_1.fields.trust.text, "45/100");
    assert.equal(s.blocks.blk_1.fields.mood.text, "wary", "Mood was left out, so it stays");
    assert.equal(s.blocks.blk_2.text, "Open the gate");
    assert.deepEqual(r.applied.map(a => [a.block, a.after]), [["blk_1", "45/100"], ["blk_2", "Open the gate"]]);
});

test("model: the user's edit can clear a field or the text; a block that changed kind starts over", () => {
    let s = applyCustom(null, parseCustomBlocks(reply("<Trust>\nTrust: 40/100 | Mood: wary\n</Trust>\n<Quest_Log>\nFind the key\n</Quest_Log>"), [trust, quest]), { seq: 1 }).state;
    s = applyCustom(s, { blocks: { blk_1: { kind: "fields", fields: [{ key: "mood", label: "Mood", remove: true }] }, blk_2: { kind: "text", clear: true } } }, { seq: 2 }).state;
    assert.equal(s.blocks.blk_1.fields.mood, undefined);
    assert.equal(s.blocks.blk_2.text, "");
    s = applyCustom(s, { blocks: { blk_1: { kind: "text", text: "now prose" } } }, { seq: 3 }).state;
    assert.deepEqual(s.blocks.blk_1, { kind: "text", text: "now prose", seq: 3 });
});

// ── When it is asked for ─────────────────────────────────────────────────

test("due: every reply, every N replies, and never in the reply when Chomusuke writes it", () => {
    assert.equal(customBlockDue(normalizeCustomBlock({}), 0), true);
    const n3 = normalizeCustomBlock({ when: "everyN", everyN: 3 });
    assert.equal(customBlockDue(n3, null), true, "never written yet");
    // Before the reply: written in reply 1, so replies 2 and 3 are coming; 4 is due.
    assert.equal(customBlockDue(n3, 0), false, "asked for reply 2");
    assert.equal(customBlockDue(n3, 1), false, "asked for reply 3");
    assert.equal(customBlockDue(n3, 2), true, "asked for reply 4: every 3rd");
    // After the reply (Chomusuke): the reply just in is already counted.
    assert.equal(customBlockDue(n3, 2, { afterReply: true }), false);
    assert.equal(customBlockDue(n3, 3, { afterReply: true }), true);
    const chomu = normalizeCustomBlock({ writer: "chomusuke" });
    assert.equal(customBlockDue(chomu, 5), false, "the story is never asked for it");
    assert.equal(customBlockDue(chomu, 0, { afterReply: true }), true);
});

test("chomusuke: its blocks sit after the reply in one entry; the store reads both", () => {
    const joined = joinCustomRead(reply("<Quest_Log>\nFind the key\n</Quest_Log>"), "<Trust>\nTrust: 45/100\n</Trust>");
    assert.equal(customReadPart(joined), "<Trust>\nTrust: 45/100\n</Trust>");
    assert.equal(customReadPart("a reply with no read"), "");
    const p = parseCustomBlocks(joined, [trust, quest]);
    assert.equal(p.blocks.blk_1.fields[0].text, "45/100");
    assert.equal(p.blocks.blk_2.text, "Find the key");
});

test("chomusuke: its notes carry the custom blocks' values from before the reply", () => {
    const notes = renderWorkerNotes({ bonds: "Anno: Trust: 40/100", extra: ["<Trust_Now>\nTrust: 40/100\n</Trust_Now>", ""] });
    assert.equal(notes, "<Current_Info>\n<Bonds_Now>\nAnno: Trust: 40/100\n</Bonds_Now>\n\n<Trust_Now>\nTrust: 40/100\n</Trust_Now>\n</Current_Info>");
    assert.equal(renderWorkerNotes({}), "");
});

// ── What the story reads ─────────────────────────────────────────────────

test("current info: kept values as <Tag_Now>, free text as <Last_Tag> with its note; only 'Last one in Current Info'", () => {
    const fresh = normalizeCustomBlock({ id: "blk_3", tag: "Mood_Ring", memory: "fresh" });
    const s = applyCustom(null, parseCustomBlocks(reply("<Trust>\nTrust: 40/100\n</Trust>\n<Quest_Log>\nFind the key\n</Quest_Log>\n<Mood_Ring>\nblue\n</Mood_Ring>"), [trust, quest, fresh]), { seq: 1 }).state;
    const out = customInfoSections(s, [trust, quest, fresh]);
    assert.equal(out.length, 2);
    assert.equal(out[0], "<Trust_Now>\nTrust: 40/100\n</Trust_Now>");
    assert.match(out[1], /^<Last_Quest_Log>\n<!-- The last copy of this block\.[^\n]*-->\nFind the key\n<\/Last_Quest_Log>$/);
    assert.equal(customInfoTag(trust), "Trust_Now");
    assert.deepEqual(customInfoSections(null, [trust]), [], "nothing on file, no section");
});

test("hiding: a block's own memory choice decides, with hiding on or off", () => {
    const chat = normalizeCustomBlock({ id: "blk_4", tag: "Diary", memory: "chat" });
    const blocks = [trust, quest, chat];
    assert.deepEqual(customTagsToHide(blocks), ["Trust", "Quest_Log"]);
    assert.deepEqual(customTagsToKeep(blocks), ["Diary"]);
    const text = reply("<Bonds>\nAnno: Trust: 40/100\n</Bonds>\n<Diary>\nDay one.\n</Diary>\n<Trust>\nTrust: 40/100\n</Trust>");
    // Hiding on: the envelope goes, the Diary stays at the end.
    assert.equal(stripBlocksForModel(text, ["Bonds", "Trust", "Quest_Log", "Diary"], { keep: ["Diary"] }), "Prose here.\n\n<Diary>\nDay one.\n</Diary>");
    // Hiding off: only the custom blocks that hide themselves go.
    assert.equal(stripBlocksForModel(text, customTagsToHide(blocks), { whole: false }), "Prose here.\n<Blocks>\n<Bonds>\nAnno: Trust: 40/100\n</Bonds>\n<Diary>\nDay one.\n</Diary>\n\n</Blocks>");
    // Nothing kept: as before.
    assert.equal(stripBlocksForModel(text, ["Bonds", "Trust", "Diary"]), "Prose here.");
});

// ── In the store ─────────────────────────────────────────────────────────

function env(blocks) {
    const e = { chat: [], meta: {}, blocks };
    e.store = createStateStore({
        adapter: { getChat: () => e.chat, getMeta: () => e.meta, saveMeta: () => {}, saveChat: () => {}, getUserNames: () => ["Kazuma"] },
        modules: { custom: createCustomModule(() => e.blocks) }
    });
    return e;
}
const ai = text => ({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} });

test("store: a swipe undoes a custom block, swiping back brings it back; a reply without it changes nothing", () => {
    const e = env([trust]);
    e.chat.push(ai(reply("<Trust>\nTrust: 40/100\n</Trust>")));
    e.store.recordMessage(0);
    e.chat.push({ is_user: true, mes: "hi", extra: {} });
    e.chat.push(ai(reply("<Trust>\nTrust: 55/100\n</Trust>")));
    e.store.recordMessage(2);
    assert.equal(e.store.getState("custom").blocks.blk_1.fields.trust.text, "55/100");

    const msg = e.chat[2];
    msg.swipes.push("No block this time.");
    msg.swipe_id = 1;
    msg.mes = msg.swipes[1];
    e.store.onSwiped(2);
    assert.equal(e.store.getState("custom").blocks.blk_1.fields.trust.text, "40/100", "the other swipe left it out");

    msg.swipe_id = 0;
    msg.mes = msg.swipes[0];
    e.store.onSwiped(2);
    assert.equal(e.store.getState("custom").blocks.blk_1.fields.trust.text, "55/100");
});

test("store: a block added later is read from the replies after it is set up", () => {
    const e = env([]);
    e.chat.push(ai(reply("<Trust>\nTrust: 40/100\n</Trust>")));
    e.store.recordMessage(0);
    assert.equal(e.store.hasState("custom"), false, "no such block yet");
    e.blocks.push(trust);
    e.chat.push(ai(reply("<Trust>\nTrust: 50/100\n</Trust>")));
    e.store.recordMessage(1);
    assert.equal(e.store.getState("custom").blocks.blk_1.fields.trust.text, "50/100");
});
