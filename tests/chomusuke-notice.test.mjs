// node --test "tests/*.test.mjs"
// Plan 016: what the user is told when Chomusuke's answer is missing or unusable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { answerKind, joinJobNames, chomusukeProblemText, warnChomusuke } from "../src/engine/chomusukeNotice.js";

test("an answer that is empty, or only thinking, said nothing; anything else is the wrong format", () => {
    assert.equal(answerKind(""), "empty");
    assert.equal(answerKind(null), "empty");
    assert.equal(answerKind("  \n "), "empty");
    assert.equal(answerKind("<think>hmm, the bonds…</think>\n"), "empty");
    assert.equal(answerKind("<think>cut off before it ended"), "empty");
    assert.equal(answerKind("Sure! Here is the update: she is happy."), "format");
});

test("job names read as a list", () => {
    assert.equal(joinJobNames(["worldState"]), "World State");
    assert.equal(joinJobNames(["worldState", "blocks"]), "World State and Blocks");
    assert.equal(joinJobNames(["worldState", "blocks", "imageGen"]), "World State, Blocks and the image");
});

test("each kind says what happened and what to do", () => {
    const failed = chomusukeProblemText("failed", ["worldState"], { error: new Error("401 Unauthorized") });
    assert.match(failed, /couldn't get an answer for World State: 401 Unauthorized\./);
    assert.match(failed, /Read again/);
    assert.doesNotMatch(failed, /connection is back/); // nothing was switched
    assert.match(chomusukeProblemText("failed", ["memory"], { error: "x", switchedBack: true }), /Your story connection is back./);

    const empty = chomusukeProblemText("empty", ["blocks", "notebook"]);
    assert.match(empty, /sent back nothing for Blocks and The Notebook/);
    assert.match(empty, /Chomusuke tab/);

    const format = chomusukeProblemText("format", ["imageGen"]);
    assert.match(format, /not in a format it could use for the image, so nothing changed/);
    assert.doesNotMatch(format, /Read again/); // an image has no card to read again
    assert.match(format, /stronger model/);
});

test("no internal words reach the user", () => {
    for (const kind of ["failed", "empty", "format"]) {
        const t = chomusukeProblemText(kind, ["worldState", "blocks", "notebook", "imageGen", "memory", "storyPlan"], { error: "timeout" });
        assert.doesNotMatch(t, /worldState|imageGen|storyPlan|sidemodel|module|entry|undefined|null/);
    }
});

test("a failed request is an error, the rest are warnings; nothing to name, nothing shown", () => {
    const shown = [];
    globalThis.toastr = { error: t => shown.push(["error", t]), warning: t => shown.push(["warning", t]) };
    try {
        warnChomusuke("failed", ["worldState"], { error: "x" });
        warnChomusuke("format", ["blocks"]);
        warnChomusuke("empty", []);
        assert.deepEqual(shown.map(s => s[0]), ["error", "warning"]);
    } finally {
        delete globalThis.toastr;
    }
});
