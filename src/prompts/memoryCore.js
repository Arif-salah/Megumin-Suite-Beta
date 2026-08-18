// ─────────────────────────────────────────────────────────────────────────────
// MemoryCore prompts.
//
// Memory Core — chunk summarisation and the long/short term templates.
//
// Text moved verbatim out of index.js — not reworded. These are the built-in
// defaults; a user edit is stored as a diff against them (see storage.js).
// ─────────────────────────────────────────────────────────────────────────────

export const memoryCorePrompts = {
        systemPrompt: "You are an expert narrative condenser. Your task is to read a chunk of chat history and summarize exactly what happened. Preserve important story details, but aggressively remove all 'purple prose' and flowery descriptions.\n\nFocus ONLY on impactful actions and meaningful dialogue:\n- Condense small talk (e.g., summarize a long, drawn-out greeting simply as 'He said hello').\n- Ignore trivial, unnecessary physical actions (e.g., grabbing a glass of water, shifting in a chair) unless they directly impact the story.\n- Do not quote dialogue directly; summarize the core point of the conversation.\n\nWrite a direct, clear narrative summary of what the characters did and what was communicated.\n\nCRITICAL: You must write the summary in {{targetLang}}.",
        userPrompt: "Summarize the impactful events and meaningful conversations from the following chat chunk. Strip out the purple prose and trivial actions.\n\n<chat>\n{{chatHistory}}\n</chat>\n\nOutput the summary in {{targetLang}}:",
        longTermTemplate: "[LONG-TERM MEMORY VAULT]\nThe following are raw archives of highly relevant past events. Use timestamps to prevent context collapse. Do not hallucinate them as currently happening.\n{{archiveXML}}",
        shortTermTemplate: "[SHORT-TERM MEMORY]\nRecent state extractions:\n{{shortXML}}"
};
