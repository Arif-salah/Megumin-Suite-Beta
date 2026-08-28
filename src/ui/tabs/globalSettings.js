// ────────────────────────────────────────────────────────────────────────────
// Global Settings — extension preferences, community links and about.
// ────────────────────────────────────────────────────────────────────────────

import { extension_settings, saveSettingsDebounced } from "../../st.js";
import { extensionName } from "../../core/constants.js";
import { localProfile } from "../../core/state.js";
import { initProfile, saveProfileToMemory } from "../../core/profile.js";
import { flushProfileSettingsToLoadedKey, _saveProfileDebouncedInner } from "../../core/profile.js";
import { cancelDebounce } from "../../st.js";

// The version on the about card. One place, so it cannot fall out of step with
// itself the way "v9" did once V10 shipped.
const SUITE_VERSION = "V10";

// Where the "send Kazuma something" button points. Tally rather than Google Forms
// for one reason: Google makes anyone uploading a file sign in and records their
// address, which would quietly undo the word "anonymous" two lines down in the card.
//
// Blank it to remove the whole section -- it is skipped rather than drawn dead.
const SUBMIT_FORM_URL = "https://tally.so/r/D46yNq";

// The dot on the gear in the dock. Named rather than a bare boolean so a future
// notice is one string change here: bump the id and every install shows the dot
// again, without a migration and without a second flag to remember.
//
// Spent the moment the tab is drawn -- nobody should have to hunt for what the
// dot meant, and a dot that outlives its errand is just noise on the icon.
const SETTINGS_NOTICE_ID = "submit-card-v10";

export function hasUnseenSettingsNotice() {
    if (!SUBMIT_FORM_URL) return false;
    const gs = extension_settings[extensionName] && extension_settings[extensionName].globalSettings;
    return Boolean(gs) && gs.settingsNoticeSeen !== SETTINGS_NOTICE_ID;
}

