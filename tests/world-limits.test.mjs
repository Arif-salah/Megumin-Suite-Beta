// node --test "tests/*.test.mjs"
// Plan 022: World State limits set in its tab; Chomusuke's scene list; labels
// after names; the final check's <Blocks> line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyWorld, applyWorldChanges, presentCast, findCast } from "../src/state/modules/world/model.js";
import { parseWorldBlocks } from "../src/state/modules/world/parse.js";
import { renderWorldInstructions, renderWorldForPrompt, setWorldLimits } from "../src/state/modules/world/render.js";
import { worldModule } from "../src/state/modules/world/index.js";
import { parseBonds } from "../src/state/modules/stats/parse.js";
import { applyBonds } from "../src/state/modules/stats/model.js";
import { parseScene } from "../src/state/scene.js";
import { reminderSection } from "../src/engine/presetSections.js";

const U = b => `<World_Update>\n${b}\n</World_Update>`;

test("the user's limits cut the lists, and the rules and notes say the same numbers", () => {
    let s = emptyWorld();
    for (let i = 1; i <= 6; i++) s = applyWorldChanges(s, parseWorldBlocks(U(`Thread+: thread ${i}`)), { seq: i, limits: { threads: 5 } }).state;
    assert.deepEqual(s.threads, ["thread 2", "thread 3", "thread 4", "thread 5", "thread 6"]);
    setWorldLimits({ threads: 5, offscreen: 6 });
    try {
        const rules = renderWorldInstructions("update").rules;
        assert.match(rules, /Keep at most 5 Threads, 3 Seeds and 2 Timers/);
        assert.match(rules, /Keep at most 6 Off-screen lines/);
        assert.match(renderWorldForPrompt(s), /Threads \(5 of 5\)/);
    } finally { setWorldLimits({}); }
});

test("full update each time: no limits, whatever was set", () => {
    let s = emptyWorld();
    for (let i = 1; i <= 6; i++) s = applyWorldChanges(s, parseWorldBlocks(U(`Thread+: thread ${i}`)), { seq: i, limits: { threads: 2 }, noLimits: true }).state;
    assert.equal(s.threads.length, 6);
    assert.doesNotMatch(renderWorldInstructions("update", { noLimits: true }).rules, /Keep at most/);
});

test("Chomusuke's <Scene> (read with the update) sets who is there when the reply wrote none", () => {
    const base = applyWorldChanges(emptyWorld(), parseWorldBlocks("<World_State>\n+ Lona\n+ Kade\n</World_State>"), { seq: 1 }).state;
    const answer = U("Lona.Mood: tired") + "\n<Scene>\nHere: Lona\nRemote: Kade\n</Scene>";
    const parsed = worldModule.parse(answer);
    assert.ok(parsed.scene);
    const r = applyWorldChanges(base, parsed, { seq: 2, text: "A reply with no scene list." });
    assert.deepEqual(presentCast(r.state).map(c => c.name), ["Lona"]);
    assert.equal(findCast(r.state, "Kade").remote, true);
    // The reply's own list wins over Chomusuke's.
    const own = applyWorldChanges(base, parsed, { seq: 2, text: "x\n<Scene>\nHere: Kade\n</Scene>" });
    assert.deepEqual(presentCast(own.state).map(c => c.name), ["Kade"]);
});

test("a label after a name is not part of it", () => {
    assert.equal(parseBonds("<Bonds>\nCathleen Cairns (Remote): Affection: 47/100\n</Bonds>").people[0].name, "Cathleen Cairns");
    assert.deepEqual(parseScene("<Scene>\nHere: Lona (by the door)\n</Scene>").here.map(n => n.name), ["Lona"]);
    // A bracket added after a known name doesn't become their name.
    const s = applyBonds({ people: { dom: { name: "Dom", fields: {} } } }, { people: [{ name: "Dom (Bartender)", fields: [] }] }).state;
    assert.equal(s.people.dom.name, "Dom");
});

test("the final check asks for <Blocks> only on a turn that has it", () => {
    assert.doesNotMatch(reminderSection({ checks: "Check one." }), /Blocks/);
    assert.match(reminderSection({ checks: "Check one.", blocks: true }), /2\. The response ends with the <Blocks> section\.$/);
    assert.match(reminderSection({ checks: "Check one.", blocks: "scene" }), /<Scene> first\./);
});
