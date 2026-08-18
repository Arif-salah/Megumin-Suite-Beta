// ──────────────────────────────────────────────────────────────────────────────
// Story Config — the field definitions and the block they compile into.
//
// Data and pure derivations only. The tab that edits them is UI and stays out.
// profile.js needs normalizeStoryConfig on load and buildBaseDict needs
// buildConfigBlock, so this layer sits below both.
// ──────────────────────────────────────────────────────────────────────────────


import { extension_settings } from "../../st.js";
import { extensionName } from "../../core/constants.js";

// The preamble is always emitted whenever the block is emitted at all.
export const CONFIG_PREAMBLE = `These are standing settings for this story. Where a setting here contradicts anything above, this block wins. These apply to the whole story, not a single scene.`;

// Every field is a single string on localProfile.storyConfig.
// Empty string = the field is off and its line never reaches the prompt.
// "select" fields offer a Custom… escape hatch so a user can write their own sentence
// ("hard. the world is against {{user}}") instead of the canned value.
export const storyConfigFields = [
    {
        key: "genre", tag: "genre", label: "Genre", icon: "fa-masks-theater", color: "#f59e0b", type: "text",
        placeholder: "e.g. horror, romance",
        aiNote: "sets the conventions the story plays straight, never comments on",
        hint: "The story's genre and the conventions that come with it. Played straight, never commented on.",
        chips: ["slice of life", "noir", "horror", "romance", "workplace comedy", "political thriller", "survival", "dark fantasy", "sci-fi", "mystery", "adventure", "tragedy"]
    },
    {
        key: "culture", tag: "culture", label: "Culture & Setting", icon: "fa-globe", color: "#22c55e", type: "text",
        placeholder: "e.g. Japanese, Western",
        aiNote: "the cultural world — names, honorifics, food, manners, idiom",
        hint: "The cultural world the story runs on — names, honorifics, food, manners, social rules and the idiom people speak in. Works with era to place the story.",
        chips: [
            "Japanese", "Korean", "Chinese", "wuxia / xianxia", "Southeast Asian", "Indian",
            "Middle Eastern", "North African", "West African", "Latin American", "Brazilian",
            "American", "Wild West frontier", "British", "Irish", "French", "Italian",
            "Mediterranean", "Nordic", "Slavic", "Greco-Roman", "high fantasy European",
            "steampunk Victorian", "cyberpunk East Asian", "post-Soviet"
        ]
    },
    {
        key: "era", tag: "era", label: "Era", icon: "fa-hourglass-half", color: "#d97706", type: "text",
        placeholder: "e.g. 1980s",
        aiNote: "the period the world runs on",
        hint: "The year or period the world runs on.",
        chips: ["ancient", "medieval", "renaissance", "victorian", "1920s", "1950s", "1970s", "1980s", "1990s", "present day", "near future", "far future", "post-apocalyptic"]
    },
    {
        key: "pov", tag: "pov", label: "Point of View", icon: "fa-eye", color: "#3b82f6", type: "select",
        hint: "Narrative person and where the camera sits. Never loosens the {{user}} boundary.",
        customPlaceholder: "e.g. third limited, sitting behind Maya's eyes",
        options: [
            "second person on {{user}}",
            "third limited",
            "third limited following one NPC",
            "third omniscient",
            "first person",
            "roving"
        ]
    },
    {
        key: "focus", tag: "focus", label: "Focus", icon: "fa-crosshairs", color: "#eab308", type: "text",
        placeholder: "e.g. the camera follows Maya",
        aiNote: "whose story the camera favours",
        hint: "Whose story this is, if the camera should favour someone other than {{user}}. Name them.",
        chips: []
    },
    {
        key: "tone", tag: "narration tone", label: "Narration Tone", icon: "fa-cloud-sun-rain", color: "#a855f7", type: "text",
        placeholder: "e.g. bleak, absurd",
        aiNote: "the emotional weather over everything; overrides the default register",
        hint: "The mood that sits over the whole story, whatever is happening in a given scene.",
        chips: ["warm", "bleak", "absurd", "tense", "melancholy", "playful", "dreamlike", "clinical", "wistful", "manic"]
    },
    {
        key: "narratorPresence", tag: "narrator_presence", label: "Narrator Presence", icon: "fa-comment-dots", color: "#14b8a6", type: "select",
        aiNote: "how visible the narrator's attitude is",
        customPlaceholder: "e.g. heavy. comment on everything",
        hint: "How visible the narrator's attitude is. Light is your preset default.",
        defaultLabel: "light",
        defaultAliases: ["light", "light (one beat per response)", "light (default: one beat per response)"],
        options: [
            "invisible (report only, no coloring)",
            "heavy (commentary throughout)"
        ]
    },
    {
        key: "npcSpeechStyle", tag: "npc_speech_style", label: "NPC Speech Style", icon: "fa-quote-left", color: "#0ea5e9", type: "text",
        placeholder: "e.g. 1980s poetic",
        aiNote: "how NPCs sound when they speak",
        hint: "Override how the NPCs sound.",
        chips: ["medieval poetic", "shakespearean", "victorian formal", "1920s slang", "1970s street", "1980s poetic", "modern casual", "corporate", "military clipped", "rural drawl", "cyberpunk street", "archaic high fantasy"]
    },
    {
        key: "npcDisposition", tag: "npc_disposition", label: "NPC Disposition", icon: "fa-users", color: "#8b5cf6", type: "select",
        aiNote: "the cast's starting stance toward {{user}}; individuals still move based on what they actually do",
        customPlaceholder: "e.g. cold. the NPCs don't like {{user}}",
        hint: "How the cast feels about {{user}} before they earn anything else. Ordinary is your preset default.",
        defaultLabel: "ordinary",
        defaultAliases: ["ordinary"],
        options: [
            "warm",
            "wary",
            "cold",
            "hostile"
        ]
    },
    {
        key: "difficulty", tag: "difficulty", label: "Difficulty", icon: "fa-mountain", color: "#ef4444", type: "select",
        aiNote: "how hard the world pushes back on what {{user}} attempts",
        customPlaceholder: "e.g. hard. the world is against {{user}}",
        hint: "How hard the world pushes back on what {{user}} attempts. Realistic is your preset default.",
        defaultLabel: "realistic",
        defaultAliases: ["realistic", "realistic (default)"],
        options: [
            "forgiving (most attempts land)",
            "harsh (competence required, failure common, mistakes carry a real cost)"
        ]
    },
    {
        key: "friction", tag: "friction", label: "Friction", icon: "fa-bolt", color: "#f97316", type: "select",
        aiNote: "how often complications arrive",
        customPlaceholder: "e.g. high. trouble is always around the corner",
        hint: "How often trouble arrives. Normal is your preset default.",
        defaultLabel: "normal",
        defaultAliases: ["normal", "normal (the preset's own curve)"],
        options: [
            "low (only ever as earned consequence)",
            "high (complications every scene, pressure never fully releasing)"
        ]
    },
    {
        key: "explicitness", tag: "explicitness", label: "Explicitness", icon: "fa-fire", color: "#e11d48", type: "select",
        aiNote: "how far scenes go and how directly they are written",
        customPlaceholder: "e.g. graphic. give details",
        hint: "How far scenes go and how directly they are written.",
        options: [
            "fade to black",
            "plain",
            "graphic"
        ]
    },
    {
        key: "pace", tag: "pace", label: "Pace", icon: "fa-gauge-high", color: "#10b981", type: "select",
        aiNote: "how fast story time moves and how freely scenes skip ahead",
        customPlaceholder: "e.g. steady, but skip anything that isn't a real beat",
        hint: "How fast story time moves.",
        options: [
            "slow burn",
            "steady",
            "fast"
        ]
    },
    {
        key: "length", tag: "length", label: "Length", icon: "fa-ruler-horizontal", color: "#06b6d4", type: "select",
        aiNote: "target size of each response",
        customPlaceholder: "e.g. around 300 words, longer when a scene earns it",
        hint: "How long each reply should run.",
        options: [
            // Flexible reads as a whole instruction, so its label and value differ.
            { label: "flexible", value: "flexible — as short as 50 words for a quick one-on-one exchange, up to 700 when a scene earns the space. Match the length to what the moment actually needs; never pad to reach a number" },
            "250–350 words",
            "450–550 words",
            "minimum 900 words"
        ]
    },
    {
        key: "notes", tag: "notes", label: "Notes", icon: "fa-note-sticky", color: "#94a3b8", type: "textarea",
        placeholder: "e.g. never let Maya win",
        aiNote: "standing instruction, applies to the whole story",
        hint: "Any standing instruction that doesn't fit a field above."
    }
];

