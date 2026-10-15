// node --test "tests/*.test.mjs"
// Author's Notebook (plan 010) phase 1: parsing, the rules the code enforces,
// the prompts, and the store undoing a reply's notebook on swipe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNotebook, truthId, splitNames, clueInProse, storyProse } from "../src/state/modules/notebook/parse.js";
import { emptyNotebook, applyNotebook, liveTruths, pastTruths, findHiddenName, LIVE_CAP } from "../src/state/modules/notebook/model.js";
import {
    notebookPhase, renderNotebookSetup, renderNotebookForPrompt, renderNotebookUpdateRules,
    describeNotebookChange, renderTruthCard
} from "../src/state/modules/notebook/render.js";
import { notebookModule } from "../src/state/modules/notebook/index.js";
import { createStateStore } from "../src/state/store.js";

const SETUP = `The rain had not stopped since noon. The ferryman pushed the coin back across the plank.

<Notebook>
**T1**
Truth: The ferryman is Mira's father, who faked his death ten years ago.
Hidden from: Mira, the reader
Comes out when: Mira sees the scar on his hand.
What it changes: Mira stops trusting her mother.
Clue ideas: he refuses her money; he knows her childhood nickname.

T2
- Truth: The well was poisoned by the abbot.
- Hidden from: Mira, Old Tomas and the reader
- Comes out when: someone reads the abbot's ledger.
- What it changes: the village turns on the abbey.
- Clue ideas: dead birds near the well.
</Notebook>`;

const apply = (state, text, seq) => applyNotebook(state, parseNotebook(text), { seq });
const upd = (prose, body) => `${prose}\n<Notebook_Update>\n${body}\n</Notebook_Update>`;

test("ids, names and the clue check", () => {
    assert.equal(truthId("**T3**"), "T3");
    assert.equal(truthId("t 12"), "T12");
    assert.equal(truthId("Truth"), null);
    assert.deepEqual(splitNames("Mira, Old Tomas and the reader"), ["Mira", "Old Tomas", "the reader"]);
    assert.deepEqual(splitNames("no one"), []);
    assert.equal(clueInProse("the ferryman refused payment from Mira", "The ferryman pushed the coin back."), true);
    assert.equal(clueInProse("Mira saw a scar on his hand", "They ate soup in silence."), false, "only the name matches");
    assert.equal(clueInProse("refuses her money", "He refused it."), true, "same stem");
    assert.equal(clueInProse("Mira", "anything"), true, "nothing to compare: counts as found");
    assert.doesNotMatch(storyProse("Prose.\n<think>dead birds</think>\n<Blocks>dead birds</Blocks>"), /birds/);
});

test("setup block: entries with ids, bullets, bold, and names split", () => {
    const p = parseNotebook(SETUP);
    assert.equal(p.kind, "delta");
    assert.deepEqual(p.ops.map(o => [o.op, o.id, o.hiddenFrom]), [
        ["entry", "T1", ["Mira", "the reader"]],
        ["entry", "T2", ["Mira", "Old Tomas", "the reader"]]
    ]);
    assert.equal(p.ops[1].clueIdeas, "dead birds near the well.");
    assert.equal(parseNotebook("No notebook here."), null);
});

test("entries without id lines split on the next Truth:", () => {
    const p = parseNotebook("<Notebook>\nTruth: A.\nHidden from: Mira\nTruth: B.\nHidden from: Tomas\n</Notebook>");
    assert.deepEqual(p.ops.map(o => o.truth), ["A.", "B."]);
});

test("the rules and the setup prompt are never read as blocks", () => {
    const echoed = renderNotebookSetup() + "\n" + renderNotebookUpdateRules();
    assert.equal(parseNotebook(echoed), null);
});

test("update lines: Clue, Learned, Truth-, Truth+ with its lines", () => {
    const text = upd("The ferryman refused her coin.", [
        "Clue T1: the ferryman refused payment from Mira",
        "Learned T2: Old Tomas",
        "Truth-: T2",
        "Truth+: T3",
        "Truth: The abbot has a daughter in the city.",
        "Hidden from: the reader",
        "Clue ideas: letters with a city seal",
        "Clue T3: a letter with a city seal"
    ].join("\n"));
    const ops = parseNotebook(text).ops;
    assert.deepEqual(ops.map(o => o.op), ["clue", "learned", "out", "entry", "clue"]);
    assert.equal(ops[0].found, true);
    assert.deepEqual(ops[1].names, ["Old Tomas"]);
    assert.equal(ops[3].id, "T3");
    assert.equal(ops[3].clueIdeas, "letters with a city seal", "Clue ideas: stays a field of the entry");
    assert.equal(ops[4].found, false, "the letter is not in the prose");
});

