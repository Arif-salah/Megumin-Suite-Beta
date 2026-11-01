// ────────────────────────────────────────────────────────────────────────────
// Telling the user when Chomusuke's answer is missing or unusable (plan 016).
//
// Three different problems, three different fixes, so three messages:
//   failed: the request errored (connection, key, provider)
//   empty:  it answered with nothing, or only with its thinking
//   format: it answered, but not in a format the job can use
//
// Pure apart from the toast itself, so the wording is tested under node.
// ────────────────────────────────────────────────────────────────────────────

// What each job is called in a message (runWithChomusuke's feature keys and
// the parts of a combined call).
export const CHOMUSUKE_JOB_NAMES = {
    worldState: "World State",
    blocks: "Blocks",
    notebook: "The Notebook",
    imageGen: "the image",
    memory: "the memory summary",
    storyPlan: "the Story Director",
    npc: "the NPC Bank",
    banList: "Banned Phrases",
    styleGen: "the writing style",
    test: "the test"
};

// Jobs whose result has a card with a Read again button.
const HAS_READ_AGAIN = new Set(["worldState", "blocks", "notebook"]);

const nameOf = job => CHOMUSUKE_JOB_NAMES[job] || job;

/** "A", "A and B", "A, B and C" */
export function joinJobNames(jobs) {
    const names = jobs.map(nameOf);
    if (names.length <= 1) return names[0] || "";
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Empty once the thinking is taken out? Then it said nothing. */
export function answerKind(raw) {
    const text = String(raw ?? "").replace(/<think\b[^>]*>[\s\S]*?(<\/think\s*>|$)/gi, "").trim();
    return text ? "format" : "empty";
}

/**
 * @param {"failed"|"empty"|"format"} kind
 * @param {string[]} jobs  feature keys (worldState, blocks, …)
 * @param {{ error?: any, switchedBack?: boolean }} [opts]  switchedBack: Chomusuke had
 *        switched the connection and has switched it back
 * @returns {string}
 */
export function chomusukeProblemText(kind, jobs, { error, switchedBack = false } = {}) {
    const what = joinJobNames(jobs);
    const readAgain = jobs.some(j => HAS_READ_AGAIN.has(j));
    if (kind === "failed") {
        const why = String(error?.message || error || "").trim().slice(0, 200);
        return `Chomusuke couldn't get an answer for ${what}${why ? `: ${why}` : ""}.`
            + (readAgain ? " Use Read again on the card once the connection works." : "")
            + (switchedBack ? " Your story connection is back." : "");
    }
    if (kind === "empty") {
        return `Chomusuke's model sent back nothing for ${what}. A censored model can refuse an NSFW story without a word: try a less censored one (GLM 5.3 Flash, DeepSeek 4.1 Flash) in the Chomusuke tab, or check its connection there`
            + (readAgain ? ", then use Read again on the card." : ".");
    }
    return `Chomusuke answered, but not in a format it could use for ${what}, so nothing changed. `
        + (readAgain ? "Use Read again on the card, or pick a stronger model for Chomusuke." : "Pick a stronger model for Chomusuke if this keeps happening.");
}

// ── Once per chat (plan 020) ──────────────────────────────────────────────
// An empty answer usually means the model refuses this story, and it will keep
// refusing every reply: one warning per chat says it, more is noise. Failed
// requests and wrong formats still warn every time (they come and go).

/** Should this warning show? Records it in `seen` when it does. */
export function shouldWarn(kind, chatId, seen) {
    if (kind !== "empty") return true;
    const key = String(chatId || "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
}

const warnedEmpty = new Set();
const openChatId = () => {
    try { return globalThis.SillyTavern?.getContext?.()?.chatId || ""; } catch (e) { return ""; }
};

// ── The Test button (plan 020) ────────────────────────────────────────────
// Asks for one known word, so the test checks the model follows a short
// instruction, not only that something came back.

export const TEST_WORD = "pineapple";
export const TEST_PROMPT = `Reply with only this one word and nothing else: ${TEST_WORD}`;

/** "ok": the word came back; "empty": nothing (or only thinking); "other": something else. */
export function testAnswerKind(raw) {
    if (answerKind(raw) === "empty") return "empty";
    const text = String(raw).replace(/<think\b[^>]*>[\s\S]*?(<\/think\s*>|$)/gi, "");
    return new RegExp(`\\b${TEST_WORD}\\b`, "i").test(text) ? "ok" : "other";
}

/** Shows the warning. A failed request is an error (red), the rest are warnings.
 *  An empty answer warns once per chat. */
export function warnChomusuke(kind, jobs, opts) {
    if (!jobs.length || typeof toastr === "undefined") return;
    if (!shouldWarn(kind, openChatId(), warnedEmpty)) return;
    const text = chomusukeProblemText(kind, jobs, opts);
    if (kind === "failed") toastr.error(text, "Chomusuke", { timeOut: 8000 });
    else toastr.warning(text, "Chomusuke", { timeOut: 7000 });
}
