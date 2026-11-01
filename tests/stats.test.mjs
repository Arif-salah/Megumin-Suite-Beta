// node --test "tests/*.test.mjs"
// Plan 008: Bonds, Character Sheet, Inner Chatter and Story Tracker in the state store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStateStore } from "../src/state/store.js";
import { parseBonds, parseSheet, parseLatest, parseStatValue } from "../src/state/modules/stats/parse.js";
import { applyBonds, applySheet, pickBondsFor, emptyBonds } from "../src/state/modules/stats/model.js";
import { renderBondsNotes, renderSheetNotes } from "../src/state/modules/stats/render.js";
import { bondsModule, sheetModule, chatterModule, trackerModule } from "../src/state/modules/stats/index.js";

const BONDS_TEMPLATE = `[One line per named NPC present in the scene, plus any NPC whose numbers changed this scene. Nobody else.
- Carry every number forward from the previous Bonds block. Never reset one.
- These are feelings, not bodies. Do not describe clothing, posture or location here.]`;

const reply = (bonds, extra = "") => `Prose here.\n<Blocks>\n<Bonds>\n${bonds}\n</Bonds>${extra}\n</Blocks>`;

// ── Values ───────────────────────────────────────────────────────────────

test("values: meters, numbers, changes, reasons, text, placeholders", () => {
    assert.deepEqual(parseStatValue("45/100 (+5 she liked the gift)"), { text: "45/100", value: 45, max: 100, delta: 5, reason: "she liked the gift" });
    assert.deepEqual(parseStatValue("60/100 (=)"), { text: "60/100", value: 60, max: 100 });
    assert.deepEqual(parseStatValue("120 (+20 reward)"), { text: "120", value: 120, delta: 20, reason: "reward" });
    assert.deepEqual(parseStatValue("+5 kind words"), { text: "", delta: 5, reason: "kind words" });
    assert.deepEqual(parseStatValue("smug"), { text: "smug" });
    assert.deepEqual(parseStatValue("rope, torch x3"), { text: "rope, torch x3" });
    assert.equal(parseStatValue("[0-100]/100 [(±N reason) or (=)]"), null);
    assert.equal(parseStatValue("unchanged"), null);
});

// ── Bonds ────────────────────────────────────────────────────────────────

test("bonds: one line per character; the template's instructions are skipped", () => {
    const p = parseBonds(reply(`${BONDS_TEMPLATE}\n\nAnno: Mood: smug | Affection: 45/100 (+5 gift) | Trust: 60/100 (=)\n**Matt "Matty"**: Mood: flustered | Affection: 30/100 (=)`));
    assert.equal(p.people.length, 2);
    assert.equal(p.people[0].name, "Anno");
    assert.deepEqual(p.people[0].fields.map(f => [f.label, f.text]), [["Mood", "smug"], ["Affection", "45/100"], ["Trust", "60/100"]]);
    assert.equal(p.people[1].name, "Matt", "the quoted nickname comes off");
    assert.equal(parseBonds("No blocks here."), null);
    assert.equal(parseBonds(reply(`${BONDS_TEMPLATE}\n\n[NPC Name]: Mood: [emotional surface] | Affection: [0-100]/100`)), null, "an unfilled template is nothing");
});

test("bonds: other line shapes and user-added fields", () => {
    const p = parseBonds(reply("- Anno — Mood: smug | Jealousy: 10/100\nMatt | Mood: calm"));
    assert.deepEqual(p.people.map(x => x.name), ["Anno", "Matt"]);
    assert.equal(p.people[0].fields[1].label, "Jealousy");
});

test("bonds model: first line wins inside one reply; a bare change moves the old value; nobody is dropped", () => {
    let s = applyBonds(emptyBonds(), parseBonds(reply("Anno: Affection: 40/100\nMatt: Affection: 30/100")), { seq: 1 }).state;
    const r = applyBonds(s, parseBonds(reply("Anno: Affection: +5 kind words | Affection: 90/100")), { seq: 2 });
    s = r.state;
    assert.equal(s.people.anno.fields.affection.text, "45/100");
    assert.deepEqual(r.applied, [{ label: "Anno: Affection", before: "40/100", after: "45/100" }]);
    assert.equal(s.people.matt.fields.affection.text, "30/100", "Matt is kept although he was not in this reply");
    // "Matt Reyes" later is the same person, and the fuller name is shown.
    s = applyBonds(s, parseBonds(reply("Matt Reyes: Affection: 35/100")), { seq: 3 }).state;
    assert.equal(Object.keys(s.people).length, 2);
    assert.equal(s.people.matt.name, "Matt Reyes");
});

