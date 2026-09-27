// node --test "tests/*.test.mjs"
// World State + image in one call (Chomusuke "Combine calls").
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderCombinedPrompt, splitCombinedAnswer, COMBINED_SYSTEM } from "../src/features/imagegen/v2/prompt.js";
import { renderWorldClerkTask, renderClerkNotes } from "../src/state/modules/world/render.js";
import { parseWorldBlocks } from "../src/state/modules/world/parse.js";
import { parseOutfitBlocks } from "../src/features/imagegen/v2/looksCore.js";

const OFF_FRAME = /\b(extension|plugin|app|ledger|database|tracker|interface)\b/i;

const base = (over = {}) => ({
    notes: renderClerkNotes("<Current_World_State>\n<!-- x -->\nLoc: Tavern\n</Current_World_State>"),
    earlier: "Aqua: Earlier line.",
    exchange: "Kazuma: I hand her a towel.\n\nAqua: She wraps it around herself.",
    world: renderWorldClerkTask("update"),
    ...over
});

test("V2: reference material first, sheets before the story, the tasks together at the end", () => {
    const { system, user, prefill } = renderCombinedPrompt(base({
        engine: "v2",
        castList: "<Cast>\n@Aqua: female, in the scene\n</Cast>",
        sheets: "<character_sheet name=\"Wiz\">A shopkeeper.</character_sheet>",
        imageRules: "## How to write the image prompt\n…",
        extras: { outfits: [{ name: "Kazuma", outfit: "grey hoodie" }], looks: ["Wiz"], followUpdate: true }
    }));
    const order = [
        "<Current_World_State>", "<Cast>", "<Character_Sheets>", "<Earlier_Story>", "<Latest_Exchange>",
        "# Task 1: World Update", "# Task 2: Image prompt", "# Also in the same answer", "# Answer in this shape and nothing else"
    ];
    const at = order.map(s => user.indexOf(s));
    assert.ok(at.every(i => i >= 0), JSON.stringify(at));
    assert.deepEqual([...at].sort((a, b) => a - b), at, "sections in this order");
    assert.match(user, /<!-- Where the story stood before the latest exchange\. -->/);
    assert.match(user, /<Cast> shows everyone as they stood BEFORE the latest exchange: where your World_Update changes someone's clothing or position, the image follows your World_Update/);
    assert.match(user, /Outfit tags for every character whose Outfit your World_Update changes, and for these outfits/);
    assert.match(user, /Kazuma: grey hoodie/);
    assert.match(user, /Appearance of Wiz/);
    assert.match(user, /<World_Update>\n\[change lines, or: No changes\]\n<\/World_Update>\n<Image_Prompt>the image prompt<\/Image_Prompt>\n<Outfit_Tags name="Name">[^\n]*\n<Character_Visual name="Name">/);
    assert.equal(prefill, "<World_Update>\n");
    assert.equal(system, COMBINED_SYSTEM);
    assert.doesNotMatch(system + user, OFF_FRAME);
});

test("Classic: its own rules and sheets; no cast, no outfit tags, no looks", () => {
    const { user } = renderCombinedPrompt(base({
        engine: "classic",
        castList: "<Cast>\nignored\n</Cast>",
        sheets: "<character_sheet name=\"Aqua\">Blue hair.</character_sheet>",
        imageRules: "**RELEVANT NPC IMAGE TAGS:** [Wiz]: brown hair\n\nBuild the prompt in this EXACT order…",
        extras: { outfits: [{ name: "Aqua", outfit: "x" }], looks: ["Wiz"], followUpdate: true }
    }));
    assert.doesNotMatch(user, /<Cast>|Outfit_Tags|Character_Visual|# Also in the same answer/);
    assert.ok(user.indexOf("<Character_Sheets>") < user.indexOf("<Latest_Exchange>"));
    assert.match(user, /# Task 2: Image prompt\nThe image shows the moment the latest exchange ends on; draw nothing that has already ended \(someone who put an item away no longer holds it\)\. Where your World_Update changes someone's clothing, draw them in the new clothing\.\n\*\*RELEVANT NPC IMAGE TAGS/);
    assert.match(user, /<\/World_Update>\n<Image_Prompt>the image prompt<\/Image_Prompt>$/);
});

test("first reply of a chat: a full World_State, and the prefill matches", () => {
    const r = renderCombinedPrompt(base({ notes: renderClerkNotes(""), world: renderWorldClerkTask("bootstrap"), engine: "v2", imageRules: "r" }));
    assert.match(r.user, /Nothing has been noted about this story yet/);
    assert.match(r.user, /# Task 1: World State\n## World State rules/);
    assert.match(r.user, /your World_State changes/);
    assert.equal(r.prefill, "<World_State>\n");
});

test("only-when-a-picture mode, and the previous prompt for the Edit method", () => {
    const r = renderCombinedPrompt(base({ engine: "v2", imageRules: "r", onlyIfPhoto: true, previous: "1girl, blue hair" }));
    assert.match(r.user, /If nobody in the latest exchange takes, sends or shares a picture, write <Image_Prompt>NONE<\/Image_Prompt>\./);
    assert.match(r.user, /<Previous_Image_Prompt>\n1girl, blue hair\n<\/Previous_Image_Prompt>/);
    assert.ok(r.user.indexOf("<Previous_Image_Prompt>") < r.user.indexOf("# Task 1"));
    assert.doesNotMatch(renderCombinedPrompt(base({ engine: "v2", imageRules: "r" })).user, /Previous_Image_Prompt|NONE/);
});

test("reading a combined answer that starts inside the prefilled World block", () => {
    // What the model returns after the "<World_Update>\n" prefill.
    const raw = "Aqua.Outfit: white bath towel\nAqua.Position: on the bed\n</World_Update>\n<Image_Prompt>1girl, @Aqua, sitting on bed, blushing, medium shot</Image_Prompt>\n<Outfit_Tags name=\"Aqua\">white bath towel</Outfit_Tags>";
    const world = parseWorldBlocks("<World_Update>\n" + raw);
    assert.equal(world.changes.find(c => c.field === "outfit").value, "white bath towel");
    const { prompt, rest } = splitCombinedAnswer(raw);
    assert.equal(prompt, "1girl, @Aqua, sitting on bed, blushing, medium shot");
    assert.deepEqual(parseOutfitBlocks(rest), [{ name: "Aqua", tags: "white bath towel" }]);
    // No <Image_Prompt> wrapper: the World lines never leak into the prompt.
    assert.equal(splitCombinedAnswer("Aqua.Outfit: towel\n</World_Update>\n1girl, @Aqua, smiling").prompt, "1girl, @Aqua, smiling");
    // A missing World block leaves the image intact.
    assert.equal(parseWorldBlocks("<Image_Prompt>x</Image_Prompt>"), null);
    assert.equal(splitCombinedAnswer("<Image_Prompt>1girl, @Aqua</Image_Prompt>").prompt, "1girl, @Aqua");
});