export function renderGlobalSettings(c) {
    c.empty();
    const gs = extension_settings[extensionName].globalSettings;

    // Opening the tab is what spends the notice. Cleared off the dock here rather
    // than waiting for the next switchTab, which would leave the dot lit while the
    // reader is already looking at the thing it was pointing to.
    if (hasUnseenSettingsNotice()) {
        gs.settingsNoticeSeen = SETTINGS_NOTICE_ID;
        saveSettingsDebounced();
        $(".dock-icon.has-notice").removeClass("has-notice");
    }

    c.append(`
        <div class="mtab-header">
            <div class="mtab-header-left">
                <div class="mtab-header-icon" style="background: linear-gradient(135deg, #64748b, #475569);">
                    <i class="fa-solid fa-gear"></i>
                </div>
                <div>
                    <h2>Global Settings</h2>
                    <p>Preferences that apply to every character and every chat.</p>
                </div>
            </div>
            <div class="mtab-header-badge" style="background: rgba(168,85,247,0.12); color: #a855f7; border: 1px solid rgba(168,85,247,0.25);">
                <i class="fa-solid fa-earth-americas" style="font-size:0.6rem;"></i> Saved globally
            </div>
        </div>
    `);

    const $content = $(`<div style="display:flex; flex-direction:column; gap:10px;"></div>`);

    // ── BEHAVIOUR ───────────────────────────────────────────────────────────
    $content.append(`<div class="wstyle-section-head blue"><i class="fa-solid fa-sliders"></i> Behaviour</div>`);
    $content.append(`
        <div class="mtab-toggle-row ${gs.promptPreview ? 'active' : ''}" id="gs_toggle_prompt_preview" style="cursor: pointer;">
            <div class="toggle-info">
                <div class="toggle-label"><i class="fa-solid fa-magnifying-glass" style="color: var(--gold);"></i> Prompt Payload Preview</div>
                <div class="toggle-desc">Shows the finished prompt in a popup before it is sent, so you can read exactly what the AI receives. Cancelling the popup stops the generation.</div>
            </div>
            <div class="ps-switch" style="${gs.promptPreview ? 'background: var(--gold);' : ''}"></div>
        </div>
    `);
    $content.append(`
        <div class="mtab-toggle-row ${gs.enableUtilityPrefill ? 'active' : ''}" id="gs_toggle_utility_prefill" style="cursor: pointer;">
            <div class="toggle-info">
                <div class="toggle-label"><i class="fa-solid fa-wand-sparkles" style="color: #10b981;"></i> Utility Prefills</div>
                <div class="toggle-desc">Puts an opening &lt;think&gt; into the AI's mouth for background jobs — Image Gen, the Ban List, the Story Director, NPC scans. <b>Off by default:</b> Claude and several other APIs reject a prefill outright. Turn it on only if yours accepts one.</div>
            </div>
            <div class="ps-switch" style="${gs.enableUtilityPrefill ? 'background: #10b981;' : ''}"></div>
        </div>
    `);

    // ── DATA ────────────────────────────────────────────────────────────────
    $content.append(`<div class="wstyle-section-head gold" style="margin-top:8px;"><i class="fa-solid fa-floppy-disk"></i> Data</div>`);
    $content.append(`
        <div class="mtab-panel" style="margin: 0; padding: 12px 16px;">
            <div class="mtab-setting-row" style="padding: 0; border: none;">
                <div class="set-info">
                    <div class="set-label"><i class="fa-solid fa-floppy-disk" style="color: var(--gold);"></i> Profile Save Mode</div>
                    <div class="set-desc"><b>Per Character</b> shares your settings across every chat with that character. <b>Per Chat</b> keeps each chat and each branch on its own settings.</div>
                </div>
                <select id="gs_save_mode" class="ps-modern-input" style="width: 180px; cursor: pointer;">
                    <option value="character" ${gs.saveMode === 'character' ? 'selected' : ''}>Per Character (Default)</option>
                    <option value="chat" ${gs.saveMode === 'chat' ? 'selected' : ''}>Per Chat</option>
                </select>
            </div>
        </div>
    `);

    // ── SEND KAZUMA A CARD ──────────────────────────────────────────────────
    // Skipped entirely while the URL is blank. A button that goes nowhere is
    // worse than no button at all.
    if (SUBMIT_FORM_URL) {
        $content.append(`<div class="wstyle-section-head purple" style="margin-top:8px;"><i class="fa-solid fa-paper-plane"></i> Send me a card</div>`);
        $content.append(`
            <div class="mtab-panel gs-submit" style="margin: 0;">
                <div class="gs-submit-body">
                    <div class="gs-submit-icon"><i class="fa-solid fa-inbox"></i></div>
                    <div>
                        <div class="gs-submit-title">Got a card or a scenario worth playing?</div>
                        <div class="gs-submit-text">I have been running out of things to roleplay, so I am collecting recommendations. Attach a character card, describe a scenario, or just drop a link to something you enjoyed. <b>Completely anonymous</b> — no sign-in, no name, nothing tying it back to you. I cannot reply, so say everything you want to say in the form.</div>
                    </div>
                </div>
                <a class="gs-submit-btn" href="${SUBMIT_FORM_URL}" target="_blank" rel="noopener noreferrer">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Open the form
                </a>
                <div class="gs-submit-note">Opens tally.so in your browser, outside SillyTavern.</div>
            </div>
        `);
    }

    // ── ABOUT ───────────────────────────────────────────────────────────────
    $content.append(`<div class="wstyle-section-head green" style="margin-top:8px;"><i class="fa-solid fa-circle-info"></i> About</div>`);
    $content.append(`
        <div class="mtab-panel gs-about" style="margin: 0;">
            <div class="gs-about-title">Megumin Suite ${SUITE_VERSION}</div>
            <div class="gs-about-by">Made by KazumaONIISAN</div>

            <div class="gs-link-grid">
                <a class="gs-link" href="https://github.com/Arif-salah/Megumin-Suite" target="_blank" rel="noopener noreferrer">
                    <i class="fa-brands fa-github"></i>
                    <span><b>GitHub</b><small>Source, issues and releases</small></span>
                </a>
                <div class="gs-link gs-link-static">
                    <i class="fa-brands fa-paypal" style="color:#3b82f6;"></i>
                    <span><b>PayPal</b><small>arifsalah10@gmail.com</small></span>
                </div>
                <div class="gs-link gs-link-static">
                    <i class="fa-solid fa-coins" style="color:#a1a1aa;"></i>
                    <span><b>Litecoin</b><small>LSjf1DczHxs3GEbkoMmi1UWH2GikmXDtis</small></span>
                </div>
            </div>
        </div>
    `);

    // ── WIRING ──────────────────────────────────────────────────────────────
    //
    // One helper for both toggles. Each used to carry its own block re-applying
    // the same three styles by hand, which is how they came to use different
    // colours for the same state.
    const wireToggle = (id, key, colour) => {
        $content.find(id).on("click", function () {
            gs[key] = !gs[key];
            saveSettingsDebounced();
            $(this).toggleClass("active", gs[key]);
            $(this).css("border-color", gs[key] ? colour : "var(--border-color)");
            $(this).find(".ps-switch").css("background", gs[key] ? colour : "");
        });
    };
    wireToggle("#gs_toggle_prompt_preview", "promptPreview", "var(--gold)");
    wireToggle("#gs_toggle_utility_prefill", "enableUtilityPrefill", "#10b981");

    $content.find("#gs_save_mode").on("change", function () {
        // getCharacterKey() reads saveMode, so changing it moves where a save lands. Get any
        // pending edit written under the key it was made on before the switch, otherwise
        // initProfile() below replaces localProfile and that edit either dies or, worse,
        // gets saved under the new mode's key later.
        cancelDebounce(_saveProfileDebouncedInner);
        flushProfileSettingsToLoadedKey();
        gs.saveMode = $(this).val();
        saveSettingsDebounced();
        initProfile(); // Immediately reloads the correct profile
        toastr.success(`Save mode changed to Per ${gs.saveMode === 'chat' ? 'Chat' : 'Character'}.`);
    });

    c.append($content);
}
