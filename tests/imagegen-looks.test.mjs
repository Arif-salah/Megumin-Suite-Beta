// node --test "tests/*.test.mjs"
// Image Gen V2 phase 3: look scans — prompts, parsing, and what a scan may change.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    renderLookScanPrompt, renderNaturalPrompt, parseLookBlocks, parseNaturalBlocks, planLookUpdates, findLookKey,
    LOOK_SCAN_SYSTEM, NATURAL_SYSTEM, SHEET_FIRST, sheetNames, lookSourceFor
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

// ── Phase 4: outfits, position, NPC priority ─────────────────────────────
import { outfitHash, freshOutfitTags, renderOutfitTagsPrompt, parseOutfitBlocks, OUTFIT_SYSTEM } from "../src/features/imagegen/v2/looksCore.js";
import { buildImageCast } from "../src/features/imagegen/v2/cast.js";
import { renderCastList } from "../src/features/imagegen/v2/prompt.js";
import { parseWorldBlocks } from "../src/state/modules/world/parse.js";
import { emptyWorld, applyWorldChanges } from "../src/state/modules/world/model.js";

test("outfit tags are fresh only for the outfit they were made from (or when locked)", () => {
    const made = { from: outfitHash("Grey hoodie,  black joggers"), tags: "grey hoodie, black joggers" };
    assert.equal(freshOutfitTags(made, "grey hoodie, black joggers"), "grey hoodie, black joggers", "case and spacing do not matter");
    assert.equal(freshOutfitTags(made, "white towel"), null, "a new outfit needs new tags");
    assert.equal(freshOutfitTags({ ...made, locked: true }, "white towel"), "grey hoodie, black joggers");
    assert.equal(freshOutfitTags(undefined, "x"), null);
    assert.equal(freshOutfitTags({ from: outfitHash("x"), tags: "" }, "x"), null);
});

test("outfit prompt and parsing", () => {
    const p = renderOutfitTagsPrompt([{ name: "Matthew", outfit: "cropped black tee, pleated skirt" }]);
    assert.match(p, /Matthew: cropped black tee, pleated skirt/);
    assert.match(p, /<Outfit_Tags name="Name">tag, tag, tag<\/Outfit_Tags>$/);
    assert.doesNotMatch(p + OUTFIT_SYSTEM, /\b(extension|plugin|app|ledger|interface)\b/i);
    assert.deepEqual(parseOutfitBlocks('<Outfit_Tags name="Matthew \\"Matt\\"">black crop top, black pleated skirt, black crop top, 1boy</Outfit_Tags>'),
        [{ name: "Matthew", tags: "black crop top, black pleated skirt" }]);
});

function scene() {
    const t = `<World_State>\nKazuma.Outfit: grey hoodie\nKazuma.Position: on the bed\n+ Aqua\nAqua.Outfit: blue dress\nAqua.Position: by the door\n</World_State>`;
    return applyWorldChanges(emptyWorld(), parseWorldBlocks(t), { userNames: ["Kazuma"] }).state;
}

test("position goes into the Cast for the player and whoever is in the scene", () => {
    const looks = { Kazuma: { tags: "brown hair" }, Aqua: { tags: "blue hair" } };
    const list = renderCastList(buildImageCast({ world: scene(), userName: "Kazuma", looks }));
    assert.match(list, /@Kazuma: the player\n  appearance: brown hair\n  wearing: grey hoodie\n  position: on the bed/);
    assert.match(list, /@Aqua: in the scene\n  appearance: blue hair\n  wearing: blue dress\n  position: by the door/);
});

test("cast uses fresh outfit tags, and flags stale ones for remaking", () => {
    const looks = {
        Aqua: { tags: "female, blue hair", outfitTags: { from: outfitHash("blue dress"), tags: "blue dress, detached sleeves" } },
        Kazuma: { tags: "male", outfitTags: { from: outfitHash("black coat"), tags: "black coat" } }
    };
    const cast = buildImageCast({ world: scene(), userName: "Kazuma", looks, outfitTags: true });
    const by = n => cast.find(c => c.name === n);
    assert.equal(by("Aqua").outfit, "blue dress, detached sleeves");
    assert.equal(by("Aqua").outfitStale, false);
    assert.equal(by("Kazuma").outfit, "grey hoodie", "stale tags: the World State text until remade");
    assert.equal(by("Kazuma").outfitStale, true);
    assert.equal(by("Kazuma").outfitText, "grey hoodie");
    // Off: the World State text, nothing flagged.
    const off = buildImageCast({ world: scene(), userName: "Kazuma", looks });
    assert.equal(off.find(c => c.name === "Aqua").outfit, "blue dress");
    assert.equal(off.find(c => c.name === "Aqua").outfitStale, false);
});