// Starter presets. These are read-only; loading one copies its values into the profile.
export const builtInConfigPresets = [
    {
        id: "cfg_grimdark", name: "Grimdark Survival", builtin: true,
        values: { genre: "survival, dark fantasy", tone: "bleak", pov: "third limited", pace: "steady", length: "450–550 words", difficulty: "harsh (competence required, failure common, mistakes carry a real cost)", friction: "high (complications every scene, pressure never fully releasing)", npcDisposition: "wary", explicitness: "graphic", narratorPresence: "", focus: "", culture: "high fantasy European", era: "", npcSpeechStyle: "", notes: "" }
    },
    {
        id: "cfg_cozy", name: "Cozy Slice of Life", builtin: true,
        values: { genre: "slice of life", tone: "warm", pov: "second person on {{user}}", pace: "slow burn", length: "250–350 words", difficulty: "forgiving (most attempts land)", friction: "low (only ever as earned consequence)", npcDisposition: "warm", explicitness: "fade to black", narratorPresence: "invisible (report only, no coloring)", focus: "", era: "present day", npcSpeechStyle: "modern casual", notes: "" }
    },
    {
        id: "cfg_noir", name: "Noir Mystery", builtin: true,
        values: { genre: "noir, mystery", tone: "melancholy", pov: "first person", pace: "steady", length: "450–550 words", difficulty: "", friction: "", npcDisposition: "wary", explicitness: "plain", narratorPresence: "heavy (commentary throughout)", focus: "", culture: "American", era: "1950s", npcSpeechStyle: "1920s slang", notes: "" }
    },
    {
        id: "cfg_horror", name: "Slow Dread Horror", builtin: true,
        values: { genre: "horror", tone: "tense", pov: "third limited", pace: "slow burn", length: "minimum 900 words", difficulty: "harsh (competence required, failure common, mistakes carry a real cost)", friction: "high (complications every scene, pressure never fully releasing)", npcDisposition: "cold", explicitness: "graphic", narratorPresence: "", focus: "", era: "", npcSpeechStyle: "", notes: "Never resolve a threat in the same scene it appears." }
    },
    {
        id: "cfg_romance", name: "Slow Burn Romance", builtin: true,
        values: { genre: "romance", tone: "warm", pov: "second person on {{user}}", pace: "slow burn", length: "450–550 words", difficulty: "", friction: "", npcDisposition: "", explicitness: "plain", narratorPresence: "", focus: "", era: "", npcSpeechStyle: "", notes: "" }
    }
];

