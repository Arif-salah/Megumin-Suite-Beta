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
