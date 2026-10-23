// node --test "tests/*.test.mjs"
// Plan 019, phase 3: what the "Chomusuke is working" indicator says.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chomusukeStatusText, setChomusukeStatus, getChomusukeStatus, onChomusukeStatus, setChomusukeStopHandler, stopFromIndicator } from "../src/engine/chomusukeStatus.js";

test("the indicator names the running job and how many wait", () => {
    assert.equal(chomusukeStatusText({ running: null, waiting: 0 }), "");
    assert.equal(chomusukeStatusText({ running: { jobs: ["worldState"] }, waiting: 0 }), "World State…");
    assert.equal(chomusukeStatusText({ running: { jobs: ["worldState", "blocks"] }, waiting: 2 }), "World State and Blocks… (2 more waiting)");
    assert.equal(chomusukeStatusText({ running: null, waiting: 1 }), "1 job waiting…");
    assert.equal(chomusukeStatusText({ running: null, waiting: 3 }), "3 jobs waiting…");
});

test("listeners hear every change; Stop calls the handler", () => {
    const seen = [];
    const off = onChomusukeStatus(s => seen.push(s.waiting));
    setChomusukeStatus({ running: { jobs: ["imageGen"] }, waiting: 1 });
    setChomusukeStatus({ running: null, waiting: -4 });
    off();
    setChomusukeStatus({ running: null, waiting: 5 });
    assert.deepEqual(seen, [1, 0]);
    assert.equal(getChomusukeStatus().waiting, 5);
    let stopped = 0;
    setChomusukeStopHandler(() => stopped++);
    stopFromIndicator();
    assert.equal(stopped, 1);
});
