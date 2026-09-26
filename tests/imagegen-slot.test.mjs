// node --test "tests/*.test.mjs"
// Where an automatic image lands inside a reply.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findImageSlot, insertAtSlot } from "../src/features/imagegen/slot.js";

const IMG = '<div id="x" class="kazuma-img-placeholder">[Generating Image...]</div>';
const REPLY = [
    "<think>Planning.\n\nMore planning.</think>",
    "First paragraph.",
    "",
    "Second paragraph.",
    "",
    "Third paragraph.",
    "",
    "<Blocks>",
    "<World_Update>",
    "No changes",
    "</World_Update>",
    "</Blocks>"
].join("\n");

test("end: just above the blocks, after the prose", () => {
    const out = insertAtSlot(REPLY, IMG, "end");
    assert.match(out, /Third paragraph\.\n\n<div id="x"[^>]*>\[Generating Image\.\.\.\]<\/div>\n\n<Blocks>/);
});

test("end: with no blocks, at the very end", () => {
    assert.equal(insertAtSlot("Only prose.\n", IMG, "end"), `Only prose.\n\n${IMG}`);
});

test("old-format blocks count as blocks too", () => {
    const out = insertAtSlot("Prose.\n\n<details><summary>World State</summary>…</details>", IMG, "end");
    assert.ok(out.startsWith(`Prose.\n\n${IMG}\n\n<details>`));
});

test("random: always a paragraph break inside the prose, never in think or blocks", () => {
    for (const r of [0, 0.34, 0.5, 0.67, 0.99]) {
        const at = findImageSlot(REPLY, "random", () => r);
        const thinkEnd = REPLY.indexOf("</think>") + "</think>".length;
        const blocks = REPLY.indexOf("<Blocks>");
        assert.ok(at > thinkEnd && at <= blocks, `r=${r} at=${at}`);
    }
    // The choices are: after paragraph 1, after paragraph 2, after paragraph 3 (the end).
    const picks = new Set([0, 0.4, 0.8].map(r => insertAtSlot(REPLY, IMG, "random", () => r).indexOf(IMG)));
    assert.equal(picks.size, 3);
});

test("random: never before the first paragraph", () => {
    const out = insertAtSlot("\n\nFirst.\n\nSecond.", IMG, "random", () => 0);
    assert.ok(out.indexOf("First.") < out.indexOf(IMG));
});

test("the rest of the reply is left exactly as it was", () => {
    const reply = "A.\n\n\n\nB with   spaces.\n\nC.";
    const out = insertAtSlot(reply, IMG, "end");
    assert.equal(out, `${reply}\n\n${IMG}`);
});
