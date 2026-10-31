// node --test "tests/*.test.mjs"
// Plan 020, phase 4: the setup checklist, Chomusuke's Test, and the empty
// answer warning that shows once per chat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checklistState } from "../src/ui/checklistCore.js";
import { testAnswerKind, TEST_PROMPT, TEST_WORD, shouldWarn, chomusukeProblemText } from "../src/engine/chomusukeNotice.js";

test("checklist: counts, the next step to open, ready when all are done", () => {
    assert.deepEqual(checklistState([{ done: true }, { done: false }, { done: false }]), { done: 1, total: 3, allDone: false, next: 1 });
    assert.deepEqual(checklistState([{ done: true }, { done: true }]), { done: 2, total: 2, allDone: true, next: -1 });
    assert.equal(checklistState([]).allDone, false, "no steps is not ready");
    assert.equal(checklistState(null).total, 0);
});

test("Chomusuke's test: the word back is ok, nothing is empty, anything else is other", () => {
    assert.match(TEST_PROMPT, new RegExp(TEST_WORD));
    assert.equal(testAnswerKind(TEST_WORD), "ok");
    assert.equal(testAnswerKind("Pineapple."), "ok");
    assert.equal(testAnswerKind("<think>they want a fruit</think>\npineapple"), "ok");
    assert.equal(testAnswerKind(""), "empty");
    assert.equal(testAnswerKind("<think>I should not</think>"), "empty");
    assert.equal(testAnswerKind("I can't help with that."), "other");
    assert.equal(testAnswerKind("<think>pineapple?</think>\nSure!"), "other", "the word only in its thinking doesn't count");
    assert.equal(testAnswerKind("pineapples"), "other", "a whole word");
});

test("an empty answer warns once per chat; failed and wrong format warn every time", () => {
    const seen = new Set();
    assert.equal(shouldWarn("empty", "chat-a", seen), true);
    assert.equal(shouldWarn("empty", "chat-a", seen), false);
    assert.equal(shouldWarn("empty", "chat-b", seen), true);
    assert.equal(shouldWarn("failed", "chat-a", seen), true);
    assert.equal(shouldWarn("failed", "chat-a", seen), true);
    assert.equal(shouldWarn("format", "chat-a", seen), true);
});

test("the empty warning names models to try", () => {
    assert.match(chomusukeProblemText("empty", ["worldState"]), /GLM 5\.3 Flash, DeepSeek 4\.1 Flash/);
});
