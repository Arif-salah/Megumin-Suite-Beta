import { test } from "node:test";
import assert from "node:assert/strict";
import { pushLog, makeLogEntry, applyEditedTexts, bgJobWanted, messageText, BG_LOG_MAX, BG_LOG_TEXT_CAP } from "../src/engine/bgPromptsCore.js";

test("the log keeps the newest 10", () => {
    let log = [];
    for (let i = 0; i < 15; i++) log = pushLog(log, { n: i });
    assert.equal(log.length, BG_LOG_MAX);
    assert.equal(log[0].n, 14);
    assert.equal(log[9].n, 5);
});

test("a log entry is plain text and capped", () => {
    const big = "x".repeat(BG_LOG_TEXT_CAP + 500);
    const e = makeLogEntry({ job: "memory", messages: [{ role: "system", content: big }, { role: "user", content: [{ type: "text", text: "hi" }, { type: "image_url", image_url: {} }] }], status: "sent", at: 1 });
    assert.ok(e.messages[0].text.length < big.length);
    assert.match(e.messages[0].text, /cut here/);
    const small = makeLogEntry({ job: "memory", messages: [{ role: "user", content: [{ type: "text", text: "hi" }, { type: "image_url", image_url: {} }] }], status: "sent" });
    assert.equal(small.messages[0].text, "hi\n[image]");
    assert.equal(e.at, 1);
});

test("edited boxes go back into the messages, images kept", () => {
    const msgs = [{ role: "system", content: "a" }, { role: "user", content: [{ type: "text", text: "b" }, { type: "image_url", image_url: { url: "x" } }] }];
    assert.equal(applyEditedTexts(msgs, ["a", "b"]), false); // unchanged boxes: text parts only
    assert.equal(applyEditedTexts(msgs, ["A", "B"]), true);
    assert.equal(msgs[0].content, "A");
    assert.equal(messageText(msgs[1]), "B\n[image]");
    assert.equal(msgs[1].content[1].type, "image_url");
});

test("every job is shown unless switched off", () => {
    assert.equal(bgJobWanted(undefined, "memory"), true);
    assert.equal(bgJobWanted({ memory: true }, "memory"), true);
    assert.equal(bgJobWanted({ memory: false }, "memory"), false);
});
