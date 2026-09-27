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
    // A blank line, so the shot line never reads as part of the example above it.
    return parts.join("\n\n");
}

const previousBlock = previous =>
    `<Previous_Image_Prompt>\n${String(previous || "").trim() || "(none yet: this is the first image)"}\n</Previous_Image_Prompt>`;

/** <Character_Sheets>: always BEFORE the story, never among the tasks. */
export function renderSheetsBlock(sheets) {
    const s = String(sheets || "").trim();
    return s ? `<Character_Sheets>\n${s}\n</Character_Sheets>` : "";
}

/**
 * The manual button's quiet generation. Reference material first (cast,
 * sheets, scene, story), the tasks together at the end.
 * @returns {{ system: string, user: string }}
 */
export function renderV2ManualPrompt({ castList = "", sheets = "", scene = "", earlier = "", last = "", rules = "", method = "placeholders", previous = "", extras = "" } = {}) {
    const user = [
        castList,
        renderSheetsBlock(sheets),
        scene ? `<Scene>\n${scene}\n</Scene>` : "",
        String(earlier || "").trim() ? `<Earlier_Story>\n${String(earlier).trim()}\n</Earlier_Story>` : "",
        `<Last_Message>\n${String(last || "").trim()}\n</Last_Message>`,
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
 * The instructions for the extra sections (no heading, no answer shape).
 * @param {{ outfits?: Array<{ name: string, outfit: string }>, looks?: string[], followUpdate?: boolean }} needs
 *   followUpdate: in a combined call, also give tags for every outfit the World_Update changes
 */
export function renderV2ExtraTasks({ outfits = [], looks = [], followUpdate = false } = {}) {
    const parts = [];
    if (outfits.length || followUpdate) {
        const who = followUpdate
            ? `for every character whose Outfit your World_Update changes${outfits.length ? ", and for these outfits" : ""}`
            : "for these outfits";
        parts.push(`- Outfit tags ${who}: one booru tag per garment or accessory, with its colour or material; keep the state of dress; clothing only, nothing the text does not say.`);
        parts.push(...outfits.map(o => `  ${o.name}: ${o.outfit}`));
    }
    if (looks.length) {
        parts.push(`- Appearance of ${looks.join(", ")} as booru tags, from the story and <Character_Sheets>: sex and apparent age, hair, eyes, skin, face, build, permanent features. No clothing, expressions, poses or count tags. Skip anyone the text does not describe.`);
    }
    return parts.join("\n");
}

/** The answer-shape lines for the extra sections that were asked for. */
export function renderV2ExtraShape({ outfits = [], looks = [], followUpdate = false } = {}) {
    return [
        ...(outfits.length || followUpdate ? ["<Outfit_Tags name=\"Name\">tag, tag, tag</Outfit_Tags>"] : []),
        ...(looks.length ? ["<Character_Visual name=\"Name\">tag, tag, tag</Character_Visual>"] : [])
    ];
}

/**
 * The extras for a normal (image-only) call: tasks and answer shape.
 * The sheets the looks need go BEFORE the story (renderV2ManualPrompt), not here.
 * @param {{ outfits?: Array<{ name: string, outfit: string }>, looks?: string[] }} needs
 * @returns {string} "" when nothing extra is needed
 */
export function renderV2Extras({ outfits = [], looks = [] } = {}) {
    if (!outfits.length && !looks.length) return "";
    return [
        "## In the same answer",
        renderV2ExtraTasks({ outfits, looks }),
        "",
        "Answer in this shape and nothing else:",
        "<Image_Prompt>the image prompt</Image_Prompt>",
        ...renderV2ExtraShape({ outfits, looks })
    ].join("\n");
}

const OTHER_SECTIONS = /<(Outfit_Tags|Character_Visual|World_Update|World_State)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|(?=<(?:Outfit_Tags|Character_Visual|Image_Prompt|World_Update|World_State)\b)|$)/gi;

/**
 * Splits a combined answer. The prompt is <Image_Prompt> when present;
 * otherwise the whole answer minus every other section (a model that ignored
 * the shape still gives a usable prompt). `rest` holds the extra sections.
 * @returns {{ prompt: string, rest: string }}
 */
export function splitCombinedAnswer(raw) {
    const text = String(raw || "").replace(/<think\b[^>]*>[\s\S]*?(<\/think\s*>|$)/gi, "");
    const extra = /<(Outfit_Tags|Character_Visual)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|(?=<(?:Outfit_Tags|Character_Visual|Image_Prompt|World_Update|World_State)\b)|$)/gi;
    const rest = (text.match(extra) || []).join("\n");
    const m = text.match(/<Image_Prompt\b[^>]*>([\s\S]*?)(?:<\/Image_Prompt\s*>|(?=<(?:Outfit_Tags|Character_Visual|World_Update|World_State)\b)|$)/i);
    // No wrapper: everything outside the other sections. With a prefill the
    // answer starts INSIDE the World block (no opening tag), so everything up
    // to its closing tag goes too.
    let body = text;
    const close = body.search(/<\/World_(Update|State)\s*>/i);
    if (close >= 0 && !/<World_(Update|State)\b/i.test(body.slice(0, close))) body = body.slice(body.indexOf(">", close) + 1);
    const prompt = (m ? m[1] : body.replace(OTHER_SECTIONS, "")).trim();
    return { prompt, rest };
}