test("bonds: who is fed — the scene, the recent text, the latest block; nobody else", () => {
    let s = emptyBonds();
    s = applyBonds(s, parseBonds(reply("Anno: Affection: 40/100\nMatt: Affection: 30/100\nYuki: Affection: 70/100\nJoe Walker: Trust: 10/100")), { seq: 1 }).state;
    const keys = pickBondsFor(s, { present: ["Anno"], recentText: "Later, Yuki knocked on the door.", latestNames: [] });
    assert.deepEqual(keys, ["anno", "yuki"]);
    assert.equal(renderBondsNotes(s, keys), "Anno: Affection: 40/100\nYuki: Affection: 70/100");
    assert.deepEqual(pickBondsFor(s, { recentText: "joe waved" }), ["joe walker"], "first name matches too");
});

// ── Sheet ────────────────────────────────────────────────────────────────

test("sheet: every field; numbers on one line, lists on their own", () => {
    const text = "<Character_Sheet>\n[{{user}}'s sheet.\n- Carry every number forward.]\n\nHP: 80/100 (-20 the fall) | Stamina: 60/100 (=) | Gold: 120 (+20 reward)\nStatus: bruised\nInventory: rope, torch x3\n</Character_Sheet>";
    const p = parseSheet(text);
    assert.deepEqual(p.fields.map(f => f.label), ["HP", "Stamina", "Gold", "Status", "Inventory"]);
    let s = applySheet(undefined, p, { seq: 1 }).state;
    s = applySheet(s, parseSheet("<Character_Sheet>\nGold: -30 bought a map\nInventory: rope, map\n</Character_Sheet>"), { seq: 2 }).state;
    assert.equal(renderSheetNotes(s), "HP: 80/100 | Stamina: 60/100 | Gold: 90\nStatus: bruised\nInventory: rope, map");
});

// ── Latest (Inner Chatter, Story Tracker) ────────────────────────────────

test("latest: the last copy of the block, its template left out", () => {
    const p = parseLatest("<NPC_Inner_Chatter>\nAnno: He actually looked scared. Cute.\nMatt: I should not have come.\n</NPC_Inner_Chatter>", "NPC_Inner_Chatter");
    assert.equal(p.text, "Anno: He actually looked scared. Cute.\nMatt: I should not have come.");
    assert.equal(parseLatest("<NPC_Inner_Chatter>\n[Unfiltered internal layer\nhidden from the PC.]\n</NPC_Inner_Chatter>", "NPC_Inner_Chatter"), null);
    assert.equal(trackerModule.parse("<Story_Tracker>\narc_status: progressing\n</Story_Tracker>").text, "arc_status: progressing");
});

// ── In the store: swipes undo, old chats import ───────────────────────────

function env(chat = []) {
    const e = { chat, meta: {} };
    e.store = createStateStore({
        adapter: { getChat: () => e.chat, getMeta: () => e.meta, saveMeta: () => {}, saveChat: () => {}, getUserNames: () => ["Kazuma"] },
        modules: { bonds: bondsModule, sheet: sheetModule, chatter: chatterModule, tracker: trackerModule }
    });
    return e;
}
const ai = text => ({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} });

test("store: a swipe undoes its bonds, swiping back brings them back", () => {
    const e = env();
    e.chat.push(ai(reply("Anno: Affection: 40/100")));
    e.store.recordMessage(0);
    e.chat.push({ is_user: true, mes: "hi", extra: {} });
    e.chat.push(ai(reply("Anno: Affection: 50/100", "\n<NPC_Inner_Chatter>\nAnno: finally.\n</NPC_Inner_Chatter>")));
    e.store.recordMessage(2);
    assert.equal(e.store.getState("bonds").people.anno.fields.affection.text, "50/100");
    assert.equal(e.store.getState("chatter").text, "Anno: finally.");

    // Swipe to a new reply that has no chatter and lower affection.
    const m = e.chat[2];
    m.swipes[0] = m.mes; m.swipe_info[0].extra = structuredClone(m.extra);
    m.swipe_id = 1; m.mes = reply("Anno: Affection: 35/100"); m.swipes[1] = m.mes; m.swipe_info[1] = { extra: structuredClone(m.extra) };
    e.store.recordMessage(2);
    e.store.reconcile();
    assert.equal(e.store.getState("bonds").people.anno.fields.affection.text, "35/100");
    assert.equal(e.store.getState("chatter").text, "", "the chatter of the swipe we left is gone");

    // Back to the first swipe.
    m.swipes[1] = m.mes; m.swipe_info[1].extra = structuredClone(m.extra);
    m.swipe_id = 0; m.mes = m.swipes[0]; m.extra = structuredClone(m.swipe_info[0].extra);
    e.store.onSwiped(2);
    e.store.reconcile();
    assert.equal(e.store.getState("bonds").people.anno.fields.affection.text, "50/100");
});

