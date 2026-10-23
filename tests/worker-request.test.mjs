// node --test "tests/*.test.mjs"
// Plan 019: Chomusuke sending its jobs straight to its connection profile.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    workerRoute, isJobMarker, plainMessages, replyLength, answerOf, requestError, isChatProfile, storyWaitsFor,
} from "../src/engine/workerRequest.js";

test("a job goes to the profile, unless it is the story's own connection or the fallback is on", () => {
    const base = { profileId: "w", currentId: "s", hasService: true, fallback: false };
    assert.equal(workerRoute(base), "profile");
    assert.equal(workerRoute({ ...base, profileId: "" }), "current");
    assert.equal(workerRoute({ ...base, profileId: "s" }), "current");
    assert.equal(workerRoute({ ...base, fallback: true }), "switch");
    assert.equal(workerRoute({ ...base, hasService: false }), "switch");
    assert.equal(workerRoute({ ...base, profileId: "", fallback: true }), "current");
});

test("our markers are built by the prompt handler; a plain prompt goes as one user message", () => {
    assert.ok(isJobMarker("___PS_WORLD_EXTRACT___"));
    assert.ok(isJobMarker(" ___PS_IMAGE_GEN___\n"));
    assert.ok(!isJobMarker("Reply with the single word: OK"));
    assert.ok(!isJobMarker(""));
    assert.deepEqual(plainMessages("Reply with the single word: OK"), [{ role: "user", content: "Reply with the single word: OK" }]);
    assert.deepEqual(plainMessages("  "), []);
});

test("the reply length is the worker preset's, else the story's, else 1024", () => {
    assert.equal(replyLength(800, 2000), 800);
    assert.equal(replyLength(undefined, 2000), 2000);
    assert.equal(replyLength("0", "300"), 300);
    assert.equal(replyLength(null, null), 1024);
});

test("the answer's text comes back without its reasoning", () => {
    assert.equal(answerOf({ content: "World", reasoning: "hmm" }), "World");
    assert.equal(answerOf("plain"), "plain");
    assert.equal(answerOf(null), "");
    assert.equal(answerOf({ content: { a: 1 } }), "");
});

test("a failed request shows the API's own words, not 'API request failed'", () => {
    const inner = new Error("Invalid API key");
    assert.equal(requestError(new Error("API request failed", { cause: inner })), "Invalid API key");
    assert.equal(requestError(new Error("Connection Manager is not available")), "Connection Manager is not available");
    assert.equal(requestError("timeout"), "timeout");
});

test("only Chat Completion profiles", () => {
    assert.ok(isChatProfile({ mode: "cc" }));
    assert.ok(isChatProfile({}));
    assert.ok(!isChatProfile({ mode: "tc" }));
    assert.ok(!isChatProfile(null));
});

test("a message you send waits for the jobs that read the last reply, not for an image or a scan", () => {
    assert.ok(storyWaitsFor(["worldState"]));
    assert.ok(storyWaitsFor(["imageGen", "blocks"]));
    assert.ok(!storyWaitsFor(["imageGen"]));
    assert.ok(!storyWaitsFor(["npc"]));
    assert.ok(!storyWaitsFor(null));
});
