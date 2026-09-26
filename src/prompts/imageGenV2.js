// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 prompts (plan 006, B2).
//
// One short base, one style block (Tags / Natural), one shot block (Cinematic /
// POV / Portrait) — instead of six long combined templates. Framing rule: the
// model is never told about an extension or anything "filling in" for it;
// @Name simply stands for a character.
// ────────────────────────────────────────────────────────────────────────────

export const IMAGE_V2_PROMPTS = {
    system:
        "You write image prompts for moments from an ongoing story: who is in the shot, what they are doing, " +
        "their expressions and poses, the place, the light and the framing.",

    baseRules: [
        "## Image prompt rules",
        "@Name stands for that character's full appearance and current clothing, exactly as they look in the story.",
        "- Put each character who is in the shot in the prompt as @Name, using the names in <Cast>.",
        "- Never describe a @Name character's hair, eyes, face, skin, body or clothes; @Name already carries them.",
        "- If someone's clothing is not what they normally wear at this moment (undressing, soaked, torn, a towel), write @Name.look and then describe the clothing as it is right now.",
        "- Only put in characters who are actually in this shot. Two at most works best."
    ].join("\n"),

    style: {
        tags: [
            "- Write comma-separated booru tags on one line.",
            "- Start with who is in the shot: 1girl, 1boy, 2girls, 1girl 1boy, no humans… then the @Name of each character.",
            "- Then pose and action, expression, how they interact; then the place, time of day and lighting; then camera and framing tags.",
            "- No quality tags (masterpiece, best quality…); leave them out."
        ].join("\n"),
        natural: [
            "- Write 2 to 4 plain sentences describing the image.",
            "- Name each character as @Name where they appear in the sentence.",
            "- Describe the action, expressions, the place, the light and the camera angle."
        ].join("\n")
    },

    shot: {
        cinematic: "- Frame it like a film still. Choose a wide, medium or close shot to suit the moment, with a composition that tells what is happening.",
        pov: "- The camera is {{user}}'s eyes. {{user}} is never written as @Name and never seen, except their hands or body from first person when they touch something. Include pov and what {{user}} is looking at.",
        portrait: "- One character, head-and-shoulders or chest-up, focused on face and expression, with a simple background from the place."
    },

    manualTask: "Write the image prompt for the latest moment. Output only the prompt, nothing else.",

    inlineHead: "### IMAGE\n{{conditionalText}}Within your response, insert {{imageCount}} image tag(s) like this: <img prompt=\"...\"> at the moment the image shows.",
    inlineTail: "Inside prompt=\"...\", never use double quotes."
};