// ── World State + image in one call (Chomusuke "Combine calls") ──────────
// On a reply that gets an automatic image, one Chomusuke call does the World
// State read AND the image prompt (and, on V2, outfit tags and missing looks).
// Reference material first, the tasks together at the end, then the shape.

export const COMBINED_SYSTEM =
    "You are a continuity clerk and image prompt writer for an ongoing roleplay. You read the latest exchange, " +
    "note what it changed in the world, and write an image prompt for the moment it ends on. " +
    "You never write story, never explain, and never add facts the exchange does not state or clearly show.";

/**
 * @param {{
 *   notes: string,            // the continuity notes as a reader sees them (renderClerkNotes)
 *   castList?: string,        // V2 only
 *   sheets?: string,          // character and persona sheets (before the story)
 *   earlier?: string,         // messages before the latest exchange (context)
 *   exchange: string,         // the latest exchange
 *   world: { rules: string, template: string, tag: string },   // renderWorldClerkTask
 *   engine: "v2"|"classic",
 *   imageRules: string,       // V2: renderV2Rules(...); Classic: its NPC tags + template rules + extra + examples
 *   onlyIfPhoto?: boolean,
 *   extras?: { outfits?: Array<{name: string, outfit: string}>, looks?: string[], followUpdate?: boolean },
 *   previous?: string|null    // V2 "Edit last prompt" method: the previous image prompt
 * }} a
 * @returns {{ system: string, user: string, prefill: string }}
 */
export function renderCombinedPrompt(a) {
    const tag = a.world.tag;
    const v2 = a.engine === "v2";
    const extras = v2 ? (a.extras || {}) : {};
    const extraTasks = v2 ? renderV2ExtraTasks(extras) : "";
    const follow = v2
        ? `<Cast> shows everyone as they stood BEFORE the latest exchange: where your ${tag} changes someone's clothing or position, the image follows your ${tag} (@Name will carry the new outfit).`
        : `Where your ${tag} changes someone's clothing, draw them in the new clothing.`;
    const user = [
        a.notes,
        v2 ? a.castList : "",
        renderSheetsBlock(a.sheets),
        String(a.earlier || "").trim() ? `<Earlier_Story>\n${String(a.earlier).trim()}\n</Earlier_Story>` : "",
        `<Latest_Exchange>\n${String(a.exchange || "").trim()}\n</Latest_Exchange>`,
        v2 && a.previous != null ? previousBlock(a.previous) : "",
        `# Task 1: ${tag === "World_State" ? "World State" : "World Update"}\n${a.world.rules}`,
        [
            "# Task 2: Image prompt",
            `The image shows the moment the latest exchange ends on; draw nothing that has already ended (someone who put an item away no longer holds it). ${follow}`,
            a.imageRules,
            a.onlyIfPhoto ? "If nobody in the latest exchange takes, sends or shares a picture, write <Image_Prompt>NONE</Image_Prompt>." : ""
        ].filter(Boolean).join("\n"),
        extraTasks ? `# Also in the same answer\n${extraTasks}` : "",
        [
            "# Answer in this shape and nothing else",
            a.world.template,
            "<Image_Prompt>the image prompt</Image_Prompt>",
            ...(v2 ? renderV2ExtraShape(extras) : [])
        ].join("\n")
    ].filter(s => String(s || "").trim()).join("\n\n");
    return { system: COMBINED_SYSTEM, user, prefill: `<${tag}>\n` };
}
