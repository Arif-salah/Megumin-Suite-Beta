// ─────────────────────────────────────────────────────────────────────────────
// MEGUMIN_SLOT_REGISTRY — every [[placeholder]] the engine knows about.
//
// This is the same idea as MEGUMIN_BLOCK_REGISTRY, applied to the other half of
// the system. A placeholder used to be declared in three hand-maintained lists:
//
//   1. a createOverrideBlock(...) call in ui/devmode.js       (the editor box)
//   2. an entry in the overrides[] array in buildBaseDict.js  (the actual wiring)
//   3. a string in the 60-tag cleanup array in injection.js   (the leak guard)
//
// Only #2 was load-bearing, so forgetting #1 meant an uneditable slot and
// forgetting #3 meant a raw "[[whatever]]" leaking into the model's context.
// Three edits, three chances to miss one, and two of the three failures are
// silent. Everything is now derived from the one entry below.
//
// Adding a placeholder means adding ONE object here. If you find yourself
// editing devmode.js or the cleanup list to introduce a slot, stop — the thing
// you are about to hand-write is meant to be derived.
// ─────────────────────────────────────────────────────────────────────────────

import { addons, blocks, models } from "./database.js";

const addonText = id => addons.find(a => a.id === id)?.content || "";
const blockText = id => blocks.find(b => b.id === id)?.content || "";

// ── Scopes ───────────────────────────────────────────────────────────────────
//
// engine  this engine's own text. Lives on the engine object. Editing it means
//         cloning, exactly as it always has.
// shared  one value for the whole install, stored outside every engine in
//         extension_settings[...].sharedFragments. No engine CONTAINS this
//         text — they all leave the slot for the dictionary to fill — which is
//         why one edit reaches stock V7 and your own clone alike.
// auto    built at generation time by a feature. Read-only in Dev Mode unless
//         the slot is marked overridable, in which case the editor offers an
//         opt-in box that shadows the computed value.
//
export const SLOT_SCOPE = { ENGINE: "engine", SHARED: "shared", AUTO: "auto" };

// ── Gates ────────────────────────────────────────────────────────────────────
//
// What has to be switched on for a slot to reach the prompt at all. These
// MIRROR the conditions in buildBaseDict's overrides[] array — that is the
// point of recording them: the editor can now say "this is currently off and
// your text will not be used", instead of silently accepting an edit that goes
// nowhere. `where` names the tab the reader has to visit to switch it on.
//
const gate = (test, label, where) => ({ test, label, where });

const GATE = {
    think:   gate(p => p.cotEnabled !== false, "Chain of Thought", "Presets & CoT"),
    block:   id => gate(p => (p.blocks || []).includes(id), null, "Blocks"),
    addon:   id => gate(p => (p.addons || []).includes(id), null, "Add-ons"),
    chatter: gate(p => (p.blocks || []).includes("npc_inner_chatter")
                    || (p.blocks || []).includes("npc_inner_chatter_v2"),
                  "NPC Inner Chatter", "Blocks"),
    plan:    gate(p => !!(p.storyPlan && p.storyPlan.enabled), "Story Director", "Story Plan"),
    dnratio: gate(p => !!(p.dnRatio && p.dnRatio.enabled), "Dialogue/Narration ratio", "Global"),
    onomato: gate(p => !!(p.onomatopoeia && p.onomatopoeia.enabled), "Onomatopoeia", "Global"),
    dice:    gate(p => (p.addons || []).includes("dice")
                    || (p.addons || []).includes("dice_all"), "Dice", "Add-ons"),
};


// The chain-of-thought library, offered as a dropdown on the two slots that can
// be filled from it. cot-off is skipped: it exists to mean "no reasoning", and
// picking it would silently empty the box rather than load anything.
const cotPicker = key => () => models
    .filter(m => m.id !== "cot-off" && (m[key] || "").trim() !== "")
    .map(m => ({ label: m.id, value: m[key] }));

