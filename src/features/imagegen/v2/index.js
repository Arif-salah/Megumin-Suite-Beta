// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 ↔ SillyTavern.
//
// Gathers what the pure parts need (stored looks, World State, NPC Bank, the
// persona, the recent chat) and hands out: the manual prompt, the inline
// instruction, and the @Name resolver every image goes through before ComfyUI.
// ────────────────────────────────────────────────────────────────────────────

import { getContext, generateQuietPrompt, substituteParams, saveMetadataDebounced } from "../../../st.js";
import { localProfile } from "../../../core/state.js";
import { setActiveImageGenRequest } from "../../../core/activeRequests.js";
import { meguminCleanChatHistoryText } from "../../../engine/chatText.js";
import { getWorldState, worldHasState } from "../../../state/index.js";
import { buildImageCast } from "./cast.js";
import { resolveImagePrompt } from "./resolve.js";
import { renderCastList, renderV2Rules, renderV2ManualPrompt, renderV2InlineInstruction } from "./prompt.js";
import { refreshOutfitTags } from "./looks.js";

export const V2_DEFAULTS = {
    style: "tags", shot: "cinematic", extra: "", method: "placeholders",
    autoLooks: true,          // a character entering the scene gets a look read from the chat
    lookPriority: "v2",       // "v2" | "npc": which wins when the NPC Bank also has Image Tags
    outfitTags: false         // Tags style: turn World State outfits into detailed tags (once per outfit)
};

// ── The previous image prompt (Reference method) ─────────────────────────
// Kept per chat, in the chat file: the last prompt sent to ComfyUI.
const LAST_PROMPT_KEY = "megumin_image_v2";

export function getLastImagePrompt() {
    const meta = getContext()?.chatMetadata;
    return (meta && meta[LAST_PROMPT_KEY] && meta[LAST_PROMPT_KEY].lastPrompt) || "";
}

function setLastImagePrompt(prompt) {
    const ctx = getContext();
    if (!ctx || !ctx.chatId || !ctx.chatMetadata || !String(prompt || "").trim()) return;
    ctx.chatMetadata[LAST_PROMPT_KEY] = { ...(ctx.chatMetadata[LAST_PROMPT_KEY] || {}), lastPrompt: String(prompt).trim(), at: Date.now() };
    saveMetadataDebounced();
}

export function v2Settings() {
    return { ...V2_DEFAULTS, ...((localProfile && localProfile.imageGen && localProfile.imageGen.v2) || {}) };
}

const sub = t => { try { return substituteParams(t); } catch (e) { return t; } };

/**
 * The stored looks (chat_metadata via task 003's characterTags), in V2 shape.
 * Entries written by tasks 003/004 ({ tags, locked, provisional, aliases })
 * are upgraded in place and keep their tags and nicknames.
 */
export function getLooks() {
    const ig = localProfile && localProfile.imageGen;
    if (!ig) return {};
    if (!ig.characterTags || typeof ig.characterTags !== "object") ig.characterTags = {};
    for (const entry of Object.values(ig.characterTags)) {
        if (!entry || typeof entry !== "object") continue;
        if (typeof entry.tags !== "string") entry.tags = String(entry.tags || "");
        if (typeof entry.natural !== "string") entry.natural = "";
        if (!Array.isArray(entry.aliases)) entry.aliases = [];
        if (typeof entry.locked !== "boolean") entry.locked = Boolean(entry.locked);
        if (!entry.source) entry.source = entry.provisional ? "chat" : "manual";
    }
    return ig.characterTags;
}

function recentMessages(count) {
    const chat = (getContext() && getContext().chat) || [];
    return chat.filter(m => m && !m.is_system).slice(-count);
}

