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
            "[who is in the shot], [@Name, then what only they are doing and their expression], [the next @Name, then theirs], [what they do together], [place], [time and lighting], [camera and framing]",
            "",
            "Example (made-up characters; use the names from <Cast>):",
            "1girl, 1boy, @Mira, laughing, holding a mug, @Theo, leaning on the counter, smiling, looking at another, facing another, tavern, night, warm lamplight, medium shot, from side",
            "",
            "Rules:",
            "- [who is in the shot] is the count: 1girl, 1boy, 2girls, 2boys, 1girl 1boy, no humans… <Cast> says who is male and who is female.",
            "- <Cast> shows each character's look and clothing so you can pick the count and the framing. It is reference only: copy none of it; @Name carries it.",
            "- Always end with the framing (close-up, portrait, upper body, cowboy shot, full body, wide shot…): it decides how much of each character is shown.",
            "- @Name stands for that character's whole appearance and clothing. Write each @Name once and never again.",
            "- One character: add solo after the count.",
            "- Two characters: put the one the moment is about first. Right after each @Name, put what only that character is doing (their pose, their expression, what they hold), so each tag stays with the right person. After both, put what they do together and how they are placed: holding hands, hug, facing another, side-by-side, sitting on lap, looking at another…",
            "- Three or more people: write @Name only for the two the moment is about; everyone else goes in as background tags without @Name (people in background, crowd).",
            "- Never write hair, eyes, face, body or clothing tags for a @Name character. The one exception: when <Cast> says a character's clothing is not noted, put their clothing tags right after their @Name.",
            "- Write actions as plain tags without names: \"holding hands\", not \"Mira holding Theo's hand\".",
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
            "- Never describe a @Name character's hair, eyes, face, body or clothing. The one exception: when <Cast> says a character's clothing is not noted, describe what they wear.",
            "- Two characters: say where each one is (left or right, in front or behind) and give each their own action and expression in their own clause.",
            "- Three or more people: focus on the two the moment is about; mention the rest briefly as background, without @Name.",
            "- Only characters who are in this shot; two at most works best. Use the names from <Cast>.",
            "- <Cast> shows each character's look and clothing so you know who they are. It is reference only: describe none of it; @Name carries it.",
            "- Always say how the shot is framed (close-up, from the waist up, full body, wide shot): it decides how much of each character is shown."
        ].join("\n")
    },

    shot: {
        cinematic: "Shot: a film still of the moment. Pick a wide, medium or close shot to suit it.",
        pov: "Shot: through {{user}}'s eyes. Include pov. {{user}} is never in the shot, except their hands when they touch something.",
        portrait: "Shot: one character, head-and-shoulders or chest-up, focused on face and expression, with a simple background from the place."
    },

    // Reference method (experimental): the model edits the previous image prompt
    // instead of writing placeholders, with the cast as the source of truth.
    reference: {
        head: [
            "## How to write the image prompt",
            "<Previous_Image_Prompt> is the last image made in this story. Write the new image prompt by editing it:",
            "- Keep everything that still holds, word for word: each character's appearance and clothing tags, their order, and the style of the prompt.",
            "- Change only what the new moment changes: who is in the shot, their poses and actions, expressions, the place, the light and the framing.",
            "- Each character's appearance and clothing must match <Cast> exactly. If the previous prompt disagrees with <Cast>, <Cast> is right.",
            "- A character's body tags go in only when the shot shows their body (full body, wide shot, cowboy shot); leave them out of close-ups and portraits.",
            "- Why: the closer the new prompt stays to the previous one, the more consistent the images and the characters stay from one image to the next. Make small edits; do not write a new prompt from scratch.",
            "- With no previous prompt, write a new one, using each character's tags from <Cast> word for word for their appearance and clothing."
        ].join("\n"),
        tags: [
            "- ONE line of comma-separated booru tags. Start with the count (1girl, 1boy, 2boys, 1girl 1boy…; <Cast> says who is male and who is female), then each character's appearance and clothing tags followed by what only they are doing, then what they do together, the place, the light, and the framing last.",
            "- No quality tags (masterpiece, best quality…)."
        ].join("\n"),
        natural: "- 2 to 4 plain sentences: each character's appearance and clothing as in <Cast>, what they are doing, the place, the light, and how the shot is framed."
    },

    manualTask: "Write the image prompt for the latest moment. Output only the prompt, nothing else.",
    manualTaskWithExtras: "Write the image prompt for the latest moment.",

    inlineHead: "### IMAGE\n{{conditionalText}}Within your response, insert {{imageCount}} image tag(s) like this: <img prompt=\"...\"> at the moment the image shows.",
    inlineTail: "Inside prompt=\"...\", never use double quotes."
};
