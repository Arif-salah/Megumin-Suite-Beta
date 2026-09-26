// node --test "tests/*.test.mjs"
// Quoted nicknames: 'Matthew "Matt"' is one character (reported from a real chat,
// where it became "Matthew Matt" with no details plus a separate "Matt").
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWorldBlocks } from "../src/state/modules/world/parse.js";
import { emptyWorld, applyWorldChanges, findCast, presentCast, castDisplayName } from "../src/state/modules/world/model.js";
import { renderWorldForPrompt, renderWorldCard, renderWorldExtractPrompt, findReturning } from "../src/state/modules/world/render.js";
import { parseWorldState } from "../src/blocks/treatments.js";
import { createStateStore } from "../src/state/store.js";
import { worldModule } from "../src/state/modules/world/index.js";

const S = b => `<World_State>\n${b}\n</World_State>`;
const U = b => `<World_Update>\n${b}\n</World_Update>`;
const apply = (text, prev = emptyWorld()) => applyWorldChanges(prev, parseWorldBlocks(text), { userNames: ["Kazuma"] }).state;

// The bootstrap the model actually wrote in that chat.
const REPORTED = S([
    "Loc: Kazuma's bedroom doorway",
    '+ Matthew "Matt"',
    "Matt.Outfit: Cropped black graphic tee, pleated black mini skirt",
    "Matt.Position: Gripping the bedroom doorframe",
    "Matt.Mood: Mortified craving for approval"
].join("\n"));

test("the reported bootstrap gives ONE character, found by either name", () => {
    const s = apply(REPORTED);
    assert.deepEqual(presentCast(s).map(c => c.name), ["Matthew"]);
    assert.equal(findCast(s, "Matt"), findCast(s, "Matthew"));
    assert.equal(findCast(s, "Matt").fields.outfit, "Cropped black graphic tee, pleated black mini skirt");
    assert.equal(castDisplayName(findCast(s, "Matt")), 'Matthew "Matt"');
});

test("later updates by either name land on the same character", () => {
    let s = apply(REPORTED);
    s = apply(U("Matt.Position: Two steps inside the bedroom"), s);
    s = apply(U("Matthew.Mood: Hopeful"), s);
    s = apply(U('Matthew "Matt".Outfit: Oversized hoodie'), s);
    assert.equal(presentCast(s).length, 1);
    const m = findCast(s, "Matt");
    assert.equal(m.fields.position, "Two steps inside the bedroom");
    assert.equal(m.fields.mood, "Hopeful");
    assert.equal(m.fields.outfit, "Oversized hoodie");
    s = apply(U("- Matt: went to the kitchen"), s);
    assert.equal(findCast(s, "Matthew").present, false);
});

test("a nickname-only record is taken over when the full name arrives", () => {
    let s = apply(U("+ Matt\nMatt.Outfit: hoodie\nMatt.Mood: shy"));
    s = apply(U('+ Matthew "Matt"\nMatthew.Position: by the door'), s);
    assert.deepEqual(Object.values(s.cast).map(c => c.name), ["Matthew"]);
    const m = findCast(s, "Matt");
    assert.equal(m.fields.outfit, "hoodie");
    assert.equal(m.fields.position, "by the door");
    assert.equal(m.present, true);
});

test("nicknames show in the notes and on the card, and the card still reads back", () => {
    const s = apply(REPORTED);
    assert.match(renderWorldForPrompt(s), /Present\n  Matthew "Matt"\n    Outfit:/);
    const card = renderWorldCard(s);
    assert.match(card, /\*\*Matthew "Matt":\*\*/);
    assert.deepEqual(parseWorldState(card).people.map(p => p.name).filter(n => n !== "{{user}}"), ['Matthew "Matt"']);
    // Our own card fed back in (legacy import) is still one character.
    const back = apply(S(card));
    assert.equal(presentCast(back).length, 1);
    assert.equal(findCast(back, "Matt").fields.mood, "Mortified craving for approval");
});

test("a returning character is recognised by nickname", () => {
    let s = apply(REPORTED);
    s = apply(U("- Matt: went home"), s);
    assert.deepEqual(findReturning(s, "Later, Matt knocks on the door.").map(c => c.name), ["Matthew"]);
});

test("apostrophes and parenthesis notes are not nicknames", () => {
    const s = apply(U("+ O'Brien\n+ Aqua (goddess)"));
    assert.ok(findCast(s, "O'Brien"));
    assert.deepEqual(findCast(s, "Aqua").aliases || [], []);
});

test("prompt D's notes carry the clerk's comment, not the story model's", () => {
    const notes = renderWorldForPrompt(apply(REPORTED));
    assert.match(notes, /before your reply/);
    const d = renderWorldExtractPrompt({ notes, exchange: "x", mode: "update" });
    assert.doesNotMatch(d.user, /your reply/);
    assert.match(d.user, /<!-- Where the story stood before the latest exchange\. -->/);
});

// ── Chats already on file get the fix on load ──────────────────────────

test("reparseStale fixes entries parsed by the old parser (the reported chat)", () => {
    const msg = { is_user: false, mes: REPORTED, swipe_id: 0, swipes: [REPORTED], swipe_info: [{ extra: {} }], extra: {} };
    const e = { chat: [msg], meta: {} };
    const store = createStateStore({
        adapter: { getChat: () => e.chat, getMeta: () => e.meta, saveMeta() {}, saveChat() {}, getUserNames: () => ["Kazuma"] },
        modules: { world: worldModule }
    });
    store.recordMessage(0, { expect: true });
    // What the old parser stored: "Matthew Matt" plus a separate "Matt".
    const entry = store.root().journal[0];
    entry.parsed.changes[entry.parsed.changes.findIndex(c => c.type === "enter")] = { type: "enter", who: "Matthew Matt" };
    delete store.root().parserVersion;
    store.addUserEntry("world", { kind: "delta", changes: [] }); // bump version so the memo refreshes
    assert.equal(presentCast(store.getState("world")).length, 2, "the bug, reproduced");

    assert.equal(store.reparseStale("world"), 1);
    assert.deepEqual(presentCast(store.getState("world")).map(c => c.name), ["Matthew"]);
    assert.equal(store.reparseStale("world"), 0, "runs once per parser version");
});

test("a side model's stored answer is what gets re-parsed", () => {
    const msg = { is_user: false, mes: "prose only", swipe_id: 0, swipes: ["prose only"], swipe_info: [{ extra: {} }], extra: {} };
    const e = { chat: [msg], meta: {} };
    const store = createStateStore({
        adapter: { getChat: () => e.chat, getMeta: () => e.meta, saveMeta() {}, saveChat() {}, getUserNames: () => [] },
        modules: { world: worldModule }
    });
    const raw = S('+ Matthew "Matt"\nMatt.Outfit: tee');
    store.recordMessage(0, { source: "sidemodel", expect: true, parsed: { kind: "snapshot", changes: [{ type: "enter", who: "Matthew Matt" }, { type: "field", who: "Matt", field: "outfit", value: "tee" }], skipped: [], noChanges: false }, raw });
    delete store.root().parserVersion;
    assert.equal(store.reparseStale("world"), 1);
    assert.deepEqual(presentCast(store.getState("world")).map(c => c.name), ["Matthew"]);
});
