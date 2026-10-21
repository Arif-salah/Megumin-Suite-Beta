// node --test "tests/*.test.mjs"
// Plan 018, phase 4: V11 Тайна and its Writers' Room, their turn frame, the
// short ban list, and Chomusuke writing the notebook setup a reply left out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { modes_v11taina, V11_BAN_LIST, SHORT_BAN_LIST } from "../data/modes/v11taina.js";
import { modes_v11 } from "../data/modes/v11.js";
import { modes } from "../data/modes/index.js";
import { models, meguminCotForMode } from "../data/cot/index.js";
import { thinkingSection, formattingSection, reminderSection, bannedSection } from "../src/engine/presetSections.js";
import { storySettingsBlock, wrapRepetition, languageLine, BAN_ADDITIONS } from "../src/prompts/v11Rules.js";
import {
    renderNotebookSetupTask, renderNotebookSetupWorkerPrompt, notebookSetupAnswerBlock, replyWroteTruths,
    NOTEBOOK_SETUP_SYSTEM, NOTEBOOK_WORKER_SYSTEM
} from "../src/state/modules/notebook/worker.js";
import { renderNotebookSetup, NOTEBOOK_TRUTH_FORM } from "../src/state/modules/notebook/render.js";
import { parseNotebook } from "../src/state/modules/notebook/parse.js";

const voice = modes_v11taina.find(m => m.id === "v11-voice");
const room = modes_v11taina.find(m => m.id === "v11-writers-room");

test("the list: V11 Тайна first and recommended, then the Writers' Room, then the Preview", () => {
    assert.deepEqual(modes.slice(0, 3).map(m => m.id), ["v11-voice", "v11-writers-room", "v11-room"]);
    assert.equal(voice.label, "V11 Тайна");
    assert.equal(room.label, "V11 Тайна · Writers' Room");
    assert.equal(modes_v11[0].label, "V11 Тайна Preview");
    assert.equal(modes.filter(m => m.recommended && String(m.id).startsWith("v11")).length, 1);
    for (const m of [voice, room]) {
        assert.equal(m.turnFrame, "v11");
        assert.equal(m.notebook, true);
    }
    assert.equal(modes_v11[0].turnFrame, undefined, "the Preview keeps the old frame");
});

test("each engine's text: one [[pronouns]], one [[aiprompt]], no slot markers left", () => {
    for (const m of [voice, room]) {
        assert.equal(m.p1.split("[[pronouns]]").length, 2);
        assert.equal(m.p1.split("[[aiprompt]]").length, 2);
        assert.doesNotMatch(m.p1 + m.contentRules + m.repetition, />>>|\[\[style\]\]/);
        assert.match(m.contentRules, /^<content>[\s\S]*<\/content>$/);
        assert.match(m.repetition, /Characters answer what \{\{user\}\} said without repeating it/);
        assert.match(m.reminderChecks, /listed in <content>\.$/);
    }
    assert.match(voice.p1, /You narrate as \[\[aiprompt\]\]/);
    assert.match(room.p1, /JULIA is: \[\[aiprompt\]\]/);
});