export const MEGUMIN_SLOT_REGISTRY = [
    // ── The engine's own voice ───────────────────────────────────────────────
    { key: "p1", trigger: "[[prompt1]]", structural: true, label: "Prompt 1", scope: "engine", group: "engine",
      hint: "The first thing the model reads. Sets the ground rules." },
    { key: "p2", trigger: "[[prompt2]]", structural: true, hidden: true, label: "Prompt 2", scope: "engine", group: "engine",
      hint: "Runs straight on from the opening rules." },
    { key: "p3", trigger: "[[prompt3]]", structural: true, label: "Prompt 3", scope: "engine", group: "engine",
      hint: "Closes the first system message." },
    { key: "p4", trigger: "[[prompt4]]", structural: true, label: "Prompt 4", scope: "engine", group: "engine",
      hint: "How the model is meant to write. Usually the longest section." },
    { key: "p5", trigger: "[[prompt5]]", structural: true, label: "Prompt 5", scope: "engine", group: "engine",
      hint: "How characters act and what the model may decide on its own." },
    { key: "p6", trigger: "[[prompt6]]", structural: true, label: "Prompt 6", scope: "engine", group: "engine",
      hint: "The last of the engine's own instructions." },
    { key: "main", trigger: "[[main]]", hidden: true, label: "Personality", scope: "auto", group: "engine",
      where: "Personality",
      hint: "Comes from the Personality tab. Blanked entirely on V6 and newer engines." },
    { key: "A1", trigger: "[[AI1]]", structural: true, hidden: true, label: "Model Acknowledgement 1", scope: "engine", group: "engine",
      advanced: true, hint: "A fake reply from the model, agreeing that it read the rules." },
    { key: "A2", trigger: "[[AI2]]", structural: true, hidden: true, label: "Model Acknowledgement 2", scope: "engine", group: "engine",
      advanced: true, hint: "The second fake acknowledgement." },

    // ── Reasoning ────────────────────────────────────────────────────────────
    { key: "cot", trigger: "[[COT]]", label: "Chain of Thought", scope: "engine", group: "reasoning",
      carrier: "think",
      picker: { label: "Load from a chain-of-thought", options: cotPicker("content") },
      hint: "The reasoning script the model works through before it writes. Engine-specific, because it is written to match the engine's own rules." },
    { key: "prefill", trigger: "[[prefill]]", label: "Prefill", scope: "engine", group: "reasoning",
      picker: { label: "Load from a chain-of-thought", options: cotPicker("prefill") },
      hint: "Words put into the model's mouth to start its reply." },
    { key: "think", trigger: "[[THINK]]", label: "Thinking Tags", scope: "shared", group: "reasoning",
      gate: GATE.think,
      hint: "The tags the reasoning is wrapped in. {Thinking} marks where the engine's Chain of Thought is dropped in — keep it, or the script has nowhere to go.",
      fallback: () => "<think>\n<think>\n<think>\n{Thinking}\n</think>" },

    // ── Shared fragments: one value, every engine ────────────────────────────
    { key: "death", trigger: "[[death]]", label: "Death System", scope: "shared", group: "systems",
      gate: GATE.addon("death"), hint: "What happens when a character should die.",
      fallback: () => addonText("death") },
    { key: "combat", trigger: "[[combat]]", label: "Combat System", scope: "shared", group: "systems",
      gate: GATE.addon("combat"), hint: "How fights are resolved.",
      fallback: () => addonText("combat") },
    { key: "html", trigger: "[[html]]", label: "Immersive HTML", scope: "shared", group: "systems",
      gate: GATE.addon("html"),
      hint: "Lets the model draw a screen, letter or sign as real HTML instead of describing it.",
      fallback: () => addonText("html") },
    { key: "dice", trigger: "[[dice]]", label: "Dice", scope: "shared", group: "systems",
      gate: GATE.dice,
      hint: "How the model must use the d20 rolls it is handed each turn. Keep the [[dice_rolls]] marker — this turn's numbers are dropped in there.",
      // Two add-ons share the [[dice]] anchor and are mutually exclusive, so the
      // default shown depends on which variant is switched on. That is why the
      // fallback takes the profile.
      fallback: p => addonText((p && (p.addons || []).includes("dice_all")) ? "dice_all" : "dice"),
      presets: [
          { label: "Player only (3 rolls)", value: () => addonText("dice") },
          { label: "Everyone (6 rolls)", value: () => addonText("dice_all") },
      ] },
    { key: "direct", trigger: "[[Direct]]", label: "Direct Language", scope: "shared", group: "systems",
      gate: GATE.addon("direct"), hint: "Blunt anatomical wording instead of euphemism.",
      fallback: () => addonText("direct") },
    { key: "dn", trigger: "[[DN]]", label: "Dialogue / Narration Tags", scope: "shared", group: "format",
      gate: GATE.addon("dn"), hint: "Wraps speech and narration in tags so the chat can style them.",
      fallback: () => addonText("dn") },
    { key: "dialogueColor", trigger: "[[COLOR]]", label: "Dialogue Colours", scope: "shared", group: "format",
      gate: GATE.addon("color"), hint: "Gives each speaker their own colour.",
      fallback: () => addonText("color") },
    { key: "onomato", trigger: "[[onomato]]", label: "Onomatopoeia", scope: "shared", group: "format",
      gate: GATE.onomato, hint: "Asks for real sound words rather than descriptions of sound.",
      fallback: () => "- Narration must utilize onomatopoeia. Use precise, context-specific phonetic representations for physical interactions (e.g., the click of a latch, the thud of a heavy object, the soughing of wind) rather than abstract descriptions of sound." },
    { key: "dnratio", trigger: "[[DNRATIO]]", label: "Dialogue / Narration Ratio", scope: "shared", group: "format",
      gate: GATE.dnratio, hint: "How much of a reply should be speech versus description.",
      fallback: () => "Ratio: Maintain a balance of 50% Dialogue and 50% Narration." },
    { key: "banlist", trigger: "[[banlist]]", label: "Ban List (your additions)", scope: "shared", group: "format",
      hint: "Added to the end of the built-in ban list. The built-in part lives in the preset and is not edited here.",
      fallback: () => "" },

    // ── Shared fragments that happen to be output blocks ─────────────────────
    { key: "info", trigger: "[[infoblock]]", carrier: "blocks", label: "World State Block", scope: "shared", group: "blocks",
      gate: GATE.block("info"), hint: "The scene board printed under each reply.",
      fallback: () => blockText("info") },
    { key: "cyoa", trigger: "[[cyoa]]", carrier: "blocks", label: "Choice Block", scope: "shared", group: "blocks",
      gate: GATE.block("cyoa"), hint: "The numbered options offered at the end of a reply.",
      fallback: () => blockText("cyoa") },
    { key: "mvu", trigger: "[[MVU]]", label: "MVU Variables", scope: "shared", group: "blocks",
      gate: GATE.block("mvu"), hint: "The contract with the MVU extension.",
      fallback: () => blockText("mvu") },
    { key: "npc_inner_chatter", trigger: "[[npc_inner_chatter]]", carrier: "blocks", label: "NPC Inner Chatter",
      scope: "shared", group: "blocks", gate: GATE.chatter,
      hint: "What the NPCs are privately thinking.",
      fallback: () => blockText("npc_inner_chatter"),
      presets: [
          { label: "Default", value: () => blockText("npc_inner_chatter") },
          { label: "Simple", value: () => blockText("npc_inner_chatter_v2") },
      ] },
    { key: "storytracker", trigger: "[[storytracker]]", carrier: "blocks", label: "Story Tracker", scope: "shared", group: "blocks",
      gate: GATE.plan, hint: "Arc, chapter and secrets, printed for the Story Director.",
      fallback: () => "# at the very end of the response put this block:\n<Story_Tracker>\narc: The Arc that is now active.\nchapter: The chapter that is now active.\nEpisode: The episode that is now active.\nSecrets: Any secret that the user/{{user}} doesn't know.\n</Story_Tracker>" },

    // ── Computed from your settings. Overridable, but rarely worth it ────────
    { key: "language", trigger: "[[Language]]", label: "Language Rule", scope: "auto", group: "global",
      overridable: true, where: "Global",
      hint: "Built from the language you picked in the Global tab." },
    { key: "pronouns", trigger: "[[pronouns]]", label: "Your Pronouns", scope: "auto", group: "global",
      overridable: true, where: "Global",
      hint: "Built from the pronouns you picked in the Global tab." },
    { key: "count", trigger: "[[count]]", label: "Word Count", scope: "auto", group: "global",
      overridable: true, deprecated: true, where: "Presets & CoT",
      hint: "Superseded by Length in Story Config. Always sent empty unless you override it here." },

    // ── Filled live by a feature. Nothing to edit ────────────────────────────
    { key: null, trigger: "[[config]]", label: "Story Config", scope: "auto", group: "live", where: "Presets & CoT",
      hint: "The <config> block built from your Story Config choices." },
    { key: null, trigger: "[[blocks]]", label: "Output Blocks", scope: "auto", group: "live", where: "Blocks",
      hint: "The whole <Blocks> envelope, assembled from the blocks you switched on." },
    { key: null, trigger: "[[long-Memory]]", label: "Long-term Memory", scope: "auto", group: "live", where: "Memory",
      hint: "Archived summaries pulled from the vault for this turn." },
    { key: null, trigger: "[[Short-memory]]", label: "Short-term Memory", scope: "auto", group: "live", where: "Memory",
      hint: "Recent chat kept verbatim." },
    { key: null, trigger: "[[npc list]]", label: "NPC List", scope: "auto", group: "live", where: "NPC",
      hint: "The NPCs judged relevant to the current scene." },
    { key: null, trigger: "[[npc_dossier]]", label: "NPC Dossier Rules", scope: "auto", group: "live", where: "NPC",
      hint: "Instructions for keeping dossiers up to date. Not the dossiers themselves." },
    { key: null, trigger: "[[npc_events]]", label: "Organic NPCs & Events", scope: "auto", group: "live",
      where: "Add-ons", gate: GATE.addon("npc_events"),
      hint: "Stops new characters appearing out of nowhere." },
    { key: null, trigger: "[[storyplan]]", label: "Story Plan", scope: "auto", group: "live", where: "Story Plan",
      gate: GATE.plan, hint: "The current directive from the Story Director." },
    { key: null, trigger: "[[img1]]", label: "Image Rules", scope: "auto", group: "live", where: "Image Gen",
      hint: "Instructions for emitting image prompts." },
    { key: null, trigger: "[[aiprompt]]", label: "Narration Style", scope: "auto", group: "live",
      where: "Writing Style",
      hint: "Your writing style, wrapped differently depending on the engine generation." },
    { key: null, trigger: "[[OOC]]", label: "OOC Protocol", scope: "auto", group: "live", where: "Global",
      hint: "Out-of-character directives. Blanked on V8 and V9." },
    { key: null, trigger: "[[control]]", label: "Control Protocol", scope: "auto", group: "live", where: "Global",
      hint: "Who may act for whom. Blanked on V8 and V9." },
];

