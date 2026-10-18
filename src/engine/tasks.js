// ──────────────────────────────────────────────────────────────────────────────
// Running a one-off generation through SillyTavern.
//
// The pattern throughout: park a payload in activeRequests, fire a quiet prompt
// that the injection handler recognises, clear the payload in a finally.
// useMeguminEngine additionally swaps the OpenAI preset for the duration and puts
// it back, so a background task can use a different preset than the roleplay.
// ──────────────────────────────────────────────────────────────────────────────

import { generateQuietPrompt, eventSource, event_types, extension_settings, isGenerating, getContext, online_status, waitUntilCondition } from "../st.js";
import { extensionName, TARGET_PRESET_NAME } from "../core/constants.js";
import { localProfile } from "../core/state.js";
import { setActiveBanListChat, setActiveGenerationOrder } from "../core/activeRequests.js";
import { warnChomusuke } from "./chomusukeNotice.js";

/**
 * Returns available SillyTavern Connection Profiles.
 * @returns {Array<{id: string, name: string, mode?: string}>}
 */
export function getSillyTavernConnectionProfiles() {
    try {
        const profiles = extension_settings?.connectionManager?.profiles;
        if (Array.isArray(profiles)) {
            return profiles.map(p => ({ id: p.id, name: p.name, mode: p.mode }));
        }
    } catch (err) {
        console.warn(`[${extensionName}] Unable to read connectionManager profiles:`, err);
    }
    return [];
}

/**
 * Returns the currently active connection profile ID in SillyTavern.
 * @returns {string}
 */
export function getCurrentConnectionProfileId() {
    try {
        return extension_settings?.connectionManager?.selectedProfile || "";
    } catch {
        return "";
    }
}

/**
 * Safely switches SillyTavern's active connection profile by ID.
 * Awaits both CONNECTION_PROFILE_LOADED and backend online_status readiness.
 * 
 * @param {string} profileId
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<boolean>}
 */
export async function applyConnectionProfileById(profileId, timeoutMs = 10000) {
    const select = document.getElementById("connection_profiles");
    if (!select) {
        console.warn(`[${extensionName}] #connection_profiles element not found in DOM.`);
        return false;
    }

    // Check if the requested profile ID exists in options (or is empty for None)
    const options = Array.from(select.options);
    const targetIndex = profileId ? options.findIndex(o => o.value === profileId) : 0;
    if (targetIndex === -1 && profileId) {
        console.warn(`[${extensionName}] Connection profile ID "${profileId}" not found in options.`);
        return false;
    }

    // If it's already the selected profile, no need to switch unless disconnected
    if (select.selectedIndex === targetIndex && targetIndex >= 0) {
        const currentStatus = getContext()?.onlineStatus || online_status;
        if (!profileId || (currentStatus && currentStatus !== "no_connection")) {
            return true;
        }
    }

    // 1. Await CONNECTION_PROFILE_LOADED
    const awaitLoaded = new Promise((resolve) => {
        let settled = false;
        let timer = null;

        const onLoaded = () => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            resolve(true);
        };

        if (eventSource && event_types?.CONNECTION_PROFILE_LOADED) {
            eventSource.once(event_types.CONNECTION_PROFILE_LOADED, onLoaded);
        }

        timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            console.warn(`[${extensionName}] Timed out waiting for CONNECTION_PROFILE_LOADED for "${profileId}".`);
            resolve(false);
        }, timeoutMs);
    });

    select.selectedIndex = targetIndex;
    select.dispatchEvent(new Event("change"));

    await awaitLoaded;

    // 2. Await backend online_status readiness (mirrors SillyTavern's own /profile command)
    if (profileId) {
        try {
            await waitUntilCondition(() => {
                const status = getContext()?.onlineStatus || online_status;
                return status && status !== "no_connection";
            }, timeoutMs, 100, { rejectOnTimeout: false });
        } catch (err) {
            console.warn(`[${extensionName}] Error waiting for online_status:`, err);
        }
    }

    // 3. Settle buffer for UI state, samplers, and secrets rotation
    await new Promise(r => setTimeout(r, 400));

    // 4. Verify backend connection succeeded
    if (profileId) {
        const finalStatus = getContext()?.onlineStatus || online_status;
        if (!finalStatus || finalStatus === "no_connection") {
            console.error(`[${extensionName}] Connection profile "${profileId}" failed to achieve connection. Status: ${finalStatus}`);
            return false;
        }
    }

    return true;
}

/**
 * Executes a task using Chomusuke (the worker connection profile) if enabled and configured.
 * Otherwise executes the task directly using the currently active model.
 * 
 * Guarantees primary connection profile restoration on completion or error.
 * 
 * @param {"memory"|"storyPlan"|"npc"|"banList"|"imageGen"|"styleGen"|"worldState"|"test"} featureKey
 * @param {() => Promise<any>} task
 * @param {{ force?: boolean, jobs?: string[] }} [options]  jobs: what a failure
 *        message names (a combined call covers several); default [featureKey].
 *        A failure on the worker is shown here and comes back as null, so a
 *        caller that gets null has nothing more to tell the user.
 * @returns {Promise<any>}
 */
// ── Worker session ───────────────────────────────────────────────────────
// From the moment the worker profile is switched IN until the main profile is
// switched back, SillyTavern's active connection is the worker. SillyTavern
// swaps Send for Stop while the worker is generating, but not while the profile
// is switching either way, so a message sent in those gaps would go to the
// worker. The session promise lets the send guard (index.js) wait it out.
let workerSession = null;

