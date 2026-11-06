// node --test "tests/*.test.mjs"
// Plan 027 phase 1: looks and outfits sorted by where they sit on the body.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRegionLines, joinRegions, regionsToParts, isSorted, holdToOriginal, OUTFIT_REGIONS } from "../src/features/imagegen/v2/regions.js";
import {
    parseLookBlocks, parseOutfitBlocks, planLookUpdates, renderSortLooksPrompt, renderLookScanPrompt, SORT_LOOKS_SYSTEM
} from "../src/features/imagegen/v2/looksCore.js";
import { renderV2Extras } from "../src/features/imagegen/v2/prompt.js";

const JENNY = `<Character_Visual name="Jenny">
Core: 1girl, female, young adult, tomboy, fair skin
Head: short hair, messy hair, brown hair,
  blue eyes
**Upper:** large breasts
- Lower: wide hips, brown hair
Feet:
</Character_Visual>`;

test("a look in lines: each part read, count tags out, a tag on two lines kept on the first, a wrapped line joined", () => {
    const [j] = parseLookBlocks(JENNY);
    assert.deepEqual(j.regions, {
        core: "female, young adult, tomboy, fair skin",
        head: "short hair, messy hair, brown hair, blue eyes",
        upper: "large breasts",
        lower: "wide hips",
        feet: ""
    });
    assert.equal(j.tags, "female, young adult, tomboy, fair skin, short hair, messy hair, brown hair, blue eyes, large breasts, wide hips");
    assert.deepEqual(regionsToParts(j.regions), {
        always: "female, young adult, tomboy, fair skin, short hair, messy hair, brown hair, blue eyes",
        body: "large breasts, wide hips"
    });
});

test("an answer with no lines is read as one tag list, as before", () => {
    assert.deepEqual(parseLookBlocks('<Character_Visual name="Aqua">female, blue hair</Character_Visual>'),
        [{ name: "Aqua", aliases: [], tags: "female, blue hair" }]);
    assert.equal(parseRegionLines("female, blue hair"), null);
    assert.equal(parseRegionLines("Core:\nHead:"), null, "all lines empty: nothing usable");
});

test("a label written twice keeps its first line; an unknown label ends the part above it", () => {
    const r = parseRegionLines("Head: red hair\nHead: blue hair\nMood: happy, smiling\nUpper: wings");
    assert.equal(r.head, "red hair");
    assert.equal(r.upper, "wings");
    assert.doesNotMatch(joinRegions(r), /happy/);
});

test("outfits in lines: Core is not an outfit part, tags joined in body order", () => {
    const [o] = parseOutfitBlocks(`<Outfit_Tags name="Jenny">
Head:
Upper: oversized heather-grey graphic t-shirt, laminated visitor badge
Lower: frayed light-blue denim cutoff shorts
Feet: white sneakers
</Outfit_Tags>`);
    assert.deepEqual(Object.keys(o.regions), OUTFIT_REGIONS);
    assert.equal(o.tags, "oversized heather-grey graphic t-shirt, laminated visitor badge, frayed light-blue denim cutoff shorts, white sneakers");
    assert.equal(o.regions.feet, "white sneakers");
});

test("sorting an old look may only move its own tags: made-up ones dropped, forgotten ones go in Core", () => {
    const sorted = holdToOriginal({ core: "female, smiling", head: "Brown Hair, blue eyes", upper: "", lower: "", feet: "" },
        "female, brown hair, blue eyes, freckles");
    assert.deepEqual(sorted, { core: "female, freckles", head: "brown hair, blue eyes", upper: "", lower: "", feet: "" });
    assert.equal(holdToOriginal({ core: "made up" }, "female"), null);
    assert.equal(holdToOriginal(null, "female"), null);
    assert.ok(isSorted({ regions: sorted }));
    assert.ok(!isSorted({ tags: "female" }));
});

test("the sorting prompt lists each look and asks for the tags exactly as given", () => {
    const p = renderSortLooksPrompt([{ name: "Jenny", tags: "female, brown hair" }]);
    assert.match(p, /written exactly as given\. Add no tags\./);
    assert.ok(p.includes("Jenny: female, brown hair"));
    assert.ok(p.trimEnd().endsWith("Feet:\n</Character_Visual>"));
    assert.doesNotMatch(p + SORT_LOOKS_SYSTEM, /\b(extension|plugin|app|ledger|interface)\b/i);
});

test("a scan's sorting reaches the look it adds", () => {
    const plan = planLookUpdates({}, parseLookBlocks(JENNY));
    assert.equal(plan.add[0].regions.upper, "large breasts");
});

import { matchScanToTargets } from "../src/features/imagegen/v2/looksCore.js";

test("a look written under the full name lands on the character asked for by first name, and back", () => {
    const [k] = parseLookBlocks('<Character_Visual name="Koromi Hazami">\nCore: female, mature female\nHead: brown hair\n</Character_Visual>');
    const [hit] = matchScanToTargets([k], [{ name: "Koromi" }]);
    assert.equal(hit.name, "Koromi");
    assert.deepEqual(hit.aliases, ["Koromi Hazami"], "the full name is kept as a nickname");
    assert.equal(matchScanToTargets([{ name: "Koromi", aliases: [], tags: "x" }], [{ name: "Koromi Hazami" }])[0].name, "Koromi Hazami");
    assert.deepEqual(matchScanToTargets([k], [{ name: "Koromi Ito" }, { name: "Koromi" }]).map(x => x.name), ["Koromi"]);
    assert.deepEqual(matchScanToTargets([k], [{ name: "Hazami" }]), [], "a surname alone never picks");
});

