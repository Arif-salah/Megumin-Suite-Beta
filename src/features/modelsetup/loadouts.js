// ────────────────────────────────────────────────────────────────────────────
// Model Setup (plan 018, phase 5): the tested loadouts and the settings they
// set. Pure: the page (ui.js) hands in what needs SillyTavern (the Story
// Config length sentences). Every value here comes from Desktop/prompt/
// loadouts.md; a loadout recommends, it never locks.
// ────────────────────────────────────────────────────────────────────────────

import { meguminCotForMode } from "../../../data/cot/index.js";
import { directStyles } from "../../../data/directStyles.js";

export const V11_STYLE_IDS = ["dir_v11", "dir_v11_inside"];

// The Story Config length options a loadout picks, by their label.
export const LENGTH_FLEXIBLE = "flexible";
export const LENGTH_SHORT = "250–350 words, longer for fights and sex";

// One row per setting. `tab` is the tab id the row's button opens (and whose
// Global sync a change on the page follows); `page` a page inside that tab.
// read/write work on a profile object; ctx = { lengthLabel, lengthValue }.
export const SETTINGS = [
    {
        key: "mode", label: "Preset", tab: "preset", page: "preset",
        read: p => p.mode,
        write: (p, id) => pickEngine(p, id)
    },
    {
        key: "thinking", label: "Thinking prompt", tab: "preset", page: "thinking",
        read: p => p.cotEnabled !== false,
        write: (p, on) => { p.cotEnabled = Boolean(on); }
    },
    {
        key: "length", label: "Length", tab: "preset", page: "config",
        read: (p, ctx) => ctx.lengthLabel(p.storyConfig && p.storyConfig.length),
        write: (p, label, ctx) => {
            if (!p.storyConfig) p.storyConfig = {};
            p.storyConfig.length = ctx.lengthValue(label);
        }
    },
    {
        key: "banList", label: "Ban list", tab: "banlist",
        read: p => p.banListBuiltIn === false ? "off" : (p.banListShort ? "short" : "full"),
        write: (p, v) => {
            p.banListBuiltIn = v !== "off";
            if (v !== "off") p.banListShort = v === "short";
        }
    },
    {
        key: "html", label: "Immersive HTML", tab: "addons",
        read: p => Array.isArray(p.addons) && p.addons.includes("html"),
        write: (p, on) => {
            const list = (Array.isArray(p.addons) ? p.addons : []).filter(id => id !== "html");
            if (on) list.push("html");
            p.addons = list;
        }
    },
    ...["blocks", "worldState", "notebook"].map(f => ({
        key: f, label: { blocks: "Blocks", worldState: "World State", notebook: "The Notebook" }[f], tab: "chomusuke",
        read: p => (p.chomusuke && p.chomusuke.features && p.chomusuke.features[f] === true) ? "chomusuke" : "story",
        write: (p, v) => {
            if (!p.chomusuke.features) p.chomusuke.features = {};
            p.chomusuke.features[f] = v === "chomusuke";
        }
    }))
];

export const settingFor = key => SETTINGS.find(s => s.key === key);

/** Picks an engine the way the Preset tab does: its thinking comes with it.
 *  The style is kept when it is a V11 style or one of your own; another
 *  generation's built-in style becomes V11 Default. */
export function pickEngine(p, id) {
    p.mode = id;
    const cot = meguminCotForMode(id, "english");
    if (cot) p.model = cot;
    const builtIn = directStyles.some(s => s.id === p.activeStyleId);
    if (!p.activeStyleId || (builtIn && !V11_STYLE_IDS.includes(p.activeStyleId))) {
        const ds = directStyles.find(s => s.id === "dir_v11");
        p.activeStyleId = ds.id;
        p.aiRule = ds.rule;
    }
}

const STORY_MODEL = { blocks: "story", worldState: "story", notebook: "story" };

