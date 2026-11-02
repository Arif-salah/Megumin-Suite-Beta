// node --test "tests/*.test.mjs"
// Plan 018: the V11 preset sends the rules up top and only what is new this
// turn in <turn_notes>.
import { test } from "node:test";
import assert from "node:assert/strict";
import { thisTurnSection } from "../src/engine/presetSections.js";
import {
    DICE_ROLLS_POINTER, IMAGE_ASK_OLD, IMAGE_ASK_NEW, diceTurnLine, imageTurnLine,
} from "../src/prompts/presetFrame.js";
import {
    bondsRulesSplit, sheetRulesSplit, shortRulesHeading, wrapBlockRules, wrapImageRules, wrapAddon,
    npcUpdateRulesSplit, npcPersistenceRuleSplit, npcKnownNames, wrapNpcRules, sameText, andList,
    DICE_RULES_PLAYER, DICE_RULES_EVERYONE, ADDON_RULES_SPLIT,
} from "../src/prompts/v11Rules.js";
import { addons } from "../data/addons.js";
import { imageGenPrompts } from "../src/prompts/imageGen.js";
import { IMAGE_V2_PROMPTS } from "../src/prompts/imageGenV2.js";
import { renderV2InlineSplit } from "../src/features/imagegen/v2/prompt.js";

test("<turn_notes> holds only the parts that are there, or nothing", () => {
    assert.equal(thisTurnSection({}), "");
    assert.equal(thisTurnSection({ dice: "", image: "  ", blocks: "" }), "");
    assert.equal(thisTurnSection({ dice: "Dice rolls: 4, 17, 9" }), "<turn_notes>\nDice rolls: 4, 17, 9\n</turn_notes>");
    assert.equal(
        thisTurnSection({ dice: "Dice rolls: 1", image: "Image: insert 1 image tag in this reply.", blocks: "<Blocks>\n</Blocks>" }),
        "<turn_notes>\nDice rolls: 1\n\nImage: insert 1 image tag in this reply.\n\n<Blocks>\n</Blocks>\n</turn_notes>"
    );
});

test("the dice rules point at <turn_notes>, in both variants", () => {
    for (const id of ["dice", "dice_all"]) {
        const text = addons.find(a => a.id === id).content;
        assert.ok(text.includes("this turn's rolls are [[dice_rolls]]."), id);
        assert.ok(text.replace("[[dice_rolls]]", DICE_ROLLS_POINTER).includes("this turn's rolls are listed in <turn_notes>. take them in order"), id);
    }
    assert.equal(diceTurnLine([14, 3, 19]), "Dice rolls: 14, 3, 19");
});

test("the image line counts its tags and says when a photo is the only reason", () => {
    assert.equal(imageTurnLine(1, false), "Image: insert 1 image tag in this reply.");
    assert.equal(imageTurnLine("2", false), "Image: insert 2 image tags in this reply.");
    assert.equal(imageTurnLine(1, true), "Image: up to 1 image tag this turn, only if a character is taking or sharing a picture right now.");
    assert.equal(imageTurnLine("", false), "Image: insert 1 image tag in this reply.");
});

test("Classic's image rules open on the sentence the split rewrites", () => {
    const t = imageGenPrompts.injectionTemplate;
    assert.ok(t.includes(IMAGE_ASK_OLD));
    assert.ok(t.replace(IMAGE_ASK_OLD, IMAGE_ASK_NEW).includes("When <turn_notes> asks for an image, insert this image tag within your response: <img prompt=\"[prompt]\"> to illustrate the scene."));
});

test("V2's split keeps the rules up top and the cast and previous prompt for <turn_notes>", () => {
    const out = renderV2InlineSplit({ castList: "<Cast>\nAnna\n</Cast>", rules: "- rules", method: "reference", previous: "1girl" });
    assert.equal(out.rules, `${IMAGE_V2_PROMPTS.inlineHeadSplit.replace("{{conditionalText}}", "")}\n- rules\n${IMAGE_V2_PROMPTS.inlineTail}`);
    assert.ok(out.rules.includes("When <turn_notes> asks for an image"));
    assert.ok(!out.rules.includes("<Cast>"));
    assert.equal(out.turn, "<Cast>\nAnna\n</Cast>\n<Previous_Image_Prompt>\n1girl\n</Previous_Image_Prompt>");
    assert.equal(renderV2InlineSplit({ castList: "<Cast></Cast>", method: "placeholders", previous: "x" }).turn, "<Cast></Cast>");
});

test("the Bonds rules up top follow the block's fields", () => {
    const romance = [
        { label: "Mood", type: "text" },
        { label: "Affection", type: "meter", start: 20 },
        { label: "Trust", type: "meter", start: 30 },
        { label: "Desire", type: "meter", start: 0 },
    ];
    assert.equal(bondsRulesSplit(romance),
        "## Bonds\nOne line for each character in <Scene>, Here or Remote, and for anyone whose numbers changed in this scene. " +
        "Start every number from <Bonds_Now> in <Current_Info>. A number moves only when something in this scene moved it: " +
        "write the change and its reason in brackets, like (-6 he apologised and she heard pity), or (=) when nothing moved it. " +
        "Affection, Trust and Desire move by 10 at most in one reply, unless the scene plainly earns more. " +
        "Someone with no numbers yet starts at Affection 20, Trust 30, Desire 0. " +
        "Bonds are feelings only: leave out clothes, posture and place.");
    const one = bondsRulesSplit([{ label: "Trust", type: "meter", start: 30 }, { label: "Gold", type: "number" }]);
    assert.ok(one.includes("Trust moves by 10 at most"));
    assert.ok(one.includes("starts at Trust 30, Gold 0."));
    assert.equal(bondsRulesSplit([{ label: "Mood", type: "text" }]),
        "## Bonds\nOne line for each character in <Scene>, Here or Remote, and for anyone whose numbers changed in this scene. Bonds are feelings only: leave out clothes, posture and place.");
});

