// ─────────────────────────────────────────────────────────────────────────────
// BanList prompts.
//
// Dynamic Ban List — scans the chat for repeated phrasing.
//
// Text moved verbatim out of index.js — not reworded. These are the built-in
// defaults; a user edit is stored as a diff against them (see storage.js).
// ─────────────────────────────────────────────────────────────────────────────

export const banListPrompts = {
        systemPrompt: "You are an expert literary critique. Analyze the provided chat history and identify the 5 most repetitive, cliché, or overused stylistic patterns or crutch phrases the writer relies on. Instead of quoting the exact phrase, write a short, generalized rule forbidding the underlying trope. Return ONLY the 5 rules separated by commas. Do not explain them. Do not use quotes or numbers.",
        userPrompt: "Extract the top 5 most overused clichés or repetitive narrative patterns from this text. Return ONLY the 5 generalized rules forbidding them, separated by commas.\n<chat>\n{{chatHistory}}\n</chat>",
        thinkingPrompt: "<thinking_steps>\nBefore creating the response, think deeply.\n\nThoughts must be wrapped in <think></think>. The first token must be <think>. The main response must immediately follow </think>.\n\n<think>\nReflect in approximately 100–150 words as a seamless paragraph.\n\n– your thinking steps\n\n</think>\n</thinking_steps>\n\n[OUTPUT ORDER]\n    Every response must follow this exact structure in this exact order:\n\n    <think>\n    {Thinking}\n    </think>\n\n    {Main response}",
        injectionTemplate: "[BAN LIST]\nNever rely on these clichés, tropes, or repetitive patterns. They are dead language:\n{{banItems}}"
};
