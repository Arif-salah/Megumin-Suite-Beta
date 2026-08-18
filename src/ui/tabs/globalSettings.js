// ────────────────────────────────────────────────────────────────────────────
// Global Settings — extension preferences and about.
// ────────────────────────────────────────────────────────────────────────────

import { extension_settings, saveSettingsDebounced } from "../../st.js";
import { extensionName } from "../../core/constants.js";
import { localProfile } from "../../core/state.js";
import { initProfile, saveProfileToMemory } from "../../core/profile.js";
import { flushProfileSettingsToLoadedKey, _saveProfileDebouncedInner } from "../../core/profile.js";
import { cancelDebounce } from "../../st.js";

export function renderGlobalSettings(c) {
    c.empty();
    const gs = extension_settings[extensionName].globalSettings;
    
    c.append(`
        <div class="mtab-header">
            <div class="mtab-header-left">
                <div class="mtab-header-icon" style="background: linear-gradient(135deg, #64748b, #475569);">
                    <i class="fa-solid fa-gear"></i>
                </div>
                <div>
                    <h2>Global Settings</h2>
                    <p>Extension preferences and about info.</p>
                </div>
            </div>
        </div>
    `);

    const $content = $(`
        <div style="display:flex; flex-direction:column; gap:16px;">
            
            <div class="mtab-toggle-row ${gs.promptPreview ? 'active' : ''}" id="gs_toggle_prompt_preview" style="cursor: pointer;">
                <div class="toggle-info">
                    <div class="toggle-label"><i class="fa-solid fa-magnifying-glass" style="color: var(--gold);"></i> Prompt Payload Preview</div>
                    <div class="toggle-desc">Show a popup of the final constructed prompt right before it is sent to the AI.</div>
                </div>
                <div class="ps-switch" style="${gs.promptPreview ? 'background: var(--gold);' : ''}"></div>
            </div>
            
            <div class="mtab-toggle-row ${gs.disableUtilityPrefill ? 'active' : ''}" id="gs_toggle_utility_prefill" style="cursor: pointer;">
                <div class="toggle-info">
                    <div class="toggle-label"><i class="fa-solid fa-ban" style="color: #ef4444;"></i> Disable Utility Prefills</div>
                    <div class="toggle-desc">Turn this ON if your API (like Claude) errors out during Image Gen, Banlist, or Story Director generation.</div>
                </div>
                <div class="ps-switch" style="${gs.disableUtilityPrefill ? 'background: #ef4444;' : ''}"></div>
            </div>

            <div class="mtab-panel" style="margin: 0; padding: 12px 16px;">
                <div class="mtab-setting-row" style="padding: 0; border: none;">
                    <div class="set-info">
                        <div class="set-label"><i class="fa-solid fa-floppy-disk" style="color: var(--gold);"></i> Profile Save Mode</div>
                        <div class="set-desc">"Per Character" syncs settings across all chats with the same character. "Per Chat" isolates settings to individual chats/branches.</div>
                    </div>
                    <select id="gs_save_mode" class="ps-modern-input" style="width: 180px; cursor: pointer;">
                        <option value="character" ${gs.saveMode === 'character' ? 'selected' : ''}>Per Character (Default)</option>
                        <option value="chat" ${gs.saveMode === 'chat' ? 'selected' : ''}>Per Chat</option>
                    </select>
                </div>
            </div>
            
            <div class="mtab-panel" style="margin-top: 15px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: 900; color: var(--gold); margin-bottom: 4px; text-shadow: 0 2px 10px rgba(245,158,11,0.3);">Megumin Suite v9</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Made by KazumaONIISAN</div>
                
                <!-- Support & Social Links -->
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 15px; align-items: center;">
                    <a href="https://github.com/Arif-salah/Megumin-Suite" target="_blank" style="color: var(--text-main); text-decoration: none; font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 8px; transition: background 0.2s ease; cursor: pointer;">
                        <i class="fa-brands fa-github"></i> GitHub Repository
                    </a>
                    <div style="color: var(--text-main); font-size: 0.8rem; background: rgba(59, 130, 246, 0.1); padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3); display: flex; align-items: center; gap: 8px;">
                        <i class="fa-brands fa-paypal" style="color: #3b82f6;"></i> arifsalah10@gmail.com
                    </div>
                    <div style="color: var(--text-main); font-size: 0.75rem; background: rgba(161, 161, 170, 0.1); padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(161, 161, 170, 0.3); display: flex; align-items: center; gap: 8px; word-break: break-all; max-width: 90%; text-align: left;">
                        <i class="fa-solid fa-coins" style="color: #a1a1aa; flex-shrink: 0;"></i> LTC: LSjf1DczHxs3GEbkoMmi1UWH2GikmXDtis
                    </div>
                </div>

                <div style="font-size: 0.7rem; color: #a855f7; margin-top: 15px; background: rgba(168,85,247,0.1); display: inline-block; padding: 4px 12px; border-radius: 12px; border: 1px solid rgba(168,85,247,0.3);">
                    <i class="fa-solid fa-earth-americas"></i> These settings are saved globally
                </div>
            </div>
        </div>
    `);

    $content.find("#gs_toggle_prompt_preview").on("click", function () {
        gs.promptPreview = !gs.promptPreview;
        saveSettingsDebounced();
        $(this).toggleClass("active", gs.promptPreview);
        if (gs.promptPreview) {
            $(this).css("border-color", "var(--gold)");
            $(this).find(".ps-switch").css("background", "var(--gold)");
        } else {
            $(this).css("border-color", "var(--border-color)");
            $(this).find(".ps-switch").css("background", "");
        }
    });

    $content.find("#gs_toggle_utility_prefill").on("click", function () {
        gs.disableUtilityPrefill = !gs.disableUtilityPrefill;
        saveSettingsDebounced();
        $(this).toggleClass("active", gs.disableUtilityPrefill);
        if (gs.disableUtilityPrefill) {
            $(this).css("border-color", "#ef4444");
            $(this).find(".ps-switch").css("background", "#ef4444");
        } else {
            $(this).css("border-color", "var(--border-color)");
            $(this).find(".ps-switch").css("background", "");
        }
    });

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
