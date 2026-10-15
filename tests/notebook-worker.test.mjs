// node --test "tests/*.test.mjs"
// Author's Notebook (plan 010) phase 5: Chomusuke reads each reply for clues,
// who learned what, and what came out; the story model only writes new truths.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNotebook } from "../src/state/modules/notebook/parse.js";
import { applyNotebook } from "../src/state/modules/notebook/model.js";
import { renderNotebookUpdateRules } from "../src/state/modules/notebook/render.js";
import {
    renderNotebookClerkTask, renderNotebookWorkerPrompt, replyWroteNotebookChanges, notebookAnswerBlock,
    joinNotebookRead, notebookReadPart, parseNotebookRead, NOTEBOOK_WORKER_SYSTEM
} from "../src/state/modules/notebook/worker.js";
import { notebookModule } from "../src/state/modules/notebook/index.js";
import { renderCombinedPrompt, splitCombinedAnswer } from "../src/features/imagegen/v2/prompt.js";

const OFF_FRAME = /\b(extension|plugin|app|ledger|database|tracker|interface|system)\b/i;

const SETUP = `<Notebook>
T1
Truth: The ferryman is Mira's father.
Hidden from: Mira, the reader
T2
Truth: The well was poisoned by the abbot.
Hidden from: Mira, Old Tomas
</Notebook>`;

const start = () => applyNotebook(null, parseNotebook(SETUP), { seq: 1 }).state;

const REPLY = `The ferryman would not take her coin. He called her "little wren", a name no one had used in years.
<Notebook_Update>
Truth+: T3
Truth: The innkeeper sold the map.
Hidden from: Mira
</Notebook_Update>`;

test("the story model's rules shrink to Truth+ when Chomusuke reads", () => {
    const rules = renderNotebookUpdateRules({ newOnly: true });
    assert.match(rules, /Truth\+/);
    assert.doesNotMatch(rules, /Clue T1|Learned T1|Truth-/);
});

test("the read's prompt: notes, story, task, shape; in-story wording", () => {
    const built = renderNotebookWorkerPrompt({ notes: "<Author_Notebook>\nT1\n</Author_Notebook>", earlier: "Mira: hello", exchange: "Ferryman: no." });
    assert.equal(built.system, NOTEBOOK_WORKER_SYSTEM);
    for (const part of ["<Author_Notebook>", "<Earlier_Story>", "<Latest_Exchange>", "Clue T1:", "Learned T1:", "Truth-: T1", "No changes", "<Notebook_Update>"]) {
        assert.ok(built.user.includes(part), part);
    }
    assert.ok(built.user.indexOf("<Latest_Exchange>") < built.user.indexOf("# Task"));
    assert.doesNotMatch(built.system + built.user, OFF_FRAME);
    const task = renderNotebookClerkTask();
    assert.equal(task.tag, "Notebook_Update");
    assert.doesNotMatch(task.rules, /Truth\+/);
});

test("a reply that wrote its own clue lines needs no read; a Truth+ alone does", () => {
    assert.equal(replyWroteNotebookChanges(REPLY), false);
    assert.equal(replyWroteNotebookChanges("Text.\n<Notebook_Update>\nClue T1: the coin\n</Notebook_Update>"), true);
    assert.equal(replyWroteNotebookChanges("Just story."), false);
});

test("the answer keeps only clue, learned and came-out lines", () => {
    const ans = notebookAnswerBlock(`<think>hm</think>
<Notebook_Update>
Clue T1: he calls her little wren
Learned T2: Old Tomas
Truth+: T9
Truth: Chomusuke may not invent truths.
Hidden from: Mira
Truth-: T1
</Notebook_Update>`);
    assert.equal(ans.count, 3);
    assert.doesNotMatch(ans.block, /Truth\+|invent/);
    assert.match(ans.block, /^<Notebook_Update>\nClue T1: he calls her little wren\nLearned T2: Old Tomas\nTruth-: T1\n<\/Notebook_Update>$/);
    assert.deepEqual(notebookAnswerBlock("<Notebook_Update>\nNo changes\n</Notebook_Update>"), { block: "<Notebook_Update>\nNo changes\n</Notebook_Update>", count: 0 });
    assert.equal(notebookAnswerBlock("I could not find anything."), null);
});

test("the reply's own truth and Chomusuke's lines are one entry; the clue is checked against the story", () => {
    const ans = notebookAnswerBlock("<Notebook_Update>\nClue T1: he calls her little wren\nClue T2: dead birds by the well\n</Notebook_Update>");
    const parsed = parseNotebookRead(REPLY, ans.block);
    const res = applyNotebook(start(), parsed, { seq: 2 });
    assert.deepEqual(res.applied.map(a => a.op), ["entry", "clue", "clue"]);
    assert.equal(res.state.truths.T3.truth, "The innkeeper sold the map.");
    assert.equal(res.state.truths.T1.clues[0].found, true);
    assert.equal(res.state.truths.T2.clues[0].found, false);

    // The stored text parses to the same thing (a parser upgrade re-reads it).
    const raw = joinNotebookRead(REPLY, ans.block);
    assert.deepEqual(notebookModule.parse(raw), parsed);
    // An edit to the reply keeps Chomusuke's part.
    assert.equal(notebookReadPart(raw), ans.block);
    assert.equal(notebookReadPart(REPLY), "");
});

test("the combined call carries the notebook task, and its block never leaks into the image prompt", () => {
    const built = renderCombinedPrompt({
        exchange: "Ferryman: no.",
        image: true,
        engine: "classic",
        imageRules: "Write tags.",
        notebook: { notes: "<Author_Notebook>\nT1\n</Author_Notebook>", task: renderNotebookClerkTask() }
    });
    assert.ok(built.user.includes("The author's notebook"));
    assert.ok(built.user.includes("<Author_Notebook>"));
    assert.ok(built.user.includes("[change lines, or No changes]"));
    assert.match(built.system, /author's notebook/);
    const { prompt } = splitCombinedAnswer("<Image_Prompt>1girl, rain</Image_Prompt>\n<Notebook_Update>\nClue T1: wren\n</Notebook_Update>");
    assert.equal(prompt, "1girl, rain");
    const loose = splitCombinedAnswer("1girl, rain\n<Notebook_Update>\nClue T1: wren\n</Notebook_Update>");
    assert.equal(loose.prompt, "1girl, rain");
});