test("NPC Bank priority: the stored look wins by default; npcFirst makes the NPC tags win", () => {
    const looks = { Aqua: { tags: "female, blue hair, wide hips" } };
    const npcs = [{ name: "Aqua", imageTags: "female, pink hair, long legs" }];
    const v2 = buildImageCast({ world: scene(), userName: "Kazuma", looks, npcs }).find(c => c.name === "Aqua");
    assert.equal(v2.look, "female, blue hair");
    assert.equal(v2.lookSource, "manual");
    const npc = buildImageCast({ world: scene(), userName: "Kazuma", looks, npcs, npcFirst: true }).find(c => c.name === "Aqua");
    assert.equal(npc.look, "female, pink hair");
    assert.equal(npc.body, "long legs");
    assert.equal(npc.lookSource, "npc");
});

test("look scan: lorebook entries go first, and a scan can run on lore alone", () => {
    const p = renderLookScanPrompt({ source: "Anno: hi", sourceLabel: "Recent_Story", names: ["Anno"], lore: "Anno has jet-black hair." });
    assert.ok(p.startsWith("<Lore>\nAnno has jet-black hair.\n</Lore>\n\n<Recent_Story>\nAnno: hi\n</Recent_Story>"));
    const only = renderLookScanPrompt({ source: "", names: ["Anno"], lore: "Anno has jet-black hair." });
    assert.doesNotMatch(only, /<Source>/);
    assert.equal(renderLookScanPrompt({ source: "x" }).startsWith("<Source>"), true, "no lore: unchanged");
});

test("look prompts ask for an age tag, never a number", () => {
    const p = renderLookScanPrompt({ source: "x" });
    assert.match(p, /Age is one of these tags, never a number or a decade: young adult, adult, mature female, mature male, old woman, old man\./);
    assert.match(p, /"late 20s" is "young adult"; "30s" is "adult"\./);
});

// A new chat is only the greeting: a card character's look comes from the card.
test("the automatic look reads the card before the story, and the card wins", () => {
    const p = renderLookScanPrompt({ source: "Aqua: Hello!", sourceLabel: "Recent_Story", names: ["Aqua"],
        sheets: '<character_sheet name="Aqua">Long blue hair, blue eyes.</character_sheet>' });
    assert.ok(p.indexOf("<Character_Sheets>") < p.indexOf("<Recent_Story>"));
    assert.ok(p.includes(SHEET_FIRST));
    const plain = renderLookScanPrompt({ source: "Aqua: Hello!", sourceLabel: "Recent_Story", names: ["Aqua"] });
    assert.ok(!plain.includes("<Character_Sheets>"));
    assert.ok(!plain.includes(SHEET_FIRST));
});

test("the names on the sheets", () => {
    const s = '<character_sheet name="Aqua">x</character_sheet>\n\n<persona_sheet name="Kazuma">y</persona_sheet>';
    assert.deepEqual(sheetNames(s), ["Aqua", "Kazuma"]);
    assert.deepEqual(sheetNames(""), []);
});

test("a look for someone on the card is marked as read from the card", () => {
    const card = ["Resha Helios", "Kazuma"];
    assert.equal(lookSourceFor("Resha Helios", [], card), "sheet");
    assert.equal(lookSourceFor("Resha", [], card), "sheet");
    assert.equal(lookSourceFor("kazuma", [], card), "sheet");
    assert.equal(lookSourceFor("Megumin", ["Kazuma"], card), "sheet");
    assert.equal(lookSourceFor("Res", [], card), "chat");
    assert.equal(lookSourceFor("Wiz", [], card), "chat");
    assert.equal(lookSourceFor("Wiz", [], []), "chat");
});