// ── Derived views. Never hand-maintain these ────────────────────────────────

/**
 * Every trigger the injector must strip if nothing filled it. Replaces the
 * 60-string array that used to sit inline in injection.js.
 */
export function meguminAllSlotTriggers() {
    const out = new Set();
    MEGUMIN_SLOT_REGISTRY.forEach(s => out.add(s.trigger));
    // Numbered twins: some presets emit a block a second time further down.
    ["[[infoblock2]]", "[[cyoa2]]", "[[storytracker2]]", "[[npc_inner_chatter2]]",
        "[[npc_dossier2]]", "[[img2]]", "[[dice_rolls]]", "[[npc_updates]]", "[[order]]",
        "[[v9_lean_min]]", "[[v9_lean_max]]", "[[v9_full_min]]", "[[v9_full_max]]"]
        .forEach(t => out.add(t));
    // The bare-bracket spellings an older preset generation used.
    for (let i = 1; i <= 6; i++) out.add(`[prompt${i}]`);
    return [...out];
}

/**
 * The slots buildBaseDict's override pass may take from an engine or from the
 * shared bucket.
 *
 * Structural slots are excluded. p1..p6 and AI1/AI2 are written a few lines
 * earlier by hand, and that code does more than a plain assignment: the p1..p6
 * loop also fills the bare-bracket twin [prompt1] that older presets use, and
 * it writes even when the value is empty so an unused tag still gets blanked.
 * Running them through here as well would be a redundant second write, which is
 * exactly the kind of "two places set the same thing" this registry exists to
 * remove.
 */
