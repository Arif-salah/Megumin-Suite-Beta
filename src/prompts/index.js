// Barrel for the prompt layer. Import from here rather than reaching into the
// individual module files — it keeps the one-import-line convenience the old
// single-file layout had.

export { DEFAULT_PROMPTS, MEGUMIN_PROMPT_MODULES } from "./defaults.js";
export {
    meguminDiffPrompts,
    meguminFillPrompts,
    meguminSparsifyProfilePrompts,
    meguminRehydrateProfilePrompts,
} from "./storage.js";

// Individual blocks, for code that wants one module's prompts without pulling in
// the whole set.
export { storyPlanPrompts } from "./storyPlan.js";
export { banListPrompts } from "./banList.js";
export { imageGenPrompts } from "./imageGen.js";
export { memoryCorePrompts } from "./memoryCore.js";
export { npcBankPrompts } from "./npcBank.js";
