// ────────────────────────────────────────────────────────────────────────────
// The Notebook tab (plan 010): the Author's Notebook switch, the per-chat
// pause, and where the story stands. The Past timeline and the blurred Active
// cards join it in phase 4.
// ────────────────────────────────────────────────────────────────────────────

import { getContext } from "../../st.js";
import { localProfile } from "../../core/state.js";
import { saveProfileToMemory } from "../../core/profile.js";
import { meguminScheduleBlocksRefresh } from "../blocks/chat.js";
import {
    notebookEnabled, notebookForcedByEngine, notebookPaused, setNotebookPaused, notebookCurrentPhase, notebookState
} from "../../state/index.js";
import { liveTruths, pastTruths, LIVE_CAP } from "../../state/modules/notebook/model.js";

export function renderNotebookTab(c) {
    c.empty();
    const forced = notebookForcedByEngine();
    const on = notebookEnabled();
    const hasChat = Boolean(getContext()?.chatId);
    const paused = hasChat && notebookPaused();
    const phase = hasChat ? notebookCurrentPhase() : "off";
    const state = hasChat ? notebookState() : null;
    const live = state ? liveTruths(state).length : 0;
    const past = state ? pastTruths(state).length : 0;

    const status = !on ? "The notebook is off."
        : !hasChat ? "Open a chat to see its notebook."
        : paused ? "Paused in this chat: nothing is sent and no new truths are written. The truths already written are kept."
        : phase === "setup" ? "The next reply writes the notebook: two or three hidden truths."
        : `${live} of ${LIVE_CAP} truths are live in this chat${past ? `, ${past} came out` : ""}.`;

    c.append(`
        <div class="mtab-header">
            <div class="mtab-header-left">
                <div class="mtab-header-icon" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9);"><i class="fa-solid fa-book"></i></div>
                <div>
                    <h2>The Notebook</h2>
                    <p>The truths the story is hiding, the clues it plants, and when they come out.</p>
                </div>
            </div>
            <div class="mtab-header-badge" style="background: ${on ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)"}; color: ${on ? "#10b981" : "var(--text-muted)"}; border: 1px solid ${on ? "rgba(16,185,129,0.25)" : "var(--border-color)"};">
                <i class="fa-solid fa-${on ? "circle-check" : "circle-xmark"}" style="font-size:0.6rem;"></i> ${on ? "Enabled" : "Disabled"}
            </div>
        </div>

        <div class="mtab-toggle-row ${on ? "active" : ""}" id="nb_enable_card" style="margin-bottom: 12px; ${forced ? "cursor: default; opacity: 0.85;" : ""}">
            <div class="toggle-info">
                <div class="toggle-label"><i class="fa-solid fa-book" style="color:#8b5cf6;"></i> Author's Notebook${forced ? " (your engine keeps one)" : ""}</div>
                <div class="toggle-desc">The story decides a few hidden truths, keeps them from turn to turn, plants clues, and reveals them when the story is ready. World State stops asking for a Secret while this is on.</div>
            </div>
            <div class="ps-switch"></div>
        </div>

        <div class="mtab-toggle-row ${paused ? "active" : ""}" id="nb_pause_card" style="margin-bottom: 16px; ${on && hasChat ? "" : "opacity: 0.5; cursor: default;"}">
            <div class="toggle-info">
                <div class="toggle-label"><i class="fa-solid fa-pause" style="color:#8b5cf6;"></i> Pause in this chat</div>
                <div class="toggle-desc">Stops the notebook in this chat only: no setup, nothing sent.</div>
            </div>
            <div class="ps-switch"></div>
        </div>

        <div class="mtab-callout" style="margin-bottom: 16px;">
            <i class="fa-solid fa-circle-info"></i>
            <span>${status}</span>
        </div>
    `);

    c.find("#nb_enable_card").on("click", () => {
        if (forced) return;
        localProfile.notebook = { ...(localProfile.notebook || {}), enabled: !on };
        saveProfileToMemory();
        meguminScheduleBlocksRefresh();
        renderNotebookTab(c);
    });
    c.find("#nb_pause_card").on("click", () => {
        if (!on || !hasChat) return;
        setNotebookPaused(!paused);
        renderNotebookTab(c);
    });
}
