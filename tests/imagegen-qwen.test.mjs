// node --test "tests/*.test.mjs"
// Plan 026: the Qwen Image style's texts and the shapes of its look and outfit prompts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { IMAGE_V2_BUILTIN, IMAGE_V2_PROMPTS, QWEN_ART_STYLES, qwenArtStyleText } from "../src/prompts/imageGenV2.js";
import {
    renderQwenLookPrompt, parseQwenLookBlocks, renderQwenOutfitPrompt, parseQwenOutfitBlocks,
} from "../src/features/imagegen/v2/looksCore.js";
import { V2_OUTFIT_TASK_QWEN } from "../src/features/imagegen/v2/prompt.js";
import { MEGUMIN_SLOT_REGISTRY } from "../data/slots.js";

test("the Qwen guide: one paragraph, @Name only where a character stands, the Characters in focus line", () => {
    const g = IMAGE_V2_BUILTIN.style.qwen;
    assert.match(g, /one long paragraph/);
    assert.match(g, /never @Name\)/, "the opening sentence names people in plain words");
    assert.match(g, /ONE framing/, "the framing decides whether a body is shown");
    assert.ok(g.includes("Three characters at most; mention anyone else briefly as people in the background."),
        "the sentence Characters in focus swaps");
    assert.doesNotMatch(g, /too small to see/, "small details are welcome on Qwen");
    // The example uses each @Name once.
    const example = g.slice(g.indexOf("Example"));
    assert.equal(example.match(/@Mira/g).length, 1);
    assert.equal(example.match(/@Theo/g).length, 1);
});

test("Qwen shot lines: no pov tag, and each names its framing", () => {
    const s = IMAGE_V2_BUILTIN.shotQwen;
    assert.deepEqual(Object.keys(s), ["cinematic", "pov", "portrait"]);
    assert.doesNotMatch(s.pov, /Include pov/);
    assert.match(s.pov, /\{\{user\}\}/);
    assert.match(s.portrait, /close-up/);
});

test("art styles: a detailed text for each, Your own sends your words, anime when nothing fits", () => {
    assert.equal(QWEN_ART_STYLES.at(-1).id, "custom");
    for (const s of QWEN_ART_STYLES.slice(0, -1)) assert.ok(s.text.split(" ").length >= 12, s.id);
    assert.equal(qwenArtStyleText("photo"), QWEN_ART_STYLES.find(s => s.id === "photo").text);
    assert.equal(qwenArtStyleText("custom", "  ink wash painting  "), "ink wash painting");
    assert.equal(qwenArtStyleText("custom", ""), QWEN_ART_STYLES[0].text);
    assert.equal(qwenArtStyleText("gone"), QWEN_ART_STYLES[0].text);
    assert.match(IMAGE_V2_PROMPTS.artStyleLine, /^Art style: \{\{artStyle\}\}\./);
});

test("Qwen looks: the prompt lists each character's tags, the answer is read back by name", () => {
    const p = renderQwenLookPrompt([{ name: "Jenny", tags: "female, young adult, short hair" }]);
    assert.match(p, /30 to 60 words/);
    assert.ok(p.includes("Jenny: female, young adult, short hair"));
    assert.ok(p.trimEnd().endsWith("<Character_Qwen name=\"Name\">a …</Character_Qwen>"));
    const r = parseQwenLookBlocks("<think>x</think><Character_Qwen name=\"Jenny\">\n a young woman with\n short brown hair </Character_Qwen>");
    assert.deepEqual(r, [{ name: "Jenny", qwen: "a young woman with short brown hair" }]);
});

test("Qwen outfits: one phrase per outfit, a leading 'wearing' and a full stop taken off", () => {
    const p = renderQwenOutfitPrompt([{ name: "Jenny", outfit: "grey tee, cutoff shorts" }]);
    assert.ok(p.includes("Jenny: grey tee, cutoff shorts"));
    assert.match(p, /<Outfit_Qwen name="Name">/);
    const r = parseQwenOutfitBlocks("<Outfit_Qwen name=\"Jenny\">wearing an oversized heather-grey tee and frayed denim shorts.</Outfit_Qwen>");
    assert.deepEqual(r, [{ name: "Jenny", outfit: "an oversized heather-grey tee and frayed denim shorts" }]);
    assert.match(V2_OUTFIT_TASK_QWEN, /\{\{who\}\}/);
});

test("every new Qwen text can be edited in Dev Mode, under its own label", () => {
    const keys = new Map(MEGUMIN_SLOT_REGISTRY.map(s => [s.key, s.label]));
    for (const k of ["imageV2.style.qwen", "imageV2.artStyleLine", "imageV2.shotQwen.pov", "imageV2.qwenLook.task",
        "imageV2.qwenOutfit.task", "imageV2.descriptionsInEnglish", "imageV2OutfitTaskQwen"]) {
        assert.ok(keys.has(k), k);
        assert.notEqual(keys.get(k), k.replace(/^imageV2\./, ""), `${k} has a label`);
    }
});
