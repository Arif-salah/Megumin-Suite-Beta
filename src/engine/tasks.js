// ──────────────────────────────────────────────────────────────────────────────
// Running a one-off generation through SillyTavern.
//
// The pattern throughout: park a payload in activeRequests, fire a quiet prompt
// that the injection handler recognises, clear the payload in a finally.
// useMeguminEngine additionally swaps the OpenAI preset for the duration and puts
// it back, so a background task can use a different preset than the roleplay.
// ──────────────────────────────────────────────────────────────────────────────

import { generateQuietPrompt } from "../st.js";
import { extensionName, TARGET_PRESET_NAME } from "../core/constants.js";
import { setActiveBanListChat, setActiveGenerationOrder } from "../core/activeRequests.js";

export async function analyzeSlopDirectly(chatText) {
    setActiveBanListChat(chatText);
    try {
        let rawOutput = await generateQuietPrompt({ prompt: "___PS_BANLIST___" });
        return rawOutput.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    } catch (e) {
        console.error(`[${extensionName}] Ban List Analysis Failed:`, e);
        return null;
    } finally {
        setActiveBanListChat(null);
    }
}

export async function analyzeSlopWithPreset(chatText) {
    let result = null;
    await useMeguminEngine(async () => {
        // We still use the interceptor! This just makes the engine switch first.
        result = await analyzeSlopDirectly(chatText);
    });
    return result;
}

export async function useMeguminEngine(task, targetPreset = TARGET_PRESET_NAME) { // Added parameter with default value
    const selector = $("#settings_preset_openai");
    const option = selector.find(`option`).filter(function () { return $(this).text().trim() === targetPreset; }); // Use the new parameter
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

// ──────────────────────────────────────────────────────────────────────────────
// Background quiet-generation lock.
//
// All the non-roleplay quiet prompts (image prompt, memory summarization, NPC
// scan, story plan, …) share one thing: ST builds the outgoing request in
// handlePromptInjection() by reading whichever of the active-request markers is
// set, in a fixed priority order. When two background requests run concurrently,
// the marker that HAPPENS to be checked first wins the OTHER request's quiet
// call — so an image prompt can be returned in place of a memory summary (the
// interceptor checks activeImageGenRequest before activeMemorySummarizationRequest).
//
// Auto image-gen fires after every reply, and memory summarization can loop over
// many chunks for minutes, so the two genuinely overlap. Serializing them here
// guarantees one quiet prompt at a time and keeps each request's marker matched
// to the prompt actually being built. Roleplay turns are unaffected: they are
// guarded separately via isGenerating() and never pass through this lock.
// ──────────────────────────────────────────────────────────────────────────────
let _backgroundLock = Promise.resolve();

export async function withBackgroundLock(task) {
    const previous = _backgroundLock;
    let release;
    _backgroundLock = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
        return await task();
    } finally {
        release();
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
