// node --test "tests/*.test.mjs"
// Plan 022 phase 2: Bonds follows World State's names and its "Same person as".
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStateStore } from "../src/state/store.js";
import { parseBonds } from "../src/state/modules/stats/parse.js";
import { bondNamesFromCast, unsentBondKeys } from "../src/state/modules/stats/model.js";
import { bondsModule } from "../src/state/modules/stats/index.js";

const reply = (prose, bonds) => `${prose}\n<Blocks>\n<Bonds>\n${bonds}\n</Bonds>\n</Blocks>`;
const ai = text => ({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} });

function env(module = bondsModule, e = { chat: [], meta: {} }) {
    e.store = createStateStore({
        adapter: { getChat: () => e.chat, getMeta: () => e.meta, saveMeta: () => {}, saveChat: () => {}, getUserNames: () => ["Kazuma"] },
        modules: { bonds: module }
    });
    return e;
}

// What the bridge does (state/index.js bondsFactsFor) with World State's cast.
function record(e, text, cast) {
    e.chat.push(ai(text));
    const index = e.chat.length - 1;
    const seq = e.store.stamp(e.chat[index]).seq;
    const before = e.store.getStateAt("bonds", seq - 0.5);
    const same = bondNamesFromCast(before, parseBonds(text), cast);
    e.store.recordMessage(index, Object.keys(same).length ? { facts: { bonds: { same } } } : {});
    return same;
}

const people = e => Object.fromEntries(Object.values(e.store.getState("bonds").people).map(p => [p.name, p.fields.affection?.text]));
const castOf = (...list) => Object.fromEntries(list.map(c => [c.name.toLowerCase(), { aliases: [], ...c }]));

test("a first name World State knows starts that character's bonds under their full name", () => {
    const e = env();
    const same = record(e, reply("Duncan walked in.", "Duncan: Affection: 20/100"), castOf({ name: "Duncan Cairns" }));
    assert.deepEqual(same, { Duncan: "Duncan Cairns" });
    assert.deepEqual(people(e), { "Duncan Cairns": "20/100" });
});

test("a nickname World State knows moves the bonds on file", () => {
    const e = env();
    const cast = castOf({ name: "Matthew", aliases: ["Matt"] });
    record(e, reply("Matthew smiled.", "Matthew: Affection: 40/100"), cast);
    record(e, reply("Matt laughed.", "Matt: Affection: 45/100 (+5 joke)"), cast);
    assert.deepEqual(people(e), { Matthew: "45/100" });
});

test("a name World State doesn't know is kept as written", () => {
    const e = env();
    record(e, reply("Mira waved.", "Mira: Affection: 10/100"), castOf({ name: "Duncan Cairns" }));
    assert.deepEqual(people(e), { Mira: "10/100" });
});

test("the reading survives a reload and a reparse", () => {
    const e = env();
    record(e, reply("Duncan walked in.", "Duncan: Affection: 20/100"), castOf({ name: "Duncan Cairns" }));
    const again = env({ ...bondsModule, version: 2 }, { chat: e.chat, meta: e.meta });
    assert.ok(again.store.reparseStale("bonds") > 0);
    assert.deepEqual(people(again), { "Duncan Cairns": "20/100" });
});

test("same person: the bonds join, the fresher values win, and undoing it splits them again", () => {
    const e = env();
    record(e, reply("Uncle Emma nodded.", "Uncle Emma: Affection: 30/100 | Trust: 50/100"), {});
    record(e, reply("Emma sighed.", "Emma: Affection: 35/100"), {});
    const edit = e.store.addUserEntry("bonds", { people: [], merge: [{ who: "Emma", into: "Uncle Emma" }], mergeOf: "e1" });
    const now = e.store.getState("bonds").people;
    assert.deepEqual(Object.keys(now), ["uncle emma"]);
    assert.equal(now["uncle emma"].fields.affection.text, "35/100", "Emma was seen last");
    assert.equal(now["uncle emma"].fields.trust.text, "50/100", "only Uncle Emma had it");
    e.store.removeUserEntry(edit.id);
    assert.deepEqual(people(e), { "Uncle Emma": "30/100", Emma: "35/100" });
});

test("same person when only the newcomer has bonds: they carry on under the known name", () => {
    const e = env();
    record(e, reply("Emma sighed.", "Emma: Affection: 35/100"), {});
    e.store.addUserEntry("bonds", { people: [], merge: [{ who: "Emma", into: "Uncle Emma" }] });
    assert.deepEqual(people(e), { "Uncle Emma": "35/100" });
});

test("a returning character written by nickname still counts as not handed", () => {
    const state = { people: { matthew: { name: "Matthew", fields: {} } } };
    const parsed = parseBonds("<Bonds>\nMatt: Affection: 10/100\n</Bonds>");
    const same = bondNamesFromCast(state, parsed, castOf({ name: "Matthew", aliases: ["Matt"] }));
    assert.deepEqual(unsentBondKeys(state, parsed, [], { same }), ["matthew"]);
});
