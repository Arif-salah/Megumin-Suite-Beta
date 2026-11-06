// node --test "tests/*.test.mjs"
// Plan 027 phase 3: the Krea 2 style.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveImagePrompt, personNoun } from "../src/features/imagegen/v2/resolve.js";
import { renderV2Rules, renderV2Extras, v2Method, wantsLookDetail, V2_STYLES } from "../src/features/imagegen/v2/prompt.js";
import { renderLookScanPrompt } from "../src/features/imagegen/v2/looksCore.js";
import { IMAGE_V2_BUILTIN } from "../src/prompts/imageGenV2.js";
import { MEGUMIN_SLOT_REGISTRY } from "../data/slots.js";

const jenny = {
    name: "Jenny", aliases: [], sex: "female", look: "female, young adult, short hair, blue eyes", body: "large breasts, wide hips",
    lookRegions: { core: "1girl, female, young adult, tomboy", head: "short hair, blue eyes", upper: "large breasts", lower: "wide hips", feet: "" },
    outfit: "grey t-shirt, denim shorts, white sneakers",
    outfitRegions: { head: "", upper: "grey t-shirt", lower: "denim shorts", feet: "white sneakers" }
};
const hana = { name: "Hana", aliases: [], sex: "female", look: "female, mature female, long black hair", body: "", outfit: "white blouse" };
const krea = (p, cast = [jenny, hana]) => resolveImagePrompt(p, { cast, style: "krea" });

test("Krea: @Name becomes 'a young woman (tags), wearing …' with no name, after the name and mood the model wrote", () => {
    const r = krea("Medium shot from a doorway, looking at a young woman. On the left, Jenny, furious, teeth bared, @Jenny:waist, shoving forward.");
    assert.equal(r.prompt, "Medium shot from a doorway, looking at a young woman. On the left, Jenny, furious, teeth bared, a young woman (female, young adult, tomboy, short hair, blue eyes, large breasts, wide hips), wearing a grey t-shirt, denim shorts, shoving forward.");
    assert.deepEqual(r.filled, [{ name: "Jenny", part: "all", level: "waist" }]);
});

test("Krea: levels cut the look and outfit; a plain @Name takes the opening's framing; :nude", () => {
    assert.match(krea("Close-up of a face. Jenny, grinning, @Jenny, winks.").prompt, /\(female, young adult, tomboy, short hair, blue eyes\), wearing a grey t-shirt, winks/);
    assert.match(krea("Full body shot. Jenny, shy, @Jenny:full:nude, stands.").prompt, /wide hips\), nude, stands/);
});

test("Krea: only the first plain mention carries the look; possessives and repeats are the name", () => {
    const r = krea("Medium shot. On the left, Jenny, angry, @Jenny:waist, pushing past @Hana's shoulder. On the right, Hana, smug, @Hana, watching @Jenny.");
    assert.match(r.prompt, /pushing past Hana's shoulder\. On the right, Hana, smug, a woman \(female, mature female, long black hair\), wearing a white blouse, watching Jenny\.$/);
    assert.equal(r.filled.length, 2);
});

test("personNoun reads sex and age from the tags", () => {
    assert.equal(personNoun({ sex: "male" }, "male, old man, beard"), "an old man");
    assert.equal(personNoun({}, "female, young adult"), "a young woman");
    assert.equal(personNoun({}, "male, adult"), "a man");
    assert.equal(personNoun({}, "female, mature female"), "a woman", "'female' inside 'mature female' is not 'male'");
    assert.equal(personNoun({}, ""), "a person");
});

test("Krea rules: its guide, the levels, its shot line, no art style, Characters in focus", () => {
    const r = renderV2Rules({ style: "krea", shot: "pov", artStyle: "anime illustration" });
    assert.ok(r.includes(IMAGE_V2_BUILTIN.levels));
    assert.ok(r.includes(IMAGE_V2_BUILTIN.shotKrea.pov));
    assert.doesNotMatch(r, /anime illustration|Art style:/);
    assert.match(r, /The expression comes before @Name/);
    assert.match(renderV2Rules({ style: "krea", focus: "all" }), /Every named character in the moment gets their own place in the frame/);
    assert.match(renderV2Rules({ style: "krea", focus: "2" }), /Two characters at most;/);
    assert.equal(v2Method("krea", "reference"), "placeholders");
    assert.ok(V2_STYLES.includes("krea"));
});

test("the example writes the mood before @Name, and nothing of the frame talks about tools", () => {
    const g = IMAGE_V2_BUILTIN.style.krea;
    assert.match(g, /Mira, laughing, eyes squeezed shut and cheeks flushed, @Mira:waist,/);
    assert.doesNotMatch(g + Object.values(IMAGE_V2_BUILTIN.shotKrea).join(" "), /\b(extension|plugin|app|placeholder|fill(ed)? in)\b/i);
});

test("Qwen and Krea looks ask for body detail; Tags and Plain sentences don't", () => {
    assert.ok(wantsLookDetail("krea") && wantsLookDetail("qwen") && !wantsLookDetail("tags") && !wantsLookDetail("natural"));
    assert.ok(renderLookScanPrompt({ source: "x", detail: true }).includes(IMAGE_V2_BUILTIN.lookDetail));
    assert.ok(!renderLookScanPrompt({ source: "x" }).includes(IMAGE_V2_BUILTIN.lookDetail));
    assert.ok(renderV2Extras({ looks: ["Hana"], detail: true }).includes(IMAGE_V2_BUILTIN.lookDetail));
    assert.ok(!renderV2Extras({ looks: ["Hana"] }).includes(IMAGE_V2_BUILTIN.lookDetail));
});

test("every Krea text can be edited in Dev Mode, under its own label", () => {
    const keys = new Map(MEGUMIN_SLOT_REGISTRY.map(s => [s.key, s.label]));
    for (const k of ["imageV2.style.krea", "imageV2.shotKrea.cinematic", "imageV2.shotKrea.pov", "imageV2.shotKrea.portrait", "imageV2.lookDetail"]) {
        assert.ok(keys.has(k), k);
        assert.notEqual(keys.get(k), k.replace(/^imageV2\./, ""), `${k} has a label`);
    }
});

// ── Phase 4: Text in images ──────────────────────────────────────────────
import { drawsText } from "../src/features/imagegen/v2/prompt.js";

test("Text in images: Qwen and Krea only, only when the switch is on; inline uses single quotes", () => {
    const t = IMAGE_V2_BUILTIN.textInImages;
    assert.ok(drawsText("qwen") && drawsText("krea") && !drawsText("tags") && !drawsText("natural"));
    assert.ok(renderV2Rules({ style: "krea", text: true }).includes(t));
    assert.ok(renderV2Rules({ style: "qwen", text: true }).includes(t));
    assert.ok(!renderV2Rules({ style: "krea" }).includes(t));
    assert.ok(!renderV2Rules({ style: "tags", text: true }).includes("speech bubble"));
    const inline = renderV2Rules({ style: "krea", text: true, inline: true });
    assert.match(inline, /in English in single quotes/);
    assert.match(inline, /reads 'Back off!'/);
    assert.doesNotMatch(inline.slice(inline.indexOf("When the moment has")), /"Back off!"/);
    assert.match(t, /in English/);
});

test("Text in images can be edited in Dev Mode", () => {
    const keys = new Map(MEGUMIN_SLOT_REGISTRY.map(s => [s.key, s.label]));
    assert.equal(keys.get("imageV2.textInImages"), "Text in images (Qwen Image and Krea 2)");
});
