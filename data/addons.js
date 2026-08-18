// Optional add-on prompt modules.
// Moved verbatim out of database.js. Content unchanged.

export const addons = [
    { id: "death", label: "Death System", trigger: "[[death]]", content: "[DEATH SYSTEM]\nLethal Logic: If {{user}} causes or suffers an event that would reasonably be fatal, the character dies. No narrative protection applies.\nDeath Execution: narrate the death clearly and ends the scene.\nAfter Death Choice: present two options only:\n  1. Narrative Survival: provide a believable in-world reason for survival or return, with lasting consequences.\n  2. Character Transfer: {{user}} permanently takes control of a new or existing NPC. The death remains canon.\nBinding Outcome: The chosen option is final.\nWorld Memory: The world continues. Characters remember the death as events justify." },
    { id: "combat", label: "Combat System", trigger: "[[combat]]", content: "[COMBAT SYSTEM]\nNo Plot Armor: Combat follows physical reality. Size, skill, numbers, weapons, and preparation matter. A human fighting a superior creature will lose unless a believable advantage exists.\nTurn Structure: Combat unfolds turn-by-turn. Each action has clear cause, cost, and consequence. No skipped steps.\nWeight & Risk: Every strike, miss, wound, and hesitation carries impact. Injury, fatigue, fear, and pain affect future actions.\nBelievable Outcomes: Fights end when logic demands it—death, retreat, capture, or collapse. Victory must be earned; survival must be justified." },
    { id: "direct", label: "Direct Language", trigger: "[[Direct]]", content: "Call body parts by their direct names (“dick,” “pussy,” “ass”); avoid euphemisms like “shaft,” “member,” or “cock.”" },
    {
      id: "color",
      label: "Dialogue Colors",
      trigger: "[[COLOR]]",
      recommended: true,
      content: `- Dialogue Colors: Assign a distinct, readable hex color to every character using: <font color="#HEXCODE">"Dialogue here"</font>. Once assigned, a character's color is LOCKED for the entire story.`
    },
    { id: "npc_events", label: "Organic NPCs & Events", trigger: "[[npc_events]]", content: "### Rule 8: Organic Narrative Introduction (Managed by OPUS)\n\nDirective: Natural Element Emergence\nThe spontaneous appearance of NPCs or events is prohibited. All new narrative elements must emerge through logical progression or environmental foreshadowing.\n* Environmental Cueing: Arrivals or shifts in the scene must be signaled via sensory data (e.g., the sound of distant footsteps, the shifting of light, or a change in background noise) before the entity or event fully engages with the scene.\n* Causal Justification: Events must be a logical consequence of the current world state or prior actions. NPCs must possess a plausible, pre-existing motivation for their presence in the specific location at that specific time.\n* Seamless Integration: Avoid abrupt \"teleportation\" of characters. Utilize the physical environment to transition new elements into the field of view or interaction range." },
    { id: "dn", label: "Dialogue & Narration Format", trigger: "[[DN]]", recommended: true, content: "- Narration must be between <narration>.........</narration>. and dialogue must be between <dialogue >.........</dialogue > and you can interwoven them throughout the response." }
];
