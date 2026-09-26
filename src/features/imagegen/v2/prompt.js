// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 — prompt assembly. Pure: takes the cast and settings, returns
// strings. {{user}} is left for the caller to substitute.
// ────────────────────────────────────────────────────────────────────────────

import { IMAGE_V2_PROMPTS as P } from "../../../prompts/imageGenV2.js";

export const V2_STYLES = ["tags", "natural"];
export const V2_SHOTS = ["cinematic", "pov", "portrait"];

/**
 * @typedef {Object} ImageCastMember
 * @property {string}   name
 * @property {string[]} [aliases]
 * @property {boolean}  [isPc]
 * @property {boolean}  [inScene]
 * @property {boolean}  [mentioned]  absent, but named in the recent text
 */

/** <Cast>: the player, who is in the scene, and absent characters just mentioned. */
export function renderCastList(cast, { shot = "cinematic" } = {}) {
    const lines = [];
    for (const c of cast || []) {
        if (!c || !c.name) continue;
        if (!c.isPc && !c.inScene && !c.mentioned) continue;
        // POV: the player is the camera, so they are not offered as a subject.
        if (c.isPc && shot === "pov") continue;
        const aka = (c.aliases || []).filter(Boolean);
        const name = `@${c.name}${aka.length ? ` (also ${aka.map(a => `@${a}`).join(", ")})` : ""}`;
        const where = c.isPc ? "the player" : c.inScene ? "in the scene" : "not in the scene";
        lines.push(`${name}: ${where}`);
    }
    return lines.length ? `<Cast>\n${lines.join("\n")}\n</Cast>` : "";
}

/** The style guide (structure + example + rules), the shot line, extra instructions. */
export function renderV2Rules({ style = "tags", shot = "cinematic", extra = "" } = {}) {
    const parts = [P.style[style] || P.style.tags, P.shot[shot] || P.shot.cinematic];
    if (String(extra || "").trim()) parts.push(`Extra instructions: ${String(extra).trim()}`);
    return parts.join("\n");
}

/**
 * The manual button's quiet generation.
 * @returns {{ system: string, user: string }}
 */
export function renderV2ManualPrompt({ castList = "", scene = "", story = "", rules = "" } = {}) {
    const user = [
        castList,
        scene ? `<Scene>\n${scene}\n</Scene>` : "",
        `<Recent_Story>\n${String(story || "").trim()}\n</Recent_Story>`,
        rules,
        P.manualTask
    ].filter(Boolean).join("\n\n");
    return { system: P.system, user };
}

/** [[img1]]: the inline instruction the story model reads. */
export function renderV2InlineInstruction({ conditionalText = "", imageCount = 1, castList = "", rules = "" } = {}) {
    const head = P.inlineHead
        .replace("{{conditionalText}}", conditionalText || "")
        .replace("{{imageCount}}", String(imageCount || 1));
    return [head, castList, rules, P.inlineTail].filter(Boolean).join("\n");
}
