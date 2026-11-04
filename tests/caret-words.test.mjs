// node --test "tests/*.test.mjs"
// The Gemini Pro loadout: a ^ before every word, taken out as the reply lands.
import { test } from "node:test";
import assert from "node:assert/strict";
import { usesCaretWords, stripCarets, stripMessageCarets } from "../src/engine/caretWords.js";
import { formattingSection } from "../src/engine/presetSections.js";
import { GEMINI_CARET_LINE } from "../src/prompts/v11Rules.js";

test("only the Gemini JB add-on asks for the ^", () => {
    assert.equal(usesCaretWords({ addons: ["html", "gemini_jb"] }), true);
    assert.equal(usesCaretWords({ addons: ["html"], loadout: "gemini-pro" }), false, "switched off by hand");
    assert.equal(usesCaretWords({}), false);
    assert.equal(usesCaretWords(null), false);
});

test("the reply and the swipe it shows lose every ^, blocks included", () => {
    const raw = "^She ^smiled.\n<Blocks>\n<Bonds>\n^Mira: ^45/100\n</Bonds>\n</Blocks>";
    const msg = { mes: raw, swipe_id: 1, swipes: ["^old", raw] };
    assert.equal(stripMessageCarets(msg), true);
    assert.equal(msg.mes, "She smiled.\n<Blocks>\n<Bonds>\nMira: 45/100\n</Bonds>\n</Blocks>");
    assert.equal(msg.swipes[1], msg.mes);
    assert.equal(msg.swipes[0], "^old");
    assert.equal(stripMessageCarets(msg), false);
});

test("the player's messages are left alone", () => {
    const msg = { mes: "2^3", is_user: true };
    assert.equal(stripMessageCarets(msg), false);
    assert.equal(msg.mes, "2^3");
    assert.equal(stripCarets(undefined), "");
});

test("the ^ line is the last line of <formatting>", () => {
    const out = formattingSection({ color: "- colour", extra: GEMINI_CARET_LINE, frame: "v11" });
    assert.ok(out.trimEnd().endsWith(`${GEMINI_CARET_LINE}\n</formatting>`));
    assert.ok(!formattingSection({ color: "- colour", extra: "", frame: "v11" }).includes("^"));
});