/** Resolves when the current Chomusuke run has switched back; null when none is running. */
export function chomusukeSessionPromise() {
    return workerSession;
}

export async function runWithChomusuke(featureKey, task, { force = false, jobs = null } = {}) {
    const chomusuke = localProfile?.chomusuke;
    const isEnabled = Boolean(chomusuke?.enabled) || force;
    const workerProfileId = chomusuke?.profileId;
    const isFeatureEnabled = featureKey === "test" || chomusuke?.features?.[featureKey] !== false;

    // If Chomusuke is not enabled, missing a profile, or toggled off for this feature -> run directly
    if (!isEnabled || !workerProfileId || !isFeatureEnabled) {
        return await task();
    }

    // One worker run at a time. Several features now run after every reply
    // (World State read, the auto image prompt); two runs switching the
    // connection profile over each other would restore the main profile while
    // the other is still working. Queued in arrival order, so an image prompt
    // started after a World State read sees the outfits that read produced.
    //
    // Never call runWithChomusuke from INSIDE a task it is running: the inner
    // call queues behind the outer one and both wait forever. Do that work
    // before starting the outer job. The watchdog below names a stuck queue.
    const waitingSince = Date.now();
    const ahead = runningWorkerJob;
    const watchdog = setTimeout(() => {
        console.warn(`[${extensionName}] Chomusuke "${featureKey}" has waited ${Math.round((Date.now() - waitingSince) / 1000)}s behind "${ahead || "?"}". If this never ends, a Chomusuke call is being made from inside another Chomusuke job.`);
    }, 90000);
    const turn = workerQueue.then(async () => {
        clearTimeout(watchdog);
        runningWorkerJob = featureKey;
        try { return await runOnWorker(featureKey, task, chomusuke, workerProfileId, jobs || [featureKey]); }
        finally { runningWorkerJob = null; }
    });
    workerQueue = turn.catch(() => {});
    return turn;
}

let runningWorkerJob = null;

/** The Chomusuke job running right now ("worldState", "imageGen"…), or null. */
export function chomusukeJobRunning() {
    return runningWorkerJob;
}

let workerQueue = Promise.resolve();

async function runOnWorker(featureKey, task, chomusuke, workerProfileId, jobs) {
    // Traffic guard: wait if SillyTavern is currently generating in the main chat
    let waitLoops = 0;
    while (typeof isGenerating === "function" && isGenerating() && waitLoops < 60) {
        await new Promise(r => setTimeout(r, 500));
        waitLoops++;
    }

    const currentProfileId = getCurrentConnectionProfileId();
    const originalProfileId = chomusuke.primaryProfileId || currentProfileId;
    const needsSwitch = workerProfileId !== currentProfileId;

    if (!needsSwitch) {
        // Worker profile is already active in SillyTavern
        return await task();
    }

    let switchedToWorker = false;
    let endSession;
    const session = new Promise(resolve => { endSession = resolve; });
    workerSession = session;

    try {
        switchedToWorker = await applyConnectionProfileById(workerProfileId, 10000);
        if (!switchedToWorker) {
            throw new Error("Worker profile failed to establish connection (timed out or offline).");
        }

        const result = await task();
        if (result === undefined || result === null) {
            throw new Error("Worker model returned no output.");
        }

        return result;
    } catch (e) {
        console.error(`[${extensionName}] Chomusuke worker execution failed for "${featureKey}":`, e);
        warnChomusuke("failed", jobs, { error: e, switchedBack: true });
        return null;
    } finally {
        if (switchedToWorker) {
            try {
                await applyConnectionProfileById(originalProfileId, 10000);
            } catch (restoreErr) {
                console.error(`[${extensionName}] Failed to restore primary connection profile "${originalProfileId}":`, restoreErr);
            }
        }
        if (workerSession === session) workerSession = null;
        endSession();
    }
}

export async function analyzeSlopDirectly(chatText) {
    setActiveBanListChat(chatText);
    try {
        let rawOutput = await generateQuietPrompt({ prompt: "___PS_BANLIST___", quietPrompt: "___PS_BANLIST___" });
        return rawOutput.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    } catch (e) {
        console.error(`[${extensionName}] Ban List Analysis Failed:`, e);
        return null;
    } finally {
        setActiveBanListChat(null);
    }
}


export async function analyzeSlopWithPreset(chatText) {
    return await runWithChomusuke("banList", () => analyzeSlopDirectly(chatText));
}

export async function useMeguminEngine(task, targetPreset = TARGET_PRESET_NAME) {
    const selector = $("#settings_preset_openai");
    const option = selector.find(`option`).filter(function () { return $(this).text().trim() === targetPreset; });
    let originalValue = null;

    if (option.length) {
        originalValue = selector.val();
        selector.val(option.val()).trigger("change");
        toastr.info(`Switched to ${targetPreset} preset... Please wait.`);
        await new Promise(r => setTimeout(r, 3000));
    } else {
        toastr.error(`"${targetPreset}" not found in OpenAI presets.`);
        return;
    }

    try {
        await task();
    } catch (e) {
        console.error(`[${extensionName}] AI Error:`, e);
    } finally {
        await new Promise(r => setTimeout(r, 500));
        selector.val(originalValue).trigger("change");
    }
}

export async function runMeguminTask(orderText) {
    setActiveGenerationOrder(orderText);
    try {
        return await generateQuietPrompt({ prompt: "___PS_DUMMY___" });
    } finally {
        setActiveGenerationOrder(null);
    }
}
