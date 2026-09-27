// ────────────────────────────────────────────────────────────────────────────
// World State + image in one call (Chomusuke tab → Combine calls).
//
// On a reply that gets an automatic image, when Chomusuke both reads World
// State and makes the images, ONE Chomusuke call does the World State read
// and writes the image prompt (on V2 also the outfit tags that go stale and
// the looks that are missing). Turns without an image keep the plain World
// State read, so every reply costs exactly one call.
//
// After the answer, in order:
//   1. the World Update is filed under the reply's swipe (or, when missing,
//      a separate read runs if the fallback is on, else "no update" is noted);
//   2. V2: outfit tags and new looks are saved against the NEW outfits;
//   3. the image prompt goes to ComfyUI (V2 fills in @Name from the updated
//      World State; Classic sends it as written).
// ────────────────────────────────────────────────────────────────────────────

import { getContext, generateQuietPrompt, substituteParams } from "../../st.js";
import { localProfile } from "../../core/state.js";
import { setActiveImageGenRequest } from "../../core/activeRequests.js";
import { runWithChomusuke } from "../../engine/tasks.js";
import { meguminCleanChatHistoryText } from "../../engine/chatText.js";
import {
    worldEnabled, worldUpdateMode, worldBeginExternalRead, worldReadInputs,
    worldFinishExternalRead, worldRecordMissing, worldExtractMessage
} from "../../state/index.js";
import { renderWorldClerkTask, renderClerkNotes } from "../../state/modules/world/render.js";
import { worldModule } from "../../state/modules/world/index.js";
import { igGenerateWithComfy } from "./comfy.js";
import { imageViaChomusuke, dueNow, NOT_A_REPLY, insertPlaceholder, removePlaceholder, unwrapImgTag } from "./auto.js";
import { classicImageParts, classicImageRulesBlock } from "./classic/prompt.js";
import { v2Settings, currentImageCast, cleanModelPrompt, getLastImagePrompt } from "./v2/index.js";
import { renderCastList, renderV2Rules, renderCombinedPrompt, splitCombinedAnswer } from "./v2/prompt.js";
import { storeOutfitTags, storeNewLooks, takeLookAttempts, sheetSource } from "./v2/looks.js";
import { imageGenEngine } from "./index.js";

const sub = t => { try { return substituteParams(t); } catch (e) { return t; } };

/** The Chomusuke "Combine calls" settings. */
export function combineSettings() {
    const c = (localProfile && localProfile.chomusuke && localProfile.chomusuke.combine) || {};
    return { worldImage: c.worldImage === true, worldFallback: c.worldFallback === true };
}

/** Should this reply's World State read and image be one call? */
export function combinedTurnWanted(messageId, type) {
    if (!combineSettings().worldImage) return false;
    const ig = localProfile && localProfile.imageGen;
    if (!ig || !ig.enabled || !imageViaChomusuke() || NOT_A_REPLY.has(type)) return false;
    if (!worldEnabled() || worldUpdateMode() !== "sidemodel") return false;
    const chat = getContext().chat || [];
    const index = typeof messageId === "number" ? messageId : chat.length - 1;
    const msg = chat[index];
    if (!msg || msg.is_user || msg.is_system) return false;
    // A reply that wrote its own World block is filed from it: no read to combine.
    if (worldModule.parse(String(msg.mes || ""))) return false;
    return dueNow(ig, chat);
}

// The messages before the latest exchange (the exchange = the user turn(s)
// just before the reply, plus the reply), for context.
function earlierStory(index, count = 4) {
    const chat = getContext().chat || [];
    let start = index;
    while (start - 1 >= 0 && chat[start - 1] && (chat[start - 1].is_user || chat[start - 1].is_system)) start--;
    return chat.slice(0, start).filter(m => m && !m.is_system).slice(-count)
        .map(m => `${m.name}: ${meguminCleanChatHistoryText(m.mes)}`).join("\n\n");
}

/**
 * Runs the combined call for one reply. Resolves when the image has been sent
 * to ComfyUI (or skipped). Never throws.
 */
