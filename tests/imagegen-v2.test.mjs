// node --test "tests/*.test.mjs"
// Image Gen V2 (plan 006): @Name substitution, the image cast, and the prompts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveImagePrompt, stripCountTags, dedupeTags, splitTags, isLineLayout, wearingPhrase } from "../src/features/imagegen/v2/resolve.js";
import { buildImageCast, inImage, needsLook } from "../src/features/imagegen/v2/cast.js";
import { renderCastList, renderV2Rules, renderV2ManualPrompt, renderV2InlineInstruction } from "../src/features/imagegen/v2/prompt.js";
import { parseWorldBlocks } from "../src/state/modules/world/parse.js";
import { emptyWorld, applyWorldChanges } from "../src/state/modules/world/model.js";

const CAST = [
    { name: "Aqua", look: "1girl, long blue hair, blue eyes, slender", lookNatural: "a slender young woman with long blue hair and blue eyes", outfit: "blue dress, detached sleeves" },
    { name: "Matthew", aliases: ["Matt"], look: "1boy, male focus, two-tone black and purple hair, purple eyes, petite", outfit: "cropped black tee, pleated black mini skirt" },
    { name: "Lady Darkness", look: "blonde ponytail, armor", outfit: "full plate armor" },
    { name: "Lady", look: "old woman" },
    { name: "Wiz", look: "" , outfit: "purple robe" }
];
const R = (p, style = "tags") => resolveImagePrompt(p, { cast: CAST, style });

// ── Substitution ─────────────────────────────────────────────────────────

test("@Name puts in the look then the outfit, word for word", () => {
    const r = R("1girl, @Aqua, sitting at the bar, warm lamplight");
    assert.equal(r.prompt, "1girl, long blue hair, blue eyes, slender, blue dress, detached sleeves, sitting at the bar, warm lamplight");
    assert.deepEqual(r.filled, [{ name: "Aqua", part: "all" }]);
});

test("the look's own count tags never reach the prompt; the model's stay at the front", () => {
    const r = R("1girl, 1boy, @Aqua, @Matthew, holding hands");
    assert.equal(r.prompt.split(", ").filter(t => /^1(girl|boy)$/.test(t)).length, 2);
    assert.ok(r.prompt.startsWith("1girl, 1boy, long blue hair"));
    assert.ok(!/male focus/.test(r.prompt));
});

test("@Name is the only placeholder: .look / .outfit written anyway are plain @Name", () => {
    // The outfit always comes from World State, never from the model.
    const full = "long blue hair, blue eyes, slender, blue dress, detached sleeves";
    assert.equal(R("@Aqua.look").prompt, full);
    assert.equal(R("@Aqua.outfit").prompt, full);
    assert.equal(R("@Aqua.appearance, @Aqua.clothes").prompt, full);
    // The reported case: the model's own clothing guess after @Matt.look is not what
    // it wears; the stored outfit goes in (the guessed tags are the prompt's, not ours).
    assert.match(R("1boy, @Matt.look, pov").prompt, /^1boy, two-tone black and purple hair, purple eyes, petite, cropped black tee, pleated black mini skirt, pov$/);
    // An unrelated word after a dot is left alone.
    assert.equal(R("@Aqua.").prompt, "long blue hair, blue eyes, slender, blue dress, detached sleeves, .".replace(", .", "."));
});

test("longest name wins, nicknames resolve, case does not matter", () => {
    assert.match(R("@Lady Darkness, standing").prompt, /^blonde ponytail, armor, full plate armor, standing$/);
    assert.equal(R("@Lady, sitting").prompt, "old woman, sitting");
    assert.match(R("@matt, smiling").prompt, /^two-tone black and purple hair/);
});

test("a name must end on a word boundary", () => {
    const r = R("@Aquarius");
    assert.equal(r.prompt, "Aquarius");
    assert.deepEqual(r.unknown, ["Aquarius"]);
});

test("unknown names become the plain name and are reported; no raw @ reaches ComfyUI", () => {
    const r = R("1girl, @Stranger, rain");
    assert.equal(r.prompt, "1girl, Stranger, rain");
    assert.deepEqual(r.unknown, ["Stranger"]);
    assert.ok(!r.prompt.includes("@"));
});

test("an @ inside a word is not a placeholder", () => {
    assert.equal(R("sign reading user@host").prompt, "sign reading user@host");
});

