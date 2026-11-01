// node --test "tests/*.test.mjs"
// Plan 008 fix: a character the story model was not handed bonds for (nobody
// named them lately) comes back in a reply. Its made-up numbers must not
// replace the real ones; next turn their bonds are handed over as usual.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStateStore } from "../src/state/store.js";
import { parseBonds } from "../src/state/modules/stats/parse.js";
import { pickBondsFor, unsentBondKeys } from "../src/state/modules/stats/model.js";
import { bondsModule } from "../src/state/modules/stats/index.js";

const reply = (prose, bonds) => `${prose}\n<Blocks>\n<Bonds>\n${bonds}\n</Bonds>\n</Blocks>`;
const ai = text => ({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} });
const user = text => ({ is_user: true, is_system: false, mes: text, extra: {} });
const prose = m => String(m.mes).replace(/<Blocks>[\s\S]*<\/Blocks>/, "");

function env(module = bondsModule, e = { chat: [], meta: {} }) {
    e.store = createStateStore({
        adapter: { getChat: () => e.chat, getMeta: () => e.meta, saveMeta: () => {}, saveChat: () => {}, getUserNames: () => ["Kazuma"] },
        modules: { bonds: module }
    });
    return e;
}

// What the bridge does (state/index.js bondsFactsFor), with no World State.
function handedFor(e, index) {
    const seq = e.store.stamp(e.chat[index]).seq;
    const state = e.store.getStateAt("bonds", seq - 0.5);
    const entries = e.store.activeEntries("bonds").filter(x => !x.missing && x.seq < seq);
    const last = entries[entries.length - 1];
    const latestNames = (last && last.parsed.people || []).map(p => p.name);
    const recentText = e.chat.slice(Math.max(0, index - 3), index).map(prose).join("\n");
    return { state, keys: pickBondsFor(state, { recentText, latestNames }) };
}

function turn(e, userText, replyText) {
    e.chat.push(user(userText));
    e.chat.push(ai(replyText));
    const index = e.chat.length - 1;
    const { state, keys } = handedFor(e, index);
    const unsent = unsentBondKeys(state, parseBonds(replyText), keys);
    e.store.recordMessage(index, unsent.length ? { facts: { bonds: { unsent } } } : {});
    return keys;
}

const affection = (e, k) => e.store.getState("bonds").people[k]?.fields.affection?.text;

function lonaLeftLongAgo() {
    const e = env();
    e.chat.push(ai(reply("Lona waved goodbye.", "Lona: Affection: 60/100")));
    e.store.recordMessage(0);
    turn(e, "I head to the market.", reply("Maya sold you apples.", "Maya: Affection: 30/100"));
    turn(e, "I buy bread.", reply("Maya smiled.", "Maya: Affection: 32/100 (+2 kind)"));
    turn(e, "I walk home.", reply("Maya waved.", "Maya: Affection: 32/100 (=)"));
    return e;
}

test("Lona comes back unnamed: her made-up numbers are skipped, the real ones stay", () => {
    const e = lonaLeftLongAgo();
    const handed = turn(e, "I open the door.", reply("Lona stood there, scowling.", "Lona: Affection: 10/100"));
    assert.ok(!handed.includes("lona"), "her bonds were not handed this turn");
    assert.equal(affection(e, "lona"), "60/100", "60 is kept, not replaced by 10");

    // Next turn she is named, so her real bonds are handed and the story moves them.
    const next = turn(e, "Lona?", reply("Lona crossed her arms.", "Lona: Affection: 52/100 (-8 still angry)"));
    assert.ok(next.includes("lona"), "her bonds are handed now");
    assert.equal(affection(e, "lona"), "52/100");
});

test("the skipped line still counts: next turn hands her bonds even if the prose never names her", () => {
    const e = lonaLeftLongAgo();
    turn(e, "Someone knocks.", reply("The visitor scowled.", "Lona: Affection: 10/100"));
    const next = turn(e, "I let them in.", reply("The visitor sat down.", "Lona: Affection: 58/100 (-2 tense)"));
    assert.ok(next.includes("lona"), "named in the last Bonds block");
    assert.equal(affection(e, "lona"), "58/100");
});

test("a character named before the reply is handed, so their numbers count", () => {
    const e = lonaLeftLongAgo();
    turn(e, "I go find Lona.", reply("Lona looked up.", "Lona: Affection: 55/100 (-5 surprised)"));
    assert.equal(affection(e, "lona"), "55/100");
});

test("a brand-new character is created as usual", () => {
    const e = lonaLeftLongAgo();
    turn(e, "A stranger arrives.", reply("Kade bowed.", "Kade: Affection: 20/100"));
    assert.equal(affection(e, "kade"), "20/100");
});

test("the decision survives a reload and a reparse", () => {
    const e = lonaLeftLongAgo();
    turn(e, "I open the door.", reply("Lona stood there.", "Lona: Affection: 10/100"));
    const again = env({ ...bondsModule, version: 2 }, { chat: e.chat, meta: e.meta });
    assert.ok(again.store.reparseStale("bonds") > 0);
    assert.equal(again.store.getState("bonds").people.lona.fields.affection.text, "60/100");
});

test("a model that copies every handed line back does not grow the list on its own", () => {
    const e = env();
    e.chat.push(ai(reply("Everyone met.", "Lona: Affection: 60/100\nMaya: Affection: 30/100\nKade: Affection: 20/100")));
    e.store.recordMessage(0);
    let sizes = [];
    for (let i = 0; i < 6; i++) {
        e.chat.push(user("I wait."));
        e.chat.push(ai("placeholder"));
        const index = e.chat.length - 1;
        const { state, keys } = handedFor(e, index);
        // The copying model writes back every line it was handed.
        const text = reply("Time passes.", keys.map(k => `${state.people[k].name}: Affection: ${state.people[k].fields.affection.text} (=)`).join("\n"));
        e.chat[index].mes = text;
        e.chat[index].swipes[0] = text;
        e.store.recordMessage(index);
        sizes.push(keys.length);
    }
    assert.ok(sizes.every(n => n <= 3), `never more than the three on file: ${sizes}`);
    assert.ok(sizes.every((n, i) => i === 0 || n <= sizes[i - 1]), `never grows by itself: ${sizes}`);
});
