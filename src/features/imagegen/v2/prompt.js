// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 — prompt assembly. Pure: takes the cast and settings, returns
// strings. {{user}} is left for the caller to substitute.
//
// Two methods:
//   placeholders — the model writes @Name; the extension puts in the look and
//                  outfit. The cast is shown as reference only.
//   reference    — (experimental) the model edits the previous image prompt,
//                  with the cast as the source of truth for looks and clothes.
// ────────────────────────────────────────────────────────────────────────────

import { IMAGE_V2_PROMPTS as P } from "../../../prompts/imageGenV2.js";

export const V2_STYLES = ["tags", "natural"];
export const V2_SHOTS = ["cinematic", "pov", "portrait"];
export const V2_METHODS = ["placeholders", "reference"];

/**
 * @typedef {Object} ImageCastMember
 * @property {string}   name
 * @property {string[]} [aliases]
 * @property {boolean}  [isPc]
 * @property {boolean}  [inScene]
 * @property {boolean}  [mentioned]  absent, but named in the recent text
 * @property {string}   [sex]        "male" | "female" | ""
 * @property {string}   [look]       appearance that shows in any shot
 * @property {string}   [body]       build and proportions (full-body shots only)
 * @property {string}   [outfit]     current outfit; empty = the model describes the clothing
 * @property {string}   [position]   where they are and their posture (World State), for framing
 */

/**
 * <Cast>: the player, who is in the scene, and absent characters just
 * mentioned — each with their sex, look, body and clothing, so the model can
 * pick the count and the framing.
 */
export function renderCastList(cast, { shot = "cinematic", method = "placeholders" } = {}) {
    const ref = method === "reference";
    const blocks = [];
    for (const c of cast || []) {
        if (!c || !c.name) continue;
        if (!c.isPc && !c.inScene && !c.mentioned) continue;
        // POV: the player is the camera, so they are not offered as a subject.
        if (c.isPc && shot === "pov") continue;
        const aka = (c.aliases || []).filter(Boolean);
        const handle = ref ? c.name : `@${c.name}`;
        const also = aka.length ? ` (also ${aka.map(a => ref ? a : `@${a}`).join(", ")})` : "";
        const where = c.isPc ? "the player" : c.inScene ? "in the scene" : "not in the scene";
        const sex = c.sex ? `${c.sex}, ` : "";
        const lines = [`${handle}${also}: ${sex}${where}`];
        if (String(c.look || "").trim()) lines.push(`  appearance: ${c.look}`);
        if (String(c.body || "").trim()) lines.push(`  body (only when the shot shows it): ${c.body}`);
        if (String(c.outfit || "").trim()) lines.push(`  wearing: ${c.outfit}`);
        else lines.push("  wearing: not noted (describe what they wear)");
        if (String(c.position || "").trim()) lines.push(`  position: ${c.position}`);
        blocks.push(lines.join("\n"));
    }
    return blocks.length ? `<Cast>\n${blocks.join("\n")}\n</Cast>` : "";
}

/** The style guide (structure + example + rules), the shot line, extra instructions. */
export function renderV2Rules({ style = "tags", shot = "cinematic", extra = "", method = "placeholders" } = {}) {
    const guide = method === "reference"
        ? [P.reference.head, P.reference[style] || P.reference.tags].join("\n")
        : (P.style[style] || P.style.tags);
    const parts = [guide, P.shot[shot] || P.shot.cinematic];
    if (String(extra || "").trim()) parts.push(`Extra instructions: ${String(extra).trim()}`);
    return parts.join("\n");
}

const previousBlock = previous =>
    `<Previous_Image_Prompt>\n${String(previous || "").trim() || "(none yet: this is the first image)"}\n</Previous_Image_Prompt>`;

/**
 * The manual button's quiet generation.
 * @returns {{ system: string, user: string }}
 */