test("a character with no look falls back to their outfit, or their name, and is reported", () => {
    const r = R("@Wiz, shopkeeping");
    assert.equal(r.prompt, "purple robe, shopkeeping");
    assert.deepEqual(r.noLook, ["Wiz"]);
});

test("duplicate tags the model added anyway are dropped (tags style)", () => {
    assert.equal(R("1girl, @Aqua, blue eyes, Blue Eyes, smiling").prompt,
        "1girl, long blue hair, blue eyes, slender, blue dress, detached sleeves, smiling");
});

test("weights keep their commas and survive", () => {
    assert.deepEqual(splitTags("(red, blue:1.2), a, [b, c]"), ["(red, blue:1.2)", "a", "[b, c]"]);
    assert.equal(stripCountTags("(1girl:1.1), solo, long hair"), "long hair");
    assert.equal(dedupeTags("a, A, b,, a"), "a, b");
});

test("natural style: the description and 'wearing', in the sentence", () => {
    const r = R("@Aqua leans on the bar while @Matt watches her.", "natural");
    assert.equal(r.prompt,
        "Aqua, a slender young woman with long blue hair and blue eyes, wearing a blue dress, detached sleeves, leans on the bar while Matthew, two-tone black and purple hair, purple eyes, petite, wearing a cropped black tee, pleated black mini skirt, watches her.");
});

test("a finished prompt goes through unchanged (Retry reproduces the image)", () => {
    const once = R("1girl, @Aqua, rain").prompt;
    assert.equal(R(once).prompt, once);
});

// ── The image cast ───────────────────────────────────────────────────────

function world() {
    const t = `<World_State>\nLoc: Tavern\nKazuma.Outfit: green cape\n+ Matthew "Matt"\nMatt.Outfit: cropped black tee\n+ Aqua\nAqua.Outfit: blue dress\nOffscreen: Wiz = restocking\n</World_State>`;
    return applyWorldChanges(emptyWorld(), parseWorldBlocks(t), { userNames: ["Kazuma"] }).state;
}

test("cast: player, present and absent from World State; looks attach by name or nickname", () => {
    const cast = buildImageCast({
        world: world(),
        userName: "Kazuma",
        looks: {
            "Matt": { tags: "purple eyes", aliases: [] },             // a task 003/004 entry under the nickname
            "Aqua": { tags: "blue hair", natural: "a blue-haired woman", source: "sheet" },
            "{{user}}": { tags: "brown hair" },
            "Sara": { tags: "red hair" }                              // stored look, not in World State
        },
        npcs: [{ name: "Wiz", imageTags: "brown hair, gentle smile" }, { name: "Aqua", imageTags: "ignored" }],
        recentText: "Later Sara knocked."
    });
    const by = n => cast.find(c => c.name === n);
    assert.deepEqual(cast.map(c => c.name), ["Kazuma", "Matthew", "Aqua", "Wiz", "Sara"]);
    assert.equal(by("Kazuma").isPc, true);
    assert.equal(by("Kazuma").look, "brown hair");
    assert.equal(by("Kazuma").outfit, "green cape");
    assert.equal(by("Matthew").look, "purple eyes");
    assert.deepEqual(by("Matthew").aliases, ["Matt"]);
    assert.equal(by("Matthew").outfit, "cropped black tee");
    assert.equal(by("Aqua").lookNatural, "a blue-haired woman");
    assert.equal(by("Aqua").lookSource, "sheet");
    assert.equal(by("Wiz").look, "brown hair, gentle smile");
    assert.equal(by("Wiz").lookSource, "npc");
    assert.equal(by("Wiz").inScene, false);
    assert.equal(by("Sara").mentioned, true);
    assert.equal(by("Wiz").mentioned, false);
});

test("cast without World State still works from looks alone", () => {
    const cast = buildImageCast({ looks: { Aqua: { tags: "blue hair" } }, userName: "Kazuma" });
    assert.deepEqual(cast.map(c => [c.name, c.isPc, c.look]), [["Kazuma", true, ""], ["Aqua", false, "blue hair"]]);
});

// ── Prompts ──────────────────────────────────────────────────────────────

const OFF_FRAME = /\b(extension|plugin|app|system|ledger|database|tracker|interface|filled in|substitut\w*|replac\w*)\b/i;

