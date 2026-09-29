// node --test "tests/*.test.mjs"
// Plan 008: blocks are hidden from the story model's view of the chat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { stripBlocksForModel, hideBlocksInMessages } from "../src/engine/hideBlocks.js";

const TAGS = ["Dice", "CYOA", "World_State", "World_Update", "NPC_Inner_Chatter", "Bonds", "Character_Sheet", "New_NPC", "NPC_Update", "Story_Tracker"];

test("the envelope, loose blocks and the lead dice go; the prose and its formatting stay", () => {
    const reply = [
        "<Dice>Stealth: 14 + 2 = 16 vs DC 12 → success</Dice>",
        "She laughed. <span style=\"color:#f43f5e\">*crack*</span>",
        "",
        "<Blocks>",
        "<Bonds>\nAnno: Affection: 45/100\n</Bonds>",
        "<CYOA>\n1. Leave\n</CYOA>",
        "</Blocks>"
    ].join("\n");
    assert.equal(stripBlocksForModel(reply, TAGS), "She laughed. <span style=\"color:#f43f5e\">*crack*</span>");
});

test("a block outside a broken envelope, and a cut-off one, go too", () => {
    assert.equal(stripBlocksForModel("Prose.\n<Bonds>\nAnno: 45\n</Bonds>\nMore prose.", TAGS), "Prose.\n\nMore prose.");
    assert.equal(stripBlocksForModel("Prose.\n<Blocks>\n<Bonds>\nAnno: 4", TAGS), "Prose.");
    assert.equal(stripBlocksForModel("Prose.\n<Character_Sheet>\nHP: 80", TAGS), "Prose.");
});

test("old <details> cards go; other details stay", () => {
    const old = "Prose.\n<details><summary>📌 <b>World State</b></summary>\nTime: night\n</details>";
    assert.equal(stripBlocksForModel(old, TAGS), "Prose.");
    const mine = "Prose.\n<details><summary>Letter</summary>Dear Anno</details>";
    assert.equal(stripBlocksForModel(mine, TAGS), mine);
});

test("only assistant messages are touched: the preset's own block template stays", () => {
    const messages = [
        { role: "system", content: "Write this at the end:\n<Blocks>\n<Bonds>\n[NPC Name]: Affection: [0-100]\n</Bonds>\n</Blocks>" },
        { role: "user", content: "hi" },
        { role: "assistant", content: "Hello.\n<Blocks><Bonds>Anno: Affection: 45/100</Bonds></Blocks>" }
    ];
    assert.equal(hideBlocksInMessages(messages, TAGS), 1);
    assert.match(messages[0].content, /<Bonds>/);
    assert.equal(messages[2].content, "Hello.");
});