export function meguminOverridableSlots() {
    return MEGUMIN_SLOT_REGISTRY.filter(s =>
        s.key && !s.structural && (s.scope !== "auto" || s.overridable));
}

/**
 * The add-ons: the slots Dev Mode lets you edit on their own, independently of
 * any engine. Shared fragments plus the handful of computed slots that accept
 * an override.
 *
 * Hidden slots are excluded. [[prompt2]] and [[main]] are used by exactly one
 * generation -- the V4/V5 engines flagged devLegacy -- and Dev Mode no longer
 * offers those for editing, so drawing their slots would be drawing controls
 * that can never apply to anything you can open. They stay in the registry
 * regardless, because the preset still contains both tags and the injector's
 * leak guard is derived from this same list.
 */
export function meguminAddonSlots() {
    return MEGUMIN_SLOT_REGISTRY.filter(s =>
        !s.hidden && (s.scope === "shared" || (s.scope === "auto" && s.overridable)));
}

/** The slots an engine owns and Dev Mode draws inline. */
export function meguminEngineSlots() {
    return MEGUMIN_SLOT_REGISTRY.filter(s => !s.hidden && s.scope === "engine");
}

/** Engines Dev Mode offers as a starting point. */
export function meguminIsDevEditableMode(mode) {
    return !!mode && mode.devLegacy !== true;
}

