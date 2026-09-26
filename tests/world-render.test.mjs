// node --test "tests/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWorldBlocks } from "../src/state/modules/world/parse.js";
import { emptyWorld, applyWorldChanges, findCast } from "../src/state/modules/world/model.js";
import {
    renderWorldForPrompt, renderWorldInstructions, renderWorldCard, findReturning, isEmptyWorld
} from "../src/state/modules/world/render.js";
import { parseWorldState } from "../src/blocks/treatments.js";

const S = body => `<World_State>\n${body}\n</World_State>`;
const U = body => `<World_Update>\n${body}\n</World_Update>`;

function scene() {
    let s = applyWorldChanges(emptyWorld(), parseWorldBlocks(S([
        "Time: Night", "Loc: Axel | guild tavern", "Wx: Rain",
        "Kazuma.Outfit: green cape", "Kazuma.Condition: soaked",
        "+ Aqua", "Aqua.Outfit: blue dress", "Aqua.Mood: smug",
        "Aqua.Agenda: win back her followers", "Aqua.Secret: spent the rent",
        "+ Sara", "Sara.Outfit: green sundress",
        "Offscreen: Wiz = restocking her shop",
        "Thread+: Who stole the coin", "Seed+: a demon crest", "Timer+: landlord: 2 turns",
        "Arc: Escalation", "Scene: Building"
    ].join("\n"))), { userNames: ["Kazuma"] }).state;
    s = applyWorldChanges(s, parseWorldBlocks(U("- Sara: went to the market")), {}).state;
    return s;
}

// Anything the storytelling model reads must stay inside the story. "Record
// what your reply changed" is fine (approved wording); a record KEEPER is not.
const OFF_FRAME = /\b(extension|plugin|app|system|ledger|database|tracker|interface|record[- ]?keep\w*|keeps? (the )?records?)\b/i;

test("framing: prompts never mention the extension or record keeping", () => {
    const s = scene();
    const texts = [
        renderWorldForPrompt(s, { returning: findReturning(s, "Sara waves") }),
        renderWorldInstructions("update").rules, renderWorldInstructions("update").template,
        renderWorldInstructions("bootstrap").rules, renderWorldInstructions("bootstrap").template
    ];
    for (const t of texts) assert.doesNotMatch(t, OFF_FRAME, t.slice(0, 120));
});

test("continuity notes: full detail", () => {
    const t = renderWorldForPrompt(scene());
    assert.match(t, /^<Current_World_State>/);
    assert.match(t, /Loc: Axel \| guild tavern/);
    assert.match(t, /\{\{user\}\} \(PC\)\n  Outfit: green cape/);
    assert.match(t, /Aqua\n    Outfit: blue dress\n    Mood: smug\n    Agenda: win back her followers/);
    assert.match(t, /Off-screen\n(.*\n)*  Wiz: restocking her shop/);
    assert.match(t, /Threads\n  - Who stole the coin/);
    assert.match(t, /Arc: Escalation \| Scene: Building/);
    assert.doesNotMatch(t, /Returning/);
});

test("continuity notes: scene-only leaves the deep currents out", () => {
    const t = renderWorldForPrompt(scene(), { detail: "scene" });
    assert.match(t, /Outfit: blue dress/);
    assert.doesNotMatch(t, /Mood|Agenda|Secret|Threads|Seeds|Timers|Off-screen|Arc:/);
});

test("returning characters appear only when named recently", () => {
    const s = scene();
    assert.deepEqual(findReturning(s, "Kazuma looks around the bar.").map(c => c.name), []);
    const back = findReturning(s, "The door opens and Sara walks in.");
    assert.deepEqual(back.map(c => c.name), ["Sara"]);
    const t = renderWorldForPrompt(s, { returning: back });
    assert.match(t, /Returning \(not in the scene; last known, use only if they reappear\)\n  Sara \| Outfit: green sundress \| last seen: went to the market/);
    assert.deepEqual(findReturning(s, "Sarah smiled").map(c => c.name), [], "whole words only");
});

test("empty state renders nothing", () => {
    assert.equal(isEmptyWorld(emptyWorld()), true);
    assert.equal(renderWorldForPrompt(emptyWorld()), "");
    assert.equal(renderWorldCard(emptyWorld()), "");
});

test("card markdown reads back through the card treatment", () => {
    const s = scene();
    s.pc.name = "Kazuma";
    const card = renderWorldCard(s);
    const parsed = parseWorldState(card);
    assert.deepEqual(parsed.header.map(h => h.label), ["Time", "Loc", "Wx"]);
    assert.equal(parsed.header[1].value, "Axel | guild tavern");
    assert.deepEqual(parsed.people.map(p => [p.name, p.isPc]), [["Kazuma", true], ["Aqua", false]]);
    assert.ok(parsed.people[0].fields.some(f => f.label === "Visible Condition" && f.value === "soaked"));
    assert.deepEqual(parsed.offscreen.map(o => o.name).sort(), ["Sara", "Wiz"]);
    assert.deepEqual(parsed.threads.map(t => t.text), ["Who stole the coin"]);
    assert.equal(parsed.summary.arc.value, "Escalation");
});

test("the card round-trips through the parser (legacy import of our own output)", () => {
    const s = scene();
    s.pc.name = "Kazuma";
    const back = applyWorldChanges(emptyWorld(), parseWorldBlocks(S(renderWorldCard(s))), { userNames: ["Kazuma"] }).state;
    assert.equal(back.scene.location, "Axel | guild tavern");
    assert.equal(back.pc.fields.outfit, "green cape");
    assert.equal(findCast(back, "Aqua").fields.agenda, "win back her followers");
    assert.equal(findCast(back, "Wiz").offscreen, "restocking her shop");
    assert.deepEqual(back.timers, ["landlord: 2 turns"]);
});

test("a model echoing the empty bootstrap template creates nothing", () => {
    const echo = renderWorldInstructions("bootstrap").template;
    const p = parseWorldBlocks(echo);
    const s = applyWorldChanges(emptyWorld(), p, {}).state;
    assert.equal(isEmptyWorld(s), true, JSON.stringify(p.changes));
});

test("a model echoing the empty update template creates nothing", () => {
    const p = parseWorldBlocks(renderWorldInstructions("update").template);
    assert.equal(p.changes.length, 0);
});

test("the update rules' own example lines parse as the rules describe", () => {
    const s = applyWorldChanges(scene(), parseWorldBlocks(U([
        "Time: Dawn", "Loc: The inn", "Wx: Clear",
        "Aqua.Outfit: towel",
        "+ Darkness", "Darkness.Outfit: armor",
        "- Aqua: upstairs",
        "Offscreen: Wiz = asleep",
        "Thread-: Who stole the coin", "Thread+: The crest's meaning",
        "Seed-: a demon crest", "Timer-: landlord: 2 turns",
        "Arc: Crisis", "Scene: Climax"
    ].join("\n"))), {}).state;
    assert.equal(s.scene.time, "Dawn");
    assert.equal(findCast(s, "Aqua").present, false);
    assert.equal(findCast(s, "Darkness").present, true);
    assert.equal(findCast(s, "Wiz").offscreen, "asleep");
    assert.deepEqual(s.threads, ["The crest's meaning"]);
    assert.deepEqual(s.seeds, []);
    assert.deepEqual(s.timers, []);
    assert.equal(s.arcPhase, "Crisis");
});
