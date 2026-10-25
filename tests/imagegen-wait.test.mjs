// node --test "tests/*.test.mjs"
// Image Gen V2: an image the story model wrote waits for World State and the looks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { waitUnlessStuck } from "../src/features/imagegen/v2/waitFor.js";

const later = (ms, fail = false) => new Promise((ok, no) => setTimeout(() => (fail ? no(new Error("x")) : ok()), ms));

test("nothing pending: done at once", async () => {
    assert.equal(await waitUnlessStuck(Promise.resolve(), { limitMs: 50, tickMs: 10 }), "done");
});

test("work that finishes in time: done", async () => {
    assert.equal(await waitUnlessStuck(later(30), { limitMs: 200, tickMs: 10 }), "done");
});

test("work that fails still lets the image go", async () => {
    assert.equal(await waitUnlessStuck(later(20, true), { limitMs: 200, tickMs: 10 }), "done");
});

test("stuck work: gives up at the limit", async () => {
    const start = Date.now();
    assert.equal(await waitUnlessStuck(new Promise(() => {}), { limitMs: 60, tickMs: 10 }), "gave-up");
    assert.ok(Date.now() - start < 1000);
});

test("time on a preview popup doesn't count", async () => {
    let paused = true;
    setTimeout(() => { paused = false; }, 80);
    // The limit is 40 ms, but the first 80 ms are paused, so the work (100 ms) makes it.
    assert.equal(await waitUnlessStuck(later(100), { limitMs: 40, tickMs: 10, isPaused: () => paused }), "done");
});