export function renderV2ManualPrompt({ castList = "", scene = "", story = "", rules = "", method = "placeholders", previous = "", extras = "" } = {}) {
    const user = [
        castList,
        scene ? `<Scene>\n${scene}\n</Scene>` : "",
        `<Recent_Story>\n${String(story || "").trim()}\n</Recent_Story>`,
        method === "reference" ? previousBlock(previous) : "",
        rules,
        // With extra sections the answer has a shape of its own (see renderV2Extras).
        extras ? P.manualTaskWithExtras : P.manualTask,
        extras
    ].filter(Boolean).join("\n\n");
    return { system: P.system, user };
}

/** [[img1]]: the inline instruction the story model reads. */
export function renderV2InlineInstruction({ conditionalText = "", imageCount = 1, castList = "", rules = "", method = "placeholders", previous = "" } = {}) {
    const head = P.inlineHead
        .replace("{{conditionalText}}", conditionalText || "")
        .replace("{{imageCount}}", String(imageCount || 1));
    return [head, castList, method === "reference" ? previousBlock(previous) : "", rules, P.inlineTail].filter(Boolean).join("\n");
}

// ── One call, several answers ────────────────────────────────────────────
// The image call can also bring the outfit tags that went stale and the looks
// that are missing, so an image never costs more than one background call.
// Only what is needed is asked for; with nothing extra, the answer is just the
// prompt, as before. Sections come back as tags, not JSON: a broken section
// loses only itself.

/**
 * @param {{ outfits?: Array<{ name: string, outfit: string }>, looks?: string[], sheets?: string }} needs
 * @returns {string} "" when nothing extra is needed
 */
export function renderV2Extras({ outfits = [], looks = [], sheets = "" } = {}) {
    if (!outfits.length && !looks.length) return "";
    const parts = ["## In the same answer"];
    if (outfits.length) {
        parts.push(
            "Turn these outfits into booru clothing tags: one tag per garment or accessory, with its colour or material; keep the state of dress; clothing only, nothing the text does not say.",
            ...outfits.map(o => `${o.name}: ${o.outfit}`)
        );
    }
    if (looks.length) {
        if (String(sheets || "").trim()) parts.push(`<Character_Sheets>\n${String(sheets).trim()}\n</Character_Sheets>`);
        parts.push(
            `Write the permanent appearance of ${looks.join(", ")} as booru tags, from the story and the sheets: sex and apparent age, hair, eyes, skin, face, build, permanent features. No clothing, expressions, poses or count tags. Skip anyone the text does not describe.`
        );
    }
    parts.push(
        "",
        "Answer in this shape and nothing else:",
        "<Image_Prompt>the image prompt</Image_Prompt>",
        ...(outfits.length ? ["<Outfit_Tags name=\"Name\">tag, tag, tag</Outfit_Tags>"] : []),
        ...(looks.length ? ["<Character_Visual name=\"Name\">tag, tag, tag</Character_Visual>"] : [])
    );
    return parts.join("\n");
}

/**
 * Splits a combined answer. The prompt is <Image_Prompt> when present;
 * otherwise the whole answer minus any other sections (a model that ignored
 * the shape still gives a usable prompt).
 * @returns {{ prompt: string, rest: string }}
 */
export function splitCombinedAnswer(raw) {
    const text = String(raw || "").replace(/<think\b[^>]*>[\s\S]*?(<\/think\s*>|$)/gi, "");
    const extra = /<(Outfit_Tags|Character_Visual)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|(?=<(?:Outfit_Tags|Character_Visual|Image_Prompt)\b)|$)/gi;
    const rest = (text.match(extra) || []).join("\n");
    const m = text.match(/<Image_Prompt\b[^>]*>([\s\S]*?)(?:<\/Image_Prompt\s*>|(?=<(?:Outfit_Tags|Character_Visual)\b)|$)/i);
    const prompt = (m ? m[1] : text.replace(extra, "")).trim();
    return { prompt, rest };
}
