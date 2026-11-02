// node --test "tests/*.test.mjs"
// Plan 022 phase 1: one name finder for World State, Bonds and Image V2.
import { test } from "node:test";
import assert from "node:assert/strict";
import { whoIs, namedIn, shortName, nameWords } from "../src/state/names.js";

const people = (...names) => Object.fromEntries(names.map(n => [nameWords(n), typeof n === "string" ? { name: n } : n]));

test("exact name, nickname, brackets and possessives", () => {
    const p = { lona: { name: "Lona" }, matthew: { name: "Matthew", aliases: ["Matt"] }, dom: { name: "Dom (Dominic Morin)" } };
    assert.equal(whoIs(p, "Lona"), "lona");
    assert.equal(whoIs(p, "lona's"), "lona");
    assert.equal(whoIs(p, "Lona’s"), "lona");
    assert.equal(whoIs(p, "Matt"), "matthew");
    assert.equal(whoIs(p, "Dominic Morin"), "dom");
    assert.equal(whoIs(p, "Dom"), "dom");
    assert.equal(whoIs(p, "Kade"), null);
});

test("a first name or a longer name finds the one character it fits", () => {
    const p = people("Matt Reyes", "Resha");
    assert.equal(whoIs(p, "Matt"), "matt reyes");
    assert.equal(whoIs(p, "Resha Helios"), "resha");
    assert.equal(whoIs(p, "Matt Cole"), null, "Matt Cole is someone new, not Matt Reyes");
});

test("two characters fit: nobody is picked", () => {
    const p = people("Matt Reyes", "Matt Cole", "Duncan Cairns", "Cathleen Cairns");
    assert.equal(whoIs(p, "Matt"), null);
    assert.equal(whoIs(p, "Cairns"), null);
    assert.equal(whoIs(p, "Matt Cole"), "matt cole");
});

test("a surname alone picks nobody (a title reads like a first name)", () => {
    assert.equal(whoIs(people("Elizabeth Bathory", "Lona"), "Bathory"), null);
    assert.equal(whoIs(people("Uncle Emma"), "Emma"), null);
});

test("a short nickname only for names known to be in the scene", () => {
    const p = people("Cathleen Cairns", "Duncan Cairns");
    assert.equal(whoIs(p, "Cat"), null);
    assert.equal(whoIs(p, "Cat", { nickname: true }), "cathleen cairns");
    assert.equal(whoIs(people("Cathleen", "Catalina"), "Cat", { nickname: true }), null);
});

test("an exact name wins over a looser match", () => {
    const p = people("Resha", "Resha Helios");
    assert.equal(whoIs(p, "Resha"), "resha");
    assert.equal(whoIs(p, "Resha Helios"), "resha helios");
});

test("exactOnly skips the looser steps", () => {
    assert.equal(whoIs(people("Matt Reyes"), "Matt", { exactOnly: true }), null);
});

test("namedIn: full names, first names, a surname only when one character has it", () => {
    const p = people("Matt Reyes", "Duncan Cairns", "Cathleen Cairns", "Elizabeth Bathory", "Dom (Dominic Morin)");
    assert.deepEqual(namedIn("Matt's coat was wet.", p), ["matt reyes"]);
    assert.deepEqual(namedIn("Cairns nodded.", p), []);
    assert.deepEqual(namedIn("Bathory smiled.", p), ["elizabeth bathory"]);
    assert.deepEqual(namedIn("Dominic waved.", p), ["dom dominic morin"]);
    assert.deepEqual(namedIn("", p), []);
});

test("shortName: the first name, else the full name, that finds only them", () => {
    const p = people("Lona", "Matt Reyes", "Matt Cole", "Elizabeth Bathory", "Dom (Dominic Morin)");
    assert.equal(shortName(p, "lona"), "Lona");
    assert.equal(shortName(p, "matt reyes"), "Matt Reyes");
    assert.equal(shortName(p, "elizabeth bathory"), "Elizabeth");
    assert.equal(shortName(p, "dom dominic morin"), "Dom");
});

// The point of phase 1: World State, Bonds and Image V2 find the same person.
import { resolveCastKey } from "../src/state/modules/world/model.js";
import { findPersonKey } from "../src/state/modules/stats/model.js";
import { buildImageCast } from "../src/features/imagegen/v2/cast.js";

test("World State, Bonds and Image V2 agree on who a name is", () => {
    const names = ["Matt Reyes", "Dom (Dominic Morin)", "Resha Helios"];
    const world = { pc: { name: "Kazuma", fields: {} }, cast: Object.fromEntries(names.map(n => [nameWords(n), { name: n, present: false, fields: {} }])) };
    const bonds = Object.fromEntries(names.map(n => [nameWords(n), { name: n, fields: {} }]));
    for (const [said, who] of [["Matt", "Matt Reyes"], ["Dominic", "Dom (Dominic Morin)"], ["Resha", "Resha Helios"], ["Matt Cole", null]]) {
        const w = world.cast[resolveCastKey(world, said)];
        assert.equal(w ? w.name : null, who, `World State: ${said}`);
        const b = findPersonKey(bonds, said);
        assert.equal(b ? bonds[b].name : null, who, `Bonds: ${said}`);
    }
    const cast = buildImageCast({ world, recentText: "Dominic's knife and Matt's coat." });
    assert.deepEqual(cast.filter(m => m.mentioned).map(m => m.name), ["Matt Reyes", "Dom (Dominic Morin)"]);
});

// Phase 5: the names the story is handed.
import { knownNameList } from "../src/state/names.js";

test("knownNameList: one name per person across modules, the scene first, then the latest seen", () => {
    const list = knownNameList([
        { name: "Cathleen Cairns", aliases: ["Cathleen"], seen: 3 },
        { name: "Duncan Cairns", seen: 5 },
        { name: "Matt Reyes", seen: 1 },
        { name: "Matt Cole", seen: 2 },
        { name: "Duncan", seen: 9 },          // Bonds' record for Duncan Cairns
        { name: "Mira", seen: 4 }
    ], { first: ["Matt Reyes", "Cat"] });
    assert.deepEqual(list, ["Cathleen", "Matt Reyes", "Duncan", "Mira", "Matt Cole"]);
});

test("knownNameList stops at the cap", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `Person${i}`, seen: i }));
    const list = knownNameList(many, { cap: 30 });
    assert.equal(list.length, 30);
    assert.equal(list[0], "Person39");
});
