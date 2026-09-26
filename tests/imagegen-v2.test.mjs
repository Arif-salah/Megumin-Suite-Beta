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

test(".look and .outfit, and their synonyms", () => {
    assert.equal(R("@Aqua.look, towel").prompt, "long blue hair, blue eyes, slender, towel");
    assert.equal(R("@Aqua.outfit").prompt, "blue dress, detached sleeves");
    assert.equal(R("@Aqua.appearance, @Aqua.clothes").prompt, "long blue hair, blue eyes, slender, blue dress, detached sleeves");
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
        "@Sara: not in the scene",
        "</Cast>"
    ].join("\n"));
    assert.doesNotMatch(renderCastList(cast, { shot: "pov" }), /Kazuma/);
});

test("rules: base + style + shot + extra, and never off-frame", () => {
    for (const style of ["tags", "natural"]) {
        for (const shot of ["cinematic", "pov", "portrait"]) {
            const r = renderV2Rules({ style, shot, extra: "moody" });
            assert.match(r, /^## Image prompt rules\n@Name stands for/);
            assert.match(r, /Extra instructions: moody$/);
            assert.doesNotMatch(r, OFF_FRAME);
        }
    }
    assert.match(renderV2Rules({ style: "tags" }), /Start with who is in the shot: 1girl/);
    assert.match(renderV2Rules({ style: "natural" }), /2 to 4 plain sentences/);
    assert.match(renderV2Rules({ shot: "pov" }), /\{\{user\}\}'s eyes/);
});

test("manual and inline prompts carry the cast and the rules", () => {
    const castList = "<Cast>\n@Aqua: in the scene\n</Cast>";
    const rules = renderV2Rules({});
    const m = renderV2ManualPrompt({ castList, scene: "Loc: Tavern", story: "Aqua: Hi.", rules });
    assert.match(m.user, /^<Cast>[\s\S]*<Scene>\nLoc: Tavern\n<\/Scene>[\s\S]*<Recent_Story>\nAqua: Hi\.\n<\/Recent_Story>[\s\S]*## Image prompt rules[\s\S]*Output only the prompt, nothing else\.$/);
    assert.doesNotMatch(m.system + m.user, OFF_FRAME);
    const inl = renderV2InlineInstruction({ conditionalText: "ONLY IF A PHOTO. ", imageCount: 2, castList, rules });
    assert.match(inl, /^### IMAGE\nONLY IF A PHOTO\. Within your response, insert 2 image tag\(s\)/);
    assert.match(inl, /never use double quotes\.$/);
    assert.doesNotMatch(inl, OFF_FRAME);
});
