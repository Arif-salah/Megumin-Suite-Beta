// node --test "tests/*.test.mjs"
// Plan 020: "Full update each time" lifts World State's limits; the Notebook
// keeps as many live truths as the user picks (3 by default).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWorldBlocks } from "../src/state/modules/world/parse.js";
import { emptyWorld, applyWorldChanges, LIST_LIMITS } from "../src/state/modules/world/model.js";
import { renderWorldInstructions, renderWorldForPrompt, renderWorldClerkTask, withoutLimits } from "../src/state/modules/world/render.js";
import { applyNotebook, emptyNotebook, liveTruths, clampLiveCap, LIVE_CAP, MAX_LIVE_CAP } from "../src/state/modules/notebook/model.js";
import { renderNotebookSetup, renderNotebookForPrompt, renderNotebookUpdateRules, truthCountWords } from "../src/state/modules/notebook/render.js";
import { renderNotebookSetupTask } from "../src/state/modules/notebook/worker.js";

const S = body => parseWorldBlocks(`<World_State>\n${body}\n</World_State>`);

test("full update: no list is cut, and the counts and limits leave the text", () => {
    const five = "Time: Night\n" + [1, 2, 3, 4, 5].map(i => `Thread+: thread number ${i}`).join("\n") + "\n" + [1, 2, 3, 4].map(i => `Seed+: seed number ${i}`).join("\n");
    const cut = applyWorldChanges(emptyWorld(), S(five), { seq: 1 }).state;
    assert.equal(cut.threads.length, LIST_LIMITS.threads, "with limits");
    const all = applyWorldChanges(emptyWorld(), S(five), { seq: 1, noLimits: true }).state;
    assert.equal(all.threads.length, 5);
    assert.equal(all.seeds.length, 4);

    const notes = renderWorldForPrompt(all, { noLimits: true });
    assert.match(notes, /\nThreads\n/);
    assert.doesNotMatch(notes, / of \d\)/);
    assert.match(renderWorldForPrompt(cut), /Threads \(3 of 3\)/, "the default keeps its counts");

    for (const r of [renderWorldInstructions("bootstrap", { carry: true, noLimits: true }), renderWorldClerkTask("bootstrap", { carry: true, noLimits: true })]) {
        assert.doesNotMatch(r.rules + r.template, /at most \d/);
        assert.match(r.rules, /Write the Threads, Seeds and Timers that still matter; the ones you leave out are closed\./);
    }
    assert.doesNotMatch(renderWorldInstructions("update", { noLimits: true }).rules, /Keep at most/);
    assert.match(renderWorldInstructions("update").rules, /Keep at most 3 Threads/, "the default keeps its limits");
    assert.match(renderWorldInstructions("bootstrap", { carry: true, noLimits: true, noSecret: true }).rules, /Write the Threads and Timers that still matter;/);
    assert.equal(withoutLimits("Timer+: [x]   (at most 2)"), "Timer+: [x]");
});

const truth = (id, name) => `${id}\nTruth: ${name} is not who they say.\nHidden from: Kazuma, the reader\nComes out when: later.\nWhat it changes: everything.\nClue ideas: a ring.`;
const setup = n => ({ ops: Array.from({ length: n }, (_, i) => ({ op: "entry", id: `T${i + 1}`, truth: `Truth number ${i + 1}.`, hiddenFrom: ["Kazuma"] })) });

test("notebook: the user's number of live truths, 3 by default", () => {
    assert.equal(liveTruths(applyNotebook(emptyNotebook(), setup(5), { seq: 1 }).state).length, LIVE_CAP);
    assert.equal(liveTruths(applyNotebook(emptyNotebook(), setup(5), { seq: 1, liveCap: 5 }).state).length, 5);
    const r = applyNotebook(emptyNotebook(), setup(3), { seq: 1, liveCap: 1 });
    assert.equal(liveTruths(r.state).length, 1);
    assert.match(r.notes[0], /1 are already live/);
    assert.equal(clampLiveCap(0), LIVE_CAP);
    assert.equal(clampLiveCap(99), MAX_LIVE_CAP);
    assert.equal(clampLiveCap("4"), 4);
});

test("notebook texts: word for word the same at 3, the number elsewhere", () => {
    assert.equal(truthCountWords(3), "two or three truths");
    assert.equal(truthCountWords(1), "one truth");
    assert.equal(truthCountWords(6), "two to 6 truths");
    assert.equal(renderNotebookSetup(), renderNotebookSetup({ cap: 3 }));
    assert.match(renderNotebookSetup(), /with two or three truths, built from/);
    assert.match(renderNotebookSetup({ cap: 5 }), /with two to 5 truths, built from/);
    assert.match(renderNotebookUpdateRules({ cap: 5 }), /only while fewer than 5 are live/);
    assert.match(renderNotebookUpdateRules(), /only while fewer than 3 are live/);
    const t = renderNotebookSetupTask({ cap: 4 });
    assert.match(t.rules, /two to 4 truths/);
    assert.match(t.template, /\[two to 4 truths, each in the form above\]/);
    const s = applyNotebook(emptyNotebook(), setup(2), { seq: 1 }).state;
    assert.match(renderNotebookForPrompt(s, { cap: 6 }), /Live truths: 2 of 6\./);
    assert.ok(truth);
});
