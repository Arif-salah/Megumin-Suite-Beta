// ────────────────────────────────────────────────────────────────────────────
// Author's Notebook rendering (plan 010): the setup prompt, the notebook the
// model reads every turn, the update rules, and the text the card and tab show.
//
// The prompt wording comes from the prompt design (AUTHOR_NOTEBOOK.md); keep it
// as written. FRAMING RULE: it is the author's notebook, never a tool or a
// record anyone else keeps.
//
// Pure: no imports from SillyTavern. {{user}} is left for the caller.
// ────────────────────────────────────────────────────────────────────────────

import { LIVE_CAP, liveTruths } from "./model.js";

/** "setup" (no live truth: write the notebook), "running", or "off" (off or paused). */
export function notebookPhase(state, { on = true, paused = false } = {}) {
    if (!on || paused) return "off";
    return liveTruths(state).length ? "running" : "setup";
}

export function renderNotebookSetup() {
    return [
        "<Notebook_Setup>",
        "This story keeps an author's notebook, and it is empty, so you write it this turn.",
        "",
        "Write your reply as usual. After the story, write a <Notebook> block with two or three truths, built from the character sheet, the setting, and the story so far. Write each one in this form:",
        "",
        "T1",
        "Truth: what is actually true, in a few plain sentences, with enough detail that every later clue and the reveal itself can be written from it.",
        "Hidden from: who doesn't know it. Name the characters, and add \"the reader\" if the story hasn't shown it on the page.",
        "Comes out when: what has to happen in the story for it to come out.",
        "What it changes: who acts differently once it's out, and how.",
        "Clue ideas: two or three small things the story could show that point at it and could also mean something else.",
        "",
        "The <Notebook> block doesn't count toward the reply's length.",
        "</Notebook_Setup>"
    ].join("\n");
}

function truthLines(t) {
    const lines = [
        t.id,
        `Truth: ${t.truth}`,
        `Hidden from: ${t.hiddenFrom.join(", ")}`
    ];
    if (t.when) lines.push(`Comes out when: ${t.when}`);
    if (t.changes) lines.push(`What it changes: ${t.changes}`);
    if (t.clueIdeas) lines.push(`Clue ideas: ${t.clueIdeas}`);
    if (t.clues.length) {
        lines.push("Clues planted:");
        for (const c of t.clues) lines.push(`- turn ${c.seq}: ${c.text}`);
    }
    return lines;
}

/** <Author_Notebook> for <Current_Info>: the live truths only. "" when none. */
export function renderNotebookForPrompt(state) {
    const live = liveTruths(state);
    if (!live.length) return "";
    const out = ["<Author_Notebook>"];
    live.forEach((t, i) => { if (i) out.push(""); out.push(...truthLines(t)); });
    out.push("", `Live truths: ${live.length} of ${LIVE_CAP}. Next id: T${state.next || 1}.`, "</Author_Notebook>");
    return out.join("\n");
}

/**
 * The update rules. With newOnly (Chomusuke writes the clues), the story model
 * is asked only for new truths.
 */
export function renderNotebookUpdateRules({ newOnly = false } = {}) {
    const lines = newOnly
        ? ["Truth+: T3      a new truth, only while fewer than 3 are live, followed by its lines in the notebook's form"]
        : [
            "Clue T1: <the clue this turn's story showed>",
            "Learned T1: <who on its Hidden from list found it out this turn>",
            "Truth-: T1      it came out this turn, to everyone it was hidden from",
            "Truth+: T3      a new truth, only while fewer than 3 are live, followed by its lines in the notebook's form"
        ];
    return [
        "<Notebook_Update_Rules>",
        "After the story, write a <Notebook_Update> block if the notebook changed this turn. Most turns it doesn't, and then you leave the block out. The block doesn't count toward the reply's length.",
        "",
        ...lines,
        "",
        "A truth never changes once written. It gains clues and comes out.",
        "",
        "<Notebook_Update>",
        "[change lines]",
        "</Notebook_Update>",
        "</Notebook_Update_Rules>"
    ].join("\n");
}

// ── Card and tab text ────────────────────────────────────────────────────

/** One applied change as a line for the card. */
export function describeNotebookChange(ch) {
    switch (ch && ch.op) {
        case "entry": return `${ch.id} written: ${ch.text}`;
        case "clue": return `${ch.id} clue: ${ch.text}${ch.found === false ? " (not found in the reply)" : ""}`;
        case "learned": return `${ch.id} learned by ${ch.text}`;
        case "out": return `${ch.id} came out: ${ch.text}`;
        case "edit": return `${ch.id} edited`;
        case "forget": return `${ch.id} deleted`;
        case "restore": return `${ch.id} hidden again`;
        default: return "";
    }
}

/** One truth as markdown, for the tab and the card (behind the spoiler warning). */
export function renderTruthCard(t) {
    const out = [`**${t.id}** ${t.truth}`];
    if (t.hiddenFrom.length) out.push(`*Hidden from:* ${t.hiddenFrom.join(", ")}`);
    if (t.when) out.push(`*Comes out when:* ${t.when}`);
    if (t.changes) out.push(`*What it changes:* ${t.changes}`);
    if (t.clueIdeas) out.push(`*Clue ideas:* ${t.clueIdeas}`);
    for (const c of t.clues) out.push(`* turn ${c.seq}: ${c.text}${c.found === false ? " *(not found in the reply)*" : ""}`);
    if (t.revealedHow) out.push(`*Came out:* turn ${t.revealedSeq}`);
    return out.join("\n");
}