test("cast list: player, in scene, mentioned; POV leaves the player out", () => {
    const cast = buildImageCast({
        world: world(), userName: "Kazuma",
        looks: { Sara: { tags: "female, red hair, long legs" }, Matthew: { tags: "male, purple eyes, wide hips" } },
        recentText: "Sara waved"
    });
    const list = renderCastList(cast);
    assert.equal(list, [
        "<Cast>",
        "@Kazuma: the player",
        "  wearing: green cape",
        "@Matthew (also @Matt): male, in the scene",
        "  appearance: male, purple eyes",
        "  body (only when the shot shows it): wide hips",
        "  wearing: cropped black tee",
        "@Aqua: in the scene",
        "  wearing: blue dress",
        "@Sara: female, not in the scene",
        "  appearance: female, red hair",
        "  body (only when the shot shows it): long legs",
        "  wearing: not noted (describe what they wear)",
        "</Cast>"
    ].join("\n"));
    assert.doesNotMatch(renderCastList(cast, { shot: "pov" }), /Kazuma/);
    // Reference method: plain names, no @.
    assert.match(renderCastList(cast, { method: "reference" }), /^<Cast>\nKazuma: the player\n[\s\S]*Matthew \(also Matt\): male, in the scene/);
});

test("the model describes clothing only for characters with no outfit on file", () => {
    const list = renderCastList([
        { name: "Aqua", inScene: true, outfit: "blue dress" },
        { name: "Wiz", inScene: true, outfit: "" }
    ]);
    assert.match(list, /@Aqua: in the scene\n  wearing: blue dress\n/);
    assert.match(list, /@Wiz: in the scene\n  wearing: not noted \(describe what they wear\)/);
    for (const style of ["tags", "natural"]) {
        const r = renderV2Rules({ style });
        assert.doesNotMatch(r, /\.look|\.outfit/, "no other placeholder is offered");
        assert.match(r, /The one exception: when <Cast> explicitly says "wearing: not noted"/);
    }
});