test("Truth+ with the truth on the same line", () => {
    const ops = parseNotebook(upd("x", "Truth+: T4 The bell was never cast here.\nHidden from: Mira")).ops;
    assert.deepEqual([ops[0].id, ops[0].truth, ops[0].hiddenFrom], ["T4", "The bell was never cast here.", ["Mira"]]);
});

test("setup: ids are ours, live truths and the next id", () => {
    const { state, applied } = apply(emptyNotebook(), SETUP, 1);
    assert.deepEqual(Object.keys(state.truths), ["T1", "T2"]);
    assert.equal(state.next, 3);
    assert.equal(state.truths.T1.createdSeq, 1);
    assert.deepEqual(applied.map(a => a.op), ["entry", "entry"]);
    assert.equal(liveTruths(state).length, 2);
});

test("a reused id gets the next free one, and later lines follow it", () => {
    let s = apply(emptyNotebook(), SETUP, 1).state;
    const r = apply(s, upd("A letter with a city seal lay on the desk.", "Truth+: T1\nTruth: The abbot has a daughter.\nHidden from: the reader\nClue T1: a letter with a city seal"), 2);
    s = r.state;
    assert.equal(s.truths.T3.truth, "The abbot has a daughter.");
    assert.match(s.truths.T1.truth, /ferryman/, "T1 is not overwritten");
    assert.equal(s.truths.T3.clues.length, 1, "Clue T1 in the same reply went to the new truth");
    assert.equal(s.truths.T1.clues.length, 0);
});

test("the cap: a new truth past 3 live is left out; the same truth twice is one truth", () => {
    let s = apply(emptyNotebook(), SETUP, 1).state;
    s = apply(s, upd("x", "Truth+: T3\nTruth: C.\nHidden from: Mira"), 2).state;
    const r = apply(s, upd("x", "Truth+: T4\nTruth: D.\nHidden from: Mira"), 3);
    assert.equal(liveTruths(r.state).length, LIVE_CAP);
    assert.match(r.notes[0], /3 are already live/);
    const again = apply(s, SETUP, 4);
    assert.equal(Object.keys(again.state.truths).length, 3, "a rewritten notebook adds nothing");
    assert.equal(apply(emptyNotebook(), "<Notebook>\nT1\nTruth: X.\nHidden from: no one\n</Notebook>", 1).notes[0], "New truth left out: it is hidden from no one.");
});

test("Learned shrinks the list; empty list = revealed. Truth- reveals at once", () => {
    let s = apply(emptyNotebook(), SETUP, 1).state;
    s = apply(s, upd("x", "Learned T1: the reader"), 2).state;
    assert.deepEqual(s.truths.T1.hiddenFrom, ["Mira"]);
    const r = apply(s, upd("x", "Learned T1: Mira, Nobody"), 3);
    assert.equal(r.state.truths.T1.revealedSeq, 3);
    assert.equal(r.state.truths.T1.revealedHow, "learned");
    assert.deepEqual(r.applied.map(a => a.op), ["learned", "out"]);
    const out = apply(r.state, upd("x", "Truth-: T2"), 4).state;
    assert.equal(out.truths.T2.revealedHow, "out");
    assert.equal(liveTruths(out).length, 0);
    assert.equal(pastTruths(out).length, 2);
    assert.equal(notebookPhase(out), "setup", "nothing live: setup runs again");
});

test("Learned matches the reader, a unique first name, and ignores strangers", () => {
    const list = ["Mira Vale", "Old Tomas", "the reader"];
    assert.equal(findHiddenName(list, "reader"), 2);
    assert.equal(findHiddenName(list, "Mira"), 0);
    assert.equal(findHiddenName(list, "Tomas"), -1, "not a first name");
    assert.equal(findHiddenName(list, "Stranger"), -1);
    const s = apply(emptyNotebook(), SETUP, 1).state;
    const r = apply(s, upd("x", "Learned T2: Stranger"), 2);
    assert.equal(r.state.truths.T2.hiddenFrom.length, 3);
    assert.match(r.notes[0], /not on its Hidden from list/);
});

test("first wins; changes to unknown or revealed truths are ignored", () => {
    let s = apply(emptyNotebook(), SETUP, 1).state;
    const r = apply(s, upd("The ferryman refused her coin. Birds lay dead.", "Clue T1: the ferryman refused her coin\nClue T1: dead birds\nClue T9: anything"), 2);
    assert.deepEqual(r.state.truths.T1.clues.map(c => c.text), ["the ferryman refused her coin"]);
    assert.match(r.notes[0], /T9 is not in the notebook/);
    s = apply(r.state, upd("x", "Truth-: T1"), 3).state;
    const late = apply(s, upd("The scar again.", "Clue T1: the scar"), 4);
    assert.equal(late.state.truths.T1.clues.length, 1);
    assert.match(late.notes[0], /already come out/);
});

