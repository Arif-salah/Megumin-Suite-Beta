// ────────────────────────────────────────────────────────────────────────────
// The notebook read by Chomusuke (plan 010, phase 5).
//
// With the Chomusuke tab's Notebook route on, the story model only writes new
// truths, and after each reply Chomusuke reads it for clues, who learned what,
// and what came out. Its lines are filed with the reply's own, under the
// reply's swipe. Queued one read at a time; a read whose reply changed or
// disappeared meanwhile is dropped. A combined call does it instead when
// Combine calls is on.
// ────────────────────────────────────────────────────────────────────────────

import { generateQuietPrompt, substituteParams } from "../../st.js";
import { runWithChomusuke } from "../../engine/tasks.js";
import { warnChomusuke, answerKind } from "../../engine/chomusukeNotice.js";
import { setActiveWorldExtractRequest } from "../../core/activeRequests.js";
import {
    notebookViaChomusuke, notebookBeginRead, notebookReadNotes, notebookFinishRead, notebookRecordMissing, notebookAbandonRead
} from "../../state/index.js";
import { renderNotebookWorkerPrompt } from "../../state/modules/notebook/worker.js";
import { exchangeText, earlierText } from "../blocks/worker.js";
import { meguminScheduleBlocksRefresh } from "../blocks/chat.js";

const sub = t => { try { return substituteParams(t); } catch (e) { return t; } };

let queue = Promise.resolve();

/**
 * Chomusuke reads one reply for the notebook.
 * @param {number} index
 * @param {{ force?: boolean }} [opts]  force: read again even if already read
 * @returns {Promise<boolean>}
 */
export function notebookReadForReply(index, { force = false } = {}) {
    if (!notebookViaChomusuke()) return Promise.resolve(false);
    const token = notebookBeginRead(index, { force });
    if (!token) return Promise.resolve(false);
    meguminScheduleBlocksRefresh();

    const run = async () => {
        let raw = "";
        try {
            raw = await runWithChomusuke("notebook", async () => {
                // Built when this job has the worker, so it sees whatever landed before it.
                const built = renderNotebookWorkerPrompt({
                    notes: notebookReadNotes(token),
                    earlier: earlierText(token.index),
                    exchange: exchangeText(token.index, token.text)
                });
                setActiveWorldExtractRequest({ system: sub(built.system), user: sub(built.user), job: "notebook" });
                try {
                    return await generateQuietPrompt({ prompt: "___PS_WORLD_EXTRACT___", quietPrompt: "___PS_WORLD_EXTRACT___" });
                } finally {
                    setActiveWorldExtractRequest(null);
                }
            });
        } catch (e) {
            console.error("[Megumin-Suite] Notebook read failed", e);
            warnChomusuke("failed", ["notebook"], { error: e });
            notebookAbandonRead(token);
            meguminScheduleBlocksRefresh();
            return false;
        }
        const res = notebookFinishRead(token, raw);
        if (!res.ok && !res.dropped) {
            notebookRecordMissing(token);
            // null: the worker failed and has said so already.
            if (raw !== null) warnChomusuke(answerKind(raw), ["notebook"]);
        }
        meguminScheduleBlocksRefresh();
        return res.ok;
    };
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
}
