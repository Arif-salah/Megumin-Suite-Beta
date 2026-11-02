// node --test "tests/*.test.mjs"
// Plan 022 phase 3: the story model's <Scene> list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScene, sceneBlockOf } from "../src/state/scene.js";
import { emptyWorld, applyWorldChanges, presentCast, findCast } from "../src/state/modules/world/model.js";
import { parseWorldBlocks } from "../src/state/modules/world/parse.js";

const names = list => list.map(n => (n.isNew ? "+" : "") + n.name);

test("Here and Remote lines, + for someone new, nobody, an empty Remote", () => {
    const s = parseScene("prose\n<Blocks>\n<Scene>\nHere: Lona, +Mira\nRemote: Kade\n</Scene>\n</Blocks>");
    assert.deepEqual(names(s.here), ["Lona", "+Mira"]);
    assert.deepEqual(names(s.remote), ["Kade"]);
    assert.deepEqual(parseScene("<Scene>\nHere: nobody\nRemote:\n</Scene>"), { here: [], remote: [] });
    assert.deepEqual(parseScene("<Scene>\nHere: [names, or: nobody]\nRemote: [names, or leave it empty]\n</Scene>"), { here: [], remote: [] });
});

test("loose writing: bold labels, bullets, 'and', no labels at all", () => {
    assert.deepEqual(names(parseScene("<Scene>\n- **Here:** Lona and + Mira.\n</Scene>").here), ["Lona", "+Mira"]);
    assert.deepEqual(names(parseScene("<Scene>Lona, Kade</Scene>").here), ["Lona", "Kade"]);
});

test("no <Scene> block → null; one inside thinking doesn't count", () => {
    assert.equal(parseScene("just prose"), null);
    assert.equal(sceneBlockOf("<think><Scene>Here: X</Scene></think> prose"), "");
});

// ── World State presence from the list ─────────────────────────────────────

const U = body => `<World_Update>\n${body}\n</World_Update>`;
const S = (here, remote = "") => `\n<Scene>\nHere: ${here}\nRemote: ${remote}\n</Scene>`;
function step(state, text, seq) {
    return applyWorldChanges(state, parseWorldBlocks(text), { seq, userNames: ["Kazuma"], text, staleAfter: 8 });
}
const presentNames = s => presentCast(s).map(c => c.name);

function tavern() {
    const t = `<World_State>\nLoc: tavern\n+ Lona\nLona.Outfit: red coat\n+ Kade\nKade.Outfit: armor\n</World_State>`;
    return applyWorldChanges(emptyWorld(), parseWorldBlocks(t), { seq: 1, userNames: ["Kazuma"] }).state;
}

test("someone left off the list leaves the scene, and is not moved off-screen", () => {
    const r = step(tavern(), "Kade walked out." + U("Lona.Position: at the bar") + S("Lona"), 2);
    assert.deepEqual(presentNames(r.state), ["Lona"]);
    assert.equal(findCast(r.state, "Kade").offscreen, "");
    assert.ok(r.applied.some(a => a.label === "Kade left"));
});

test("someone on the list comes back, with their details", () => {
    let s = step(tavern(), "x" + U("No changes") + S("Lona"), 2).state;
    s = step(s, "Kade returned." + U("No changes") + S("Lona, Kade"), 3).state;
    assert.deepEqual(presentNames(s), ["Lona", "Kade"]);
    assert.equal(findCast(s, "Kade").fields.outfit, "armor");
});

test("Remote: on a call, out of the scene, shown apart", () => {
    const r = step(tavern(), "Kade calls." + U("No changes") + S("Lona", "Kade"), 2);
    assert.deepEqual(presentNames(r.state), ["Lona"]);
    assert.equal(findCast(r.state, "Kade").remote, true);
    const back = step(r.state, "He hangs up." + U("No changes") + S("Lona"), 3).state;
    assert.equal(findCast(back, "Kade").remote, undefined);
});

test("a new +Name is not asked about; a new name without + is", () => {
    const r = step(tavern(), "x" + U("Mira.Outfit: grey cloak\nAnna.Outfit: apron") + S("Lona, Kade, +Mira, Anna"), 2);
    assert.deepEqual(presentNames(r.state), ["Lona", "Kade", "Mira", "Anna"]);
    assert.deepEqual(r.unannounced, ["Anna"]);
    assert.equal(findCast(r.state, "Mira").fields.outfit, "grey cloak");
});

test("old + and - lines don't fight the list: the list wins", () => {
    const r = step(tavern(), "x" + U("- Lona: went home\n+ Bob") + S("Lona, Kade"), 2);
    assert.deepEqual(presentNames(r.state), ["Lona", "Kade"]);
    assert.equal(findCast(r.state, "Lona").offscreen, "");
});

test("a short name on the list finds the one character it starts", () => {
    let s = applyWorldChanges(emptyWorld(), parseWorldBlocks(`<World_State>\n+ Cathleen Cairns\n+ Duncan Cairns\n</World_State>`), { seq: 1 }).state;
    s = step(s, "x" + U("No changes") + S("Cat"), 2).state;
    assert.deepEqual(presentNames(s), ["Cathleen Cairns"]);
});

test("the player on the list is ignored; nobody empties the scene", () => {
    const r = step(tavern(), "x" + U("No changes") + S("Kazuma, nobody"), 2);
    assert.deepEqual(presentNames(r.state), []);
    assert.equal(findCast(r.state, "Kazuma"), null);
});

test("without a list, the old rules run as before", () => {
    const r = step(tavern(), "x" + U("- Kade: went home"), 2);
    assert.deepEqual(presentNames(r.state), ["Lona"]);
    assert.equal(findCast(r.state, "Kade").offscreen, "went home");
});

test("a reply with a list but no World block still moves people", () => {
    const r = applyWorldChanges(tavern(), null, { seq: 2, text: "x" + S("Kade"), userNames: ["Kazuma"] });
    assert.deepEqual(presentNames(r.state), ["Kade"]);
});

// Live test 2026-11-02: the model copied the scene list's "+" into other blocks.
import { parseBonds } from "../src/state/modules/stats/parse.js";

test("a + copied into World Update field lines is a field line, not an arrival", () => {
    const r = step(tavern(), "x" + U("+Mira Vale.Outfit: grey oilskin\n+Mira Vale.Mood: tired") + S("Lona, Kade, +Mira Vale"), 2);
    assert.deepEqual(Object.values(r.state.cast).map(c => c.name), ["Lona", "Kade", "Mira Vale"]);
    assert.equal(findCast(r.state, "Mira Vale").fields.outfit, "grey oilskin");
    assert.deepEqual(r.unannounced, []);
});

test("a + copied into Bonds is not part of the name", () => {
    assert.equal(parseBonds("<Bonds>\n+Mira Vale: Affection: 20/100\n</Bonds>").people[0].name, "Mira Vale");
});

test("the first reply of a chat: nobody is asked 'Same person as', there was no one to be", () => {
    const t = "x\n<World_State>\nDom.Outfit: apron\nCat.Outfit: sweater\n</World_State>" + S("Dom, Cat");
    const r = applyWorldChanges(emptyWorld(), parseWorldBlocks(t), { seq: 1, userNames: ["Kazuma"], text: t });
    assert.deepEqual(presentNames(r.state), ["Dom", "Cat"]);
    assert.deepEqual(r.unannounced, []);
});
