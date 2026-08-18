// ─────────────────────────────────────────────────────────────────────────────
// The built-in prompt set, reassembled from one file per module.
//
// DEFAULT_PROMPTS has exactly the shape it always had, so every reader
// downstream is unchanged. The split is purely so that editing the Story
// Director's system prompt doesn't mean scrolling past 17KB of image-gen rules.
// ─────────────────────────────────────────────────────────────────────────────

import { storyPlanPrompts } from "./storyPlan.js";
import { banListPrompts } from "./banList.js";
import { imageGenPrompts } from "./imageGen.js";
import { memoryCorePrompts } from "./memoryCore.js";
import { npcBankPrompts } from "./npcBank.js";

export const DEFAULT_PROMPTS = {
    storyPlan: storyPlanPrompts,
    banList: banListPrompts,
    imageGen: imageGenPrompts,
    memoryCore: memoryCorePrompts,
    npcBank: npcBankPrompts,
};

// The modules whose prompts live under `profile[mod].customPrompts`.
//
// banList is deliberately absent: its overrides are stored one level up, on
// `profile.banListCustomPrompts`, so the sparsify/rehydrate helpers handle it as
// a separate case rather than in this loop.
export const MEGUMIN_PROMPT_MODULES = ['storyPlan', 'imageGen', 'memoryCore', 'npcBank'];