test("the Character Sheet rules follow its fields too", () => {
    const rpg = [
        { label: "HP", type: "meter", start: 100 }, { label: "Mana", type: "meter", start: 100 },
        { label: "Gold", type: "number", start: 0 }, { label: "Inventory", type: "list" },
    ];
    const t = sheetRulesSplit(rpg);
    assert.ok(t.startsWith("## Character Sheet\nThe sheet is {{user}}'s. Start every number from <Character_Sheet_Now>"));
    assert.ok(t.includes("HP and Mana move by 10 at most"));
    assert.ok(t.includes("it starts at HP 100, Mana 100, Gold 0."));
    assert.equal(sheetRulesSplit([{ label: "Inventory", type: "list" }]),
        "## Character Sheet\nThe sheet is {{user}}'s. Inventory and skills change only when the story changes them; nothing comes back or gets equipped on its own.");
});

test("<block_rules> wraps the rules, with headings that are just the block's name", () => {
    assert.equal(shortRulesHeading("## World State rules\nIn <World_State>, record..."), "## World State\nIn <World_State>, record...");
    assert.equal(shortRulesHeading("## Author's Notebook rules\nThis story keeps"), "## Author's Notebook\nThis story keeps");
    assert.equal(shortRulesHeading("## Bonds\nOne line"), "## Bonds\nOne line");
    assert.equal(wrapBlockRules(["## A\na", "## B\nb"]),
        "<block_rules>\nThese rules say how to fill the blocks <turn_notes> asks for. Follow them; never write them out.\n\n## A\na\n\n## B\nb\n</block_rules>");
});

test("the dice rules: the V11 wording keeps the numbers in <turn_notes> and the line format", () => {
    for (const t of [DICE_RULES_PLAYER, DICE_RULES_EVERYONE]) {
        assert.ok(t.startsWith("<dice_rules>\n") && t.endsWith("\n</dice_rules>"));
        assert.ok(t.includes("This turn's rolls are listed in <turn_notes>. Take them in order, one per attempt."));
        assert.ok(!t.includes("[[dice_rolls]]"));
    }
    assert.ok(DICE_RULES_PLAYER.includes("<Dice>🎲 attempt — d20+N vs DC → roll+N = total · verdict</Dice>"));
    assert.ok(DICE_RULES_EVERYONE.includes("<Dice>🎲 who does what — d20+N vs DC → roll+N = total · verdict</Dice>"));
});

test("the image rules lose their old heading inside <image_rules>", () => {
    assert.equal(wrapImageRules("### IMAGE GENERATION:\nWhen <turn_notes> asks for an image..."), "<image_rules>\nWhen <turn_notes> asks for an image...\n</image_rules>");
    assert.equal(wrapImageRules("### IMAGE\nWhen <turn_notes>..."), "<image_rules>\nWhen <turn_notes>...\n</image_rules>");
    assert.equal(wrapImageRules(""), "");
});

test("the NPC rules are built from the bank's fields", () => {
    const t = npcUpdateRulesSplit({
        updatable: ["Role", "Agenda", "Secrets"], single: ["Role", "Agenda"], multi: ["Secrets"],
        locked: ["Appearance", "Voice"], template: "<NPC_Update name=\"x\">\n</NPC_Update>",
    });
    assert.ok(t.startsWith("## Changes to known characters\n"));
    assert.ok(t.includes("Fields that can change: Role, Agenda and Secrets."));
    assert.ok(t.includes("Role and Agenda hold one value: use ~."));
    assert.ok(t.includes("Secrets holds a list: use +, - or ~."));
    assert.ok(t.includes("Appearance and Voice are written once and never change."));
    assert.ok(t.endsWith("<NPC_Update name=\"x\">\n</NPC_Update>"));
    assert.equal(npcUpdateRulesSplit({ updatable: [], single: [], multi: [], locked: [], template: "" }), "");
    assert.ok(npcPersistenceRuleSplit(["Role", "Voice"]).startsWith("Role and Voice describe this person's life"));
    assert.equal(npcPersistenceRuleSplit([]), "");
    assert.equal(npcKnownNames(["Mira", "Theo"]), "These characters already have a dossier or need none: Mira, Theo.");
    assert.equal(npcKnownNames([]), "");
    assert.equal(wrapNpcRules(["", "a"]), "<npc_dossier_rules>\na\n</npc_dossier_rules>");
    assert.equal(wrapNpcRules([""]), "");
});

test("add-ons: your own text keeps its words and gets a tag", () => {
    assert.equal(wrapAddon("death", "[DEATH SYSTEM]\nmine"), "<death>\n[DEATH SYSTEM]\nmine\n</death>");
    assert.equal(wrapAddon("render", "<render>\nx\n</render>"), "<render>\nx\n</render>");
    assert.equal(wrapAddon("death", "  "), "");
    assert.ok(sameText("a  b\n c", "a b c"));
    assert.equal(andList(["A"]), "A");
    for (const [k, v] of Object.entries(ADDON_RULES_SPLIT)) assert.match(v, /^<([a-z]+)>\n[\s\S]+\n<\/\1>$/, k);
});