test("the model has no edit line; the user's ops edit, forget, reveal and restore", () => {
    let s = apply(emptyNotebook(), SETUP, 1).state;
    assert.equal(parseNotebook(upd("x", "Edit T1: something else")), null);
    s = applyNotebook(s, { ops: [{ op: "edit", id: "T1", fields: { truth: "Changed.", hiddenFrom: ["Mira"] } }] }, { seq: 2 }).state;
    assert.equal(s.truths.T1.truth, "Changed.");
    s = applyNotebook(s, { ops: [{ op: "reveal", id: "T1" }] }, { seq: 3 }).state;
    assert.equal(s.truths.T1.revealedHow, "user");
    s = applyNotebook(s, { ops: [{ op: "restore", id: "T1" }] }, { seq: 4 }).state;
    assert.equal(liveTruths(s).length, 2);
    s = applyNotebook(s, { ops: [{ op: "forget", id: "T2" }] }, { seq: 5 }).state;
    assert.deepEqual(Object.keys(s.truths), ["T1"]);
    assert.equal(s.next, 3, "a forgotten id is never given out again");
    s = applyNotebook(s, { ops: [{ op: "edit", id: "T1", fields: { hiddenFrom: [] } }] }, { seq: 6 }).state;
    assert.equal(s.truths.T1.revealedHow, "user", "an empty list from the tab means it is out");
});

test("prompts: setup, notebook, rules; phases; card text", () => {
    assert.equal(notebookPhase(emptyNotebook()), "setup");
    assert.equal(notebookPhase(emptyNotebook(), { paused: true }), "off");
    assert.equal(notebookPhase(emptyNotebook(), { on: false }), "off");
    assert.equal(renderNotebookForPrompt(emptyNotebook()), "");
    let s = apply(emptyNotebook(), SETUP, 1).state;
    s = apply(s, upd("The ferryman refused her coin.", "Clue T1: the ferryman refused her coin\nTruth-: T2"), 4).state;
    assert.equal(notebookPhase(s), "running");
    const nb = renderNotebookForPrompt(s);
    assert.match(nb, /^<Author_Notebook>\nT1\nTruth: The ferryman is Mira's father/);
    assert.match(nb, /Clues planted:\n- turn 4: the ferryman refused her coin/);
    assert.doesNotMatch(nb, /abbot/, "a revealed truth leaves the prompt");
    assert.match(nb, /Live truths: 1 of 3\. Next id: T3\.\n<\/Author_Notebook>$/);
    const rules = renderNotebookUpdateRules();
    assert.match(rules, /Clue T1: <the clue this turn's story showed>/);
    assert.match(rules, /Truth-: T1/);
    const newOnly = renderNotebookUpdateRules({ newOnly: true });
    assert.doesNotMatch(newOnly, /Clue T1|Learned|Truth-/);
    assert.match(newOnly, /Truth\+: T3/);
    for (const t of [renderNotebookSetup(), rules, nb]) assert.doesNotMatch(t, /\b(extension|plugin|app|ledger|tracker|system)\b/i);
    assert.equal(describeNotebookChange({ op: "clue", id: "T1", text: "x", found: false }), "T1 clue: x (not found in the reply)");
    assert.match(renderTruthCard(s.truths.T2), /\*Came out:\* turn 4/);
});

// ── The store: a swiped reply takes its notebook with it ────────────────
function env() {
    const e = { chat: [], meta: {} };
    e.store = createStateStore({
        adapter: { getChat: () => e.chat, getMeta: () => e.meta, saveMeta() {}, saveChat() {}, getUserNames: () => ["Kazuma"] },
        modules: { notebook: notebookModule }
    });
    return e;
}
const ai = text => ({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} });

test("store: swiping the setup reply empties the notebook; swiping back restores it", () => {
    const e = env();
    e.chat.push({ is_user: true, mes: "hi", extra: {} });
    e.chat.push(ai(SETUP));
    e.store.recordMessage(1, { expect: true });
    assert.equal(liveTruths(e.store.getState("notebook")).length, 2);
    // A new swipe with no notebook.
    const m = e.chat[1];
    m.swipe_info[0].extra = structuredClone(m.extra);
    m.swipe_id = 1;
    e.store.onSwiped(1);
    m.mes = "A different reply.";
    m.swipes[1] = m.mes;
    m.swipe_info[1] = { extra: structuredClone(m.extra) };
    e.store.recordMessage(1, { expect: true });
    assert.equal(liveTruths(e.store.getState("notebook")).length, 0);
    assert.equal(notebookPhase(e.store.getState("notebook")), "setup");
    // Back to the first swipe.
    m.swipe_info[1].extra = structuredClone(m.extra);
    m.swipe_id = 0;
    m.mes = m.swipes[0];
    m.extra = structuredClone(m.swipe_info[0].extra);
    e.store.onSwiped(1);
    assert.equal(liveTruths(e.store.getState("notebook")).length, 2);
});
