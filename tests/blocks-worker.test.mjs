// node --test "tests/*.test.mjs"
// Plan 009: blocks written by Chomusuke.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderWorkerNotes, renderBlocksTasks, renderBlocksWorkerPrompt, cleanWorkerAnswer, blockTextIn } from "../src/state/modules/stats/worker.js";
import { cyoaModule, bondsModule, chatterModule } from "../src/state/modules/stats/index.js";

const OFF_FRAME = /\b(extension|plugin|app|system|ledger|database|tracker|interface|worker|chomusuke)\b/i;

const TASKS = [
    { tag: "Bonds", body: "[One line per named NPC present.\n- Start every number from <Bonds_Now> in <Current_Info>.]\n\n[NPC Name]: Affection: [0-100]/100" },
    { tag: "CYOA", body: "1. [Short suggestion]\n2. [Short suggestion]" },
    { tag: "NPC_Inner_Chatter", body: "   " }
];

test("notes sit in <Current_Info>, as the story model sees them; nothing when empty", () => {
    assert.equal(renderWorkerNotes({ bonds: "Anno: Affection: 45/100" }), "<Current_Info>\n<Bonds_Now>\nAnno: Affection: 45/100\n</Bonds_Now>\n</Current_Info>");
    assert.equal(renderWorkerNotes({}), "");
});

test("tasks: each block's own template in its tag; empty ones left out; the answer shape in order", () => {
    const t = renderBlocksTasks(TASKS);
    assert.match(t.tasks, /<Bonds>\n\[One line per named NPC present\.[\s\S]*<\/Bonds>\n\n<CYOA>\n1\. \[Short suggestion\]/);
    assert.doesNotMatch(t.tasks, /NPC_Inner_Chatter/);
    assert.deepEqual(t.shape, ["<Bonds>…</Bonds>", "<CYOA>…</CYOA>"]);
});

test("the separate read: notes, story, the latest exchange, the tasks, the shape; in-story wording", () => {
    const p = renderBlocksWorkerPrompt({
        notes: renderWorkerNotes({ bonds: "Anno: Affection: 45/100", sheet: "HP: 80/100" }),
        earlier: "Anno: Hi.",
        exchange: "Kazuma: Hello.\n\nAnno: She smiled.",
        tasks: TASKS
    });
    const at = s => p.user.indexOf(s);
    assert.ok(at("<Current_Info>") === 0);
    assert.ok(at("<Earlier_Story>") < at("<Latest_Exchange>"));
    assert.ok(at("</Latest_Exchange>") < at("# Task"));
    assert.ok(at("# Task") < at("# Answer with these blocks"));
    assert.match(p.user, /<Character_Sheet_Now>\nHP: 80\/100\n<\/Character_Sheet_Now>/);
    assert.doesNotMatch(p.system + p.user.replace(/<[^>]+>/g, ""), OFF_FRAME);
});

test("the answer: cleaned, each module reads its own block, a block's text for its card", () => {
    const raw = cleanWorkerAnswer("<think>hmm</think>\n```\n<Bonds>\nAnno: Affection: 50/100 (+5 smiled)\n</Bonds>\n<CYOA>\n1. Wave back\n2. Leave\n</CYOA>\n<NPC_Inner_Chatter>\nAnno: He came back.\n</NPC_Inner_Chatter>\n```");
    assert.ok(raw.startsWith("<Bonds>"));
    assert.equal(bondsModule.parse(raw).people[0].fields[0].text, "50/100");
    assert.equal(cyoaModule.parse(raw).text, "1. Wave back\n2. Leave");
    assert.equal(chatterModule.parse(raw).text, "Anno: He came back.");
    assert.equal(blockTextIn(raw, "CYOA"), "<CYOA>\n1. Wave back\n2. Leave\n</CYOA>");
    assert.equal(blockTextIn(raw, "Character_Sheet"), "");
});
