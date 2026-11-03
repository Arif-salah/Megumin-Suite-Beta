// Dev Mode edits of the rules built by pure modules: World State, Bonds, Sheet.
import { test } from "node:test";
import assert from "node:assert/strict";

import { setPromptEditReader, promptEdit, fillPromptTokens } from "../src/prompts/edits.js";
import { renderWorldInstructions, worldPromptDefault, setWorldLimits } from "../src/state/modules/world/render.js";
import { bondsRulesText, bondsRulesSplit, sheetRulesText, statRuleTokens } from "../src/prompts/v11Rules.js";

const withEdits = (edits, fn) => {
    setPromptEditReader(k => edits[k] || "");
    try { return fn(); } finally { setPromptEditReader(null); }
};

test("edits: only set texts count; tokens fill, {{user}} stays", () => {
    withEdits({ a: "  ", b: "x" }, () => {
        assert.equal(promptEdit("a"), "");
        assert.equal(promptEdit("b"), "x");
        assert.equal(promptEdit("c"), "");
    });
    assert.equal(promptEdit("b"), "");
    assert.equal(fillPromptTokens("{{user}} keeps {{threads}}, {{nope}}", { threads: 4 }), "{{user}} keeps 4, {{nope}}");
});

test("world: Dev Mode opens the built-in text with the limits as tokens", () => {
    const rules = worldPromptDefault("update", "rules");
    assert.match(rules, /Keep at most \{\{threads\}\} Threads, \{\{seeds\}\} Seeds and \{\{timers\}\} Timers/);
    assert.match(rules, /Keep at most \{\{offscreen\}\} Off-screen lines/);
    assert.match(worldPromptDefault("bootstrap", "template"), /at most \{\{seeds\}\}\]/);
});

