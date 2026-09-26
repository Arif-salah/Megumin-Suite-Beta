// ────────────────────────────────────────────────────────────────────────────
// Image Gen — the Classic prompt, exactly as before task 001 (df9e9db): the
// model writes the whole image prompt, with the relevant NPC Bank image tags
// shown to it when "inject NPC tags" is on.
// ────────────────────────────────────────────────────────────────────────────

import { getContext, generateQuietPrompt } from "../../../st.js";
import { localProfile } from "../../../core/state.js";
import { setActiveImageGenRequest } from "../../../core/activeRequests.js";
import { DEFAULT_PROMPTS } from "../../../prompts/index.js";
import { meguminCleanChatHistoryText } from "../../../engine/chatText.js";
import { getRelevantNpcImageTags } from "../../npc/data.js";

export async function classicGenerateImagePromptText() {
    const ig = localProfile.imageGen;
    const chat = getContext().chat;
    const lastMessages = chat.filter(m => !m.is_user && !m.is_system).slice(-5).map(m => {
        return `${m.name}: ${meguminCleanChatHistoryText(m.mes)}`;
    }).join("\n\n");

    const customIg = ig.customPromptsEnabled ? (ig.customPrompts || {}) : {};
    const defIg = DEFAULT_PROMPTS.imageGen;

    let rules = "", examples = "";
    const tmpl = ig.promptTemplate || "illus_cinematic";

    const map = {
        "illus_pov": ["rulesIllusPov", "examplesIllusPov"],
        "sdxl_pov": ["rulesSdxlPov", "examplesSdxlPov"],
        "illus_cinematic": ["rulesIllusCinematic", "examplesIllusCinematic"],
        "sdxl_cinematic": ["rulesSdxlCinematic", "examplesSdxlCinematic"],
        "illus_portrait": ["rulesIllusPortrait", "examplesIllusPortrait"],
        "sdxl_portrait": ["rulesSdxlPortrait", "examplesSdxlPortrait"]
    };

    const keys = map[tmpl];
    if (keys) {
        rules = customIg[keys[0]] || defIg[keys[0]];
        examples = customIg[keys[1]] || defIg[keys[1]];
    }

    if (!ig.includeExamples) examples = "";

    let directLangStr = ig.directLanguage ? "**DIRECT LANGUAGE:** Use exact Booru tags only. \"naked\" not \"wearing nothing.\" \"erection\" not \"visible arousal.\"\n\n**NSFW TAG REFERENCE (use when scene is explicit):**\nBody: naked, nude, topless, exposed nipples, small breasts, medium breasts, large breasts, spread legs, ass, erection, veins, veiny penis\nActions: hetero, sex, vaginal, anal, oral, fellatio, after fellatio, paizuri, straddling, riding, missionary, doggystyle, cowgirl position, moaning, open mouth, tongue out, ahegao, clenching teeth\nFluids: cum, cum on body, cum on breasts, cum on face, cum on hair, cum on tongue, cum in mouth, cum inside, ejaculation, facial, saliva, sweat\nState: flushed face, heavy breathing, trembling, crying with eyes open, half-closed eyes, solo focus" : "";
    let npcTagsStr = getRelevantNpcImageTags(); // <-- GET THE TAGS

    setActiveImageGenRequest({
        chatText: lastMessages, 
        templateRules: rules, 
        templateExamples: examples, 
        extraStr: ig.promptExtra || "",
        directLanguageStr: directLangStr,
        npcTagsStr: npcTagsStr // <-- ADD TO REQUEST
    });

    let rawOutput = await generateQuietPrompt({ prompt: "___PS_IMAGE_GEN___" });
    return rawOutput.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/** The NPC tag section for the inline [[img1]] instruction (Classic). */
export function classicInlineNpcTags() {
    return getRelevantNpcImageTags();
}
