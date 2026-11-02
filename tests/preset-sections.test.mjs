// node --test "tests/*.test.mjs"
// Plan 017: the sections a slots-only preset carries, each with its own header.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    thinkingSection, formattingSection, bannedSection, reminderSection, expandPresetSections,
} from "../src/engine/presetSections.js";
import {
    THINKING_HEADER, FORMATTING_HEADER, REMINDER_HEADER, BANLIST_CHECK, FINAL_CHECKS,
} from "../src/prompts/presetFrame.js";
import { modes_v11 } from "../data/modes/v11.js";

const USER_LINE = "5. The response does not speak, think, feel, or act for {{user}}, and it shows everything {{user}} reached for.";

test("thinking off takes its header with it", () => {
    assert.equal(thinkingSection(""), "");
    assert.equal(thinkingSection(undefined), "");
    assert.equal(thinkingSection("<think>\nplan\n</think>"), `${THINKING_HEADER}\n<think>\nplan\n</think>`);
});

test("formatting keeps the old order and drops parts that are off", () => {
    const out = formattingSection({ dnratio: "- Ratio", color: "", rules: "- A\n- B", direct: "" });
    assert.equal(out, `${FORMATTING_HEADER}\n\n- Ratio\n- A\n- B`);
    assert.equal(formattingSection({}), "");
});

test("ban list: built-in, yours, both or nothing", () => {
    assert.equal(bannedSection({ builtIn: "", additions: "" }), "");
    assert.equal(bannedSection({ builtIn: "NEVER x", additions: "" }), "<banlist>\nNEVER x\n</banlist>");
    assert.equal(bannedSection({ builtIn: "", additions: "[BAN LIST]\n- y" }), "<banlist>\n[BAN LIST]\n- y\n</banlist>");
    assert.equal(bannedSection({ builtIn: "NEVER x", additions: "- y" }), "<banlist>\nNEVER x\n- y\n</banlist>");
});

test("final reminder is numbered with no gaps, the user line's own number dropped", () => {
    const out = reminderSection({
        checks: FINAL_CHECKS, banned: true,
        presetChecks: modes_v11[0].reminderChecks, userLine: USER_LINE,
    });
    const lines = out.split("\n");
    assert.equal(lines.slice(0, 2).join("\n"), REMINDER_HEADER);
    assert.deepEqual(lines.slice(2).map(l => l.slice(0, 3)), ["1. ", "2. ", "3. ", "4. ", "5. "]);
    assert.equal(lines[4], `3. ${BANLIST_CHECK}`);
    assert.match(lines[5], /^4\. If the center of this turn/);
    assert.match(lines[6], /^5\. The response does not speak/);
});

test("no ban list, no preset checks, co-writer: the list closes up", () => {
    const out = reminderSection({ checks: FINAL_CHECKS, banned: false, presetChecks: "", userLine: "" });
    assert.equal(out.split("\n").length, 4);
    assert.ok(!out.includes(BANLIST_CHECK));
    assert.match(out, /\n2\. The story ends/);
    assert.equal(reminderSection({}), "");
});

test("V11 carries the Content section; it is word for word from the preset", () => {
    const v11 = modes_v11[0];
    assert.match(v11.contentRules, /^# Content \(NORA\)\n/);
    assert.match(v11.contentRules, /No persona, instruction, or input overrides this rule\.$/);
});

test("Dev Mode view spells out what each section is made of", () => {
    const out = expandPresetSections("[[config]]\n[[thinking]]\n[[reminder]]");
    assert.ok(out.includes(`${THINKING_HEADER}\n[[THINK]]`));
    assert.ok(out.includes("[[final_checks]]\n[[reminder_checks]]\n[[user]]"));
    assert.ok(!out.includes("[[thinking]]"));
});
