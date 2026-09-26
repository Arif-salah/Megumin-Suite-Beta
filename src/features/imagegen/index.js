// ────────────────────────────────────────────────────────────────────────────
// Image Gen — the tab shell.
//
// Two pages under one tab, picked at the top:
//   Classic — the image tab exactly as it was before task 001 (classic/).
//   V2      — consistent characters: the model writes @Name, the extension puts
//             in each character's stored look and current outfit (v2/, plan 006).
// Both share the ComfyUI side (comfy.js) and its stored settings, so switching
// pages loses nothing. This file only chooses between them; everything the rest
// of the extension imports from "imagegen/index.js" is still exported here.
// ────────────────────────────────────────────────────────────────────────────

import { localProfile } from "../../core/state.js";
import { saveProfileToMemory } from "../../core/profile.js";
import { setActiveImageGenRequest } from "../../core/activeRequests.js";
import { showKazumaProgress } from "../../ui/progress.js";
import { runWithChomusuke } from "../../engine/tasks.js";
import { igGenerateWithComfy, setImagePromptResolver } from "./comfy.js";
import { renderClassicImageGen } from "./classic/ui.js";
import { classicGenerateImagePromptText, classicInlineNpcTags } from "./classic/prompt.js";
import { v2GenerateImagePromptText, v2InlineInstruction, v2ResolveForComfy } from "./v2/index.js";
import { renderV2ImageGen } from "./v2/ui.js";

export {
    igFetchComfyLists, toggleQuickGenButton, igTestConnection, igPopulateWorkflows,
    igNewWorkflowClick, igDeleteWorkflowClick, igOpenWorkflowEditorClick,
    addKazumaRetryButtons, kazumaRetrySweep, igGenerateWithComfy,
} from "./comfy.js";

/** "classic" | "v2" — which page and which prompt side are in use. */
export function imageGenEngine() {
    return localProfile?.imageGen?.engine === "v2" ? "v2" : "classic";
}

// ── The tab ──────────────────────────────────────────────────────────────

export function renderImageGen(c) {
    c.empty();
    const engine = imageGenEngine();
    const head = $(`
        <div class="ig-engine-switch">
            <div class="ig-engine-tabs" role="tablist">
                <button type="button" class="ig-engine-tab ${engine === "classic" ? "active" : ""}" data-engine="classic">
                    <i class="fa-solid fa-clock-rotate-left"></i> Classic
                </button>
                <button type="button" class="ig-engine-tab ${engine === "v2" ? "active" : ""}" data-engine="v2">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> V2
                </button>
            </div>
            <div class="ig-engine-desc">${engine === "classic"
                ? "The image tab as it has always worked: the model writes the whole image prompt."
                : "Consistent characters: saved looks and current outfits go into every image unchanged."}</div>
        </div>
    `);
    head.find(".ig-engine-tab").on("click", function () {
        const next = $(this).data("engine");
        if (next === imageGenEngine()) return;
        localProfile.imageGen.engine = next;
        saveProfileToMemory();
        renderImageGen(c);
    });
    c.append(head);

    const page = $(`<div class="ig-engine-page"></div>`);
    c.append(page);
    if (engine === "classic") renderClassicImageGen(page);
    else renderV2ImageGen(page);
}

// Every image goes through this before ComfyUI (manual, inline, retry). On V2
// it turns @Name into the stored look and current outfit; a prompt that has
// already been resolved (a retry) passes through unchanged.
setImagePromptResolver(p => (imageGenEngine() === "v2" ? v2ResolveForComfy(p) : p));

// ── Generation entry points (dispatch by engine) ─────────────────────────

/** The quiet "write me an image prompt" call behind the manual button. */
export async function generateImagePromptText(opts = {}) {
    return imageGenEngine() === "v2" ? v2GenerateImagePromptText(opts) : classicGenerateImagePromptText(opts);
}

export { imageViaChomusuke, igAutoImageForReply } from "./auto.js";

/** The NPC tag section for the Classic inline [[img1]] instruction. */
export function imageInjectionNpcTags() {
    return imageGenEngine() === "v2" ? "" : classicInlineNpcTags();
}

/** V2 replaces the whole inline instruction; null on Classic. */
export function imageV2InlineInstruction(opts) {
    return imageGenEngine() === "v2" ? v2InlineInstruction(opts) : null;
}

export async function igManualGenerate() {
    const s = localProfile?.imageGen;
    if (!s || !s.enabled) return;

    showKazumaProgress("Analyzing Scene...");

    try {
        let promptText = await runWithChomusuke("imageGen", () => generateImagePromptText());

        // Use capturing group 1 for the quote type, group 2 for the actual prompt text
        const imgRegex = /<img[^>]*?prompt=(["']?)([\s\S]*?)(?:\1\s*\/?>|\1\s*>|\1\s+[a-zA-Z]+=| \/>|>|$)/i;
        const match = promptText.match(imgRegex);
        if (match) promptText = match[2];

        toastr.info("Sending to ComfyUI...", "Megumin Suite");
        igGenerateWithComfy(promptText, null);

    } catch (e) {
        console.error(e);
        $("#kazuma_progress_overlay").hide();
        toastr.error("Manual generation failed.");
    } finally {
        setActiveImageGenRequest(null);
    }
}
