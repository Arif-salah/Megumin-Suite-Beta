// node --test "tests/*.test.mjs"
// Image Gen V2 phase 3: look scans — prompts, parsing, and what a scan may change.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    renderLookScanPrompt, renderNaturalPrompt, parseLookBlocks, parseNaturalBlocks, planLookUpdates, findLookKey,
    LOOK_SCAN_SYSTEM, NATURAL_SYSTEM
} from "../src/features/imagegen/v2/looksCore.js";

const OFF_FRAME = /\b(extension|plugin|app|ledger|database|tracker|interface)\b/i;

test("scan prompt: source, who, rules, output shape; never off-frame", () => {
    const all = renderLookScanPrompt({ source: "Aqua is a goddess.", sourceLabel: "Character_Sheet" });
    assert.match(all, /^<Character_Sheet>\nAqua is a goddess\.\n<\/Character_Sheet>/);
    assert.match(all, /every character the text describes/);
    assert.match(all, /Never include: clothing/);
    assert.match(all, /<Character_Visual name="Name">tag, tag, tag<\/Character_Visual>$/);
    const some = renderLookScanPrompt({ source: "x", names: ["Aqua", "Wiz"] });
    assert.match(some, /these characters: Aqua, Wiz\. Skip anyone the text does not describe\./);
    for (const t of [all, some, LOOK_SCAN_SYSTEM, NATURAL_SYSTEM, renderNaturalPrompt([{ name: "A", tags: "red hair" }])]) {
        assert.doesNotMatch(t, OFF_FRAME);
    }
});

test("parse: blocks, nicknames, escaped quotes, count tags and duplicates removed", () => {
    const answer = `<think>let me see</think>
\`\`\`
<Character_Visual name="Matthew \\"Matt\\"">
1boy, male, black hair, purple eyes, black hair, solo
</Character_Visual>
<Character_Visual name='Aqua (Goddess)'>female, long blue hair, blue eyes</Character_Visual>
<Character_Visual name="Aqua">duplicate, ignored</Character_Visual>
<Character_Visual name="Empty"></Character_Visual>
<Character_Visual name="Wiz">brown hair, gentle eyes
\`\`\``;
    assert.deepEqual(parseLookBlocks(answer), [
        { name: "Matthew", aliases: ["Matt"], tags: "male, black hair, purple eyes" },
        { name: "Aqua", aliases: ["Goddess"], tags: "female, long blue hair, blue eyes" },
        { name: "Wiz", aliases: [], tags: "brown hair, gentle eyes" }
    ]);
});

test("parse: &quot; in the name attribute", () => {
    assert.deepEqual(parseLookBlocks('<Character_Visual name="Matthew &quot;Matt&quot;">male</Character_Visual>'),
        [{ name: "Matthew", aliases: ["Matt"], tags: "male" }]);
});

test("parse natural descriptions", () => {
    assert.deepEqual(parseNaturalBlocks('<Character_Natural name="Aqua">"a slender young\n woman with blue hair"</Character_Natural>'),
        [{ name: "Aqua", natural: "a slender young woman with blue hair" }]);
});

test("plan: new looks are added, established ones need a decision, locked ones are left alone", () => {
    const looks = {
        Matthew: { tags: "male, black hair", aliases: ["Matt"] },
        Aqua: { tags: "female, blue hair", locked: true },
        Wiz: { tags: "" },
        Sara: { tags: "red hair, green eyes" }
    };
    const plan = planLookUpdates(looks, [
        { name: "Matt", aliases: [], tags: "male, black hair, purple eyes" },    // via nickname → change
        { name: "Aqua", aliases: [], tags: "female, pink hair" },                // locked
        { name: "Wiz", aliases: [], tags: "brown hair" },                        // empty look → add
        { name: "Darkness", aliases: [], tags: "blonde" },                       // new → add
        { name: "Sara", aliases: [], tags: "Green Eyes, red hair" }              // same set, different order/case
    ]);
    assert.deepEqual(plan.change.map(x => [x.key, x.old, x.tags]), [["Matthew", "male, black hair", "male, black hair, purple eyes"]]);
    assert.deepEqual(plan.locked.map(x => x.key), ["Aqua"]);
    assert.deepEqual(plan.add.map(x => x.key), ["Wiz", "Darkness"]);
    assert.deepEqual(plan.same.map(x => x.key), ["Sara"]);
});

test("findLookKey: by name or nickname, either side", () => {
    const looks = { Matthew: { aliases: ["Matt"] }, Aqua: {} };
    assert.equal(findLookKey(looks, "matt"), "Matthew");
    assert.equal(findLookKey(looks, "Aqua-sama", ["Aqua"]), "Aqua");
    assert.equal(findLookKey(looks, "Nobody"), null);
});

import { matchScanToTargets } from "../src/features/imagegen/v2/looksCore.js";

test("scan results land on the character asked for, even under a nickname", () => {
    const scanned = [
        { name: "Matt", aliases: [], tags: "male, black hair" },
        { name: "Stranger", aliases: [], tags: "tall" }
    ];
    assert.deepEqual(matchScanToTargets(scanned, [{ name: "Matthew", aliases: ["Matt"] }]),
        [{ name: "Matthew", aliases: ["Matt"], tags: "male, black hair" }]);
    assert.deepEqual(matchScanToTargets(scanned, []), scanned, "no targets: keep everything");
    assert.deepEqual(matchScanToTargets(scanned, [{ name: "Aqua" }]), []);
});
