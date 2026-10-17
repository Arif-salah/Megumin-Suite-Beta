// node --test "tests/*.test.mjs"
// The Thinking Cap repeats its rules as the last user-side message.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addThinkingNudge, thinkingNudgeFor } from "../src/engine/thinkingNudge.js";
import { cot_v11, V11_CAP_NUDGE } from "../data/cot/v11.js";

const CAP = "cot-v11-cap-english";
const capText = cot_v11.find(c => c.id === CAP).content;

const prompt = () => [
    { role: "system", content: `The room.\n\n<think>\n${capText}\n</think>` },
    { role: "user", content: "I pat his head." },
    { role: "assistant", content: "<think>\n<think>\n" }
];

test("only V11's Thinking Cap has a nudge", () => {
    assert.equal(thinkingNudgeFor(CAP), V11_CAP_NUDGE);
    assert.equal(thinkingNudgeFor("cot-v11-english"), "");
    assert.equal(thinkingNudgeFor("cot-v10-ukiyo-cap-english"), "");
    assert.equal(thinkingNudgeFor(undefined), "");
});

test("the nudge goes after the chat and before the prefill", () => {
    const m = prompt();
    assert.equal(addThinkingNudge(m, CAP), true);
    assert.deepEqual(m.map(x => x.role), ["system", "user", "user", "assistant"]);
    assert.equal(m[2].content, V11_CAP_NUDGE);
    assert.equal(m[3].content, "<think>\n<think>\n");
});

test("with no prefill it is the last message", () => {
    const m = prompt().slice(0, 2);
    addThinkingNudge(m, CAP);
    assert.equal(m.at(-1).content, V11_CAP_NUDGE);
});

test("no nudge when the cap's text wasn't sent, or for the full CoT", () => {
    const own = [{ role: "system", content: "A preset with its own thinking." }, { role: "user", content: "Hi" }];
    assert.equal(addThinkingNudge(own, CAP), false);
    assert.equal(own.length, 2);
    const full = prompt();
    assert.equal(addThinkingNudge(full, "cot-v11-english"), false);
    assert.equal(full.length, 3);
});

test("the cap counts lines, not words, and never asks for the banlist to be checked", () => {
    assert.doesNotMatch(capText, /\d+\s*words/i);
    assert.doesNotMatch(capText, /banlist this turn|most likely to break/);
    assert.match(capText, /Close thinking\. Write\.$/);
});