export function getAllConfigPresets() {
    const saved = extension_settings[extensionName].configPresets || [];
    return [...builtInConfigPresets, ...saved];
}

// A field whose value is its own named default (friction "normal", npc_disposition
// "ordinary", narrator_presence "light") is the same as leaving it on Default: the line
// is dropped. This folds those values back to "" so the UI shows Default rather than Custom…
export function normalizeStoryConfig(cfg) {
    if (!cfg) return cfg;
    storyConfigFields.forEach(f => {
        if (!f.defaultAliases) return;
        const v = String(cfg[f.key] || "").trim().toLowerCase();
        if (v && f.defaultAliases.some(a => a.toLowerCase() === v)) cfg[f.key] = "";
    });
    return cfg;
}

export function countActiveConfigFields(cfg) {
    if (!cfg) return 0;
    return storyConfigFields.filter(f => cfg[f.key] && String(cfg[f.key]).trim() !== "").length;
}

// Compiles the profile's storyConfig into the <config> block that replaces [[config]].
// Returns "" when the config is off or every field is empty, so the tag is stripped cleanly.
export function buildConfigBlock(cfg) {
    if (!cfg || !cfg.enabled) return "";

    normalizeStoryConfig(cfg);
    const lines = [];
    storyConfigFields.forEach(f => {
        const raw = cfg[f.key];
        if (!raw || String(raw).trim() === "") return;
        // The asterisked note tells the model what the field governs. pov carries none —
        // the value already says everything it needs to.
        const note = f.aiNote ? ` *${f.aiNote}*` : "";
        lines.push(`- ${f.tag}: ${String(raw).trim()}${note}`);
    });

    if (lines.length === 0) return "";
    return `<config>\n${CONFIG_PREAMBLE}\n\n${lines.join("\n")}\n</config>`;
}
