// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 prompts (plan 006, B2).
//
// One structure to fill in and one worked example per style, instead of a list
// of rules: models follow a shape they can see far more reliably than a shape
// they have to infer (the first version, rules only, came back with @Name used
// three times and clothing added after it). The shot choice is one extra line.
//
// Framing rule: the model is never told about an extension or anything
// "filling in" for it; @Name simply stands for a character.
// ────────────────────────────────────────────────────────────────────────────

export const IMAGE_V2_PROMPTS = {
    system:
        "You write image prompts for moments from an ongoing story: who is in the shot, what they are doing, " +
        "their expressions and poses, the place, the light and the framing.",

    style: {
        tags: [
            "## How to write the image prompt",
            "Fill in this structure as ONE line of comma-separated booru tags:",
            "[who is in the shot], [@Name of each character], [pose and action], [expression], [place], [time and lighting], [camera and framing]",
            "",
            "Example (made-up characters; use the names from <Cast>):",
            "1girl, 1boy, @Mira, @Theo, sitting at a table, holding a mug, leaning forward, laughing, looking at another, tavern, night, warm lamplight, medium shot, from side",
            "",
            "Rules:",
            "- [who is in the shot] is the count: 1girl, 1boy, 2girls, 2boys, 1girl 1boy, no humans…",
            "- @Name stands for that character's whole appearance and clothing. Write each @Name once, right after the count, and never again.",
            "- Never write hair, eyes, face, body or clothing tags for a @Name character.",
            "- Write actions as plain tags without names: \"holding hands\", not \"Mira holding Theo's hand\".",
            "- If someone's clothing is different right now (a towel, undressing, soaked, torn), write @Name.look instead of @Name, and put the clothing tags right after it.",
            "- Only characters who are in this shot; two at most works best. Use the names from <Cast>.",
            "- No quality tags (masterpiece, best quality…)."
        ].join("\n"),
        natural: [
            "## How to write the image prompt",
            "Fill in this structure in 2 to 4 plain sentences:",
            "[each character as @Name, what they are doing and their expression] [the place, time and light] [the camera and framing]",
            "",
            "Example (made-up characters; use the names from <Cast>):",
            "@Mira sits at the bar laughing, one hand around a mug, while @Theo leans on the counter and watches her. A warm, lamplit tavern at night, rain streaking the windows. Medium shot from the side.",
            "",
            "Rules:",
            "- @Name stands for that character's whole appearance and clothing. Write each @Name once; after that, use he, she or they.",
            "- Never describe a @Name character's hair, eyes, face, body or clothing.",
            "- If someone's clothing is different right now (a towel, undressing, soaked, torn), write @Name.look instead of @Name and describe the clothing as it is.",
            "- Only characters who are in this shot; two at most works best. Use the names from <Cast>."
        ].join("\n")
    },

    shot: {
        cinematic: "Shot: a film still of the moment. Pick a wide, medium or close shot to suit it.",
        pov: "Shot: through {{user}}'s eyes. Include pov. {{user}} is never written as @Name and never seen, except their hands when they touch something.",
        portrait: "Shot: one character, head-and-shoulders or chest-up, focused on face and expression, with a simple background from the place."
    },

    manualTask: "Write the image prompt for the latest moment. Output only the prompt, nothing else.",

    inlineHead: "### IMAGE\n{{conditionalText}}Within your response, insert {{imageCount}} image tag(s) like this: <img prompt=\"...\"> at the moment the image shows.",
    inlineTail: "Inside prompt=\"...\", never use double quotes."
};