/** Everyone who can be written as @Name right now. */
export function currentImageCast() {
    const recent = recentMessages(3).map(m => String(m.mes || "").replace(/<[^>]+>/g, " ")).join(" ");
    return buildImageCast({
        looks: getLooks(),
        world: worldHasState() ? getWorldState() : null,
        npcs: (localProfile && localProfile.npcBank && localProfile.npcBank.npcs) || [],
        userName: sub("{{user}}"),
        recentText: recent,
        npcFirst: v2Settings().lookPriority === "npc" && Boolean(localProfile && localProfile.npcBank && localProfile.npcBank.enabled),
        outfitTags: v2Settings().outfitTags && v2Settings().style === "tags"
    });
}

function sceneLine() {
    if (!worldHasState()) return "";
    const s = getWorldState().scene || {};
    return [s.time && `Time: ${s.time}`, s.location && `Loc: ${s.location}`, s.weather && `Wx: ${s.weather}`].filter(Boolean).join(" | ");
}

function rules(extraInstruction = "") {
    const cfg = v2Settings();
    const extra = [cfg.extra, extraInstruction].filter(s => String(s || "").trim()).join(" ");
    return sub(renderV2Rules({ style: cfg.style, shot: cfg.shot, extra, method: cfg.method }));
}

// ── The manual button ────────────────────────────────────────────────────

export async function v2GenerateImagePromptText({ extraInstruction = "" } = {}) {
    const cfg = v2Settings();
    // Outfits in the Cast as tags, when that is on and they changed.
    await refreshOutfitTags();
    const story = recentMessages(6)
        .map(m => `${m.name}: ${meguminCleanChatHistoryText(m.mes)}`)
        .join("\n\n");
    const built = renderV2ManualPrompt({
        castList: sub(renderCastList(currentImageCast(), { shot: cfg.shot, method: cfg.method })),
        scene: sceneLine(),
        story,
        method: cfg.method,
        previous: getLastImagePrompt(),
        rules: rules(extraInstruction)
    });
    setActiveImageGenRequest({ v2: { system: sub(built.system), user: built.user } });
    const raw = await generateQuietPrompt({ prompt: "___PS_IMAGE_GEN___" });
    return cleanModelPrompt(raw);
}

// Models wrap a one-line answer in all sorts of things.
export function cleanModelPrompt(raw) {
    return String(raw || "")
        .replace(/<think\b[^>]*>[\s\S]*?(<\/think\s*>|$)/gi, "")
        .replace(/```[a-z]*\n?|```/gi, "")
        .replace(/^\s*(image\s*)?prompt\s*:\s*/i, "")
        .trim()
        .replace(/^["“]|["”]$/g, "")
        .trim();
}

// ── The inline instruction ([[img1]]) ────────────────────────────────────

export function v2InlineInstruction({ conditionalText = "", imageCount = 1 } = {}) {
    const cfg = v2Settings();
    return sub(renderV2InlineInstruction({
        conditionalText,
        imageCount,
        castList: renderCastList(currentImageCast(), { shot: cfg.shot, method: cfg.method }),
        rules: rules(),
        method: cfg.method,
        previous: getLastImagePrompt()
    }));
}

// ── Every image, just before ComfyUI ─────────────────────────────────────

let lastResolution = null;

/** What the last resolve did (for the preview and debugging). */
export function v2LastResolution() {
    return lastResolution;
}

export async function v2ResolveForComfy(prompt) {
    // Every image path ends here (manual, automatic, inline, retry): bring any
    // changed outfit tags up to date first. No-op when detailed tags are off.
    await refreshOutfitTags();
    const r = resolveImagePrompt(prompt, { cast: currentImageCast(), style: v2Settings().style });
    lastResolution = { input: String(prompt || ""), ...r };
    // Reference method edits this next time. Kept on both methods, so switching
    // to Reference starts from the last real image.
    setLastImagePrompt(r.prompt);
    if (r.filled.length || r.unknown.length) {
        console.debug("[Megumin-Suite] Image V2 resolved:", { filled: r.filled, unknown: r.unknown, noLook: r.noLook });
    }
    if (r.unknown.length) {
        toastr.info(`No saved look for: ${[...new Set(r.unknown)].join(", ")}. Used the name as written.`, "Megumin Suite", { timeOut: 5000 });
    }
    return r.prompt;
}
