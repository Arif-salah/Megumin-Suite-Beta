// node --test "tests/*.test.mjs"
// Plan 020: someone the story stops naming is moved out of the scene, and the
// update rules ask the model to say when people leave.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWorldBlocks } from "../src/state/modules/world/parse.js";
import { emptyWorld, applyWorldChanges, presentCast, proseOf, namedIn } from "../src/state/modules/world/model.js";
import { renderWorldInstructions, renderWorldClerkTask } from "../src/state/modules/world/render.js";

const U = body => parseWorldBlocks(`<World_Update>\n${body}\n</World_Update>`);
const NONE = U("No changes");
const names = s => presentCast(s).map(c => c.name).sort();

function start() {
    const p = parseWorldBlocks("<World_State>\nTime: Night\n+ Aqua\nAqua.Outfit: blue dress\n+ Darkness\nDarkness.Outfit: armor\n</World_State>");
    return applyWorldChanges(emptyWorld(), p, { seq: 1, text: "Aqua and Darkness wait at the bar.", staleAfter: 3 }).state;
}

test("someone not named for N replies leaves the scene, and the card says why", () => {
    let s = start();
    let r;
    for (let i = 0; i < 3; i++) {
        r = applyWorldChanges(s, NONE, { seq: 2 + i, text: "Aqua laughs and orders another drink.", staleAfter: 3 });
        s = r.state;
    }
    assert.deepEqual(names(s), ["Aqua"]);
    assert.deepEqual(r.applied.find(a => a.label === "Darkness left"), { label: "Darkness left", before: "present", after: "not named for 3 replies" });
    assert.equal(s.cast.darkness.fields.outfit, "armor", "details kept");
});

test("named again, or touched by the update, keeps them; a nickname counts", () => {
    let s = start();
    s = applyWorldChanges(s, NONE, { seq: 2, text: "Aqua laughs.", staleAfter: 3 }).state;
    s = applyWorldChanges(s, U("Darkness.Position: by the door"), { seq: 3, text: "She waits.", staleAfter: 3 }).state;
    s = applyWorldChanges(s, NONE, { seq: 4, text: "Aqua laughs.", staleAfter: 3 }).state;
    s = applyWorldChanges(s, NONE, { seq: 5, text: "Aqua laughs.", staleAfter: 3 }).state;
    assert.deepEqual(names(s), ["Aqua", "Darkness"], "the field line counted as seen");
    s.cast.darkness.aliases = ["Lalatina"];
    for (let i = 0; i < 3; i++) s = applyWorldChanges(s, NONE, { seq: 6 + i, text: "Aqua teases Lalatina.", staleAfter: 3 }).state;
    assert.deepEqual(names(s), ["Aqua", "Darkness"]);
});

test("the last one left with you stays; never, without text, or with the rule off", () => {
    let s = start();
    for (let i = 0; i < 6; i++) s = applyWorldChanges(s, NONE, { seq: 2 + i, text: "She sighs.", staleAfter: 3 }).state;
    assert.equal(names(s).length, 1, "one stays");
    let t = start();
    for (let i = 0; i < 6; i++) t = applyWorldChanges(t, NONE, { seq: 2 + i, text: "She sighs.", staleAfter: 0 }).state;
    assert.deepEqual(names(t), ["Aqua", "Darkness"], "off");
    let u = start();
    for (let i = 0; i < 6; i++) u = applyWorldChanges(u, NONE, { seq: 2 + i, staleAfter: 3 }).state;
    assert.deepEqual(names(u), ["Aqua", "Darkness"], "your own edits and deleted messages don't count");
});

test("names inside blocks or thinking don't count", () => {
    const prose = proseOf("Aqua drinks.<think>Darkness should leave</think>\n<Blocks>\n<World_State>+ Darkness</World_State>\n</Blocks>");
    assert.equal(namedIn(prose, { name: "Aqua" }), true);
    assert.equal(namedIn(prose, { name: "Darkness" }), false);
    assert.equal(namedIn("Aquarium.", { name: "Aqua" }), false, "whole words");
});

