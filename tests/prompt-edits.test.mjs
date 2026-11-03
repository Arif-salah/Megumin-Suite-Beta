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