test("world: an unedited text is the built-in one; an edit is sent with the limits filled", () => {
    setWorldLimits({ threads: 5, seeds: 2, timers: 3, offscreen: 4 });
    try {
        const plain = renderWorldInstructions("update");
        const filled = renderWorldInstructions("update", {});
        assert.equal(plain.rules, filled.rules);
        assert.match(plain.rules, /Keep at most 5 Threads, 2 Seeds and 3 Timers/);

        const edited = withEdits({
            worldUpdateRules: "## World Update rules\nMy rule.\n- Keep at most {{threads}} Threads, {{seeds}} Seeds and {{timers}} Timers.",
            worldUpdateTemplate: "<World_Update>\n[mine]\n</World_Update>"
        }, () => renderWorldInstructions("update"));
        assert.equal(edited.rules, "## World Update rules\nMy rule.\n- Keep at most 5 Threads, 2 Seeds and 3 Timers.");
        assert.equal(edited.template, "<World_Update>\n[mine]\n</World_Update>");

        // "Full update each time" still drops the limit lines from an edit.
        const noLimits = withEdits({ worldUpdateRules: "A.\n- Keep at most {{threads}} Threads." },
            () => renderWorldInstructions("update", { noLimits: true }));
        assert.equal(noLimits.rules, "A.");

        // The full-scene text is its own edit.
        const full = withEdits({ worldUpdateRules: "x" }, () => renderWorldInstructions("bootstrap"));
        assert.match(full.rules, /^## World State rules/);
    } finally {
        setWorldLimits(null);
    }
});

test("bonds / sheet: token text for Dev Mode, and what the tokens stand for", () => {
    const fields = [{ label: "Trust", type: "meter", start: 30 }, { label: "Desire", type: "meter" }, { label: "Gold", type: "number", start: 5 }];
    const t = bondsRulesText(fields, { tokens: true });
    assert.match(t, /\{\{meters\}\} move by 10 at most/);
    assert.match(t, /starts at \{\{start\}\}\./);
    assert.equal(bondsRulesSplit(fields), `## Bonds\n${bondsRulesText(fields)}`);
    assert.deepEqual(statRuleTokens(fields), { start: "Trust 30, Desire 0, Gold 5", meters: "Trust and Desire" });
    assert.equal(fillPromptTokens(t, statRuleTokens(fields)), bondsRulesText(fields));
    assert.match(sheetRulesText(fields, { tokens: true }), /^The sheet is \{\{user\}\}'s\./);
});

// ── Plan 024: every other text ──
import { editableTree } from "../src/prompts/edits.js";
import { IMAGE_V2_PROMPTS, IMAGE_V2_BUILTIN } from "../src/prompts/imageGenV2.js";
import { renderNotebookSetup, renderNotebookUpdateRules, notebookSetupText, notebookUpdateText, truthCountWords, NOTEBOOK_TRUTH_FORM } from "../src/state/modules/notebook/render.js";
import { renderNotebookSetupTask, notebookSetupClerkText } from "../src/state/modules/notebook/worker.js";
import { renderCombinedPrompt, COMBINED_SYSTEM, renderV2ExtraTasks } from "../src/features/imagegen/v2/prompt.js";
import { renderBlocksWorkerPrompt, BLOCKS_WORKER_SYSTEM } from "../src/state/modules/stats/worker.js";

test("image V2: every text reads its edit; lists of lines come back as lists", () => {
    assert.equal(IMAGE_V2_PROMPTS.inEnglish, IMAGE_V2_BUILTIN.inEnglish);
    withEdits({ "imageV2.inEnglish": "English, please.", "imageV2.shot.pov": "POV!" }, () => {
        assert.equal(IMAGE_V2_PROMPTS.inEnglish, "English, please.");
        assert.equal(IMAGE_V2_PROMPTS.shot.pov, "POV!");
        assert.equal(IMAGE_V2_PROMPTS.shot.portrait, IMAGE_V2_BUILTIN.shot.portrait);
    });
    const tree = editableTree({ a: ["x", "y"] }, "t");
    assert.deepEqual(tree.a, ["x", "y"]);
    withEdits({ "t.a": "one\r\ntwo" }, () => assert.deepEqual(tree.a, ["one", "two"]));
});

test("notebook: the token texts Dev Mode opens fill back to the built-in ones", () => {
    const form = NOTEBOOK_TRUTH_FORM.join("\n");
    assert.equal(notebookSetupText(truthCountWords(3), form), renderNotebookSetup({ cap: 3 }));
    assert.equal(notebookUpdateText(false, 4), renderNotebookUpdateRules({ cap: 4 }));
    withEdits({ notebookSetupRules: "Write {{truths}}:\n{{truth_form}}", notebookTruthForm: "T1\nTruth: x" }, () => {
        assert.equal(renderNotebookSetup({ cap: 2 }), "Write one or two truths:\nT1\nTruth: x");
        assert.match(renderNotebookSetupTask({ cap: 2 }).rules, /T1\nTruth: x/);
    });
    withEdits({ notebookUpdateRules: "At most {{max}}." }, () => {
        assert.equal(renderNotebookUpdateRules({ cap: 5 }), "At most 5.");
        assert.notEqual(renderNotebookUpdateRules({ cap: 5, newOnly: true }), "At most 5.");
    });
    assert.match(notebookSetupClerkText("{{truths}}", "{{truth_form}}"), /\{\{truths\}\}[\s\S]*\{\{truth_form\}\}/);
});

test("Chomusuke: the combined call's opening and the blocks read take their edits", () => {
    const base = { exchange: "x", world: { rules: "r", template: "<World_Update>\n</World_Update>", tag: "World_Update" }, engine: "v2", imageRules: "i" };
    assert.equal(renderCombinedPrompt(base).system, COMBINED_SYSTEM);
    withEdits({ combinedSystem: "Do this: {{jobs}}." }, () => {
        assert.equal(renderCombinedPrompt(base).system, "Do this: note what it changed in the world and write an image prompt for the moment it ends on.");
    });
    assert.equal(renderBlocksWorkerPrompt({ exchange: "x", tasks: [] }).system, BLOCKS_WORKER_SYSTEM);
    withEdits({ blocksWorkerSystem: "Me.", blocksWorkerTask: "Fill these:" }, () => {
        const p = renderBlocksWorkerPrompt({ exchange: "x", tasks: [{ tag: "Bonds", body: "b" }] });
        assert.equal(p.system, "Me.");
        assert.match(p.user, /Fill these:\n\n<Bonds>/);
    });
    withEdits({ imageV2LooksTask: "Looks for {{names}}." }, () => {
        assert.match(renderV2ExtraTasks({ looks: ["Mira", "Kai"] }), /Looks for Mira, Kai\./);
    });
});
