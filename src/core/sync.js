// ─────────────────────────────────────────────────────────────────────────────
// Global tab sync — copying one tab's settings into every stored profile.
//
// Data and pure logic only. The three functions that read the tab currently on
// screen (the toggle button, its label, and the post-save propagator) are jQuery
// and toastr code, so they stay with the UI and call in here. That keeps the
// broadcast logic testable and stops this module from depending on the tab list.
// ─────────────────────────────────────────────────────────────────────────────

import { extension_settings, saveSettingsDebounced } from "../st.js";
import { extensionName } from "./constants.js";
import { localProfile, _loadedProfileKey } from "./state.js";
import { getCharacterKey } from "./keys.js";
import { meguminDiffPrompts } from "../prompts/storage.js";

// Which profile keys each tab owns. Keyed by tab TITLE, not by position: the
// numeric map broke silently the moment a tab was inserted — every tab after it
// synced the previous tab's keys, and nothing said so.
export const TAB_SYNC_KEYS = {
    "PRESETS & COT": ["mode", "model", "cotEnabled", "thinkEffort", "customThinkEffort", "thinkingV2", "storyConfig"],
    "Persona": ["personality", "toggles"],
    "Writing Style": ["activeStyleId", "aiRule", "customStyles", "dnRatio"],
    "Global Toggles & Add Ons": ["addons", "blocks", "userLanguage", "userPronouns", "onomatopoeia", "v9Limits"],
    "BLOCKS": ["blockStack", "statBlocks", "blocks"],
    "Story Director": ["storyPlan"],
    "Dynamic Ban List": ["banList", "banListBackend", "banListCustomPromptsEnabled", "banListCustomPrompts"],
    "Image Generation": ["imageGen"],
    "NPCs Bank": ["npcBank"],
    "Memory Core": ["memoryCore"]
};

// These two are stored globally already, so there is nothing per-character to keep
// in step and the toggle has no meaning on them.
export const TABS_ALREADY_GLOBAL = ["Side Panel", "Global Settings"];

export function meguminGlobalSyncMap() {
    if (!extension_settings[extensionName].globalSyncTabs) {
        extension_settings[extensionName].globalSyncTabs = {};
    }
    return extension_settings[extensionName].globalSyncTabs;
}

export function meguminIsTabSynced(title) {
    return Boolean(title && meguminGlobalSyncMap()[title]);
}

// Copies this tab's keys from the profile on screen into every stored profile.
// Returns false when it declined, so callers can stay quiet about it.
export function applyTabKeysToAllProfiles(title) {
    const keys = TAB_SYNC_KEYS[title];
    if (!keys) return false;

    // This writes localProfile into EVERY stored profile, so a stale localProfile
    // does not corrupt one save file, it corrupts all of them at once and there is
    // nothing to recover from. Runs in one tick, so one check at the top covers it.
    const liveKey = getCharacterKey() || "default";
    if (_loadedProfileKey && liveKey !== _loadedProfileKey) {
        console.debug(`[Megumin-Suite] Global tab sync declined: the settings on screen belong to "${_loadedProfileKey}" but the active chat is now "${liveKey}". Nothing was broadcast.`);
        return false;
    }

    const currentData = localProfile;
    Object.keys(extension_settings[extensionName].profiles).forEach(profKey => {
        const prof = extension_settings[extensionName].profiles[profKey];

        keys.forEach(k => {
            // --- SPECIAL HANDLING: settings travel, content stays put ---
            if (k === "storyPlan" && currentData[k]) {
                if (!prof[k]) prof[k] = {};
                const preservedPlan = prof[k].currentPlan;
                const preservedTracker = prof[k].lastTrackerState;
                const preservedIndex = prof[k].planMessageIndex;

                prof[k] = JSON.parse(JSON.stringify(currentData[k]));

                prof[k].currentPlan = preservedPlan || "";
                prof[k].lastTrackerState = preservedTracker || "";
                prof[k].planMessageIndex = preservedIndex !== undefined ? preservedIndex : null;

            } else if (k === "npcBank" && currentData[k]) {
                if (!prof[k]) prof[k] = {};
                const preservedNpcs = prof[k].npcs;
                prof[k] = JSON.parse(JSON.stringify(currentData[k]));
                prof[k].npcs = preservedNpcs || [];

            } else if (k === "memoryCore" && currentData[k]) {
                if (!prof[k]) prof[k] = {};
                const preservedShort = prof[k].shortTermChunks;
                const preservedLong = prof[k].longTermVault;
                prof[k] = JSON.parse(JSON.stringify(currentData[k]));
                prof[k].shortTermChunks = preservedShort || [];
                prof[k].longTermVault = preservedLong || [];

            } else if (currentData[k] !== undefined) {
                prof[k] = JSON.parse(JSON.stringify(currentData[k]));
            }
        });
    });

    saveSettingsDebounced();
    return true;
}
// Helper to push advanced prompt edits to ALL profiles (Global Save)
export function syncPromptsGlobally(moduleName, dataKey, dataValue) {
    // Every call site hands this a value read straight out of localProfile, and it lands in
    // every stored profile. If localProfile is behind the active chat, one guard here stops
    // all ~15 of those sites from broadcasting the wrong chat's prompt text. Each call is a
    // single synchronous UI edit, so checking once on entry covers the whole broadcast.
    const liveKey = getCharacterKey() || "default";
    if (_loadedProfileKey && liveKey !== _loadedProfileKey) {
        console.debug(`[Megumin-Suite] Global prompt sync of ${moduleName}.${dataKey} declined: the value came from "${_loadedProfileKey}" but the active chat is now "${liveKey}". No profiles were changed.`);
        return;
    }
    // This is the write path that made settings.json grow: one edited prompt block fans
    // out across every stored profile, so a full copy costs (profile count x block size).
    // Reduce it to its diff against DEFAULT_PROMPTS once here rather than per profile —
    // the value is identical for all of them, and initProfile fills the rest back in.
    let valueToStore = dataValue;
    if (dataKey === 'customPrompts' || dataKey === 'banListCustomPrompts') {
        valueToStore = meguminDiffPrompts(dataValue, moduleName);
    }
    Object.values(extension_settings[extensionName].profiles).forEach(prof => {
        const clonedValue = valueToStore !== null && typeof valueToStore === 'object' ? JSON.parse(JSON.stringify(valueToStore)) : valueToStore;
        if (moduleName === 'banList') {
            prof[dataKey] = clonedValue;
        } else {
            // A profile saved before this module existed has no container. Writing one
            // bare key would create a half-built module whose other settings load as
            // undefined. Skip it: its next load fills full defaults, and every sync
            // after that reaches it normally.
            if (!prof[moduleName]) return;
            prof[moduleName][dataKey] = clonedValue;
        }
    });
    saveSettingsDebounced();
}