export function meguminSlotByTrigger(trigger) {
    return MEGUMIN_SLOT_REGISTRY.find(s => s.trigger === trigger) || null;
}

export function meguminSlotByKey(key) {
    return MEGUMIN_SLOT_REGISTRY.find(s => s.key === key) || null;
}

/**
 * Is this slot's toggle currently on? Slots with no gate are always live.
 * A throwing gate reports live: a broken predicate must not make the editor
 * claim a slot is dead when the engine would happily use it.
 */
export function meguminSlotIsLive(slot, profile) {
    if (!slot || !slot.gate || !profile) return true;
    try { return !!slot.gate.test(profile); } catch { return true; }
}

/**
 * Which slot a custom module hangs off.
 *
 * Modules used to be nailed to p3, p5 and p6, because those were the only
 * positions the old editor drew an insert point at. They can now attach to any
 * slot, so the stored value is a full trigger. Older engines stored "p3", and
 * they keep working: anything that is not already bracketed is read as the old
 * spelling. buildBaseDict and the editor both come here rather than each
 * rebuilding the string, which is how the two used to drift.
 */
export function meguminModuleTrigger(attachPoint) {
    if (!attachPoint) return null;
    if (attachPoint.startsWith("[[")) return attachPoint;
    const n = String(attachPoint).replace(/^p/, "");
    return `[[prompt${n}]]`;
}

export const SLOT_GROUPS = [
    { id: "engine", label: "The Engine's Own Rules", hint: "Belongs to this engine. Editing means saving your own copy." },
    { id: "reasoning", label: "Reasoning" },
    { id: "systems", label: "Systems" },
    { id: "format", label: "Formatting" },
    { id: "blocks", label: "Output Blocks" },
    { id: "global", label: "Built From Your Settings" },
    { id: "live", label: "Filled In Automatically" },
];
