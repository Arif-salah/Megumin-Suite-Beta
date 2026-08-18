// ──────────────────────────────────────────────────────────────────────────────
// Turning the chat log into text an LLM should see.
//
// Every background task — the planner, the ban list, image prompts, the NPC scan,
// memory summaries — needs the story without the extension's own furniture in it.
// Getting that wrong feeds tracker blocks and <think> tags back into the model, so
// it lives in one place rather than being re-derived per feature.
// ──────────────────────────────────────────────────────────────────────────────

import { getContext } from "../st.js";
import { localProfile } from "../core/state.js";
import { meguminAllBlockTags } from "../features/blocks/registry.js";

// Re-exported so the existing chatText import sites keep working.
export { escapeRegex } from "../utils/regex.js";

export function cleanAIOutput(text) {
    if (!text) return "";
    const re = new RegExp("(<disclaimer>.*?</disclaimer>)|(<guifan>.*?</guifan>)|(<danmu>.*?</danmu>)|(<options>.*?</options>)|```start|```end|<done>|`<done>`|(.*?</think(ing)?>(\\n)?)|(<think(ing)?>[\\s\\S]*?</think(ing)?>(\\n)?)", "gs");
    return text.replace(re, "").trim();
}

// MASTER CHAT CLEANER: Removes Megumin UI blocks, thoughts, and raw HTML from chat text.
export function meguminCleanChatHistoryText(text) {
    if (!text) return "";
    let cleaned = text;

    // 1. Remove Specific Megumin Suite Blocks (Inner Chatter, World State, CYOA, NPC Dossiers, Inline Images)
    cleaned = cleaned.replace(/<img[^>]*?alt=["']KazumaInline["'][^>]*?>/gi, "");
    cleaned = cleaned.replace(/<div[^>]*?title=["']KazumaFail\|[^>]*?>.*?<\/div>/gi, "");
    
    // Comprehensive Image Block Cleanup
    cleaned = cleaned.replace(/<img\s+[^>]*\/>|<div class="kazuma-img-placeholder"[^>]*>[\s\S]*?<\/div>|<!-- kazuma-inline-start:[^>]*-->[\s\S]*?<!-- kazuma-inline-end:[^>]*-->/gi, "");
    cleaned = cleaned.replace(/<details[^>]*>\s*<summary[^>]*>.*?💭.*?<b[^>]*>NPC Inner Chatter<\/b\s*><\/summary\s*>\s*([\s\S]*?)\s*<\/details\s*>/gi, "");
    cleaned = cleaned.replace(/<details[^>]*>\s*<summary[^>]*>.*?📌.*?<b[^>]*>World State<\/b\s*><\/summary\s*>\s*([\s\S]*?)\s*<\/details\s*>/gi, "");
    cleaned = cleaned.replace(/<details[^>]*>\s*<summary[^>]*>.*?🆕.*?<b[^>]*>New NPC:.*?<\/b\s*><\/summary\s*>\s*([\s\S]*?)\s*<\/details\s*>/gi, ""); // <-- NEW
    cleaned = cleaned.replace(/<div style="border: 1px solid #444;[\s\S]*?<\/div\s*>/gi, "");

    // Story Tracker: the block stays visible in the chat, but its body (arc_status,
    // hidden_state, next_beat …) must never reach the summariser, the semantic
    // query, image gen, the ban list or the Story Director.
    cleaned = cleaned.replace(/<Story_Tracker[^>]*>[\s\S]*?<\/Story_Tracker\s*>/gi, "");
    // A reply cut off mid-tracker leaves an opening tag with no closing one. Half a
    // tracker leaks as badly as a whole one, so cut from it to the end of the text.
    cleaned = cleaned.replace(/<Story_Tracker[^>]*>[\s\S]*$/i, "");

    // The <Blocks> envelope and its named children. Taking the envelope whole
    // handles the ordinary reply in one pass; the children are then stripped
    // individually because nothing guarantees they arrived inside it — a reply
    // cut off before </Blocks> leaves them loose in the text, and a block that
    // reaches the summariser teaches the model to write more of them.
    cleaned = cleaned.replace(/<Blocks\b[^>]*>[\s\S]*?<\/Blocks\s*>/gi, "");
    const blockTags = meguminAllBlockTags();
    blockTags.forEach(tag => {
        cleaned = cleaned.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    });
    // Same cut-to-the-end guard the tracker gets, for the same reason: an opening
    // tag with no closing one is invisible to every paired strip above it.
    cleaned = cleaned.replace(/<Blocks\b[^>]*>[\s\S]*$/i, "");
    blockTags.forEach(tag => {
        cleaned = cleaned.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*$`, "i"), "");
    });

    // 2. Remove AI reasoning and artifacts (think, disclaimer, options, start/end)
    const badStuffRegex = /(<disclaimer>.*?<\/disclaimer>)|(<guifan>.*?<\/guifan>)|(<danmu>.*?<\/danmu>)|(<options>.*?<\/options>)|```start|```end|<done>|`<done>`|(.*?<\/(?:ksc??|think(?:ing)?)>(\n)?)|(<(?:ksc??|think(?:ing)?)>[\s\S]*?<\/(?:ksc??|think(?:ing)?)>(\n)?)/gs;
    cleaned = cleaned.replace(badStuffRegex, "");

    // 3. Remove leftover standard details/summary tags & HTML
    cleaned = cleaned.replace(/<details[^>]*>[\s\S]*?<\/details\s*>/gi, "");
    cleaned = cleaned.replace(/<summary[^>]*>[\s\S]*?<\/summary\s*>/gi, "");
    // A reply cut off mid-block leaves an opening tag with no closing one, exactly
    // as a cut-off tracker does above. The paired strips cannot see it, so the body
    // walked on into the summariser, the vault and the image prompts. Cut from
    // whatever opener is left to the end of the text.
    cleaned = cleaned.replace(/<details[^>]*>[\s\S]*$/i, "");
    cleaned = cleaned.replace(/<summary[^>]*>[\s\S]*$/i, "");
    cleaned = cleaned.replace(/<[^>]*>?/gm, "");

    return cleaned.trim();
}

// -------------------------------------------------------------
// AI GENERATION & BAN LIST HELPER FUNCTIONS (RESTORED)
// -------------------------------------------------------------
export function getCleanedChatHistory() {
    const context = getContext();
    if (!context.chat || context.chat.length === 0) return "";

    const aiMessages = context.chat.filter(m => !m.is_user && !m.is_system).slice(-50);
    const badStuffRegex = /(<disclaimer>.*?<\/disclaimer>)|(<guifan>.*?<\/guifan>)|(<danmu>.*?<\/danmu>)|(<options>.*?<\/options>)|```start|```end|<done>|`<done>`|(.*?<\/(?:ksc??|think(?:ing)?)>(\n)?)|(<(?:ksc??|think(?:ing)?)>[\s\S]*?<\/(?:ksc??|think(?:ing)?)>(\n)?)/gs;

    let cleanedMessages = aiMessages.map(m => meguminCleanChatHistoryText(m.mes));

    cleanedMessages = cleanedMessages.filter(t => t.length > 0);
    return cleanedMessages.join("\n\n");
}

export function getChatForStoryDirector() {
    const context = getContext();
    if (!context.chat || context.chat.length === 0) return "";

    const limit = localProfile?.storyPlan?.contextLimit !== undefined ? localProfile.storyPlan.contextLimit : 100;
    
    // Get all messages EXCEPT system messages
    let msgs = context.chat.filter(m => !m.is_system);
    
    // Apply the limit if it's greater than 0
    if (limit > 0) {
        msgs = msgs.slice(-limit);
    }

    // Clean the text and attach the character/user names so the AI knows who is speaking
    let cleanedMessages = msgs.map(m => {
        const cleanText = meguminCleanChatHistoryText(m.mes);
        if (!cleanText) return null;
        return `${m.name}: ${cleanText}`;
    }).filter(t => t !== null);

    return cleanedMessages.join("\n\n");
}

export function getChatForNpcScan() {
    const context = getContext();
    if (!context.chat || context.chat.length === 0) return "";
    const depth = localProfile?.npcBank?.scanDepth || 60;
    // Grab the last 'depth' actual messages (both user and AI) to have complete context
    const msgs = context.chat.filter(m => !m.is_system).slice(-depth);
    return msgs.map(m => `${m.name}: ${meguminCleanChatHistoryText(m.mes)}`).join("\n\n");
}