test("the update rules ask for a leave line, for the story model and for Chomusuke", () => {
    for (const rules of [renderWorldInstructions("update").rules, renderWorldClerkTask("update").rules]) {
        assert.match(rules, /Check everyone under Present/);
        assert.match(rules, /did not come along/);
    }
    assert.doesNotMatch(renderWorldInstructions("update").rules, /\b(extension|app|settings?)\b/i, "stays in-story");
});

test("two phases on one line: each its own, the first Scene wins", () => {
    const changes = l => parseWorldBlocks(`<World_Update>\n${l}\n</World_Update>`).changes.filter(c => c.type === "phase");
    assert.deepEqual(changes("Scene: Breather | Scene: Building"), [
        { type: "phase", key: "scenePhase", value: "Breather" },
        { type: "phase", key: "scenePhase", value: "Building" }
    ]);
    assert.deepEqual(changes("Arc: Resolution | Scene: Breather").map(c => [c.key, c.value]), [["arcPhase", "Resolution"], ["scenePhase", "Breather"]]);
    assert.deepEqual(changes("Scene: Climax").map(c => c.value), ["Climax"]);
    const r = applyWorldChanges(emptyWorld(), U("Arc: Resolution | Scene: Breather | Scene: Building"), { seq: 1 });
    assert.equal(r.state.arcPhase, "Resolution");
    assert.equal(r.state.scenePhase, "Breather");
    assert.ok(r.notes.some(n => /written twice/.test(n)));
});

// ── The whole scene every reply ("like V10") ─────────────────────────────
const S = body => parseWorldBlocks(`<World_State>\n${body}\n</World_State>`);

test("whole scene every reply: anyone left out has left, only real comings and goings show", () => {
    let s = applyWorldChanges(emptyWorld(), S("Time: Night\n+ Aqua\nAqua.Outfit: blue dress\n+ Darkness\n+ Duncan"), { seq: 1 }).state;
    const r = applyWorldChanges(s, S("Time: Day\n+ Aqua\nAqua.Outfit: blue dress\n+ Mira"), { seq: 2 });
    assert.deepEqual(names(r.state), ["Aqua", "Mira"]);
    const labels = r.applied.map(a => a.label);
    assert.ok(labels.includes("Mira entered"));
    assert.ok(!labels.includes("Aqua entered"), "Aqua was already there");
    assert.ok(labels.includes("Darkness left") && labels.includes("Duncan left"));
    assert.equal(r.state.cast.darkness.present, false);
    assert.ok(r.state.cast.darkness, "kept, not forgotten");
});

test("whole scene every reply: Threads, Seeds and Timers are replaced, not added to", () => {
    let s = applyWorldChanges(emptyWorld(), S("Time: Night\nThread+: the debt\nThread+: the letter\nTimer+: rent: 3 turns"), { seq: 1 }).state;
    s = applyWorldChanges(s, S("Time: Night\nThread+: the debt, now overdue\nTimer+: rent: 2 turns"), { seq: 2 }).state;
    assert.deepEqual(s.threads, ["the debt, now overdue"]);
    assert.deepEqual(s.timers, ["rent: 2 turns"]);
    const keep = applyWorldChanges(s, S("Time: Day"), { seq: 3 }).state;
    assert.deepEqual(keep.threads, ["the debt, now overdue"], "no list written: the list stays");
});

test("whole scene rules: start from the last scene; no Seeds while the Notebook is on", () => {
    const first = renderWorldInstructions("bootstrap").rules;
    const again = renderWorldInstructions("bootstrap", { carry: true }).rules;
    assert.doesNotMatch(first, /Start from it/);
    assert.match(again, /Start from it: copy every detail your reply did not change/);
    assert.match(again, /anyone you leave out has left the scene/);
    assert.match(renderWorldClerkTask("bootstrap", { carry: true }).rules, /before the latest exchange\. Start from it/);
    const nb = renderWorldInstructions("bootstrap", { carry: true, noSecret: true }).rules;
    assert.doesNotMatch(nb, /Seeds/);
    assert.match(nb, /Threads and Timers that still matter/);
    assert.equal(renderWorldInstructions("update", { carry: true }).rules, renderWorldInstructions("update").rules, "only full rewrites carry");
});