test("rules: numbered layout + rules + example + shot + extra, and never off-frame", () => {
    for (const style of ["tags", "natural"]) {
        for (const shot of ["cinematic", "pov", "portrait"]) {
            const r = renderV2Rules({ style, shot, extra: "moody" });
            assert.match(r, /^## How to write the image prompt\nWrite it top to bottom/);
            assert.match(r, /2\. \*\*One (line|sentence) per character\*\*: where they are in the frame/);
            assert.match(r, /Example \(made-up characters; use the names from <Cast>\):\n/);
            assert.match(r, /Write each @Name once\. Use no names anywhere else/);
            assert.match(r, /not "Mira's bedroom"/);
            assert.match(r, /\nShot: /);
            assert.match(r, /Extra instructions: moody$/);
            assert.doesNotMatch(r, OFF_FRAME);
        }
    }
    assert.match(renderV2Rules({ style: "tags" }), /exactly ONE framing/);
    assert.match(renderV2Rules({ style: "tags" }), /one person: add solo/);
    assert.match(renderV2Rules({ style: "tags" }), /No quality tags/);
    assert.match(renderV2Rules({ style: "natural" }), /in plain sentences/);
    assert.match(renderV2Rules({ shot: "pov" }), /through \{\{user\}\}'s eyes\. Include pov\. \{\{user\}\} is the viewer: write "the viewer" for them/);
});

test("the prompt examples resolve cleanly when those characters exist", () => {
    // The example line is itself a valid prompt: run it through the resolver.
    const mira = { name: "Mira", look: "1girl, red hair, green eyes", outfit: "white blouse" };
    const theo = { name: "Theo", look: "1boy, black hair", outfit: "grey coat" };
    const rules = renderV2Rules({ style: "tags" });
    const example = rules.slice(rules.indexOf("1girl, 1boy, indoors")).split("\nShot:")[0];
    assert.equal(resolveImagePrompt(example, { cast: [mira, theo] }).prompt, [
        "1girl, 1boy, indoors, tavern, night, medium shot,",
        "On the left is Mira, red hair, green eyes, wearing a white blouse. She sits at the bar, laughing, holding a mug.",
        "On the right is Theo, black hair, wearing a grey coat. He leans on the counter, smiling at her.",
        "wooden bar, shelves of bottles, rainy window, warm lamplight"
    ].join("\n"));
    const nat = renderV2Rules({ style: "natural" });
    const natExample = nat.slice(nat.indexOf("A medium shot inside")).split("\nShot:")[0];
    assert.match(resolveImagePrompt(natExample, { cast: [mira, theo], style: "natural" }).prompt,
        /\nOn the left is Mira, red hair, green eyes, wearing a white blouse\. She sits/);
});

test("line layout: each character's look in their own sentence, nothing deduplicated across them", () => {
    const anno = { name: "Anno", look: "female, young adult, black hair, blue eyes", body: "petite, thick thighs", outfit: "white cat-print bra, blue dolphin shorts" };
    const matt = { name: "Matt", look: "male, young adult, brown hair, blue eyes", outfit: "oversized pink sweater" };
    const p = "1girl, 1boy, pov, indoors, bedroom, night, medium shot,\nIn the foreground on the right is @Anno. She looks at the viewer.\nIn the background on the left is @Matt. He blushes.\nneon monitor glow";
    const r = resolveImagePrompt(p, { cast: [anno, matt] });
    assert.equal(r.prompt, [
        "1girl, 1boy, pov, indoors, bedroom, night, medium shot,",
        "In the foreground on the right is Anno, female, young adult, black hair, blue eyes, wearing a white cat-print bra, blue dolphin shorts. She looks at the viewer.",
        "In the background on the left is Matt, male, young adult, brown hair, blue eyes, wearing an oversized pink sweater. He blushes.",
        "neon monitor glow"
    ].join("\n"));
    // Full-body framing adds the body; a one-line "is @Name" prompt is still the line layout.
    const one = resolveImagePrompt("1girl, solo, full body, On the left is @Anno. She waves.", { cast: [anno] }).prompt;
    assert.match(one, /is Anno, female, young adult, black hair, blue eyes, petite, thick thighs, wearing a white cat-print bra/);
    // A repeat in the line layout is the plain name; the old flat line is unchanged.
    assert.match(resolveImagePrompt("On the left is @Anno. @Anno waves.", { cast: [anno] }).prompt, /\. Anno waves\.$/);
    assert.equal(isLineLayout("1girl, @Anno, waving"), false);
    assert.equal(isLineLayout("1girl\nOn the left is @Anno."), true);
});

test("wearing: the article from the first word; states of dress as they are", () => {
    assert.equal(wearingPhrase("grey hoodie"), "wearing a grey hoodie");
    assert.equal(wearingPhrase("oversized sweater"), "wearing an oversized sweater");
    assert.equal(wearingPhrase("wearing a towel"), "wearing a towel");
    assert.equal(wearingPhrase("her school uniform"), "wearing her school uniform");
    assert.equal(wearingPhrase("naked"), "naked");
    assert.equal(wearingPhrase(""), "");
    // No look: name and outfit; no look and no outfit: just the name.
    assert.equal(resolveImagePrompt("On the left is @Wiz.", { cast: [{ name: "Wiz", outfit: "purple robe" }] }).prompt, "On the left is Wiz, wearing a purple robe.");
    assert.equal(resolveImagePrompt("On the left is @Wiz.", { cast: [{ name: "Wiz" }] }).prompt, "On the left is Wiz.");
});

test("manual and inline prompts carry the cast and the rules", () => {
    const castList = "<Cast>\n@Aqua: in the scene\n</Cast>";
    const rules = renderV2Rules({});
    const m = renderV2ManualPrompt({ castList, scene: "Loc: Tavern", earlier: "Theo: Evening.", last: "Aqua: Hi.", rules });
    assert.match(m.user, /^<Cast>[\s\S]*<Scene>\nLoc: Tavern\n<\/Scene>\n\n<Earlier_Story>\nTheo: Evening\.\n<\/Earlier_Story>\n\n<Last_Message>\nAqua: Hi\.\n<\/Last_Message>[\s\S]*## How to write the image prompt[\s\S]*The image shows the moment <Last_Message> ends on\.[\s\S]*Output only the prompt, nothing else\.$/);
    assert.doesNotMatch(renderV2ManualPrompt({ last: "Aqua: Hi.", rules }).user, /<Earlier_Story>\n/, "no empty earlier block");
    assert.doesNotMatch(m.system + m.user, OFF_FRAME);
    const inl = renderV2InlineInstruction({ conditionalText: "ONLY IF A PHOTO. ", imageCount: 2, castList, rules });
    assert.match(inl, /^### IMAGE\nONLY IF A PHOTO\. Within your response, insert 2 image tag\(s\)/);
    assert.match(inl, /never use double quotes\.$/);
    assert.doesNotMatch(inl, OFF_FRAME);
});

// ── The reported output (the model broke the rules; the resolver still copes) ──

const KAZUMA = { name: "Kazuma", look: "", outfit: "Casual loungewear" };
const MATTHEW = {
    name: "Matthew", aliases: ["Matt"],
    look: "male, young adult, black hair, purple hair, two-tone hair, purple eyes, petite, flat stomach",
    outfit: "Cropped black graphic tee, pleated black mini skirt, barefoot"
};
const REPORTED = "2boys, @Kazuma, @Matthew(cropped black band t-shirt, midriff, pleated miniskirt, black thighhighs), holding hands, close standing, @Kazuma holding @Matthew's hand, @Matthew looking down, blushing intensely, shy, bedroom, warm indoor lighting, medium shot";

test("reported output: each character's tags appear once; the model's own clothing is dropped", () => {
    const r = resolveImagePrompt(REPORTED, { cast: [KAZUMA, MATTHEW] });
    const count = tag => r.prompt.split(", ").filter(t => t === tag).length;
    assert.equal(count("purple eyes"), 1);
    assert.equal(count("Cropped black graphic tee"), 1);
    assert.equal(count("Casual loungewear"), 1);
    assert.ok(!/thighhighs|band t-shirt|midriff/.test(r.prompt), "clothing stuck onto @Matthew(…) is gone");
    assert.ok(!/@|Matthew|Kazuma/.test(r.prompt), "no names or raw @ reach ComfyUI in Tags style");
    assert.ok(r.prompt.startsWith("2boys, Casual loungewear, male, young adult"));
    assert.match(r.prompt, /holding hands, close standing, holding hand, looking down, blushing intensely/);
    assert.deepEqual(r.noLook, ["Kazuma"]);
});

test("possessives: '@Name's' is recognised", () => {
    assert.equal(resolveImagePrompt("@Matt's hand", { cast: [MATTHEW] }).prompt,
        "male, young adult, black hair, purple hair, two-tone hair, purple eyes, petite, flat stomach, Cropped black graphic tee, pleated black mini skirt, barefoot hand");
    const n = resolveImagePrompt("@Kazuma takes @Matthew's hand; @Matthew looks down.", { cast: [KAZUMA, MATTHEW], style: "natural" }).prompt;
    assert.equal(n, "Kazuma, wearing a Casual loungewear, takes Matthew's hand; Matthew, male, young adult, black hair, purple hair, two-tone hair, purple eyes, petite, flat stomach, wearing a Cropped black graphic tee, pleated black mini skirt, barefoot, looks down.");
});

test("repeats: the second @Name adds nothing in Tags, the plain name in Natural", () => {
    assert.equal(resolveImagePrompt("1boy, @Matt, @Matthew, sitting", { cast: [MATTHEW] }).prompt.split("purple eyes").length, 2);
    assert.match(resolveImagePrompt("@Matt sits. Then @Matt stands.", { cast: [MATTHEW], style: "natural" }).prompt, /\. Then Matthew stands\.$/);
});

// ── Always / body, and the Reference method ──────────────────────────────
import { splitLookTags, framingShowsBody, sexOf } from "../src/features/imagegen/v2/lookParts.js";

test("look split: head and distinctive features always; build and proportions as body", () => {
    const m = splitLookTags("male, young adult, black hair, short hair, purple eyes, pale skin, feminine male, short male, petite, narrow waist, wide hips, thick thighs, flat stomach");
    assert.equal(m.always, "male, young adult, black hair, short hair, purple eyes, pale skin, feminine male");
    assert.equal(m.body, "short male, petite, narrow waist, wide hips, thick thighs, flat stomach");
    const f = splitLookTags("female, large breasts, big butt, long legs, cat ears, cat tail, thin eyebrows, (wide hips:1.2)");
    assert.equal(f.always, "female, cat ears, cat tail, thin eyebrows");
    assert.equal(f.body, "large breasts, big butt, long legs, (wide hips:1.2)");
});

test("sex from a look; framing decides whether the body shows", () => {
    assert.equal(sexOf("feminine male, purple eyes"), "male");
    assert.equal(sexOf("female, blue hair"), "female");
    assert.equal(sexOf("blue hair"), "");
    assert.equal(framingShowsBody("1girl, @Aqua, close-up, face focus"), false);
    assert.equal(framingShowsBody("1girl, @Aqua, upper body"), false);
    for (const f of ["full body", "full-body", "wide shot", "cowboy shot", "from behind"]) assert.equal(framingShowsBody(`x, ${f}`), true, f);
});

test("resolver: body tags only in full-body framing", () => {
    const cast = [{ name: "Aqua", look: "female, blue hair", body: "big butt, long legs", outfit: "blue dress" }];
    assert.equal(resolveImagePrompt("1girl, @Aqua, smiling, close-up", { cast }).prompt, "1girl, female, blue hair, blue dress, smiling, close-up");
    assert.equal(resolveImagePrompt("1girl, @Aqua, walking, full body", { cast }).prompt, "1girl, female, blue hair, big butt, long legs, blue dress, walking, full body");
});

test("reference method: previous prompt, cast wins, the reason, and a first-image fallback", () => {
    const rules = renderV2Rules({ method: "reference", style: "tags" });
    assert.match(rules, /Write the new image prompt by editing it/);
    assert.match(rules, /If the previous prompt disagrees with <Cast>, <Cast> is right/);
    assert.match(rules, /Why: the closer the new prompt stays to the previous one, the more consistent the images and the characters stay/);
    assert.match(rules, /body tags go in only when the shot shows their body/);
    assert.doesNotMatch(rules, /@Name/);
    const withPrev = renderV2ManualPrompt({ castList: "<Cast>\nAqua: in the scene\n</Cast>", story: "x", rules, method: "reference", previous: "1girl, blue hair, smiling" });
    assert.match(withPrev.user, /<Previous_Image_Prompt>\n1girl, blue hair, smiling\n<\/Previous_Image_Prompt>/);
    const first = renderV2ManualPrompt({ story: "x", rules, method: "reference", previous: "" });
    assert.match(first.user, /\(none yet: this is the first image\)/);
    assert.doesNotMatch(renderV2ManualPrompt({ story: "x", rules: "r", method: "placeholders", previous: "p" }).user, /Previous_Image_Prompt/);
    assert.match(renderV2InlineInstruction({ rules, method: "reference", previous: "p1" }), /<Previous_Image_Prompt>\np1\n/);
});

// ── One call per image: extra sections only when needed ──────────────────
import { renderV2Extras, splitCombinedAnswer } from "../src/features/imagegen/v2/prompt.js";
import { parseOutfitBlocks, parseLookBlocks } from "../src/features/imagegen/v2/looksCore.js";

test("extras: nothing needed → nothing asked, and the answer stays a plain prompt", () => {
    assert.equal(renderV2Extras({}), "");
    const m = renderV2ManualPrompt({ last: "x", rules: "r", extras: "" });
    assert.match(m.user, /Output only the prompt, nothing else\.$/);
});

test("extras: only the sections that are needed, and the answer shape", () => {
    const onlyOutfit = renderV2Extras({ outfits: [{ name: "Aqua", outfit: "blue dress" }] });
    assert.match(onlyOutfit, /Aqua: blue dress/);
    assert.match(onlyOutfit, /<Image_Prompt>the image prompt<\/Image_Prompt>\n<Outfit_Tags name="Name">/);
    assert.doesNotMatch(onlyOutfit, /Character_Visual|Character_Sheets/);
    const onlyLooks = renderV2Extras({ looks: ["Wiz"] });
    assert.match(onlyLooks, /Appearance of Wiz/);
    assert.doesNotMatch(onlyLooks, /<\/Character_Sheets>|Outfit_Tags/, "the sheets block never sits among the tasks");
    const m = renderV2ManualPrompt({ last: "x", rules: "r", extras: onlyOutfit });
    assert.match(m.user, /Write the image prompt for that moment\.\n\n## In the same answer/);
    assert.doesNotMatch(m.user, /Output only the prompt/);
});

test("sheets go before the story; all the tasks come after it", () => {
    const m = renderV2ManualPrompt({
        castList: "<Cast>\n@Wiz: in the scene\n</Cast>",
        sheets: "<character_sheet name=\"Wiz\">A shopkeeper.</character_sheet>",
        earlier: "Wiz: Welcome.",
        last: "Wiz: Hello.",
        rules: "## How to write the image prompt",
        extras: renderV2Extras({ looks: ["Wiz"] })
    }).user;
    const at = s => m.indexOf(s);
    assert.ok(at("<Cast>") < at("<Character_Sheets>"));
    assert.ok(at("<Character_Sheets>") < at("<Earlier_Story>"));
    assert.ok(at("</Earlier_Story>") < at("<Last_Message>"));
    assert.ok(at("</Last_Message>") < at("## How to write the image prompt"));
    assert.ok(at("## How to write the image prompt") < at("## In the same answer"));
});

test("combined answer: each section is read on its own; a broken one loses only itself", () => {
    const raw = `<think>plan</think>
<Image_Prompt>1girl, @Aqua, smiling, close-up</Image_Prompt>
<Outfit_Tags name="Aqua">blue dress, detached sleeves</Outfit_Tags>
<Character_Visual name="Wiz">female, long brown hair`;       // cut off: still usable
    const { prompt, rest } = splitCombinedAnswer(raw);
    assert.equal(prompt, "1girl, @Aqua, smiling, close-up");
    assert.deepEqual(parseOutfitBlocks(rest), [{ name: "Aqua", tags: "blue dress, detached sleeves" }]);
    assert.deepEqual(parseLookBlocks(rest), [{ name: "Wiz", aliases: [], tags: "female, long brown hair" }]);
    // A model that skipped the <Image_Prompt> wrapper still gives a prompt.
    assert.equal(splitCombinedAnswer("1girl, @Aqua\n<Outfit_Tags name=\"Aqua\">x</Outfit_Tags>").prompt, "1girl, @Aqua");
    // Broken outfit section: the prompt survives.
    assert.equal(splitCombinedAnswer("<Image_Prompt>1girl, @Aqua</Image_Prompt><Outfit_Tags>oops").prompt, "1girl, @Aqua");
});

test("cast: a look saved under a first name finds the full name World State uses", () => {
    const world = { pc: { name: "Kazuma", fields: {} }, cast: { "anno ryo": { name: "Anno Ryo", present: true, aliases: [], fields: { outfit: "white bra" } } } };
    const cast = buildImageCast({ looks: { Anno: { tags: "female, black hair" } }, world, userName: "Kazuma" });
    const anno = cast.find(m => m.name === "Anno Ryo");
    assert.equal(anno.look, "female, black hair");
    assert.equal(anno.lookKey, "Anno");
    assert.ok(anno.aliases.includes("Anno"), "@Anno still finds her");
    assert.equal(cast.filter(m => /anno/i.test(m.name)).length, 1, "no second, absent Anno");
});

test("cast: an exact look wins, and a first name shared by two members matches neither", () => {
    const world = { cast: {
        a: { name: "Anno Ryo", present: true, aliases: [], fields: {} },
        b: { name: "Anno Smith", present: true, aliases: [], fields: {} }
    } };
    const cast = buildImageCast({ looks: { Anno: { tags: "black hair" }, "Anno Smith": { tags: "red hair" } }, world });
    assert.equal(cast.find(m => m.name === "Anno Smith").look, "red hair");
    // Anno Smith has her own look, so "Anno" fits only Anno Ryo.
    assert.equal(cast.find(m => m.name === "Anno Ryo").look, "black hair");

    const two = buildImageCast({ looks: { Anno: { tags: "black hair" } }, world });
    assert.equal(two.find(m => m.name === "Anno Ryo").look, "");
    assert.ok(two.some(m => m.name === "Anno" && !m.inScene), "unsure: kept as its own character");
});

test("inImage / needsLook: a POV shot never asks for the player's look or outfit", () => {
    const pc = { isPc: true, inScene: true, look: "" };
    const npc = { inScene: true, look: "" };
    const away = { mentioned: true, look: "" };
    assert.equal(inImage(pc, "pov"), false);
    assert.equal(inImage(pc, "cinematic"), true);
    assert.equal(inImage(away, "pov"), true);
    assert.equal(needsLook(pc, "pov"), false);
    assert.equal(needsLook(pc, "cinematic"), true);
    assert.equal(needsLook(npc, "pov"), true);
    assert.equal(needsLook(away, "pov"), false, "only someone in the scene gets a look read");
    assert.equal(needsLook({ inScene: true, look: "x" }), false);
});