test("store: an old chat is read on import, so old characters keep their bonds", () => {
    const e = env([
        ai(reply("Yuki: Affection: 70/100 | Trust: 50/100")),
        { is_user: true, mes: "bye", extra: {} },
        ai(reply("Anno: Affection: 20/100")),
        { is_user: true, mes: "hi", extra: {} },
        ai(reply("Anno: Affection: 25/100 (+5 laughed)"))
    ]);
    assert.ok(e.store.importFromChat("bonds") >= 3);
    const s = e.store.getState("bonds");
    assert.equal(s.people.yuki.fields.affection.text, "70/100", "Yuki, not seen for two replies, is still on file");
    assert.equal(s.people.anno.fields.affection.text, "25/100");
});

// ── Editor edits ─────────────────────────────────────────────────────────

test("editor: set a value, clear a field, forget a character", () => {
    let s = applyBonds(emptyBonds(), parseBonds(reply("Anno: Mood: smug | Affection: 40/100\nMatt: Affection: 30/100")), { seq: 1 }).state;
    const edit = { kind: "delta", people: [{ name: "Anno", fields: [
        { key: "affection", label: "Affection", ...parseStatValue("55") },
        { key: "mood", label: "Mood", remove: true }
    ] }], forget: ["Matt"] };
    const r = applyBonds(s, edit, { seq: 2 });
    s = r.state;
    assert.equal(s.people.anno.fields.affection.text, "55/100", "a bare number keeps the meter's max");
    assert.equal(s.people.anno.fields.mood, undefined);
    assert.equal(s.people.matt, undefined);
});

test("bonds in play: possessives, names in brackets, a nickname for someone in the scene", () => {
    let st = emptyBonds();
    for (const n of ["Chloe von Einzbern", "Dom (Dominic Morin)", "Cathleen Cairns", "Sean O'Brien", "Harold"]) {
        st = applyBonds(st, { people: [{ name: n, fields: [{ key: "affection", label: "Affection", kind: "meter", value: 10, max: 100, text: "10/100" }] }] }, { seq: 1 }).state;
    }
    const pick = o => pickBondsFor(st, o).map(k => st.people[k].name);
    assert.deepEqual(pick({ recentText: "Chloe's awake by now. Dom’s beer sat warm." }), ["Chloe von Einzbern", "Dom (Dominic Morin)"]);
    assert.deepEqual(pick({ recentText: "Dominic laughed." }), ["Dom (Dominic Morin)"]);
    assert.deepEqual(pick({ recentText: "Sean O'Brien's coat." }), ["Sean O'Brien"]);
    assert.deepEqual(pick({ present: ["Cat"] }), ["Cathleen Cairns"]);
    assert.deepEqual(pick({ recentText: "the cat slept" }), [], "a nickname counts only for someone in the scene");
});

test("bonds in play: a surname alone, only when one character has it", () => {
    let st = emptyBonds();
    for (const n of ["Elizabeth Bathory", "Duncan Cairns", "Cathleen Cairns", "Mira"]) {
        st = applyBonds(st, { people: [{ name: n, fields: [{ key: "trust", label: "Trust", kind: "meter", value: 10, max: 100, text: "10/100" }] }] }, { seq: 1 }).state;
    }
    const pick = o => pickBondsFor(st, o).map(k => st.people[k].name);
    assert.deepEqual(pick({ recentText: "Bathory's carriage arrived." }), ["Elizabeth Bathory"]);
    assert.deepEqual(pick({ recentText: "The Cairns farm was quiet." }), [], "two Cairns: no guess");
    assert.deepEqual(pick({ recentText: "Duncan nodded." }), ["Duncan Cairns"], "first names still work");
});