export async function runCombinedTurn(messageId, type) {
    const ig = localProfile.imageGen;
    const chat = getContext().chat || [];
    const index = typeof messageId === "number" ? messageId : chat.length - 1;
    const message = chat[index];
    const token = worldBeginExternalRead(index);
    if (!token) return false;   // nothing to read (already being read, still generating…)

    const inline = (ig.injectMode || "new_msg") === "inline";
    const id = `kazuma-img-${Date.now()}-auto`;
    if (inline) await insertPlaceholder(index, message, id, ig.autoPlacement);

    const engine = imageGenEngine();
    const cfg = v2Settings();
    let built = null;
    let staleBefore = [];
    let missingLooks = [];
    let raw = "";
    try {
        raw = await runWithChomusuke("imageGen", async () => {
            // Built when this job has the worker, so it sees whatever landed before it.
            const { mode, notes, exchange } = worldReadInputs(token);
            const common = {
                notes: renderClerkNotes(notes),
                earlier: earlierStory(index),
                exchange,
                world: renderWorldClerkTask(mode),
                onlyIfPhoto: (ig.triggerMode || "always") === "conditional"
            };
            if (engine === "v2") {
                const cast = currentImageCast();
                const inShot = m => m.inScene || m.isPc || m.mentioned;
                const detailed = cfg.outfitTags && cfg.style === "tags";
                staleBefore = detailed ? cast.filter(m => m.outfitStale && inShot(m)) : [];
                missingLooks = cfg.autoLooks === false ? [] : takeLookAttempts(token.chatId,
                    cast.filter(m => (m.inScene || m.isPc) && !String(m.look || m.body || m.lookNatural || "").trim()));
                built = renderCombinedPrompt({
                    ...common,
                    engine: "v2",
                    castList: renderCastList(cast, { shot: cfg.shot, method: cfg.method }),
                    sheets: missingLooks.length ? sheetSource() : "",
                    imageRules: renderV2Rules({ style: cfg.style, shot: cfg.shot, extra: cfg.extra, method: cfg.method }),
                    previous: cfg.method === "reference" ? getLastImagePrompt() : null,
                    extras: {
                        outfits: staleBefore.map(m => ({ name: m.name, outfit: m.outfitText })),
                        looks: missingLooks.map(m => m.name),
                        followUpdate: detailed
                    }
                });
            } else {
                const parts = classicImageParts();
                built = renderCombinedPrompt({
                    ...common,
                    engine: "classic",
                    sheets: String(parts.characterSheets || "").replace(/^Use these sheets for what each character looks like:\s*/, ""),
                    imageRules: classicImageRulesBlock(parts)
                });
            }
            setActiveImageGenRequest({ v2: { system: sub(built.system), user: sub(built.user), prefill: built.prefill } });
            try {
                return await generateQuietPrompt({ prompt: "___PS_IMAGE_GEN___" });
            } finally {
                setActiveImageGenRequest(null);
            }
        });
    } catch (e) {
        console.error("[Megumin-Suite] Combined World State + image call failed", e);
    }
    raw = String(raw || "");

    // 1. World State.
    const world = worldFinishExternalRead(token, raw, built ? built.prefill : "<World_Update>\n");
    if (!world.ok && !world.dropped) {
        if (combineSettings().worldFallback) worldExtractMessage(index, { force: true });
        else worldRecordMissing(token);
    }
    if (world.dropped || getContext()?.chatId !== token.chatId) {
        if (inline) await removePlaceholder(id);
        return false;
    }

    // 2. V2: outfit tags and new looks, against the outfits AFTER the update.
    const { prompt: rawPrompt, rest } = splitCombinedAnswer(raw);
    if (engine === "v2" && rest) {
        const inShot = m => m.inScene || m.isPc || m.mentioned;
        const staleNow = currentImageCast().filter(m => m.outfitStale && inShot(m));
        if (staleNow.length) storeOutfitTags(staleNow, rest);
        if (missingLooks.length) {
            const added = storeNewLooks(missingLooks.map(m => ({ name: m.name, aliases: m.aliases || [] })), rest);
            if (added.length) toastr.info(`New look${added.length === 1 ? "" : "s"} for ${added.join(", ")}.`, "Megumin Suite", { timeOut: 3500 });
        }
    }

    // 3. The image.
    const prompt = unwrapImgTag(engine === "v2" ? cleanModelPrompt(rawPrompt) : rawPrompt);
    if (!prompt || /^none\.?$/i.test(prompt)) {
        if (inline) await removePlaceholder(id);
        return true;
    }
    toastr.info("Sending to ComfyUI...", "Megumin Suite");
    igGenerateWithComfy(prompt, { message, index, mode: inline ? "inline" : "new_msg", isInlineAuto: true, placeholderId: id });
    return true;
}