test("one voice names no narrator but the model", () => {
    const text = voice.p1 + voice.contentRules + voice.repetition;
    assert.doesNotMatch(text.replace("You are the narrator of an ongoing story.", ""), /\bthe narrator\b|author's|one person|NORA|JULIA|MIKI|ANVIL|OPUS/);
});

test("each engine gets its own thinking", () => {
    assert.equal(meguminCotForMode("v11-voice"), "cot-v11-voice-english");
    assert.equal(meguminCotForMode("v11-writers-room"), "cot-v11-wr-english");
    assert.equal(meguminCotForMode("v11-room"), "cot-v11-english");
    const v = models.find(m => m.id === "cot-v11-voice-english").content;
    assert.match(v, /\{\{user\}\}'s turn is settled\. Plan everyone else\./);
    assert.match(v, /and rewrite any line that breaks one\.$/);
    assert.doesNotMatch(v, /NORA|<think>/);
    assert.match(models.find(m => m.id === "cot-v11-wr-english").content, /The room plans everyone else\./);
});

test("the ban lists", () => {
    assert.match(V11_BAN_LIST, /^Never write any of the following\./);
    assert.match(V11_BAN_LIST, /Characters losing shoes\.$/);
    assert.match(SHORT_BAN_LIST, /^Avoid these habits\./);
    assert.equal(SHORT_BAN_LIST.split("\n").filter(l => l.startsWith("- ")).length, 5);
    assert.doesNotMatch(V11_BAN_LIST + SHORT_BAN_LIST, /SLOT|<\/?banlist>/);
});

test("the frame: thinking, formatting, final check, ban list", () => {
    assert.equal(thinkingSection("<think>\nx\n</think>", { frame: "v11" }), "<think>\nx\n</think>");
    assert.match(thinkingSection("x"), /^## your thinking steps:/);

    assert.equal(formattingSection({ dnratio: "r", color: "c", rules: "old rules", direct: "d", dn: "", frame: "v11" }),
        "<formatting>\nr\nc\nd\n</formatting>");
    assert.equal(formattingSection({ frame: "v11" }), "", "all four off: no section");

    const check = reminderSection({ checks: "a\nb", banned: true, presetChecks: "c", userLine: "5. d", frame: "v11" });
    assert.equal(check, "<final_check>\nBefore you output, check:\n1. a\n2. b\n3. Nothing in the response is on the banlist.\n4. c\n5. d\n</final_check>");
    assert.match(reminderSection({ checks: "a" }), /^## final reminder:/);

    assert.equal(bannedSection({ builtIn: "list", additions: "Also avoid these:\n- x", frame: "v11" }), "<banlist>\nlist\n\nAlso avoid these:\n- x\n</banlist>");
    assert.equal(bannedSection({ builtIn: "list", additions: "more" }), "<banlist>\nlist\nmore\n</banlist>");
    assert.equal(BAN_ADDITIONS.replace("{{banItems}}", "- x"), "Also avoid these:\n- x");
});

test("story settings, repetition and the language line", () => {
    assert.equal(storySettingsBlock(["- pov: third person"]),
        "<story_settings>\nThese settings hold for the whole story. Where one contradicts anything above, the setting wins.\n- pov: third person\n</story_settings>");
    assert.equal(storySettingsBlock([]), "");
    assert.equal(wrapRepetition("r"), "<repetition>\nr\n</repetition>");
    assert.equal(wrapRepetition(""), "");
    assert.equal(languageLine("ENGLISH"), "Write the response in English.");
    assert.equal(languageLine("arabic"), "Write the response in Arabic.");
});

test("notebook setup by Chomusuke: the task carries the craft and the same form", () => {
    const t = renderNotebookSetupTask();
    assert.equal(t.tag, "Notebook");
    assert.match(t.rules, /^<Notebook_Setup_Rules>[\s\S]*<\/Notebook_Setup_Rules>$/);
    assert.match(t.rules, /A good truth comes from the setting and the sheet, and once it comes out it changes how earlier scenes read\./);
    assert.match(t.rules, /Nothing in the story so far has given it away\./);
    for (const line of NOTEBOOK_TRUTH_FORM) {
        assert.ok(t.rules.includes(line));
        assert.ok(renderNotebookSetup().includes(line), "the story model's setup keeps the same form");
    }
    const p = renderNotebookSetupWorkerPrompt({ sheet: "Koromi runs a bar.", earlier: "", exchange: "Kazuma: hi" });
    assert.equal(p.system, NOTEBOOK_SETUP_SYSTEM);
    assert.doesNotMatch(p.system, /only what the exchange shows/);
    assert.notEqual(NOTEBOOK_SETUP_SYSTEM, NOTEBOOK_WORKER_SYSTEM);
    assert.match(p.user, /<Character_Sheet>\nKoromi runs a bar\.\n<\/Character_Sheet>/);
    assert.doesNotMatch(p.user, /Earlier_Story/);
    assert.match(p.user, /# Answer with this block and nothing else\n<Notebook>/);
});

test("notebook setup by Chomusuke: only a reply without truths gets one, and the answer is kept as a <Notebook>", () => {
    assert.equal(replyWroteTruths("She smiled. <Notebook>\nT1\nTruth: The bar is a front.\nHidden from: Kazuma\n</Notebook>"), true);
    assert.equal(replyWroteTruths("She smiled."), false);
    assert.equal(replyWroteTruths("<Notebook_Update>\nClue T1: a key\n</Notebook_Update>"), false);

    const ans = notebookSetupAnswerBlock("<think>hmm</think>\n```\n<Notebook>\nT1\nTruth: The bar is a front.\nHidden from: Kazuma, the reader\nComes out when: he opens the cellar\n\nT2\nTruth: Koromi owes the Ito family.\nHidden from: Kazuma\n</Notebook>\n```");
    assert.equal(ans.count, 2);
    assert.match(ans.block, /^<Notebook>\nT1\nTruth: The bar is a front\./);
    assert.equal(parseNotebook(ans.block, { prose: "" }).ops.filter(o => o.op === "entry").length, 2);

    assert.equal(notebookSetupAnswerBlock("No truths here."), null);
    assert.equal(notebookSetupAnswerBlock("<Notebook>\n[two or three truths, each in the form above]\n</Notebook>"), null, "the template echoed back is not a truth");
    // An echo of the task never counts as truths written.
    const echoed = renderNotebookSetupTask().rules;
    assert.equal(parseNotebook(echoed), null);
});
