// ─────────────────────────────────────────────────────────────────────────────
// One-time repairs to stored settings.
//
// Everything here is subtractive and idempotent: it fixes data written by older
// builds and does nothing on a profile that is already current. Nothing in here
// is part of normal operation, which is exactly why it does not belong inline.
//
// Two further migrations (the memory vault rebuild and the legacy block-id sync)
// are still in index.js — they depend on the memory and blocks features, which
// are not modules yet. They land here once those move.
// ─────────────────────────────────────────────────────────────────────────────

import { extension_settings, saveSettingsDebounced } from "../st.js";
import { extensionName } from "./constants.js";

export function cleanLegacySettings() {
    if (!extension_settings[extensionName] || !extension_settings[extensionName].profiles) return;
    let didClean = false;
    Object.keys(extension_settings[extensionName].profiles).forEach(key => {
        if (key === 'default') return; // Do not touch global defaults
        const prof = extension_settings[extensionName].profiles[key];
        if (prof.memoryCore && (prof.memoryCore.shortTermChunks?.length > 0 || prof.memoryCore.longTermVault?.length > 0)) {
            delete prof.memoryCore.shortTermChunks;
            delete prof.memoryCore.longTermVault;
            didClean = true;
        }
        if (prof.storyPlan && (prof.storyPlan.currentPlan || prof.storyPlan.lastTrackerState)) {
            prof.storyPlan.currentPlan = "";
            prof.storyPlan.lastTrackerState = "";
            didClean = true;
        }
    });
    if (didClean) saveSettingsDebounced();
}
