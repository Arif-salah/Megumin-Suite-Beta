// node --test "tests/*.test.mjs"
// Plan 026: the Qwen Image style's texts and the shapes of its look and outfit prompts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { IMAGE_V2_BUILTIN, IMAGE_V2_PROMPTS, QWEN_ART_STYLES, qwenArtStyleText } from "../src/prompts/imageGenV2.js";
import {
    renderQwenLookPrompt, parseQwenLookBlocks, renderQwenOutfitPrompt, parseQwenOutfitBlocks,
} from "../src/features/imagegen/v2/looksCore.js";
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
});

test("every new Qwen text can be edited in Dev Mode, under its own label", () => {
    const keys = new Map(MEGUMIN_SLOT_REGISTRY.map(s => [s.key, s.label]));
    for (const k of ["imageV2.style.qwen", "imageV2.artStyleLine", "imageV2.shotQwen.pov", "imageV2.qwenLook.task",
        "imageV2.qwenOutfit.task", "imageV2.descriptionsInEnglish"]) {
        assert.ok(keys.has(k), k);
        assert.notEqual(keys.get(k), k.replace(/^imageV2\./, ""), `${k} has a label`);
    }
});

// ── Phase 2: the rules, the fill-in, the cached descriptions ──
import { renderV2Rules, v2Method } from "../src/features/imagegen/v2/prompt.js";
import { resolveImagePrompt } from "../src/features/imagegen/v2/resolve.js";
import { buildImageCast } from "../src/features/imagegen/v2/cast.js";
import { outfitHash, freshQwenText } from "../src/features/imagegen/v2/looksCore.js";

test("Qwen rules: its guide, the art style, its shot line, and Characters in focus", () => {
    const r = renderV2Rules({ style: "qwen", shot: "pov", artStyle: "ink wash painting.", focus: "all", method: "reference" });
    assert.ok(r.startsWith("## How to write the image prompt\nWrite one long paragraph"));
    assert.ok(r.includes("Art style: ink wash painting. Name it"), "one full stop, even when the text has its own");
    assert.ok(r.includes(IMAGE_V2_BUILTIN.shotQwen.pov));
    assert.doesNotMatch(r, /Previous_Image_Prompt|Include pov/);
    assert.match(r, /Every named character in the moment gets their own place in the frame/);
    assert.equal(v2Method("qwen", "reference"), "placeholders");
    assert.equal(v2Method("tags", "reference"), "reference");
});

const jenny = {
    name: "Jenny", aliases: [], sex: "female", look: "female, young adult, short hair", body: "slim",
    lookQwen: "a young woman in her early twenties with fair skin and short tousled medium-brown hair",
    outfit: "an oversized heather-grey graphic tee and frayed denim shorts"
};
const patel = { name: "Dr. Patel", aliases: [], sex: "female", look: "female, adult", body: "", lookQwen: "", outfit: "" };

test("Qwen fill-in: the description with no name, where she stands", () => {
    const r = resolveImagePrompt("The image is a medium-shot anime illustration of a young woman at a door. In the centre stands @Jenny. She grins.", { cast: [jenny], style: "qwen" });
    assert.equal(r.prompt, "The image is a medium-shot anime illustration of a young woman at a door. In the centre stands a young woman in her early twenties with fair skin and short tousled medium-brown hair, wearing an oversized heather-grey graphic tee and frayed denim shorts. She grins.");
    assert.doesNotMatch(r.prompt, /Jenny|slim/, "no name; no body in a medium shot");
    assert.deepEqual(r.filled, [{ name: "Jenny", part: "all" }]);
});

test("Qwen fill-in: @Name written twice keeps the full look where she stands, the short form elsewhere", () => {
    const r = resolveImagePrompt("The image is a full-body anime illustration showing @Jenny braced against a door. In the centre stands @Jenny. Light falls on @Jenny's face.", { cast: [jenny], style: "qwen" });
    assert.ok(r.prompt.startsWith("The image is a full-body anime illustration showing a young woman in her early twenties braced against a door. In the centre stands a young woman in her early twenties with fair skin"));
    assert.ok(r.prompt.includes("short tousled medium-brown hair, slim, wearing"), "full-body: the build goes in");
    assert.ok(r.prompt.endsWith("Light falls on the young woman's face."));
    assert.equal(r.filled.length, 1);
});

test("Qwen fill-in: 'from behind' later in the paragraph is not a framing", () => {
    const r = resolveImagePrompt("The image is a close-up anime illustration of a woman. Here is @Jenny, lit from behind.", { cast: [jenny], style: "qwen" });
    assert.doesNotMatch(r.prompt, /slim/);
});

test("Qwen fill-in: a full stop inside a name, a look with no description yet, a name with no look", () => {
    const r = resolveImagePrompt("The image is a wide shot of a clinic. @Dr. Patel stands by the desk next to @Nobody.", { cast: [patel], style: "qwen" });
    assert.ok(r.prompt.includes("A woman with female, adult stands by the desk next to Nobody."), r.prompt);
    assert.deepEqual(r.unknown, ["Nobody"]);
});

test("Qwen descriptions are used only while made from the same look and outfit", () => {
    const looks = { Jenny: { tags: "female, short hair", body: "", natural: "", aliases: [],
        qwen: { from: outfitHash("female, short hair"), text: "a young woman with short hair" },
        outfitQwen: { from: outfitHash("grey tee"), text: "a heather-grey cotton tee" } } };
    const world = { pc: { name: "Kazuma" }, cast: { jenny: { name: "Jenny", present: true, fields: { outfit: "grey tee" } } } };
    const fresh = buildImageCast({ looks, world, qwen: true }).find(m => m.name === "Jenny");
    assert.equal(fresh.lookQwen, "a young woman with short hair");
    assert.equal(fresh.outfit, "a heather-grey cotton tee");
    assert.ok(!fresh.lookQwenStale && !fresh.outfitQwenStale);

    world.cast.jenny.fields.outfit = "red dress";
    const changed = buildImageCast({ looks, world, qwen: true }).find(m => m.name === "Jenny");
    assert.equal(changed.outfit, "red dress", "the World State text stands in until it is described");
    assert.ok(changed.outfitQwenStale);
    assert.equal(changed.outfitText, "red dress");

    const other = buildImageCast({ looks, world, qwen: false }).find(m => m.name === "Jenny");
    assert.equal(other.lookQwen, "", "other styles never see the Qwen text");
    assert.equal(freshQwenText(null, "x"), null);
});

// ── Phase 3 ──
import { prefixForStyle, QUALITY_TAGS } from "../src/features/imagegen/qualityPrefix.js";
import { V2_STYLES } from "../src/features/imagegen/v2/prompt.js";

test("picking Qwen Image takes the quality tags out of the prefix and keeps your own words", () => {
    assert.ok(V2_STYLES.includes("qwen"));
    assert.equal(prefixForStyle("qwen", `${QUALITY_TAGS}, my lora trigger`), "my lora trigger");
    assert.equal(prefixForStyle("qwen", "my lora trigger"), "my lora trigger");
});
