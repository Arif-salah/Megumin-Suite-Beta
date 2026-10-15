// ────────────────────────────────────────────────────────────────────────────
// Author's Notebook read by Chomusuke (plan 010, phase 5). Pure.
//
// With the route on, the story model only writes new truths (Truth+); after
// the reply Chomusuke reads it against the notebook as it stood before, and
// writes what the reply did to the live truths: Clue, Learned, Truth-.
//
// The reply's own notebook lines and Chomusuke's are kept as ONE entry under
// the reply, so Revert, swipes and edits treat them together. The entry's text
// is the reply followed by Chomusuke's lines (rebuilt from what was understood,
// so a truth Chomusuke tried to write never gets in), which also keeps the
// story text the clue check reads.
//
// Framing rule: in-story wording only. The reader keeps the author's notebook.
// ────────────────────────────────────────────────────────────────────────────

import { parseNotebook, storyProse } from "./parse.js";

export const NOTEBOOK_WORKER_SYSTEM =
    "You keep the author's notebook of an ongoing story: the truths it is hiding, the clues it plants, and who finds what out. " +
    "You never continue the story and never explain. You note only what the exchange shows on the page.";

/**
 * The task, for the separate read and for the combined call.
 * @returns {{ rules: string, template: string, tag: string }}
 */
export function renderNotebookClerkTask() {
    const rules = [
        "<Notebook_Update_Rules>",
        "<Author_Notebook> holds the truths the story is hiding, as they stood before the latest exchange. Read the latest exchange and write a <Notebook_Update> block with what it did to them. Most exchanges do nothing to them; then the block holds the single line No changes.",
        "",
        "Clue T1: <the clue the latest exchange showed>",
        "Learned T1: <who on its Hidden from list found it out in the latest exchange>",
        "Truth-: T1      it came out in the latest exchange, to everyone it was hidden from",
        "",
        "A clue counts only when the exchange shows it on the page. Use the truths' own ids. A truth never changes once written: you don't write new truths or rewrite them.",
        "</Notebook_Update_Rules>"
    ].join("\n");
    return { rules, template: "<Notebook_Update>\n[change lines, or No changes]\n</Notebook_Update>", tag: "Notebook_Update" };
}

/**
 * The separate read.
 * @param {{ notes: string, earlier?: string, exchange: string }} a  notes: <Author_Notebook> before the reply
 * @returns {{ system: string, user: string }}
 */
export function renderNotebookWorkerPrompt(a) {
    const task = renderNotebookClerkTask();
    const user = [
        String(a.notes || "").trim(),
        String(a.earlier || "").trim() ? `<Earlier_Story>\n${String(a.earlier).trim()}\n</Earlier_Story>` : "",
        `<Latest_Exchange>\n${String(a.exchange || "").trim()}\n</Latest_Exchange>`,
        `# Task\n${task.rules}`,
        `# Answer with this block and nothing else\n${task.template}`
    ].filter(s => String(s || "").trim()).join("\n\n");
    return { system: NOTEBOOK_WORKER_SYSTEM, user };
}

const READ_OPS = new Set(["clue", "learned", "out"]);

/** Did the reply write clue, learned or came-out lines itself? Then there is nothing to read. */
export function replyWroteNotebookChanges(replyText) {
    const parsed = parseNotebook(replyText);
    return Boolean(parsed && parsed.ops.some(o => READ_OPS.has(o.op)));
}

/**
 * Chomusuke's answer as the block to keep: only Clue, Learned and Truth- lines,
 * as understood. Null when the answer has no <Notebook_Update> block at all.
 * @returns {null | { block: string, count: number }}
 */
export function notebookAnswerBlock(raw) {
    const text = String(raw || "")
        .replace(/<think\b[^>]*>[\s\S]*?(<\/think\s*>|$)/gi, "")
        .replace(/```[a-z]*\n?|```/gi, "");
    if (!/<Notebook_Update\b/i.test(text)) return null;
    const m = text.match(/<Notebook_Update\b[^>]*>[\s\S]*?(?:<\/Notebook_Update\s*>|$)/i);
    const parsed = parseNotebook(m ? m[0] : "", { prose: "" });
    const lines = (parsed ? parsed.ops : []).filter(o => READ_OPS.has(o.op)).map(o =>
        o.op === "clue" ? `Clue ${o.id}: ${o.text}`
            : o.op === "learned" ? `Learned ${o.id}: ${o.names.join(", ")}`
                : `Truth-: ${o.id}`);
    return { block: `<Notebook_Update>\n${lines.join("\n") || "No changes"}\n</Notebook_Update>`, count: lines.length };
}

const MARK = "<!--notebook-read-->";

/** The entry's text: the reply, then Chomusuke's block. */
export function joinNotebookRead(replyText, block) {
    return `${String(replyText || "")}\n\n${MARK}\n${block}`;
}

/** Chomusuke's block back out of an entry's text, or "" when it has none. */
export function notebookReadPart(raw) {
    const s = String(raw || "");
    const i = s.lastIndexOf(MARK);
    return i < 0 ? "" : s.slice(i + MARK.length).trim();
}

/** The parsed entry for a reply plus Chomusuke's block (clues checked against the reply's story). */
export function parseNotebookRead(replyText, block) {
    return parseNotebook(joinNotebookRead(replyText, block), { prose: storyProse(replyText) });
}
