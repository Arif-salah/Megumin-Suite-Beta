// node --test "tests/*.test.mjs"
// Image Gen V2 (plan 006): @Name substitution, the image cast, and the prompts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveImagePrompt, stripCountTags, dedupeTags, splitTags } from "../src/features/imagegen/v2/resolve.js";
import { buildImageCast } from "../src/features/imagegen/v2/cast.js";
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
        "Aqua (a slender young woman with long blue hair and blue eyes, wearing blue dress, detached sleeves) leans on the bar while Matthew (two-tone black and purple hair, purple eyes, petite, wearing cropped black tee, pleated black mini skirt) watches her.");
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
    const cast = buildImageCast({ world: world(), userName: "Kazuma", looks: { Sara: { tags: "red hair" } }, recentText: "Sara waved" });
    const list = renderCastList(cast);
    assert.equal(list, [
        "<Cast>",
        "@Kazuma: the player",
        "@Matthew (also @Matt): in the scene",
        "@Aqua: in the scene",
        "@Sara: not in the scene (clothing not noted: describe what they wear)",
        "</Cast>"
    ].join("\n"));
    assert.doesNotMatch(renderCastList(cast, { shot: "pov" }), /Kazuma/);
});

test("the model describes clothing only for characters with no outfit on file", () => {
    const list = renderCastList([
        { name: "Aqua", inScene: true, outfit: "blue dress" },
        { name: "Wiz", inScene: true, outfit: "" }
    ]);
    assert.match(list, /@Aqua: in the scene\n/);
    assert.match(list, /@Wiz: in the scene \(clothing not noted: describe what they wear\)/);
    for (const style of ["tags", "natural"]) {
        const r = renderV2Rules({ style });
        assert.doesNotMatch(r, /\.look|\.outfit/, "no other placeholder is offered");
        assert.match(r, /The one exception: when <Cast> says a character's clothing is not noted/);
    }
});

test("rules: structure + example + rules + shot + extra, and never off-frame", () => {
    for (const style of ["tags", "natural"]) {
        for (const shot of ["cinematic", "pov", "portrait"]) {
            const r = renderV2Rules({ style, shot, extra: "moody" });
            assert.match(r, /^## How to write the image prompt\nFill in this structure/);
            assert.match(r, /Example \(made-up characters; use the names from <Cast>\):\n/);
            assert.match(r, /Write each @Name once/);
            assert.match(r, /\nShot: /);
            assert.match(r, /Extra instructions: moody$/);
            assert.doesNotMatch(r, OFF_FRAME);
        }
    }
    assert.match(renderV2Rules({ style: "tags" }), /\[who is in the shot\], \[@Name of each character\], \[pose and action\]/);
    assert.match(renderV2Rules({ style: "tags" }), /"holding hands", not "Mira holding Theo's hand"/);
    assert.match(renderV2Rules({ style: "natural" }), /2 to 4 plain sentences/);
    assert.match(renderV2Rules({ shot: "pov" }), /through \{\{user\}\}'s eyes/);
});

test("the prompt examples resolve cleanly when those characters exist", () => {
    // The example line is itself a valid prompt: run it through the resolver.
    const mira = { name: "Mira", look: "1girl, red hair, green eyes", outfit: "white blouse" };
    const theo = { name: "Theo", look: "1boy, black hair", outfit: "grey coat" };
    const example = renderV2Rules({ style: "tags" }).split("\n").find(l => l.startsWith("1girl, 1boy, @Mira"));
    assert.equal(resolveImagePrompt(example, { cast: [mira, theo] }).prompt,
        "1girl, 1boy, red hair, green eyes, white blouse, black hair, grey coat, sitting at a table, holding a mug, leaning forward, laughing, looking at another, tavern, night, warm lamplight, medium shot, from side");
});

test("manual and inline prompts carry the cast and the rules", () => {
    const castList = "<Cast>\n@Aqua: in the scene\n</Cast>";
    const rules = renderV2Rules({});
    const m = renderV2ManualPrompt({ castList, scene: "Loc: Tavern", story: "Aqua: Hi.", rules });
    assert.match(m.user, /^<Cast>[\s\S]*<Scene>\nLoc: Tavern\n<\/Scene>[\s\S]*<Recent_Story>\nAqua: Hi\.\n<\/Recent_Story>[\s\S]*## How to write the image prompt[\s\S]*Output only the prompt, nothing else\.$/);
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
    assert.equal(n, "Kazuma (wearing Casual loungewear) takes Matthew's hand; Matthew (male, young adult, black hair, purple hair, two-tone hair, purple eyes, petite, flat stomach, wearing Cropped black graphic tee, pleated black mini skirt, barefoot) looks down.");
});

test("repeats: the second @Name adds nothing in Tags, the plain name in Natural", () => {
    assert.equal(resolveImagePrompt("1boy, @Matt, @Matthew, sitting", { cast: [MATTHEW] }).prompt.split("purple eyes").length, 2);
    assert.match(resolveImagePrompt("@Matt sits. Then @Matt stands.", { cast: [MATTHEW], style: "natural" }).prompt, /\. Then Matthew stands\.$/);
});