test("the look scan and the image call ask for the parts", () => {
    assert.match(renderLookScanPrompt({ source: "x" }), /\nUpper: chest, shoulders, arms and hands/);
    const extras = renderV2Extras({ outfits: [{ name: "Jenny", outfit: "grey tee" }], looks: ["Hana"] });
    assert.match(extras, /sorted by where they are worn/);
    assert.match(extras, /sorted by where they show on the body: Core/);
    assert.match(extras, /<Character_Visual name="Name">\nCore: female, young adult, /);
    assert.match(extras, /Head always has hair \(colour, length, style\) and eye colour/);
});

// ── Phase 2: levels ──────────────────────────────────────────────────────
import { readLevel, framingLevel } from "../src/features/imagegen/v2/regions.js";
import { resolveImagePrompt } from "../src/features/imagegen/v2/resolve.js";
import { IMAGE_V2_BUILTIN } from "../src/prompts/imageGenV2.js";
import { renderV2Rules } from "../src/features/imagegen/v2/prompt.js";

const jenny = {
    name: "Jenny", aliases: [], sex: "female", look: "female, young adult, short hair, blue eyes", body: "large breasts, wide hips",
    lookRegions: { core: "female, young adult", head: "short hair, blue eyes", upper: "large breasts", lower: "wide hips", feet: "" },
    outfit: "grey t-shirt, denim shorts, white sneakers",
    outfitRegions: { head: "", upper: "grey t-shirt", lower: "denim shorts", feet: "white sneakers" }
};
const fill = (p, style = "tags", cast = [jenny]) => resolveImagePrompt(p, { cast, style }).prompt;

test("levels are read after @Name, in any order with :nude", () => {
    assert.deepEqual(readLevel(":waist. She"), { level: "waist", nude: false, length: 6 });
    assert.deepEqual(readLevel(":nude:full,"), { level: "full", nude: true, length: 10 });
    assert.deepEqual(readLevel(":nude"), { level: "", nude: true, length: 5 });
    assert.equal(readLevel(":waistcoat").length, 0, "a longer word is not a level");
    assert.equal(readLevel("'s hand").length, 0);
});

test("a plain @Name takes its level from the opening's framing, else full", () => {
    assert.equal(framingLevel("1girl, indoors, close-up,"), "face");
    assert.equal(framingLevel("A medium shot inside a bar."), "waist");
    assert.equal(framingLevel("2girls, upper body, then a full body mirror"), "upper", "the first framing wins");
    assert.equal(framingLevel("1girl, bedroom", "far below: wide shot"), "full", "the whole prompt when the opening has none");
    assert.equal(framingLevel("1girl, bedroom"), "full");
});

test("each level hands in only the parts it shows: no shoes in a close-up, the top kept", () => {
    assert.equal(fill("1girl, close-up,\nOn the left is @Jenny:face. She grins."),
        "1girl, close-up,\nOn the left is Jenny, female, young adult, short hair, blue eyes, wearing a grey t-shirt. She grins.");
    assert.match(fill("On the left is @Jenny:upper. She waves."), /blue eyes, large breasts, wearing a grey t-shirt\./);
    assert.match(fill("On the left is @Jenny:waist. She waves."), /large breasts, wide hips, wearing a grey t-shirt, denim shorts\./);
    assert.match(fill("On the left is @Jenny:full. She waves."), /wearing a grey t-shirt, denim shorts, white sneakers\./);
    assert.match(fill("1girl, close-up,\nOn the left is @Jenny. She grins."), /blue eyes, wearing a grey t-shirt\./, "plain @Name: the framing's level");
});

test(":nude: the look at that level, no outfit", () => {
    assert.match(fill("1girl, full body,\nOn the left is @Jenny:full:nude. She stretches."), /short hair, blue eyes, large breasts, wide hips, nude\. She/);
    assert.match(fill("A close-up. On the left is @Jenny:nude.", "natural"), /blue eyes, nude\./);
});

test("an unsorted look: the body from :waist down; an unsorted outfit goes in whole", () => {
    const old = { ...jenny, lookRegions: null, outfitRegions: null };
    assert.match(fill("On the left is @Jenny:face.", "tags", [old]), /blue eyes, wearing a grey t-shirt, denim shorts, white sneakers\.$/);
    assert.match(fill("On the left is @Jenny:waist.", "tags", [old]), /blue eyes, large breasts, wide hips, wearing/);
});

test("Qwen: the parts of the description the level shows, the outfit by part", () => {
    const q = { ...jenny, lookQwen: "x",
        lookQwenParts: { core: "a young woman in her twenties", head: "short brown hair", upper: "a full bust", lower: "wide hips", feet: "" },
        outfitQwenParts: { head: "", upper: "a loose grey cotton t-shirt", lower: "faded denim shorts", feet: "white canvas sneakers" } };
    const r = fill("The image is a close-up of a young woman. In the centre stands @Jenny. She grins.", "qwen", [q]);
    assert.match(r, /stands a young woman in her twenties, short brown hair, wearing a loose grey cotton t-shirt\. She/);
    assert.match(fill("The image is a portrait. Here is @Jenny:full.", "qwen", [q]), /wide hips, wearing a loose grey cotton t-shirt, faded denim shorts, white canvas sneakers\.$/);
});

test("every @Name style is told about levels, and its example uses them; Edit the last prompt is not", () => {
    for (const style of ["tags", "natural", "qwen"]) {
        const r = renderV2Rules({ style });
        assert.ok(r.includes(IMAGE_V2_BUILTIN.levels), style);
        assert.match(r, /@Mira:waist/, style);
    }
    assert.ok(!renderV2Rules({ style: "tags", method: "reference" }).includes(IMAGE_V2_BUILTIN.levels));
});
