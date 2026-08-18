// ─────────────────────────────────────────────────────────────────────────────
// NpcBank prompts.
//
// NPC Bank — dossier extraction and the dossier block rules.
//
// The portrait prompts are text moved verbatim out of index.js. These are the
// built-in defaults; a user edit is stored as a diff against them (see
// storage.js).
//
// WHAT CHANGED, AND WHY: `dossierTemplate` used to carry both the rules and the
// fill-in-the-blank template. The template is now GENERATED from the NPC Bank's
// field list (features/npc/fields.js), the same way Bonds and the Character
// Sheet are generated from theirs — so adding a field in the tab reaches the
// prompt without anyone editing prompt text, and the parser, the card and the
// template can no longer drift apart.
//
// What is left here is the part a field list cannot express: when to write a
// dossier at all, and how to think about each kind of field. That stays
// editable. The two generated pieces are dropped in at {{template}} and
// {{persistenceRule}}, each indented to wherever its token sits.
// ─────────────────────────────────────────────────────────────────────────────

export const npcBankPrompts = {
        systemPrompt: "You are an expert AI image prompt engineer specializing in character portraits. Your job is to read a character's dossier and convert their visual description into a highly detailed image generation prompt for a portrait. You must adhere to the requested Style Constraint and Camera Perspective. Do not include quotes, conversational text, or explanations. Output ONLY the raw prompt text.",
        userPrompt: "Write a character portrait image generation prompt based on this NPC's dossier:\n\n<npc_dossier>\n{{npcText}}\n</npc_dossier>\n\nStyle Constraint: {{styleStr}}\nCamera Perspective: {{perspStr}}\nExtra Details: {{extraStr}}\n\nUse the character's appearance, age, sex, occupation, and personality to inform the visual. Output ONLY the raw image prompt text.",
        thinkingPrompt: "<thinking_steps>\nBefore creating the response, think deeply.\n\nThoughts must be wrapped in <think></think>. The first token must be <think>. The main response must immediately follow </think>.\n\n<think>\nReflect in approximately 50-100 words on what this character looks like and what visual elements best capture them.\n\n</think>\n</thinking_steps>\n\n[OUTPUT ORDER]\n    Every response must follow this exact structure in this exact order:\n\n    <think>\n    {Thinking}\n    </think>\n\n    {Main response}",
        dossierRules: `### NPC DOSSIER:
  trigger: >
    Generate EXACTLY ONCE when an NPC meets ALL three conditions in a single scene:
      1. NAMED  — given a proper name or a name the PC will use again.
      2. VOICED — speaks more than a transactional line (not "That'll be 5 credits").
      3. STAKED — has a want, opinion, or role that can affect the story later.
    DO NOT generate for: cashiers, bartenders, guards, crowds, one-line faces,
    or anyone whose only function is set dressing.
    NEVER regenerate for an NPC who already has a dossier.
    treat the original dossier as locked canon.

  format: >
    One <New_NPC> tag per NPC, placed inside the <Blocks> section. Dense,
    dashboard-style. No prose paragraphs except the Background and Secrets
    fields. Everything else is fragments.

  template: |
    {{template}}

  guidelines:
    {{persistenceRule}}
    inner_circle_rule: >
      Include 2–5 people. At least one must be off-screen and unknown to the
      story (a mother, an ex, a childhood friend, a rival). These are future
      plot seeds, not just flavor.
    secrets_rule: >
      Secrets are for YOU as the narrative engine. They drive behavior the PC
      can't predict. Never reveal in narration unless the NPC actually discloses
      them through action or dialogue. Higher tiers stay buried longer.
    canon_lock_rule: >
      Once written, these facts are fixed. Future scenes must stay consistent
      with them. If a later scene needs a contradiction, surface it as a
      revelation (the earlier info was a lie/misunderstanding), never a silent retcon.
    image_tags: 12-20 comma-separated Booru tags. PHYSICAL ONLY. NO clothes/accessories/weapons/bg/pose/expression. MUST read as adult. Order: anchor(1girl/1boy/1other) -> hair(len,style,col) -> eyes(col,shape) -> skin tone -> body(type,build) -> age-app -> marks(scars,freckles,moles,tattoos,birthmarks).
`
};
