// node --test "tests/*.test.mjs"
// Plan 018: the V11 preset sends the rules up top and only what is new this
// turn in <this_turn>.
import { test } from "node:test";
import assert from "node:assert/strict";
import { thisTurnSection } from "../src/engine/presetSections.js";
import {
    DICE_ROLLS_POINTER, IMAGE_ASK_OLD, IMAGE_ASK_NEW, diceTurnLine, imageTurnLine,
} from "../src/prompts/presetFrame.js";
import { addons } from "../data/addons.js";
import { imageGenPrompts } from "../src/prompts/imageGen.js";
import { IMAGE_V2_PROMPTS } from "../src/prompts/imageGenV2.js";
import { renderV2InlineSplit } from "../src/features/imagegen/v2/prompt.js";

test("<this_turn> holds only the parts that are there, or nothing", () => {
    assert.equal(thisTurnSection({}), "");
    assert.equal(thisTurnSection({ dice: "", image: "  ", blocks: "" }), "");
    assert.equal(thisTurnSection({ dice: "Dice rolls: 4, 17, 9" }), "<this_turn>\nDice rolls: 4, 17, 9\n</this_turn>");
    assert.equal(
        thisTurnSection({ dice: "Dice rolls: 1", image: "Image: insert 1 image tag in this reply.", blocks: "<Blocks>\n</Blocks>" }),
        "<this_turn>\nDice rolls: 1\n\nImage: insert 1 image tag in this reply.\n\n<Blocks>\n</Blocks>\n</this_turn>"
    );
});

test("the dice rules point at <this_turn>, in both variants", () => {
    for (const id of ["dice", "dice_all"]) {
        const text = addons.find(a => a.id === id).content;
        assert.ok(text.includes("this turn's rolls are [[dice_rolls]]."), id);
        assert.ok(text.replace("[[dice_rolls]]", DICE_ROLLS_POINTER).includes("this turn's rolls are listed in <this_turn>. take them in order"), id);
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
    assert.ok(t.replace(IMAGE_ASK_OLD, IMAGE_ASK_NEW).includes("When <this_turn> asks for an image, insert this image tag within your response: <img prompt=\"[prompt]\"> to illustrate the scene."));
});

test("V2's split keeps the rules up top and the cast and previous prompt for <this_turn>", () => {
    const out = renderV2InlineSplit({ castList: "<Cast>\nAnna\n</Cast>", rules: "- rules", method: "reference", previous: "1girl" });
    assert.equal(out.rules, `${IMAGE_V2_PROMPTS.inlineHeadSplit.replace("{{conditionalText}}", "")}\n- rules\n${IMAGE_V2_PROMPTS.inlineTail}`);
    assert.ok(out.rules.includes("When <this_turn> asks for an image"));
    assert.ok(!out.rules.includes("<Cast>"));
    assert.equal(out.turn, "<Cast>\nAnna\n</Cast>\n<Previous_Image_Prompt>\n1girl\n</Previous_Image_Prompt>");
    assert.equal(renderV2InlineSplit({ castList: "<Cast></Cast>", method: "placeholders", previous: "x" }).turn, "<Cast></Cast>");
});