export const LOADOUTS = [
    {
        id: "gemini-pro", name: "Gemini Pro", icon: "fa-gem", models: "Gemini 3.1 Pro, 2.5 Pro, Gemini 4",
        why: "What Megumin was built for. Gemini writes best with its own thinking, the full ban list and the length left flexible.",
        notes: [
            { tone: "gold", text: "<b>Gemini 4:</b> the Thinking prompt and the prefill make no difference, so both stay off. <b>Gemini 3.1 Pro and 2.5 Pro:</b> if replies start getting cut off, turn the Thinking prompt on. It brings the prefill with it." }
        ],
        settings: { mode: "v11-voice", thinking: false, length: LENGTH_FLEXIBLE, banList: "full", ...STORY_MODEL }
    },
    {
        id: "claude", name: "Claude", icon: "fa-feather", models: "Claude Opus 5.5",
        why: "The best prose of any model tested. Claude keeps its thinking to itself: asked to write it out, replies can get blocked after the first message.",
        notes: [],
        settings: { mode: "v11-voice", thinking: false, length: LENGTH_FLEXIBLE, banList: "full", ...STORY_MODEL }
    },
    {
        id: "big-open", name: "Big open models", icon: "fa-dragon", models: "GLM 5.3, GLM 5.3 Flash",
        why: "GLM's own thinking writes plainer dialogue than the Thinking prompt, and the short ban list keeps it from redrafting. Immersive HTML leaks into its replies, so it stays off.",
        notes: [
            { tone: "gold", text: "<b>GLM 5.3 Flash</b> can forget a block now and then. If it does, let Chomusuke write the blocks." }
        ],
        settings: { mode: "v11-voice", thinking: false, length: LENGTH_SHORT, banList: "short", html: false, ...STORY_MODEL }
    },
    {
        id: "fast", name: "Fast models", icon: "fa-bolt", models: "DeepSeek",
        why: "Fast and cheap, and good at the story. V11 Тайна DeepSeek has one more line, so it doesn't treat the character as the player.",
        notes: [
            { tone: "red", chomusuke: true, text: "<b>DeepSeek leaves the blocks out.</b> Chomusuke has to write them, along with World State and the Notebook." },
            { tone: "gold", text: "<b>On Nvidia NIM</b> DeepSeek sends empty replies without the prefill. Turn the Thinking prompt on there: it brings the prefill with it." }
        ],
        settings: { mode: "v11-deepseek", thinking: false, length: LENGTH_SHORT, banList: "short", html: false, blocks: "chomusuke", worldState: "chomusuke", notebook: "chomusuke" }
    }
];

export const COMING_SOON = [
    { name: "Gemini Flash", icon: "fa-gem", models: "Gemini 3.5 – 3.8 Flash" },
    { name: "Overthinkers", icon: "fa-hourglass-half", models: "Kimi K3, Xiaomi MiMo V2.6" },
    { name: "Local", icon: "fa-house-laptop", models: "Gemma 4 31B, Qwen 3.8 27B" }
];

export const loadoutById = id => LOADOUTS.find(l => l.id === id);

/** Writes a loadout's settings into one profile. Containers a profile lacks
 *  are made; `chomusukeTemplate` fills a profile saved before Chomusuke. */
export function applyLoadout(p, loadout, ctx) {
    if (!p.chomusuke) p.chomusuke = JSON.parse(JSON.stringify(ctx.chomusukeTemplate || { enabled: false, profileId: "", features: {} }));
    for (const [key, value] of Object.entries(loadout.settings)) settingFor(key).write(p, value, ctx);
    p.loadout = loadout.id;
}

/** The keys whose value differs from the loadout this profile last used.
 *  Empty when it used none, or another one. */
export function changedFromLoadout(p, loadout, ctx) {
    if (!loadout || p.loadout !== loadout.id) return [];
    return Object.entries(loadout.settings)
        .filter(([key, value]) => settingFor(key).read(p, ctx) !== value)
        .map(([key]) => key);
}
