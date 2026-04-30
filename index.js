/* eslint-disable no-undef */
import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, generateQuietPrompt, event_types, eventSource, substituteParams, saveChat, reloadCurrentChat, addOneMessage, getRequestHeaders, appendMediaToMessage } from "../../../../script.js";
import { saveBase64AsFile } from "../../../utils.js";
import { humanizedDateTime } from "../../../RossAscends-mods.js";
import { Popup, POPUP_TYPE } from "../../../popup.js";
import { hardcodedLogic } from "./data/database.js";
import { KAZUMA_PLACEHOLDERS, RESOLUTIONS } from "./data/image_data.js";

const extensionName = "Megumin-Suite-Beta";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const TARGET_PRESET_NAME = "Megumin Engine";

// -------------------------------------------------------------
// STATE MANAGEMENT
// -------------------------------------------------------------
let currentTab = 0;
let localProfile = {};
let activeGenerationOrder = null;
let activeBanListChat = null;
let activeImageGenRequest = null;
let activeStoryPlanRequest = null;
let isDevEngineDirty = false;

function getCharacterKey() {
    const context = getContext();
    if (context.groupId !== undefined && context.groupId !== null) { return `group_${context.groupId}`; }
    if (context.characterId !== undefined && context.characterId !== null && context.characters[context.characterId]) { return context.characters[context.characterId].avatar; }
    return null;
}

function cleanGhostProfiles() {
    if (!extension_settings[extensionName] || !extension_settings[extensionName].profiles) return;

    const context = getContext();
    if (!context.characters || context.characters.length === 0) {
        return;
    }
    // Get all valid avatars and group IDs currently in SillyTavern
    const activeAvatars = Object.values(context.characters || {}).map(c => c.avatar);
    const activeGroups = (context.groups || []).map(g => `group_${g.id}`);
    const validKeys = ["default", ...activeAvatars, ...activeGroups];

    let deletedCount = 0;
    Object.keys(extension_settings[extensionName].profiles).forEach(key => {
        if (!validKeys.includes(key)) {
            delete extension_settings[extensionName].profiles[key];
            deletedCount++;
        }
    });

    if (deletedCount > 0) {
        saveSettingsDebounced();
        console.log(`[Megumin Suite] Garbage Collection: Cleaned up ${deletedCount} ghost profiles.`);
    }
}


function initProfile() {
    const key = getCharacterKey();
    const context = getContext();
    const isGroup = context.groupId !== undefined && context.groupId !== null;

    if (!extension_settings[extensionName]) extension_settings[extensionName] = { profiles: {} };
    if (!extension_settings[extensionName].profiles) extension_settings[extensionName].profiles = {};
    if (!extension_settings[extensionName].customModes) {
        extension_settings[extensionName].customModes = [];
    }

    const defaults = {
        mode: "balance",
        personality: "engine",
        toggles: { ooc: false, control: false },
        disableUtilityPrefill: false,
        aiTags: [],
        aiGeneratedOptions: [],
        aiRule: "",
        customStyles: [],
        activeStyleId: null,
        dnRatio: {
            enabled: false,
            dialogue: 50
        },
        onomatopoeia: {
            enabled: false,
            useStyling: false
        },
        addons: [],
        blocks: [],
        model: "cot-v1-english",
        userNotes: "",
        userWordCount: "",
        userLanguage: "",
        userPronouns: "off",
        devOverrides: {},
        banList: [],
        banListBackend: "direct",
        customModes: [],
        thinkEffort: "unspecified",
        customThinkEffort: "100",
        storyPlan: {
            enabled: false,
            backend: "direct",
            triggerMode: "manual",
            autoFreq: 10,
            currentPlan: ""
        },
        imageGen: {
            enabled: false,
            generatorBackend: "direct",
            comfyUrl: "http://127.0.0.1:8188",
            currentWorkflowName: "",
            selectedModel: "",
            selectedLora: "", selectedLora2: "", selectedLora3: "", selectedLora4: "",
            selectedLoraWt: 1.0, selectedLoraWt2: 1.0, selectedLoraWt3: 1.0, selectedLoraWt4: 1.0,
            imgWidth: 1024, imgHeight: 1024,
            customNegative: "bad quality, blurry, worst quality, low quality",
            customSeed: -1,
            selectedSampler: "euler",
            compressImages: true,
            steps: 20, cfg: 7.0, denoise: 0.5, clipSkip: 1,
            promptStyle: "standard",
            promptPerspective: "scene",
            promptExtra: "",
            triggerMode: "always",
            autoGenFreq: 1,
            previewPrompt: false,
            savedWorkflowStates: {}
        }
    };


    if (!extension_settings[extensionName].profiles["default"]) {
        extension_settings[extensionName].profiles["default"] = JSON.parse(JSON.stringify(defaults));
    }

    if (key && extension_settings[extensionName].profiles[key]) {
        localProfile = extension_settings[extensionName].profiles[key];
        if (isGroup) {
            $("#ps_rule_status_main").css({ "color": "#3b82f6", "text-shadow": "0 0 10px rgba(59,130,246,0.5)" }).text(`CUSTOM GROUP PROFILE`);
        } else {
            $("#ps_rule_status_main").css({ "color": "#10b981", "text-shadow": "0 0 10px rgba(16,185,129,0.5)" }).text(`CUSTOM CHARACTER PROFILE`);
        }
    } else {
        localProfile = JSON.parse(JSON.stringify(extension_settings[extensionName].profiles["default"]));
        if (key) {
            $("#ps_rule_status_main").css({ "color": "#f59e0b", "text-shadow": "0 0 10px rgba(245,158,11,0.5)" }).text(`USING SYSTEM DEFAULT`);
        } else {
            $("#ps_rule_status_main").css({ "color": "#a855f7", "text-shadow": "0 0 10px rgba(168,85,247,0.5)" }).text(`MODIFYING GLOBAL DEFAULT`);
        }
    }

    // PATCH missing keys
    Object.keys(defaults).forEach(k => {
        if (localProfile[k] === undefined) localProfile[k] = defaults[k];
    });
    if (!localProfile.toggles) localProfile.toggles = defaults.toggles;
    if (!localProfile.imageGen) localProfile.imageGen = defaults.imageGen;
    if (!localProfile.storyPlan) localProfile.storyPlan = defaults.storyPlan;
    if (!localProfile.dnRatio) localProfile.dnRatio = defaults.dnRatio;
    if (!localProfile.onomatopoeia) localProfile.onomatopoeia = defaults.onomatopoeia;
    if (localProfile.disableUtilityPrefill === undefined) localProfile.disableUtilityPrefill = false;

    if (localProfile.devOverrides && Object.keys(localProfile.devOverrides).length > 0) {
        localProfile.devOverrides = {};
        saveSettingsDebounced();
    }

    let displayName = "Global Default";
    if (isGroup) {
        if (context.groups && Array.isArray(context.groups)) {
            const group = context.groups.find(g => String(g.id) === String(context.groupId));
            if (group && group.name) displayName = group.name;
            else displayName = `Group Chat (${context.groupId})`;
        } else { displayName = "Group Chat"; }
    } else if (key && context.characterId !== undefined && context.characters[context.characterId]) {
        displayName = context.characters[context.characterId].name;
    }

    $("#ps_char_rule_label").text(displayName);
    toggleQuickGenButton();
    updateLiveTokenCount();
}

function saveProfileToMemory() {
    const key = getCharacterKey() || "default";
    const ruleBox = $("#ps_main_current_rule");
    if (ruleBox.length > 0) { localProfile.aiRule = ruleBox.val(); }
    extension_settings[extensionName].profiles[key] = localProfile;
    saveSettingsDebounced();

    updateLiveTokenCount(); // NEW: Update the UI whenever settings are saved!

    const saveInd = $("#ps_save_indicator");
    if (saveInd.length) {
        saveInd.html(`<i class="fa-solid fa-check"></i> Saved`).fadeIn(150);
        clearTimeout(window.psSaveTimer);
        window.psSaveTimer = setTimeout(() => saveInd.fadeOut(400), 2000);
    }
}

// NEW: Function to calculate and update the token UI with a Hover Breakdown
function updateLiveTokenCount() {
    const counterBadge = $("#ps_live_token_count");
    if (!counterBadge.length) return;

    const dict = buildBaseDict();

    let engineStr = "";
    let cotStr = "";
    let styleStr = "";
    let addonsStr = "";

    Object.entries(dict).forEach(([key, value]) => {
        if (!value) return;
        // Skip the single-bracket aliases to prevent double counting
        if (key.match(/^\[prompt[1-6]\]$/)) return;

        // Categorize the text
        if (key.includes("prompt") || key.includes("main") || key.includes("AI")) {
            engineStr += value + " ";
        } else if (key.includes("COT") || key.includes("prefill") || key.includes("THINK")) {
            cotStr += value + " ";
        } else if (key.includes("aiprompt") || key.includes("Language") || key.includes("pronouns") || key.includes("count") || key.includes("DNRATIO")) {
            styleStr += value + " ";
        } else {
            addonsStr += value + " ";
        }
    });

    // Estimate tokens (4.0 chars per token is the standard English NLP ratio)
    const estEngine = Math.ceil(engineStr.replace(/\s+/g, ' ').length / 4.0);
    const estCot = Math.ceil(cotStr.replace(/\s+/g, ' ').length / 4.0);
    const estStyle = Math.ceil(styleStr.replace(/\s+/g, ' ').length / 4.0);
    const estAddons = Math.ceil(addonsStr.replace(/\s+/g, ' ').length / 4.0);

    const total = estEngine + estCot + estStyle + estAddons;

    // Update the UI text
    counterBadge.html(`<i class="fa-solid fa-microchip"></i> ~${total}`);

    // Build the Hover Breakdown HTML
    const breakdownHTML = `
        <div style="text-align:left; min-width: 160px; font-family: 'Inter', sans-serif;">
            <div style="border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; margin-bottom: 6px; color: var(--gold); font-size: 0.8rem;"><b>Payload Breakdown</b></div>
            <div style="display:flex; justify-content:space-between; font-size: 0.75rem; margin-bottom: 4px;"><span>Engine Core:</span> <span style="color:#10b981; font-weight:bold;">~${estEngine}</span></div>
            <div style="display:flex; justify-content:space-between; font-size: 0.75rem; margin-bottom: 4px;"><span>CoT / Logic:</span> <span style="color:#3b82f6; font-weight:bold;">~${estCot}</span></div>
            <div style="display:flex; justify-content:space-between; font-size: 0.75rem; margin-bottom: 4px;"><span>Writing Style:</span> <span style="color:#a855f7; font-weight:bold;">~${estStyle}</span></div>
            <div style="display:flex; justify-content:space-between; font-size: 0.75rem;"><span>Add-ons/Blocks:</span> <span style="color:#ef4444; font-weight:bold;">~${estAddons}</span></div>
        </div>
    `;

    // Attach it to the badge
    counterBadge.attr("data-breakdown", breakdownHTML);
    counterBadge.css("cursor", "help");

    // Flash green to show it updated
    counterBadge.css("color", "#10b981");
    setTimeout(() => {
        counterBadge.css("color", "var(--text-muted)");
    }, 400);
}

let defaultImageCount = 0;

async function discoverDefaultImages() {
    if (defaultImageCount > 0) return;
    let count = 0;
    for (let i = 1; i <= 20; i++) {
        try {
            const res = await fetch(`${extensionFolderPath}/img/default${i}.png`, { method: 'HEAD' });
            if (res.ok) count = i;
            else break;
        } catch { break; }
    }
    defaultImageCount = count;
}

function getRandomDefaultImage() {
    if (defaultImageCount <= 0) return `${extensionFolderPath}/img/default.png`;
    const pick = Math.floor(Math.random() * defaultImageCount) + 1;
    return `${extensionFolderPath}/img/default${pick}.png`;
}

function updateCharacterDisplay() {
    const context = getContext();
    const bannerElement = $("#ps_hero_banner");
    let imgUrl = getRandomDefaultImage();

    if (context.groupId !== undefined && context.groupId !== null) {
        imgUrl = `${extensionFolderPath}/img/group.png`;
    } else if (context.characterId !== undefined && context.characterId !== null && context.characters[context.characterId]) {
        imgUrl = `/characters/${context.characters[context.characterId].avatar}`;
    }

    // Set the full-width background image smoothly
    bannerElement.css("background-image", `url('${imgUrl}')`);
}

function cleanAIOutput(text) {
    if (!text) return "";
    const re = new RegExp("(<disclaimer>.*?</disclaimer>)|(<guifan>.*?</guifan>)|(<danmu>.*?</danmu>)|(<options>.*?</options>)|```start|```end|<done>|`<done>`|(.*?</think(ing)?>(\\n)?)|(<think(ing)?>[\\s\\S]*?</think(ing)?>(\\n)?)", "gs");
    return text.replace(re, "").trim();
}

// -------------------------------------------------------------
// UI TAB RENDERER (Toolbox System)
// -------------------------------------------------------------
const tabsUI = [
    { title: "Core Engine", sub: "Choose the core ruleset that drives all NPC behavior and world logic.", icon: "fa-server", render: renderMode },
    { title: "Persona & Toggles", sub: "Define the personality and extra toggles.", icon: "fa-user-astronaut", render: renderPersonality },
    { title: "Writing Style", sub: "Apply a prebuilt style, generate one with AI, or build your own.", icon: "fa-pen-nib", render: renderStyleLibrary },
    { title: "Global Settings", sub: "Set response length, output language, and how the AI addresses you.", icon: "fa-earth-americas", render: renderAddons },
    { title: "Add-ons & Blocks", sub: "Attach extra modules that appear at the end of every response.", icon: "fa-puzzle-piece", render: renderBlocks },
    { title: "Chain of Thought", sub: "Control the AI's internal reasoning process before it writes.", icon: "fa-brain", render: renderModels },
    { title: "Story Planner", sub: "Generate and track future plot developments.", icon: "fa-map", render: renderStoryPlanner },
    { title: "Dynamic Ban List", sub: "Scan and ban repetitive AI phrases.", icon: "fa-ban", render: renderBanList },
    { title: "Image Generation", sub: "Wire up ComfyUI to auto-generate scene images during roleplay.", icon: "fa-image", render: renderImageGen }
];

function switchTab(index) {
    $(".dock").show();
    $("#ps_btn_save_close").show();

    // Hide Apply All on Tab 3 (Writing Style)
    if (index === 2) { $("#btn_apply_tab_all").hide(); }
    else { $("#btn_apply_tab_all").show(); }

    $("#ps_btn_dev_mode").html(`<i class="fa-solid fa-code"></i> Dev`).css("color", "#a855f7");

    let isSameTab = (currentTab === index);
    const container = $("#ps_stage_content");
    let savedScroll = 0;
    if (isSameTab && container.length) {
        savedScroll = container.scrollTop() || 0;
    }

    currentTab = index;
    const tab = tabsUI[index];

    // Generate Icons
    const dotsContainer = $("#ps_dynamic_dots");
    if (dotsContainer.children(".dock-icon").length < tabsUI.length) {
        dotsContainer.empty();
        tabsUI.forEach((t, i) => {
            dotsContainer.append(`<div class="dock-icon sidebar-step" id="dot_${i}" title="${t.title}">
                <i class="fa-solid ${t.icon}"></i> <span>${t.title}</span>
            </div>`);
        });
    }

    $(".dock-icon").removeClass("active");
    $(`#dot_${index}`).addClass("active");

    container.empty();
    container.off(".devDirty");

    tab.render(container);

    if (isSameTab) {
        container.scrollTop(savedScroll);
    } else {
        container.scrollTop(0);
    }

    updateLiveTokenCount();
}

function applyTabToAll() {
    const tabKeys = {
        0: ["mode"],
        1: ["personality", "toggles"],
        2: ["activeStyleId", "aiRule", "customStyles", "dnRatio"],
        3: ["userWordCount", "userLanguage", "userPronouns", "disableUtilityPrefill", "onomatopoeia"],
        4: ["addons", "blocks"],
        5: ["model"],
        6: ["storyPlan"],
        7: ["banList"],
        8: ["imageGen"]
    };

    const keysToSync = tabKeys[currentTab];
    if (confirm(`Apply ${tabsUI[currentTab].title} settings to ALL characters, groups, and defaults?`)) {
        const currentData = localProfile;
        Object.keys(extension_settings[extensionName].profiles).forEach(profKey => {
            const prof = extension_settings[extensionName].profiles[profKey];
            keysToSync.forEach(k => {
                prof[k] = JSON.parse(JSON.stringify(currentData[k]));
            });
        });
        saveSettingsDebounced();
        toastr.success(`Synced ${tabsUI[currentTab].title} across all profiles!`);
    }
}

function renderMode(c) {
    const descriptions = {
        "balance": "The original Secret Sauce. NPCs react naturally — no simping, no needless hostility.",
        "balance Test": "New and improved balance mode that aims to use less tokens and more creativity.",
        "cinematic": "Hollywood-inspired storytelling. Dramatic beats and heightened tension.",
        "dark": "Balance but harsher. The world is unforgiving and consequences hit harder.",
        "v6-anime-director": "Advanced cinematic framing and pacing. Designed to emulate high-budget anime direction.",
        "v6-dream-team": "The ultimate 6-specialist writer room. Unprecedented narrative consistency and realism.",
        "v6-dream-team-lite": "A streamlined version of the Dream Team. Faster generation with lower token overhead."
    };

    c.append(`<div class="ps-rule-title" style="margin-bottom:10px;">Megumin Core Engines</div>`);

    const filterContainer = $(`
        <div style="display: flex; gap: 8px; margin-bottom: 20px;">
            <button class="ps-modern-tag filter-btn selected" data-filter="all" style="margin:0; border-radius: 20px; padding: 6px 16px;">All Engines</button>
            <button class="ps-modern-tag filter-btn" data-filter="V4" style="margin:0; border-radius: 20px; padding: 6px 16px;">V4 Generation</button>
            <button class="ps-modern-tag filter-btn" data-filter="V5" style="margin:0; border-radius: 20px; padding: 6px 16px;">V5 Generation</button>
            <button class="ps-modern-tag filter-btn" data-filter="V6" style="margin:0; border-radius: 20px; padding: 6px 16px;">V6 <i class="fa-solid fa-lock" style="font-size:0.7em; margin-left:4px;"></i></button>
        </div>
    `);
    c.append(filterContainer);

    const coreGrid = $(`<div class="ps-grid" style="margin-bottom: 30px;"></div>`);
    const v6Empty = $(`<div id="v6-empty-msg" style="display:none; padding: 40px 20px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 12px; margin-bottom: 30px;"><i class="fa-solid fa-hammer" style="font-size: 2rem; color: var(--border-color); margin-bottom: 12px;"></i><br><span style="font-weight: bold; color: var(--text-main);">V6 Engines are in the forge.</span><br>Stay tuned for the next update! Later this week.</div>`);

    hardcodedLogic.modes.forEach(m => {
        const recText = m.recommended ? `<span class="ps-rec-text"><i class="fa-solid fa-star"></i> Recommended</span>` : '';
        const newBadge = m.isNew ? `<div style="position: absolute; bottom: 15px; right: 15px; background: #3b82f6; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 3px 10px; border-radius: 8px; text-transform: uppercase;">New</div>` : '';

        let version = "all";
        if (m.label.includes("V4")) version = "V4";
        else if (m.label.includes("V5")) version = "V5";
        else if (m.id.includes("v6")) version = "V6"; // Dynamically tags all v6 engines

        let isLocked = m.locked === true;
        let lockStyle = isLocked ? "opacity: 0.6; filter: grayscale(80%); pointer-events: none;" : "cursor: pointer;";
        let lockIcon = isLocked ? `<i class="fa-solid fa-lock" style="margin-right: 4px; color: var(--text-muted);"></i>` : "";
        let lockBadge = isLocked ? `<div style="position: absolute; bottom: 15px; right: 15px; background: #52525b; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 3px 10px; border-radius: 8px; text-transform: uppercase;">Coming Soon</div>` : newBadge;

        const card = $(`<div class="ps-card core-engine-card ${localProfile.mode === m.id ? 'selected' : ''}" data-version="${version}" style="position:relative; padding-bottom: ${m.isNew || isLocked ? '40px' : '20px'}; ${lockStyle}">
            <div class="ps-card-title"><span>${lockIcon}${m.label}</span> ${recText}</div>
            <div class="ps-card-desc">${descriptions[m.id] || ""}</div>${lockBadge}
        </div>`);

        if (!isLocked) {
            card.on("click", () => { localProfile.mode = m.id; saveProfileToMemory(); switchTab(currentTab); });
        }
        coreGrid.append(card);
    });

    c.append(coreGrid);
    c.append(v6Empty);

    filterContainer.find('.filter-btn').on('click', function () {
        filterContainer.find('.filter-btn').removeClass('selected');
        $(this).addClass('selected');
        const filter = $(this).attr('data-filter');
        if (filter === "all") {
            coreGrid.show(); coreGrid.find('.core-engine-card').show(); v6Empty.hide();
        } else {
            coreGrid.find('.core-engine-card').each(function () {
                if ($(this).attr('data-version') === filter) $(this).show(); else $(this).hide();
            });
            coreGrid.show();
            if (filter === "V6") v6Empty.show(); else v6Empty.hide();
        }
    });

    const customModes = extension_settings[extensionName].customModes || [];
    if (customModes.length > 0) {
        c.append(`<div class="ps-rule-title" style="margin-bottom:10px; color: #10b981;">Custom User Engines</div>`);
        const customGrid = $(`<div class="ps-grid"></div>`);
        customModes.forEach(m => {
            const isSel = localProfile.mode === m.id;
            const card = $(`<div class="ps-card ${isSel ? 'selected' : ''}" style="border-color: ${isSel ? '#10b981' : 'var(--border-color)'}; position: relative;">
                <div class="ps-card-title" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <span style="color: ${isSel ? '#000' : '#10b981'};">${m.label}</span>
                    <button class="ps-modern-btn secondary btn-quick-edit" style="padding: 4px 8px; font-size: 0.7rem; color: var(--gold); border-color: rgba(245,158,11,0.3); background: transparent;"><i class="fa-solid fa-pen"></i> Edit</button>
                </div>
                <div class="ps-card-desc">Custom Engine Flow</div>
            </div>`);
            card.on("click", (e) => {
                if ($(e.target).closest('.btn-quick-edit').length) return;
                localProfile.mode = m.id; saveProfileToMemory(); switchTab(currentTab);
            });
            card.find(".btn-quick-edit").on("click", () => renderDevMode("editor", m.id, null, "tab"));
            customGrid.append(card);
        });
        c.append(customGrid);
    }
}

function renderPersonality(c) {
    const isV6DreamTeam = localProfile.mode.includes("v6-dream-team");

    if (isV6DreamTeam) {
        // V6 LOCKED STATE
        c.append(`
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; background: rgba(168, 85, 247, 0.05); border: 1px dashed #a855f7; border-radius: 12px; margin-bottom: 30px;">
                <i class="fa-solid fa-user-lock" style="font-size: 3rem; color: #a855f7; margin-bottom: 15px;"></i>
                <h3 style="color: var(--text-main); margin: 0 0 10px 0;">Persona Selection Locked</h3>
                <p style="color: var(--text-muted); max-width: 500px; font-size: 0.85rem; line-height: 1.5;">
                    The V6 Dream Team engine utilizes an intrinsic 6-specialist framework. Standard persona injections (like Megumin or Director) are disabled to prevent logic conflicts.
                </p>
            </div>
        `);
    } else {
        // NORMAL STATE
        const descriptions = {
            "megumin": "A rebellious, dominant voice. Adds an edge of arrogance and chaos to the narration. Best for energetic or confrontational stories.",
            "director": "Professional narrator. Clean, authoritative story direction with cinematic awareness.",
            "Nora": "Nora should i say more.",
            "engine": "No personality overlay at all. The engine speaks in its purest form — precise, neutral, and fully under your control. Recommended for most setups."
        };
        c.append(`<div class="ps-rule-title" style="margin-bottom:10px;">Select Persona</div>`);
        const grid = $(`<div class="ps-grid" style="margin-bottom: 25px;"></div>`);
        hardcodedLogic.personalities.forEach(p => {
            const recText = p.recommended ? `<span class="ps-rec-text"><i class="fa-solid fa-star"></i> Recommended</span>` : '';
            const card = $(`<div class="ps-card ${localProfile.personality === p.id ? 'selected' : ''}">
                <div class="ps-card-title"><span>${p.label}</span> ${recText}</div>
                <div class="ps-card-desc">${descriptions[p.id] || ""}</div>
            </div>`);
            card.on("click", () => { localProfile.personality = p.id; saveProfileToMemory(); switchTab(currentTab); });
            grid.append(card);
        });
        c.append(grid);
    }

    // EXTRA TOGGLES (Always available)
    c.append(`<div class="ps-rule-title" style="margin-bottom:10px;">Extra Toggles</div>`);
    Object.entries(hardcodedLogic.toggles).forEach(([key, tog]) => {
        const recText = tog.recommendedOff ? `<span class="ps-rec-text"><i class="fa-solid fa-star"></i> Off by default — most engines handle this natively</span>` : '';
        const tCard = $(`<div class="ps-toggle-card ${localProfile.toggles[key] ? 'active' : ''}">
            <div style="display:flex; flex-direction:column;"><span style="font-weight:600;">${tog.label}</span><div style="margin-top:4px;">${recText}</div></div>
            <div class="ps-switch"></div></div>`);
        tCard.on("click", () => { localProfile.toggles[key] = !localProfile.toggles[key]; saveProfileToMemory(); switchTab(currentTab); });
        c.append(tCard);
    });
}

function renderStyleLibrary(c) {

    const listContainer = $(`<div style="display: flex; flex-direction: column; gap: 12px;"></div>`);
    const isOff = !localProfile.activeStyleId;

    // --- 1. THE OFF CARD ---
    const offCard = $(`
        <div class="ps-card ${isOff ? 'selected' : ''}" style="width: 100%; padding: 16px; flex-direction: row; align-items: center; justify-content: space-between; border-color: ${isOff ? 'var(--text-main)' : 'var(--border-color)'};">
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fa-solid fa-power-off" style="font-size: 1.2rem; color: ${isOff ? '#000' : 'var(--text-muted)'};"></i>
                <div>
                    <div style="font-weight: 700; font-size: 1rem; color: ${isOff ? '#000' : 'var(--text-main)'};">No Style (Off)</div>
                    <div style="font-size: 0.75rem; color: ${isOff ? '#444' : 'var(--text-muted)'};">Disable extra style directives.</div>
                </div>
            </div>
            ${isOff ? `<span style="font-weight: 800; font-size: 0.7rem; color: #000; text-transform: uppercase;"><i class="fa-solid fa-check"></i> Active</span>` : ''}
        </div>
    `);
    offCard.on("click", () => { localProfile.activeStyleId = null; localProfile.aiRule = ""; saveProfileToMemory(); renderStyleLibrary(c); });
    listContainer.append(offCard);

    // --- 2. DIALOGUE / NARRATION RATIO UI ---
    if (!localProfile.dnRatio) localProfile.dnRatio = { enabled: false, dialogue: 50 };
    const isDNR = localProfile.dnRatio.enabled;
    const dVal = localProfile.dnRatio.dialogue;

    const dnrBlock = $(`
        <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 15px; margin-top: 5px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="fa-solid fa-scale-balanced" style="font-size: 1.2rem; color: var(--gold);"></i>
                    <div>
                        <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">Dialogue / Narration Ratio</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Force the AI to favor spoken dialogue or descriptive narration via [[DNRATIO]].</div>
                    </div>
                </div>
                <div class="ps-toggle-card ${isDNR ? 'active' : ''}" id="dnr_toggle" style="padding: 10px; min-width: 64px; justify-content: center; cursor: pointer;">
                    <div class="ps-switch"></div>
                </div>
            </div>
            <div id="dnr_slider_container" style="display: ${isDNR ? 'block' : 'none'}; margin-top: 15px;">
                <div style="display: flex; align-items: center; gap: 15px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <span style="font-size: 0.8rem; font-weight: bold; color: #a855f7; width: 110px; text-align: right;"><span id="lbl_narr">${100 - dVal}</span>% Narration</span>
                    <input type="range" id="dnr_slider" min="0" max="100" step="10" value="${dVal}" style="flex: 1; cursor: pointer; accent-color: var(--gold);">
                    <span style="font-size: 0.8rem; font-weight: bold; color: #10b981; width: 110px;"><span id="lbl_dial">${dVal}</span>% Dialogue</span>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted); text-align: center; margin-top: 8px; font-family: monospace;">
                    Injection Preview: "- Ratio: Maintain a balance of <span id="lbl_prev_d">${dVal}</span>% Dialogue and <span id="lbl_prev_n">${100 - dVal}</span>% Narration."
                </div>
            </div>
        </div>
    `);

    dnrBlock.find("#dnr_toggle").on("click", function () {
        localProfile.dnRatio.enabled = !localProfile.dnRatio.enabled; saveProfileToMemory(); renderStyleLibrary(c);
    });
    dnrBlock.find("#dnr_slider").on("input", function () {
        let d = parseInt($(this).val()); let n = 100 - d;
        $("#lbl_dial, #lbl_prev_d").text(d); $("#lbl_narr, #lbl_prev_n").text(n);
    });
    dnrBlock.find("#dnr_slider").on("change", function () {
        localProfile.dnRatio.dialogue = parseInt($(this).val()); saveProfileToMemory();
    });
    listContainer.append(dnrBlock);

    // --- 3. FILTER BUTTONS ---
    const filterContainer = $(`
        <div style="display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
            <button class="ps-modern-tag style-filter-btn selected" data-filter="all" style="margin:0; border-radius: 20px; padding: 6px 16px;">All Styles</button>
            <button class="ps-modern-tag style-filter-btn" data-filter="precooked" style="margin:0; border-radius: 20px; padding: 6px 16px;">Precooked</button>
            <button class="ps-modern-tag style-filter-btn" data-filter="generators" style="margin:0; border-radius: 20px; padding: 6px 16px;">AI Generators</button>
            <button class="ps-modern-tag style-filter-btn" data-filter="custom" style="margin:0; border-radius: 20px; padding: 6px 16px;">My Library</button>
        </div>
    `);
    listContainer.append(filterContainer);

    // --- SECTIONS ---
    const secPrecooked = $(`<div class="style-section" data-section="precooked" style="display: flex; flex-direction: column; gap: 12px;"></div>`);
    const secGenerators = $(`<div class="style-section" data-section="generators" style="display: flex; flex-direction: column; gap: 12px;"></div>`);
    const secCustom = $(`<div class="style-section" data-section="custom" style="display: flex; flex-direction: column; gap: 12px;"></div>`);

    // A. Precooked Styles (Hardcoded, no AI generation needed)
    secPrecooked.append(`<div class="ps-stages-label" style="margin-top: 5px; color: var(--gold);"><i class="fa-solid fa-fire-burner"></i> Precooked Styles (Instant)</div>`);
    hardcodedLogic.directStyles.forEach(ds => {
        const isSel = localProfile.activeStyleId === ds.id;
        const card = $(`
            <div class="ps-card ${isSel ? 'selected' : ''}" style="width: 100%; padding: 16px; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 700; font-size: 1rem; color: ${isSel ? '#000' : 'var(--text-main)'};">${ds.name}</span>
                        <span style="font-size: 0.75rem; color: ${isSel ? '#333' : 'var(--text-muted)'}; margin-top: 2px;">${ds.desc}</span>
                    </div>
                    ${isSel ? `<span style="font-weight: 800; font-size: 0.7rem; color: #000; text-transform: uppercase;"><i class="fa-solid fa-check"></i> ACTIVE</span>` : ''}
                </div>
                <div style="font-size: 0.75rem; font-family: monospace; background: ${isSel ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.3)'}; padding: 8px; border-radius: 4px; border: 1px solid ${isSel ? 'rgba(0,0,0,0.2)' : 'var(--border-color)'}; color: ${isSel ? '#333' : 'var(--text-muted)'};">
                    ${ds.rule}
                </div>
            </div>
        `);
        card.on("click", () => {
            localProfile.activeStyleId = ds.id; localProfile.aiRule = ds.rule; saveProfileToMemory(); renderStyleLibrary(c);
        });
        secPrecooked.append(card);
    });

    // B. Custom Styles (My Library)
    secCustom.append(`<div class="ps-stages-label" style="margin-top: 5px; color: #10b981;"><i class="fa-solid fa-book"></i> My Library</div>`);
    const existingNames = localProfile.customStyles ? localProfile.customStyles.map(s => s.name) : [];
    if (localProfile.customStyles && localProfile.customStyles.length > 0) {
        localProfile.customStyles.forEach(style => {
            const isSel = localProfile.activeStyleId === style.id;
            const card = $(`
                <div class="ps-card ${isSel ? 'selected' : ''}" style="width: 100%; padding: 16px; flex-direction: column; gap: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <span style="font-weight: 700; font-size: 1rem; color: ${isSel ? '#000' : 'var(--text-main)'};">${style.name}</span>
                        <div style="display: flex; align-items: center; gap: 10px;">
                             <span class="ps-btn-regen" title="Regenerate" style="font-size: 0.7rem; cursor: pointer; color: ${isSel ? '#d97706' : 'var(--gold)'}; font-weight: bold; text-transform: uppercase;"><i class="fa-solid fa-rotate-right"></i> Redo</span>
                             ${isSel ? `<span style="font-weight: 800; font-size: 0.7rem; color: #000;"><i class="fa-solid fa-check"></i> ACTIVE</span>` : ''}
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; font-family: monospace; background: ${isSel ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.3)'}; padding: 8px; border-radius: 4px; border: 1px solid ${isSel ? 'rgba(0,0,0,0.2)' : 'var(--border-color)'}; max-height: 50px; overflow: hidden; color: ${isSel ? '#333' : 'var(--text-muted)'};">
                        ${style.rule || "No rule generated."}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="ps-btn-edit ps-modern-btn secondary" style="padding: 4px 10px; font-size: 0.7rem; color: ${isSel ? '#000' : 'var(--text-main)'}; border-color: ${isSel ? '#000' : 'var(--border-color)'};">Edit</button>
                        <button class="ps-btn-delete ps-modern-btn secondary" style="padding: 4px 10px; font-size: 0.7rem; color: #ef4444; border-color: rgba(239,68,68,0.2);">Delete</button>
                    </div>
                </div>
            `);
            card.on("click", (e) => {
                if ($(e.target).closest("button, .ps-btn-regen").length) return;
                localProfile.activeStyleId = style.id; localProfile.aiRule = style.rule; saveProfileToMemory(); renderStyleLibrary(c);
            });
            card.find(".ps-btn-edit").on("click", () => renderStyleEditor(c, style.id));
            card.find(".ps-btn-delete").on("click", () => {
                if (confirm(`Delete "${style.name}"?`)) {
                    localProfile.customStyles = localProfile.customStyles.filter(s => s.id !== style.id);
                    if (localProfile.activeStyleId === style.id) { localProfile.activeStyleId = null; localProfile.aiRule = ""; }
                    saveProfileToMemory(); renderStyleLibrary(c);
                }
            });
            card.find(".ps-btn-regen").on("click", async function () {
                $(this).html(`<i class="fa-solid fa-spinner fa-spin"></i>`);
                await useMeguminEngine(async () => {
                    const orderText = `Inspired by ${style.notes}. Write a writing style rule based on: ${style.tags.join(", ")}. Direct instructions only. 2-3 paragraphs. No fluff.`;
                    let rule = await runMeguminTask(orderText);
                    style.rule = cleanAIOutput(rule).trim();
                    if (localProfile.activeStyleId === style.id) localProfile.aiRule = style.rule;
                    saveProfileToMemory(); renderStyleLibrary(c); toastr.success("Rule Regenerated!");
                });
            });
            secCustom.append(card);
        });
    }
    const addBtn = $(`
        <div class="ps-card" style="width: 100%; padding: 16px; border-style: dashed; border-color: #52525b; justify-content: center; background: transparent; cursor: pointer;">
            <div style="font-weight: 700; color: var(--text-muted);"><i class="fa-solid fa-plus"></i> Create Custom AI Style</div>
        </div>
    `);
    addBtn.on("click", () => renderStyleEditor(c, null));
    secCustom.append(addBtn);

    // C. AI Generators (Templates)
    secGenerators.append(`<div class="ps-stages-label" style="margin-top: 5px; color: #a855f7;"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Style Generators</div>`);
    hardcodedLogic.styleTemplates.forEach(tpl => {
        if (existingNames.includes(tpl.name)) return;
        const card = $(`
            <div class="ps-card" style="width: 100%; padding: 16px; border-style: dashed; flex-direction: row; justify-content: space-between; align-items: center;">
                <div style="flex: 1; padding-right: 20px;">
                    <div style="font-weight: 700; color: var(--text-main); font-size: 1rem; margin-bottom: 4px;">${tpl.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4;">${tpl.notes}</div>
                </div>
                <button class="ps-btn-tpl-gen ps-modern-btn primary" style="background: var(--gold); color: #000; padding: 8px 16px; font-weight: 800;">
                    <i class="fa-solid fa-bolt"></i> GENERATE
                </button>
            </div>
        `);
        card.find(".ps-btn-tpl-gen").on("click", async function () {
            const btn = $(this); btn.prop("disabled", true).html(`<i class="fa-solid fa-spinner fa-spin"></i>`);
            await useMeguminEngine(async () => {
                const orderText = `Inspired by ${tpl.notes}. Write a writing style rule based on: ${tpl.tags.join(", ")}. Direct instructions only. 2-3 paragraphs. No fluff.`;
                let rule = await runMeguminTask(orderText);
                const newId = "style_" + Date.now();
                const newStyle = { id: newId, name: tpl.name, tags: [...tpl.tags], notes: tpl.notes, rule: cleanAIOutput(rule).trim() };
                localProfile.customStyles.push(newStyle); localProfile.activeStyleId = newId; localProfile.aiRule = newStyle.rule;
                saveProfileToMemory(); renderStyleLibrary(c); toastr.success(`${tpl.name} Added!`);
            });
        });
        secGenerators.append(card);
    });

    listContainer.append(secPrecooked);
    listContainer.append(secCustom);
    listContainer.append(secGenerators);
    c.empty().append(listContainer);

    // --- FILTER LOGIC ---
    filterContainer.find('.style-filter-btn').on('click', function () {
        filterContainer.find('.style-filter-btn').removeClass('selected');
        $(this).addClass('selected');

        const filter = $(this).attr('data-filter');
        if (filter === "all") {
            secPrecooked.show(); secGenerators.show(); secCustom.show();
        } else {
            secPrecooked.toggle(filter === "precooked");
            secGenerators.toggle(filter === "generators");
            secCustom.toggle(filter === "custom");
        }
    });
}

function renderStyleEditor(c, editId, presetData = null) {

    let currentStyle = presetData ? presetData : (editId ? JSON.parse(JSON.stringify(localProfile.customStyles.find(s => s.id === editId))) : {
        id: "style_" + Date.now(), name: "", tags: [], generatedOptions: [], notes: "", rule: ""
    });

    c.empty();
    let templateOptions = `<option value="" disabled selected>✨ Load a Pre-configured Template...</option>`;
    if (hardcodedLogic.styleTemplates) {
        hardcodedLogic.styleTemplates.forEach((tpl, index) => { templateOptions += `<option value="${index}">${tpl.name}</option>`; });
    }

    c.append(`
        <div style="display: flex; gap: 10px; margin-bottom: 12px;">
            <select id="ps_style_template_dropdown" class="ps-modern-input" style="flex: 1; font-weight: 600; color: var(--gold); border-color: var(--gold); cursor: pointer;">${templateOptions}</select>
        </div>
        <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: center;">
            <input type="text" id="ps_style_name" class="ps-modern-input" value="${currentStyle.name}" placeholder="Name your style (e.g. Fast RP + Edo)" style="flex: 1; font-size: 1.1rem; font-weight: bold;" />
            <button id="ps_btn_save_style" class="ps-modern-btn primary" style="background: #10b981; color: #fff;"><i class="fa-solid fa-floppy-disk"></i> Save & Return</button>
            <button id="ps_btn_cancel_style" class="ps-modern-btn secondary" style="color: #ef4444; border-color: rgba(239,68,68,0.3);">Cancel</button>
        </div>
    `);

    $("#ps_style_template_dropdown").on("change", function () {
        const tplIndex = $(this).val(); if (tplIndex === null) return;
        const chosenTpl = hardcodedLogic.styleTemplates[tplIndex];
        currentStyle.name = chosenTpl.name; currentStyle.tags = [...chosenTpl.tags]; currentStyle.notes = chosenTpl.notes; currentStyle.rule = ""; currentStyle.generatedOptions = [];
        renderStyleEditor(c, editId, currentStyle); toastr.info(`${chosenTpl.name} loaded!`);
    });

    const tagContainer = $(`<div></div>`);
    hardcodedLogic.styles.forEach(cat => {
        const wrap = $(`<div class="ps-tag-category"><div class="ps-rule-title" style="margin-bottom: 8px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">${cat.category}</div><div style="display: flex; flex-wrap: wrap; gap: 6px;"></div></div>`);
        const tagBox = wrap.find("div").eq(1);
        cat.tags.forEach(tagObj => {
            const tagName = tagObj.id; const isSel = currentStyle.tags.includes(tagName);
            const tEl = $(`<span class="ps-modern-tag ${isSel ? 'selected' : ''}" data-hint="${tagObj.hint}">${tagName}</span>`);
            tEl.on("click", () => {
                if (currentStyle.tags.includes(tagName)) currentStyle.tags = currentStyle.tags.filter(t => t !== tagName); else currentStyle.tags.push(tagName);
                tEl.toggleClass("selected");
            }); tagBox.append(tEl);
        }); tagContainer.append(wrap);
    }); c.append(tagContainer);

    c.append(`
        <div style="margin-top: 32px; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div class="ps-rule-title" style="color: var(--text-main); font-size: 0.9rem; font-weight: 700;">
                    <i class="fa-solid fa-sparkles" style="color: var(--gold); margin-right: 6px;"></i> AI Author Matches
                </div>
                <button id="ps_btn_get_authors_style" class="ps-modern-btn secondary" style="padding: 6px 14px; font-size: 0.75rem;"><i class="fa-solid fa-lightbulb"></i> Generate Insights</button>
            </div>
            <div id="ps_ai_author_box_style" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; min-height: 20px;"></div>
            <hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 0 0 16px 0;" />
            <input type="text" id="ps_style_notes" class="ps-modern-input" placeholder="Custom Directives..." value="${currentStyle.notes || ''}" />
        </div>
        <div style="margin-top: 24px; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">Final Rule</span>
                <button id="ps_btn_generate_style" class="ps-modern-btn primary" style="padding: 8px 16px; font-size: 0.8rem; background: var(--text-main); color: #000;"><i class="fa-solid fa-bolt"></i> Generate Writing Rule</button>
            </div>
            <textarea id="ps_style_rule_text" class="ps-modern-input" style="height: 100px; resize: vertical; font-family: monospace; font-size: 0.85rem;" placeholder="Select tags above and click Generate...">${currentStyle.rule || ''}</textarea>
            <div style="margin-top: 16px; background: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; border-radius: 4px; padding: 12px 16px;">
                <div style="display: flex; align-items: center; gap: 8px; color: #3b82f6; font-weight: 600; font-size: 0.85rem; margin-bottom: 4px;"><i class="fa-solid fa-circle-info"></i> Note</div>
                <div style="color: var(--text-main); font-size: 0.8rem; line-height: 1.5;">Dont forget to hit save at the top dummy</div>
            </div>
        </div>
    `);

    const renderInsights = () => {
        const box = $("#ps_ai_author_box_style"); box.empty();
        (currentStyle.generatedOptions || []).forEach(tag => {
            const isSel = currentStyle.tags.includes(tag);
            const tEl = $(`<span class="ps-modern-tag ${isSel ? 'selected' : ''}">${tag.replace(" ✨", "")} <i class="fa-solid fa-sparkles" style="font-size:0.6rem; margin-left:4px; color:var(--gold);"></i></span>`);
            tEl.on("click", () => {
                if (isSel) currentStyle.tags = currentStyle.tags.filter(t => t !== tag); else currentStyle.tags.push(tag);
                tEl.toggleClass("selected");
            }); box.append(tEl);
        });
    };
    renderInsights();

    $("#ps_style_notes").on("input", function () { currentStyle.notes = $(this).val(); });
    $("#ps_style_rule_text").on("input", function () { currentStyle.rule = $(this).val(); });
    $("#ps_style_name").on("input", function () { currentStyle.name = $(this).val(); });

    $("#ps_btn_cancel_style").on("click", () => renderStyleLibrary(c));
    $("#ps_btn_save_style").on("click", () => {
        if (currentStyle.name.trim() === "") currentStyle.name = "Unnamed Style";
        if (!editId) { localProfile.customStyles.push(currentStyle); }
        else { const idx = localProfile.customStyles.findIndex(s => s.id === editId); if (idx > -1) localProfile.customStyles[idx] = currentStyle; }
        if (localProfile.activeStyleId === currentStyle.id) { localProfile.aiRule = currentStyle.rule; }
        saveProfileToMemory(); renderStyleLibrary(c); toastr.success(`Saved "${currentStyle.name}"`);
    });

    $("#ps_btn_get_authors_style").on("click", async function () {
        if (!getCharacterKey()) return toastr.warning("Open a chat or group first so I can read the context!");
        $(this).prop("disabled", true).html(`<i class="fa-solid fa-spinner fa-spin"></i> Brainstorming...`);
        await useMeguminEngine(async () => {
            const orderText = `Based on the active characters and scenario, give me EXACTLY 2 famous author names or literary writing styles (e.g. Edgar Allan Poe, Jane Austen style, Dark Fantasy Author) and 5 tags that fit the rp (e.g. internet culture, femboy, virtual game) whose writing style perfectly fits the tone and world. Return ONLY the 7 items separated by a comma. Do not explain them.`;
            let aiRawOutput = await runMeguminTask(orderText);
            const aiTagsTemp = cleanAIOutput(aiRawOutput).split(",").map(t => t.trim().replace(/['"\[\]\.]/g, '')).filter(t => t.length > 0);
            if (aiTagsTemp.length > 0) {
                currentStyle.tags = currentStyle.tags.filter(tag => !tag.endsWith("✨"));
                currentStyle.generatedOptions = aiTagsTemp.map(tag => `${tag} ✨`);
                renderInsights(); toastr.success(`Generated ${aiTagsTemp.length} insights!`);
            }
        }); $(this).prop("disabled", false).html(`<i class="fa-solid fa-lightbulb"></i> Generate Insights`);
    });

    $("#ps_btn_generate_style").on("click", async function () {
        if (currentStyle.tags.length === 0) return toastr.warning("Select tags first!");
        $(this).prop("disabled", true).html(`<i class="fa-solid fa-spinner fa-spin"></i> Finalizing...`);
        await useMeguminEngine(async () => {
            const orderText = `Create a writing style prompt based on these traits:\n\nSelected style tags: ${currentStyle.tags.join(", ")}\n\nAdditional user instructions: ${currentStyle.notes}\n\nWrite a concise, well-structured writing style rule (100 words max) that the AI must follow. Combine all tags into a cohesive directive. Write it as a direct instruction. Do not use bullet points or introductory text.`;
            let rule = await runMeguminTask(orderText);
            currentStyle.rule = cleanAIOutput(rule).trim();
            $("#ps_style_rule_text").val(currentStyle.rule); toastr.success("Live AI Rule Generated!");
        }); $(this).prop("disabled", false).html(`<i class="fa-solid fa-bolt"></i> Generate Writing Rule`);
    });
}

function renderAddons(c) {
    const descriptions = {
        "death": "Enables permanent consequences. Characters — including yours — can die for real. No safety net, no plot armor.",
        "combat": "Activates a grounded, tactical combat layer. Actions have real weight, positioning matters, and you can lose badly.",
        "direct": "Forces AI ti say words like D and P. No dancing around the subject, no polite deflection. you know what i mean.",
        "color": "Each character's dialogue is color-coded for easy visual parsing.",
        "npc_events": "Requires all new story events to grow naturally from prior context or environmental cues — no random drama out of nowhere. V6 only.",
        "dn": "Forces dialogue and narration to be wrapped in their respective XML tags. Useful for specific Models for better narration style adherence."
    };
    const grid = $(`<div class="ps-grid"></div>`);

    // Only declared ONCE here.
    const activeMode = [...hardcodedLogic.modes, ...(extension_settings[extensionName].customModes || [])].find(m => m.id === localProfile.mode);
    const isV6 = activeMode && (activeMode.id.includes("v6") || activeMode.label.includes("V6"));

    // Add standard hardcoded addons
    hardcodedLogic.addons.forEach(a => {
        const isSel = localProfile.addons.includes(a.id);
        const recText = a.recommended ? `<span class="ps-rec-text"><i class="fa-solid fa-star"></i> Recommended</span>` : '';

        let disabledStyle = "";
        let v6Badge = "";

        if (a.id === "npc_events") {
            if (!isV6) {
                disabledStyle = "opacity: 0.4; filter: grayscale(100%); pointer-events: none;";
                v6Badge = `<div style="color: #ef4444; font-size: 0.65rem; font-weight: 800; margin-top: 10px;"><i class="fa-solid fa-lock"></i> REQUIRES V6 ENGINE</div>`;
            } else {
                v6Badge = `<div style="color: #10b981; font-size: 0.65rem; font-weight: 800; margin-top: 10px;"><i class="fa-solid fa-unlock"></i> V6 ACTIVE</div>`;
            }
        }

        const card = $(`<div class="ps-card ${isSel ? 'selected' : ''}" style="${disabledStyle}">
            <div class="ps-card-title"><span>${a.label}</span> ${recText}</div>
            <div class="ps-card-desc">${descriptions[a.id] || ""}</div>
            ${v6Badge}
        </div>`);

        card.on("click", () => {
            if (isSel) localProfile.addons = localProfile.addons.filter(i => i !== a.id); else localProfile.addons.push(a.id);
            saveProfileToMemory(); switchTab(currentTab);
        }); grid.append(card);
    });

    if (!localProfile.onomatopoeia) localProfile.onomatopoeia = { enabled: false, useStyling: false };
    const isOno = localProfile.onomatopoeia.enabled;
    const isOnoStyle = localProfile.onomatopoeia.useStyling;

    const onoCard = $(`
        <div class="ps-card ${isOno ? 'selected' : ''}" style="display: flex; flex-direction: column; justify-content: flex-start;">
            <div class="ps-card-title"><span>Cinematic Sounds (onomatopoeia)</span></div>
            <div class="ps-card-desc">Force the AI to use precise phonetic sound words (e.g., click, thud) instead of abstract descriptions.</div>
            
            <div style="display: ${isOno ? 'flex' : 'none'}; width: 100%; margin-top: 15px; padding-top: 12px; border-top: 1px dashed rgba(0,0,0,0.2); justify-content: space-between; align-items: center;">
                <div style="display:flex; flex-direction:column; flex: 1; padding-right: 10px;">
                    <span style="font-weight:700; font-size: 0.75rem; color: #000;">Animate Sounds</span>
                    <span style="font-size: 0.65rem; color: #444; line-height: 1.2;">Wrap in HTML tags. For capable AI only.</span>
                </div>
                <div class="ps-toggle-card ${isOnoStyle ? 'active' : ''}" id="ono_inner_toggle" style="padding: 4px; min-width: 44px; justify-content: center; background: transparent; border-color: ${isOnoStyle ? '#10b981' : 'rgba(0,0,0,0.3)'};">
                    <div class="ps-switch" style="transform: scale(0.75); ${isOnoStyle ? 'background: #10b981;' : 'background: rgba(0,0,0,0.4);'}"></div>
                </div>
            </div>
        </div>
    `);

    onoCard.on("click", (e) => {
        if ($(e.target).closest("#ono_inner_toggle").length) {
            localProfile.onomatopoeia.useStyling = !localProfile.onomatopoeia.useStyling;
            saveProfileToMemory(); switchTab(currentTab);
            return;
        }
        localProfile.onomatopoeia.enabled = !localProfile.onomatopoeia.enabled;
        saveProfileToMemory(); switchTab(currentTab);
    });

    grid.append(onoCard);
    c.append(grid);

    if (activeMode && activeMode.customToggles) {
        const customSettings = activeMode.customToggles.filter(t => t.location === "settings");
        if (customSettings.length > 0) {
            c.append(`<div class="ps-rule-title" style="margin-top: 10px; margin-bottom:10px; color: #10b981;">Custom Engine Settings</div>`);
            customSettings.forEach(cs => {
                const isSel = !!localProfile.toggles[cs.id];
                const tCard = $(`<div class="ps-toggle-card ${isSel ? 'active' : ''}" style="border-color: ${isSel ? '#10b981' : 'var(--border-color)'};">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:600; color: ${isSel ? '#10b981' : 'var(--text-main)'};">${cs.name}</span>
                        <div style="margin-top:4px; font-size:0.7rem; color:var(--text-muted);">Custom Module Attached to [[${cs.attachPoint}]]</div>
                    </div>
                    <div class="ps-switch" style="${isSel ? 'background:#10b981;' : ''}"></div>
                </div>`);
                tCard.on("click", () => { localProfile.toggles[cs.id] = !localProfile.toggles[cs.id]; saveProfileToMemory(); switchTab(currentTab); });
                c.append(tCard);
            });
        }
    }

    c.append(`
        <div style="margin-top: 32px; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 20px;">
            <div class="ps-rule-title" style="color: var(--text-main); font-size: 0.9rem; font-weight: 700;">
                <i class="fa-solid fa-earth-americas" style="margin-right: 8px; color: #4a90e2;"></i> Extra
            </div>
            
            <div class="ps-toggle-card ${localProfile.disableUtilityPrefill ? 'active' : ''}" id="ps_toggle_utility_prefill" style="padding: 12px 18px;">
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:600; font-size: 0.85rem;">Disable Utility Prefills</span>
                    <div style="margin-top:2px; font-size: 0.75rem; color: var(--text-muted);">Turn this ON if your API (like Claude) errors out during Image Gen, Banlist, or Story Planner generation. Stops the engine from forcing an 'assistant' message.</div>
                </div>
                <div class="ps-switch"></div>
            </div>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0;" />

            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="flex: 1;"><div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">Target Word Count</div><div style="font-size: 0.75rem; color: var(--text-muted);">Leave empty for no limit</div></div>
                <input type="number" id="ps_input_wordcount" class="ps-modern-input" style="width: 200px;" placeholder="e.g. 400" value="${localProfile.userWordCount || ''}" min="1" />
            </div>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0;" />
            
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="flex: 1;"><div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">Language Output</div><div style="font-size: 0.75rem; color: var(--text-muted);">Leave empty for default (English)</div></div>
                <input type="text" id="ps_input_language" class="ps-modern-input" style="width: 200px;" placeholder="e.g. Arabic, French..." value="${localProfile.userLanguage || ''}" />
            </div>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0;" />
            
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="flex: 1;"><div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">User Gender</div><div style="font-size: 0.75rem; color: var(--text-muted);">Ensure the AI addresses you correctly</div></div>
                <select id="ps_select_pronouns" class="ps-modern-input" style="width: 200px; cursor: pointer;">
                    <option value="off" ${localProfile.userPronouns === 'off' ? 'selected' : ''}>Off</option>
                    <option value="male" ${localProfile.userPronouns === 'male' ? 'selected' : ''}>Male (Him/He)</option>
                    <option value="female" ${localProfile.userPronouns === 'female' ? 'selected' : ''}>Female (Her/She)</option>
                </select>
            </div>
        </div>
    `);

    $("#ps_toggle_utility_prefill").on("click", function () {
        localProfile.disableUtilityPrefill = !localProfile.disableUtilityPrefill;
        saveProfileToMemory();
        if (localProfile.disableUtilityPrefill) $(this).addClass("active");
        else $(this).removeClass("active");
    });
    $("#ps_input_wordcount").on("input", function () { localProfile.userWordCount = $(this).val(); saveProfileToMemory(); });
    $("#ps_input_language").on("input", function () { localProfile.userLanguage = $(this).val(); saveProfileToMemory(); });
    $("#ps_select_pronouns").on("change", function () { localProfile.userPronouns = $(this).val(); saveProfileToMemory(); });
}

function renderBlocks(c) {
    // RE-DECLARED HERE SAFELY
    const activeEngine = [...hardcodedLogic.modes, ...(extension_settings[extensionName].customModes || [])].find(m => m.id === localProfile.mode);
    const descriptions = {
        "info": "Appends a tidy status panel after each response showing time, weather, location, and what characters are wearing.",
        "summary": "Keeps a running story digest that the AI updates each turn — helps it remember names, events, and details over long sessions.",
        "cyoa": "Choose-Your-Own-Adventure panel with 4 suggested actions for you to pick from each turn.",
        "mvu": "Add MVU Compatibility still in test read more here: <a href='https://github.com/KritBlade/MVU_Game_Maker' target='_blank' style='color: var(--gold); text-decoration: underline;'>https://github.com/KritBlade/MVU_Game_Maker</a>"
    };
    const grid = $(`<div class="ps-grid"></div>`);
    hardcodedLogic.blocks.forEach(b => {
        const isSel = localProfile.blocks.includes(b.id);

        const isOverridden = activeEngine && activeEngine[b.id] && activeEngine[b.id].trim() !== "";
        const overrideText = isOverridden ? `<div style="color: #10b981; font-weight: 800; font-size: 0.65rem; margin-top: 4px; text-transform: uppercase;">Using Engine Version</div>` : "";

        const card = $(`<div class="ps-card ${isSel ? 'selected' : ''}" style="${isOverridden ? 'border-color: #10b981; border-width: 2px;' : ''}">
            <div class="ps-card-title"><span style="${isOverridden && !isSel ? 'color: #10b981;' : ''}">${b.label}</span></div>
            <div class="ps-card-desc">${descriptions[b.id] || ""}</div>
            ${overrideText}
        </div>`);
        card.on("click", (e) => {
            if ($(e.target).closest("a").length) return;
            if (isSel) localProfile.blocks = localProfile.blocks.filter(i => i !== b.id); else localProfile.blocks.push(b.id);
            saveProfileToMemory(); switchTab(currentTab);
        }); grid.append(card);
    });

    if (activeEngine && activeEngine.customToggles) {
        const customAddons = activeEngine.customToggles.filter(t => t.location === "addons");
        if (customAddons.length > 0) {
            grid.append(`<div style="grid-column: 1 / -1; margin-top: 10px;"><div class="ps-rule-title" style="color: #10b981; margin-bottom: 0;">Custom Engine Add-ons</div></div>`);
            customAddons.forEach(ca => {
                const isSel = !!localProfile.toggles[ca.id];
                const card = $(`<div class="ps-card ${isSel ? 'selected' : ''}" style="border-color: ${isSel ? '#10b981' : 'var(--border-color)'}; background: ${isSel ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-panel)'};">
                    <div class="ps-card-title"><span style="color: ${isSel ? '#10b981' : 'var(--text-main)'};">${ca.name}</span></div>
                    <div class="ps-card-desc">Custom Module Attached to [[${ca.attachPoint}]]</div>
                </div>`);
                card.on("click", () => { localProfile.toggles[ca.id] = !localProfile.toggles[ca.id]; saveProfileToMemory(); switchTab(currentTab); });
                grid.append(card);
            });
        }
    } c.append(grid);
}

function renderModels(c) {
    c.empty();
    const activeEngine = [...hardcodedLogic.modes, ...(extension_settings[extensionName].customModes || [])].find(m => m.id === localProfile.mode);

    // IF CUSTOM COT EXISTS, SHOW GREEN INDICATOR
    if (activeEngine && activeEngine.cot && activeEngine.cot.trim() !== "") {
        c.append(`
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 12px; padding: 15px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px;">
                <i class="fa-solid fa-shield-halved" style="font-size: 1.5rem; color: #10b981;"></i>
                <div>
                    <div style="font-weight: bold; color: #10b981; font-size: 0.9rem;">Custom Engine Logic Active</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">This Engine provides its own [[COT]] and [[prefill]]. Selections below will be overridden by the Engine's code.</div>
                </div>
            </div>
        `);
    }
    const migrationMap = {
        "cot-english": "cot-v1-english", "cot-arabic": "cot-v1-arabic", "cot-spanish": "cot-v1-spanish", "cot-french": "cot-v1-french",
        "cot-zh": "cot-v1-zh", "cot-ru": "cot-v1-ru", "cot-jp": "cot-v1-jp", "cot-pt": "cot-v1-pt", "cot-english-test": "cot-v2-english"
    };
    if (migrationMap[localProfile.model]) { localProfile.model = migrationMap[localProfile.model]; saveProfileToMemory(); }

    let currentType = "off", currentLang = "english";
    if (localProfile.model && localProfile.model.startsWith("cot-v1-")) { currentType = "v1"; currentLang = localProfile.model.replace("cot-v1-", ""); }
    else if (localProfile.model && localProfile.model.startsWith("cot-v2-")) { currentType = "v2"; currentLang = localProfile.model.replace("cot-v2-", ""); }
    else if (localProfile.model && localProfile.model.startsWith("cot-v6-lite-")) { currentType = "v6-lite"; currentLang = localProfile.model.replace("cot-v6-lite-", ""); }
    else if (localProfile.model && localProfile.model.startsWith("cot-v6-")) { currentType = "v6"; currentLang = localProfile.model.replace("cot-v6-", ""); }

    if (!localProfile.thinkEffort) localProfile.thinkEffort = "unspecified";
    if (!localProfile.customThinkEffort) localProfile.customThinkEffort = "100";

    c.append(`<div class="ps-rule-title" style="margin-bottom:10px;">Select Thinking Effort</div>`);
    const effortGrid = $(`<div class="ps-grid" style="margin-bottom: 25px; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));"></div>`);
    const efforts = [
        { id: "100", label: "100 Words" },
        { id: "250", label: "250 Words" },
        { id: "450", label: "450 Words" },
        { id: "custom", label: "Custom" },
        { id: "unspecified", label: "Unspecified" }
    ];
    efforts.forEach(e => {
        const isSel = localProfile.thinkEffort === e.id;
        const card = $(`<div class="ps-card ${isSel ? 'selected' : ''}" style="padding: 12px 10px; min-height: unset; text-align: center;">
            <div class="ps-card-title" style="margin-bottom: 0; font-size: 0.9rem; display: flex; justify-content: center;"><span>${e.label}</span></div>
        </div>`);
        card.on("click", () => {
            localProfile.thinkEffort = e.id;
            saveProfileToMemory();
            renderModels(c);
        });
        effortGrid.append(card);
    });
    c.append(effortGrid);

    if (localProfile.thinkEffort === "custom") {
        const customBlock = $(`
            <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 15px; margin-top: -15px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px;">
                <div style="flex: 1;"><div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">Custom Word Count</div></div>
                <input type="number" id="ps_input_custom_effort" class="ps-modern-input" style="width: 150px;" value="${localProfile.customThinkEffort}" min="1" />
            </div>
        `);
        customBlock.find("#ps_input_custom_effort").on("change input", function () {
            localProfile.customThinkEffort = $(this).val();
            saveProfileToMemory();
        });
        c.append(customBlock);
    }

    if (localProfile.thinkingV2 === undefined) localProfile.thinkingV2 = false;
    const v2Card = $(`
        <div class="ps-toggle-card ${localProfile.thinkingV2 ? 'active' : ''}" style="margin-bottom: 20px; border-color: ${localProfile.thinkingV2 ? 'var(--gold)' : 'var(--border-color)'};">
            <div style="display:flex; flex-direction:column;">
                <span style="font-weight:700; font-size: 1.05rem; color: ${localProfile.thinkingV2 ? 'var(--gold)' : 'var(--text-main)'};"><i class="fa-solid fa-brain"></i> Gemini Thinking</span>
                <div style="margin-top:4px; font-size: 0.8rem; color: var(--text-muted);">This toggle is only for Gemini 3.1 Pro and 3 Flash.</div>
            </div>
            <div class="ps-switch"></div>
        </div>
    `);
    v2Card.on("click", function() {
        localProfile.thinkingV2 = !localProfile.thinkingV2;
        saveProfileToMemory();
        renderModels(c);
    });
    c.append(v2Card);

    c.append(`<hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 0 0 20px 0;" />`);

    c.append(`<div class="ps-rule-title" style="margin-bottom:10px;">Select Thinking Framework</div>`);
    const typeGrid = $(`<div class="ps-grid" style="margin-bottom: 25px;"></div>`);
    const types = [
        { id: "off", label: "CoT Off", desc: "No Chain of Thought or prefill. The AI will respond normally." },
        { id: "v1", label: "CoT V1 (Classic)", desc: "The original 8-step framework. Focuses heavily on the NPC's internal emotional landscape vs their observable actions." },
        { id: "v2", label: "CoT V2 (New)", desc: "The new experimental framework. Stricter reality checks, info audits, better NPCs, and hook generation." },
        { id: "v6", label: "CoT V6 (Dream Team)", desc: "The full 4-phase sequence designed specifically for V6 engines. Specialized validation and modeling.", isNew: true },
        { id: "v6-lite", label: "CoT V6 (Lite)", desc: "A streamlined 3-phase sequence. Less token overhead while maintaining narrative rules.", isNew: true }
    ];
    types.forEach(t => {
        const isSel = currentType === t.id;
        const newBadgeHtml = t.isNew ? `<div style="position: absolute; bottom: 15px; right: 15px; background: #3b82f6; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 3px 10px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.4);">New</div>` : '';
        const card = $(`
            <div class="ps-card ${isSel ? 'selected' : ''}" style="position: relative; padding-bottom: ${t.isNew ? '40px' : '20px'};">
                <div class="ps-card-title"><span>${t.label}</span></div>
                <div class="ps-card-desc">${t.desc}</div>${newBadgeHtml}
            </div>
        `);
        card.on("click", () => {
            if (t.id === "off") localProfile.model = "cot-off"; else localProfile.model = `cot-${t.id}-${currentLang}`;
            saveProfileToMemory(); renderModels(c);
        }); typeGrid.append(card);
    }); c.append(typeGrid);

    if (currentType !== "off") {
        c.append(`<hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 0 0 20px 0;" />`);
        c.append(`<div class="ps-rule-title" style="margin-bottom:10px;">Select Language</div>`);
        const langGrid = $(`<div class="ps-grid"></div>`);
        const langs = [
            { id: "english", label: "English" }, { id: "arabic", label: "Arabic (العربية)", rec: true }, { id: "spanish", label: "Spanish (Español)" },
            { id: "french", label: "French (Français)" }, { id: "zh", label: "Mandarin (中文)" }, { id: "ru", label: "Russian (Русский)" },
            { id: "jp", label: "Japanese (日本語)" }, { id: "pt", label: "Portuguese (Português)" }
        ];
        langs.forEach(l => {
            const isSel = currentLang === l.id;
            const recText = l.rec ? `<span class="ps-rec-text"><i class="fa-solid fa-star"></i> Pro Tip</span>` : '';
            const card = $(`
                <div class="ps-card ${isSel ? 'selected' : ''}" style="padding: 12px 18px; min-height: unset;">
                    <div class="ps-card-title" style="margin-bottom: 0; font-size: 0.9rem;"><span>${l.label}</span> ${recText}</div>
                </div>
            `);
            card.on("click", () => { localProfile.model = `cot-${currentType}-${l.id}`; saveProfileToMemory(); renderModels(c); });
            langGrid.append(card);
        }); c.append(langGrid);
    }
}

// -------------------------------------------------------------
// STAGE 7.5: STORY PLANNER
// -------------------------------------------------------------
function renderStoryPlanner(c) {
    c.empty();
    const sp = localProfile.storyPlan;

    c.append(`
        <!-- MASTER TOGGLE -->
        <div class="ps-toggle-card ${sp.enabled ? 'active' : ''}" id="sp_enable_card" style="border-color: ${sp.enabled ? 'var(--gold)' : 'var(--border-color)'}; margin-bottom: 20px;">
            <div style="display:flex; flex-direction:column;">
                <span style="font-weight:700; font-size: 1.1rem; color: ${sp.enabled ? 'var(--gold)' : 'var(--text-main)'};"><i class="fa-solid fa-map-location-dot"></i> Enable Story Planner</span>
                <div style="margin-top:4px; font-size: 0.8rem; color: var(--text-muted);">Automatically brainstorms and tracks plot milestones. Injects via [[storyplan]] and [[storytracker]].</div>
            </div>
            <div class="ps-switch"></div>
        </div>

        <div id="sp_main_content" style="display: ${sp.enabled ? 'block' : 'none'};">
            
            <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div class="ps-rule-title" style="margin-bottom: 12px;"><i class="fa-solid fa-gears"></i> Engine Settings</div>
                
                <div style="display: flex; gap: 15px; margin-bottom: 15px; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.85rem; font-weight: 600;">Generation Backend</div>
                    </div>
                    <select id="sp_backend" class="ps-modern-input" style="width: 250px; cursor: pointer;">
                        <option value="direct" ${sp.backend === 'direct' ? 'selected' : ''}>Direct API Call (Fast)</option>
                        <option value="preset" ${sp.backend === 'preset' ? 'selected' : ''}>Megumin Engine Preset</option>
                    </select>
                </div>

                <div style="display: flex; gap: 15px; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.85rem; font-weight: 600;">Auto-Trigger Mode</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Generate new plans automatically.</div>
                    </div>
                    <select id="sp_trigger" class="ps-modern-input" style="width: 150px; cursor: pointer;">
                        <option value="manual" ${sp.triggerMode === 'manual' ? 'selected' : ''}>Manual Only</option>
                        <option value="frequency" ${sp.triggerMode === 'frequency' ? 'selected' : ''}>Every X Replies</option>
                    </select>
                    <input type="number" id="sp_freq" class="ps-modern-input" value="${sp.autoFreq}" min="1" style="width: 80px; text-align: center; display: ${sp.triggerMode === 'frequency' ? 'block' : 'none'};" title="Number of AI replies" />
                </div>
            </div>

            <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div class="ps-rule-title" style="margin-bottom: 0;"><i class="fa-solid fa-book-open"></i> Current Story Plan</div>
                    <button id="sp_btn_generate" class="ps-modern-btn primary" style="background: var(--gold); color: #000; padding: 8px 16px; font-weight: bold;"><i class="fa-solid fa-bolt"></i> Generate Plan Now</button>
                </div>
                
                <textarea id="sp_current_plan" class="ps-modern-input" style="height: 250px; resize: vertical; font-size: 0.85rem; line-height: 1.5; margin-bottom: 10px;" placeholder="Generated plot milestones will appear here. You can manually edit them.">${sp.currentPlan || ""}</textarea>
                
                <div style="background: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; border-radius: 4px; padding: 12px 16px;">
                    <div style="display: flex; align-items: center; gap: 8px; color: #3b82f6; font-weight: 600; font-size: 0.85rem; margin-bottom: 4px;"><i class="fa-solid fa-circle-info"></i> How to Use</div>
                    <div style="color: var(--text-main); font-size: 0.8rem; line-height: 1.5;">A tracker will be added automaticly at the end of each response.</div>
                </div>
            </div>
        </div>
    `);

    // Listeners
    $("#sp_enable_card").on("click", function () {
        sp.enabled = !sp.enabled; saveProfileToMemory();
        if (sp.enabled) { $(this).addClass("active").css("border-color", "var(--gold)").find("span").css("color", "var(--gold)"); $("#sp_main_content").slideDown(200); }
        else { $(this).removeClass("active").css("border-color", "var(--border-color)").find("span").css("color", "var(--text-main)"); $("#sp_main_content").slideUp(200); }
    });

    $("#sp_backend").on("change", e => { sp.backend = $(e.target).val(); saveProfileToMemory(); });
    $("#sp_trigger").on("change", e => {
        sp.triggerMode = $(e.target).val(); saveProfileToMemory();
        if (sp.triggerMode === 'frequency') $("#sp_freq").show(); else $("#sp_freq").hide();
    });
    $("#sp_freq").on("input", e => { sp.autoFreq = Math.max(1, parseInt($(e.target).val()) || 10); saveProfileToMemory(); });
    $("#sp_current_plan").on("input", e => { sp.currentPlan = $(e.target).val(); saveProfileToMemory(); });

    $("#sp_btn_generate").on("click", async function () {
        const chatText = getCleanedChatHistory();
        if (chatText.length < 100) return toastr.warning("Not enough chat history to generate a plot.");

        const btn = $(this);
        btn.prop("disabled", true).html(`<i class="fa-solid fa-spinner fa-spin"></i> Brainstorming...`);

        try {
            let output;
            if (sp.backend === "direct") {
                output = await generateStoryPlanLogic(chatText);
            } else {
                await useMeguminEngine(async () => { output = await generateStoryPlanLogic(chatText); });
            }

            if (output) {
                // Extract only what is inside <plot></plot>
                const plotMatch = output.match(/<plot>([\s\S]*?)<\/plot>/i);
                if (plotMatch) {
                    sp.currentPlan = plotMatch[1].trim();
                    $("#sp_current_plan").val(sp.currentPlan);
                    saveProfileToMemory();
                    toastr.success("Story Plan Generated!");
                } else {
                    toastr.warning("AI failed to format the plot correctly. Try again.");
                }
            }
        } catch (e) {
            toastr.error("Failed to generate plot.");
        } finally {
            btn.prop("disabled", false).html(`<i class="fa-solid fa-bolt"></i> Generate Plan Now`);
        }
    });
}

async function generateStoryPlanLogic(chatText) {
    activeStoryPlanRequest = chatText;
    try {
        let rawOutput = await generateQuietPrompt({ prompt: "___PS_STORY_PLAN___" });
        return rawOutput;
    } finally {
        activeStoryPlanRequest = null;
    }
}

function renderBanList(c) {
    c.empty();
    if (!localProfile.banList) localProfile.banList = [];
    c.append(`
        <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div><span style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">AI Slop Detector</span><div style="font-size: 0.75rem; color: var(--text-muted);">Scans the last 15 AI messages to catch overused clichés.</div></div>
                <button id="ps_btn_scan_slop" class="ps-modern-btn primary" style="padding: 8px 16px; font-size: 0.8rem; background: #a855f7; color: #fff;"><i class="fa-solid fa-radar"></i> Analyze Chat History</button>
            </div>
                <hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 15px 0;" />
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">Generator Backend</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Choose how to generate the analysis.</div>
                    </div>
                    <select id="ban_list_backend" class="ps-modern-input" style="width: 200px; cursor: pointer;">
                        <option value="direct" ${localProfile.banListBackend === 'direct' ? 'selected' : ''}>Direct API Call (Fast)</option>
                        <option value="preset" ${localProfile.banListBackend === 'preset' ? 'selected' : ''}>Megumin Engine Preset</option>
                    </select>
                </div>
            <hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 15px 0;" />
            <div style="display: flex; gap: 10px;">
                <input type="text" id="ps_manual_ban_input" class="ps-modern-input" placeholder="Manually add a phrase to ban..." style="flex: 1;" />
                <button id="ps_btn_add_ban" class="ps-modern-btn secondary" style="padding: 0 15px;">Add</button>
            </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div class="ps-rule-title" style="margin-bottom: 0;">Active Banned Phrases</div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <input type="file" id="ps_import_bans_file" accept=".json" style="display: none;">
                <button id="ps_btn_import_bans" class="ps-modern-btn secondary" style="padding: 4px 10px; font-size: 0.75rem; color: #3b82f6; border-color: rgba(59, 130, 246, 0.3);"><i class="fa-solid fa-file-import"></i> Import</button>
                <button id="ps_btn_export_bans" class="ps-modern-btn secondary" style="padding: 4px 10px; font-size: 0.75rem; color: #10b981; border-color: rgba(16, 185, 129, 0.3);"><i class="fa-solid fa-file-export"></i> Export</button>
                <button id="ps_btn_clear_bans" class="ps-modern-btn secondary" style="padding: 4px 10px; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);"><i class="fa-solid fa-trash-can"></i> Clear All</button>
            </div>
        </div>
        <div id="ps_banlist_container" style="display: flex; flex-direction: column; gap: 8px; min-height: 50px; padding: 10px; border: 1px dashed var(--border-color); border-radius: 8px;"></div>
        <div style="margin-top: 20px; background: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; border-radius: 4px; padding: 12px 16px;">
            <div style="display: flex; align-items: center; gap: 8px; color: #3b82f6; font-weight: 600; font-size: 0.85rem; margin-bottom: 4px;"><i class="fa-solid fa-circle-info"></i> Note</div>
            <div style="color: var(--text-main); font-size: 0.8rem; line-height: 1.5;">This is a beta feature. Don't complain if you have to generate more than once.</div>
        </div>
    `);

    const renderTags = () => {
        const box = $("#ps_banlist_container"); box.empty();
        if (localProfile.banList.length === 0) { box.append(`<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">No phrases banned yet.</span>`); return; }
        localProfile.banList.forEach(phrase => {
            const tEl = $(`<div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444; padding: 10px 14px; border-radius: 6px; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.2s; word-break: break-word; line-height: 1.4;">
                <span style="padding-right: 15px;">${phrase}</span>
                <i class="fa-solid fa-xmark" style="opacity: 0.7;"></i>
            </div>`);
            tEl.on("mouseenter", function() { $(this).css("background", "rgba(239, 68, 68, 0.15)"); });
            tEl.on("mouseleave", function() { $(this).css("background", "rgba(239, 68, 68, 0.08)"); });
            tEl.on("click", () => { localProfile.banList = localProfile.banList.filter(p => p !== phrase); saveProfileToMemory(); renderTags(); }); box.append(tEl);
        });
    }; renderTags();

    $("#ps_btn_add_ban").on("click", () => {
        const val = $("#ps_manual_ban_input").val().trim();
        if (val && !localProfile.banList.includes(val)) { localProfile.banList.push(val); saveProfileToMemory(); $("#ps_manual_ban_input").val(""); renderTags(); }
    });
    $("#ps_btn_clear_bans").on("click", () => {
        if (localProfile.banList.length === 0) return;
        if (confirm("Are you sure you want to delete all banned phrases?")) { localProfile.banList = []; saveProfileToMemory(); renderTags(); toastr.info("Ban list cleared."); }
    });
    $("#ps_btn_export_bans").on("click", () => {
        if (!localProfile.banList || localProfile.banList.length === 0) return toastr.warning("Ban list is empty!");
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localProfile.banList, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `banlist_${localProfile.id || 'export'}.json`);
        document.body.appendChild(dlAnchorElem);
        dlAnchorElem.click();
        document.body.removeChild(dlAnchorElem);
    });
    $("#ps_btn_import_bans").on("click", () => {
        $("#ps_import_bans_file").trigger("click");
    });
    $("#ps_import_bans_file").on("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const imported = JSON.parse(evt.target.result);
                if (Array.isArray(imported)) {
                    let added = 0;
                    imported.forEach(p => {
                        if (typeof p === 'string' && !localProfile.banList.includes(p.trim()) && p.trim().length > 0) {
                            localProfile.banList.push(p.trim());
                            added++;
                        }
                    });
                    saveProfileToMemory();
                    renderTags();
                    if (added > 0) toastr.success(`Imported ${added} phrases!`);
                    else toastr.info("No new phrases imported.");
                } else {
                    toastr.error("Invalid JSON format. Expected an array of strings.");
                }
            } catch (err) {
                toastr.error("Error parsing JSON file.");
            }
        };
        reader.readAsText(file);
        $(this).val('');
    });
    $("#ban_list_backend").on("change", function () {
        localProfile.banListBackend = $(this).val();
        saveProfileToMemory();
    });
    $("#ps_btn_scan_slop").on("click", async function () {
        const chatText = getCleanedChatHistory();
        if (chatText.length < 50) return toastr.warning("Not enough chat history to analyze!");
        $(this).prop("disabled", true).html(`<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...`);
        let rawResponse;
        if (localProfile.banListBackend === "direct") {
            rawResponse = await analyzeSlopDirectly(chatText);
        } else {
            rawResponse = await analyzeSlopWithPreset(chatText);
        }
        if (rawResponse) {
            const newPhrases = rawResponse.split(/[,*\n-]/).map(t => t.trim().replace(/['"\[\]\.]/g, '')).filter(t => t.length > 3);
            let addedCount = 0;
            newPhrases.forEach(p => { if (!localProfile.banList.includes(p)) { localProfile.banList.push(p); addedCount++; } });
            if (addedCount > 0) { saveProfileToMemory(); renderTags(); toastr.success(`Caught and banned ${addedCount} repetitive phrases!`); } else { toastr.info("No new repetitive phrases found."); }
        }
        $(this).prop("disabled", false).html(`<i class="fa-solid fa-radar"></i> Analyze Chat History`);
    });
}

// -------------------------------------------------------------
// STAGE 8: IMAGE GEN KAZUMA (ComfyUI Integration)
// -------------------------------------------------------------
function renderImageGen(c) {
    c.empty();
    const s = localProfile.imageGen;

    c.append(`
        <!-- MASTER TOGGLE -->
        <div class="ps-toggle-card ${s.enabled ? 'active' : ''}" id="ig_enable_card" style="border-color: ${s.enabled ? 'var(--gold)' : 'var(--border-color)'};">
            <div style="display:flex; flex-direction:column;">
                <span style="font-weight:700; font-size: 1.1rem; color: ${s.enabled ? 'var(--gold)' : 'var(--text-main)'};"><i class="fa-solid fa-image"></i> Enable Image Generation</span>
                <div style="margin-top:4px; font-size: 0.8rem; color: var(--text-muted);">Activate ComfyUI integration for this specific character/group.</div>
            </div>
            <div class="ps-switch"></div>
        </div>
        <!-- Generator Backend -->
            <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div class="ps-rule-title" style="margin-bottom: 12px;"><i class="fa-solid fa-gears"></i> Prompt Generator Backend</div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">Generation Method</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">"Direct" is faster. "Megumin Image" is more creative and follows your preset instructions.</div>
                    </div>
                    <select id="img_gen_backend" class="ps-modern-input" style="width: 220px; cursor: pointer;">
                        <option value="direct" ${s.generatorBackend === 'direct' ? 'selected' : ''}>Direct API Call (Fast)</option>
                        <option value="preset" ${s.generatorBackend === 'preset' ? 'selected' : ''}>Megumin Image Preset</option>
                    </select>
                </div>
            </div>

        <div id="ig_main_content" style="display: ${s.enabled ? 'block' : 'none'};">
            
            <!-- Connection & Workflow -->
            <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div class="ps-rule-title" style="margin-bottom: 12px;"><i class="fa-solid fa-link"></i> ComfyUI Server & Workflow</div>
                
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <input type="text" id="ig_url" class="ps-modern-input" value="${s.comfyUrl}" placeholder="http://127.0.0.1:8188" style="flex: 1;" />
                    <button id="ig_test_btn" class="ps-modern-btn secondary" style="padding: 0 15px;"><i class="fa-solid fa-wifi"></i> Test</button>
                </div>

                <div style="display: flex; gap: 10px; align-items: center;">
                    <select id="ig_workflow_list" class="ps-modern-input" style="flex: 1; cursor: pointer;"></select>
                    <button id="ig_new_wf" class="ps-modern-btn secondary" title="New Workflow"><i class="fa-solid fa-plus"></i></button>
                    <button id="ig_edit_wf" class="ps-modern-btn secondary" title="Edit JSON"><i class="fa-solid fa-pen"></i></button>
                    <button id="ig_del_wf" class="ps-modern-btn secondary" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>

            <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div class="ps-rule-title" style="margin-bottom: 12px;"><i class="fa-solid fa-pen-nib"></i> Generation Triggers & Formatting</div>
                
                <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                    <div style="flex: 2;">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px;">Trigger Mode</div>
                        <select id="ig_trigger_mode" class="ps-modern-input" style="padding: 8px; font-size: 0.8rem; cursor: pointer;">
                            <option value="always" ${s.triggerMode === 'always' ? 'selected' : ''}>Always (Every Reply)</option>
                            <option value="frequency" ${s.triggerMode === 'frequency' ? 'selected' : ''}>After X Replies</option>
                            <option value="conditional" ${s.triggerMode === 'conditional' ? 'selected' : ''}>Only when character sends a pic</option>
                            <option value="manual" ${s.triggerMode === 'manual' ? 'selected' : ''}>Manual Button Only</option>
                        </select>
                    </div>
                    <div style="flex: 1; display: ${s.triggerMode === 'frequency' ? 'block' : 'none'};" id="ig_freq_container">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px;">Every X Replies</div>
                        <input type="number" id="ig_auto_freq" class="ps-modern-input" value="${s.autoGenFreq}" min="1" style="padding: 8px; font-size: 0.8rem; text-align: center;" />
                    </div>
                </div>

                <div class="ps-toggle-card ${s.previewPrompt ? 'active' : ''}" id="ig_preview_card" style="padding: 12px 18px; margin-bottom: 15px;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:600; font-size:0.85rem;">Preview Prompt Before Sending</span>
                        <div style="margin-top:2px; font-size: 0.7rem; color: var(--text-muted);">Show a popup to view or edit the AI's prompt before rendering.</div>
                    </div>
                    <div class="ps-switch"></div>
                </div>

                <div id="ig_prompt_builder" style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border-left: 3px solid var(--gold);">
                    <div style="display: flex; gap: 15px; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px;">Model Style Format</div>
                            <select id="ig_style" class="ps-modern-input" style="padding: 8px; font-size: 0.8rem;">
                                <option value="standard" ${s.promptStyle === 'standard' ? 'selected' : ''}>Standard (Descriptive)</option>
                                <option value="illustrious" ${s.promptStyle === 'illustrious' ? 'selected' : ''}>Illustrious/Pony (Tags)</option>
                                <option value="sdxl" ${s.promptStyle === 'sdxl' ? 'selected' : ''}>SDXL (Natural Prose)</option>
                            </select>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px;">Camera Perspective</div>
                            <select id="ig_persp" class="ps-modern-input" style="padding: 8px; font-size: 0.8rem;">
                                <option value="scene" ${s.promptPerspective === 'scene' ? 'selected' : ''}>Cinematic Scene</option>
                                <option value="pov" ${s.promptPerspective === 'pov' ? 'selected' : ''}>First Person (POV)</option>
                                <option value="character" ${s.promptPerspective === 'character' ? 'selected' : ''}>Character Portrait</option>
                            </select>
                        </div>
                    </div>
                    <input type="text" id="ig_extra" class="ps-modern-input" placeholder="Extra Instructions (e.g. moody lighting, dark atmosphere...)" value="${s.promptExtra}" style="padding: 8px; font-size: 0.8rem;" />
                </div>
            </div>

            <!-- Parameters Grid -->
            <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div class="ps-rule-title" style="margin-bottom: 12px;"><i class="fa-solid fa-sliders"></i> Image Parameters</div>
                
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <select id="ig_model" class="ps-modern-input" style="flex: 2;"><option value="">Loading Models...</option></select>
                    <select id="ig_sampler" class="ps-modern-input" style="flex: 1;"><option value="">Loading Samplers...</option></select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; background: rgba(0,0,0,0.1); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <!-- Steps -->
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="width: 50px; font-size: 0.8rem; font-weight: bold; color: var(--text-muted);">Steps</span>
                        <input type="range" id="ig_steps" min="1" max="100" value="${s.steps}" style="flex: 1; cursor: pointer;">
                        <input type="number" id="ig_steps_val" class="ps-modern-input" style="width: 50px; padding: 4px; text-align: center; font-size: 0.75rem;" value="${s.steps}">
                    </div>
                    <!-- CFG -->
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="width: 50px; font-size: 0.8rem; font-weight: bold; color: var(--text-muted);">CFG</span>
                        <input type="range" id="ig_cfg" min="1" max="30" step="0.5" value="${s.cfg}" style="flex: 1; cursor: pointer;">
                        <input type="number" id="ig_cfg_val" class="ps-modern-input" style="width: 50px; padding: 4px; text-align: center; font-size: 0.75rem;" value="${s.cfg}">
                    </div>
                    <!-- Denoise -->
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="width: 50px; font-size: 0.8rem; font-weight: bold; color: var(--text-muted);">Denoise</span>
                        <input type="range" id="ig_denoise" min="0" max="1" step="0.05" value="${s.denoise}" style="flex: 1; cursor: pointer;">
                        <input type="number" id="ig_denoise_val" class="ps-modern-input" style="width: 50px; padding: 4px; text-align: center; font-size: 0.75rem;" value="${s.denoise}">
                    </div>
                    <!-- Clip Skip -->
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="width: 50px; font-size: 0.8rem; font-weight: bold; color: var(--text-muted);">CLIP</span>
                        <input type="range" id="ig_clip" min="1" max="12" step="1" value="${s.clipSkip}" style="flex: 1; cursor: pointer;">
                        <input type="number" id="ig_clip_val" class="ps-modern-input" style="width: 50px; padding: 4px; text-align: center; font-size: 0.75rem;" value="${s.clipSkip}">
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: 2;">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase;">Resolution Preset</div>
                        <select id="ig_res_preset" class="ps-modern-input" style="padding: 8px; font-size: 0.8rem;"></select>
                    </div>
                    <div style="flex: 1; display: flex; align-items: flex-end; gap: 5px;">
                        <input type="number" id="ig_w" class="ps-modern-input" value="${s.imgWidth}" placeholder="W" style="padding: 8px; text-align: center; font-size: 0.8rem;" />
                        <span style="color: var(--text-muted); padding-bottom: 8px;">x</span>
                        <input type="number" id="ig_h" class="ps-modern-input" value="${s.imgHeight}" placeholder="H" style="padding: 8px; text-align: center; font-size: 0.8rem;" />
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase;">Seed (-1 for random)</div>
                        <input type="number" id="ig_seed" class="ps-modern-input" value="${s.customSeed}" style="padding: 8px; font-size: 0.8rem;" />
                    </div>
                    <div style="flex: 2;">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase;">Negative Prompt Override</div>
                        <input type="text" id="ig_neg" class="ps-modern-input" value="${s.customNegative}" style="padding: 8px; font-size: 0.8rem;" />
                    </div>
                </div>
            </div>

            <!-- LoRA Lab -->
            <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div class="ps-rule-title" style="margin-bottom: 12px;"><i class="fa-solid fa-flask"></i> LoRA Lab</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    ${[1, 2, 3, 4].map(i => `
                        <div style="background: rgba(0,0,0,0.15); border: 1px solid var(--border-color); padding: 10px; border-radius: 8px; border-left: 3px solid #a855f7;">
                            <div style="font-size: 0.75rem; font-weight: bold; color: var(--text-muted); margin-bottom: 5px;">Slot ${i}</div>
                            <select id="ig_lora_${i}" class="ps-modern-input" style="padding: 6px; font-size: 0.75rem; margin-bottom: 8px;"><option value="">Loading...</option></select>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: bold;">Wt: <span id="ig_lorawt_lbl_${i}" style="color: var(--text-main);">${i === 1 ? s.selectedLoraWt : i === 2 ? s.selectedLoraWt2 : i === 3 ? s.selectedLoraWt3 : s.selectedLoraWt4}</span></span>
                                <input type="range" id="ig_lorawt_${i}" min="-2" max="2" step="0.1" value="${i === 1 ? s.selectedLoraWt : i === 2 ? s.selectedLoraWt2 : i === 3 ? s.selectedLoraWt3 : s.selectedLoraWt4}" style="flex: 1; cursor: pointer;">
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `);

    // --- EVENTS & BINDINGS ---
    $("#ig_enable_card").on("click", function () {
        s.enabled = !s.enabled;
        saveProfileToMemory();
        toggleQuickGenButton(); // <-- ADDED
        if (s.enabled) { $(this).addClass("active"); $(this).css("border-color", "var(--gold)"); $(this).find("span").css("color", "var(--gold)"); $("#ig_main_content").slideDown(200); igFetchComfyLists(); }
        else { $(this).removeClass("active"); $(this).css("border-color", "var(--border-color)"); $(this).find("span").css("color", "var(--text-main)"); $("#ig_main_content").slideUp(200); }
    });
    $("#img_gen_backend").on("change", function () {
        s.generatorBackend = $(this).val();
        saveProfileToMemory();
    });

    $("#ig_trigger_mode").on("change", (e) => {
        s.triggerMode = $(e.target).val();
        saveProfileToMemory();
        toggleQuickGenButton(); // <-- ADDED
        if (s.triggerMode === 'frequency') $("#ig_freq_container").show(); else $("#ig_freq_container").hide();
    });
    $("#ig_auto_freq").on("input", (e) => { let v = parseInt($(e.target).val()); if (v < 1) v = 1; s.autoGenFreq = v; saveProfileToMemory(); });

    $("#ig_preview_card").on("click", function () {
        s.previewPrompt = !s.previewPrompt;
        saveProfileToMemory();
        if (s.previewPrompt) $(this).addClass("active");
        else $(this).removeClass("active");
    });

    // Inputs
    $("#ig_url").on("input", (e) => { s.comfyUrl = $(e.target).val(); saveProfileToMemory(); });
    $("#ig_style").on("change", (e) => { s.promptStyle = $(e.target).val(); saveProfileToMemory(); });
    $("#ig_persp").on("change", (e) => { s.promptPerspective = $(e.target).val(); saveProfileToMemory(); });
    $("#ig_extra").on("input", (e) => { s.promptExtra = $(e.target).val(); saveProfileToMemory(); });
    $("#ig_w, #ig_h").on("input", (e) => { s[e.target.id === "ig_w" ? "imgWidth" : "imgHeight"] = parseInt($(e.target).val()); saveProfileToMemory(); });
    $("#ig_neg").on("input", (e) => { s.customNegative = $(e.target).val(); saveProfileToMemory(); });
    $("#ig_seed").on("input", (e) => { s.customSeed = parseInt($(e.target).val()); saveProfileToMemory(); });

    // Sliders
    const bindSlider = (id, key, isFloat) => {
        $(`#ig_${id}`).on("input", function () { let v = isFloat ? parseFloat(this.value) : parseInt(this.value); s[key] = v; $(`#ig_${id}_val`).val(v); saveProfileToMemory(); });
        $(`#ig_${id}_val`).on("input", function () { let v = isFloat ? parseFloat(this.value) : parseInt(this.value); s[key] = v; $(`#ig_${id}`).val(v); saveProfileToMemory(); });
    };
    bindSlider("steps", "steps", false); bindSlider("cfg", "cfg", true); bindSlider("denoise", "denoise", true); bindSlider("clip", "clipSkip", false);

    // Resolutions
    const resSel = $("#ig_res_preset");
    resSel.empty().append('<option value="">-- Select Preset --</option>');
    RESOLUTIONS.forEach((r, idx) => resSel.append(`<option value="${idx}">${r.label}</option>`));
    resSel.on("change", (e) => {
        const idx = parseInt($(e.target).val());
        if (!isNaN(idx) && RESOLUTIONS[idx]) { $("#ig_w").val(RESOLUTIONS[idx].w).trigger("input"); $("#ig_h").val(RESOLUTIONS[idx].h).trigger("input"); }
    });

    // LoRAs
    for (let i = 1; i <= 4; i++) {
        const key = i === 1 ? "selectedLora" : `selectedLora${i}`;
        const wtKey = i === 1 ? "selectedLoraWt" : `selectedLoraWt${i}`;
        $(`#ig_lora_${i}`).on("change", (e) => { s[key] = $(e.target).val(); saveProfileToMemory(); });
        $(`#ig_lorawt_${i}`).on("input", function () { let v = parseFloat(this.value); s[wtKey] = v; $(`#ig_lorawt_lbl_${i}`).text(v); saveProfileToMemory(); });
    }

    // Models & Samplers
    $("#ig_model").on("change", (e) => { s.selectedModel = $(e.target).val(); saveProfileToMemory(); });
    $("#ig_sampler").on("change", (e) => { s.selectedSampler = $(e.target).val(); saveProfileToMemory(); });

    // Buttons
    $("#ig_test_btn").on("click", igTestConnection);

    // Workflow Managers
    $("#ig_new_wf").on("click", igNewWorkflowClick);
    $("#ig_edit_wf").on("click", igOpenWorkflowEditorClick);
    $("#ig_del_wf").on("click", igDeleteWorkflowClick);
    $("#ig_workflow_list").on("change", (e) => {
        const newWorkflow = $(e.target).val();
        const oldWorkflow = s.currentWorkflowName;
        if (oldWorkflow) {
            if (!s.savedWorkflowStates) s.savedWorkflowStates = {};
            s.savedWorkflowStates[oldWorkflow] = {
                selectedModel: s.selectedModel, selectedSampler: s.selectedSampler, steps: s.steps, cfg: s.cfg, denoise: s.denoise, clipSkip: s.clipSkip,
                imgWidth: s.imgWidth, imgHeight: s.imgHeight, customSeed: s.customSeed, customNegative: s.customNegative,
                promptStyle: s.promptStyle, promptPerspective: s.promptPerspective, promptExtra: s.promptExtra, previewPrompt: s.previewPrompt,
                selectedLora: s.selectedLora, selectedLoraWt: s.selectedLoraWt, selectedLora2: s.selectedLora2, selectedLoraWt2: s.selectedLoraWt2,
                selectedLora3: s.selectedLora3, selectedLoraWt3: s.selectedLoraWt3, selectedLora4: s.selectedLora4, selectedLoraWt4: s.selectedLoraWt4
            };
        }
        if (s.savedWorkflowStates && s.savedWorkflowStates[newWorkflow]) {
            Object.assign(s, s.savedWorkflowStates[newWorkflow]);
            toastr.success(`Restored settings for ${newWorkflow}`);
            renderImageGen(c); // Re-render to update UI with restored values
        } else { toastr.info(`New workflow context active`); }

        s.currentWorkflowName = newWorkflow;
        saveProfileToMemory();
    });

    if (s.enabled) {
        igPopulateWorkflows();
        igFetchComfyLists();
    }
}

// -------------------------------------------------------------
// STAGE 8 HELPER FUNCTIONS
// -------------------------------------------------------------
async function igFetchComfyLists() {
    const s = localProfile.imageGen;
    const url = s.comfyUrl;
    try {
        const mRes = await fetch('/api/sd/comfy/models', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ url: url }) });
        if (mRes.ok) {
            const models = await mRes.json();
            const sel = $("#ig_model"); sel.empty().append('<option value="">-- Select Model --</option>');
            models.forEach(m => { let v = m.value || m; let t = m.text || v; sel.append(`<option value="${v}">${t}</option>`); });
            if (s.selectedModel) sel.val(s.selectedModel);
        }
        const sRes = await fetch('/api/sd/comfy/samplers', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ url: url }) });
        if (sRes.ok) {
            const samplers = await sRes.json();
            const sel = $("#ig_sampler"); sel.empty();
            samplers.forEach(sa => sel.append(`<option value="${sa}">${sa}</option>`));
            if (s.selectedSampler) sel.val(s.selectedSampler);
        }
        const lRes = await fetch(`${url}/object_info/LoraLoader`);
        if (lRes.ok) {
            const json = await lRes.json();
            const files = json['LoraLoader'].input.required.lora_name[0];
            for (let i = 1; i <= 4; i++) {
                const sel = $(`#ig_lora_${i}`); const val = i === 1 ? s.selectedLora : s[`selectedLora${i}`];
                sel.empty().append('<option value="">-- No LoRA --</option>');
                files.forEach(f => sel.append(`<option value="${f}">${f}</option>`));
                if (val) sel.val(val);
            }
        }
    } catch (e) { console.warn(`[Megumin-Suite] ComfyLists failed`, e); }
}

function toggleQuickGenButton() {
    const s = localProfile?.imageGen;
    if (s && s.enabled && s.triggerMode === 'manual') {
        $("#kazuma_quick_gen").css("display", "flex");
    } else {
        $("#kazuma_quick_gen").css("display", "none");
    }
}

async function igTestConnection() {
    try {
        const res = await fetch('/api/sd/comfy/ping', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ url: localProfile.imageGen.comfyUrl }) });
        if (res.ok) { toastr.success("ComfyUI Connected!"); await igFetchComfyLists(); } else throw new Error("Ping failed");
    } catch (e) { toastr.error("Connection Failed: " + e.message); }
}

async function igPopulateWorkflows() {
    const sel = $("#ig_workflow_list"); sel.empty();
    try {
        const res = await fetch('/api/sd/comfy/workflows', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ url: localProfile.imageGen.comfyUrl }) });
        if (res.ok) {
            const wfs = await res.json();
            wfs.forEach(w => sel.append(`<option value="${w}">${w}</option>`));
            if (localProfile.imageGen.currentWorkflowName && wfs.includes(localProfile.imageGen.currentWorkflowName)) {
                sel.val(localProfile.imageGen.currentWorkflowName);
            } else if (wfs.length > 0) {
                sel.val(wfs[0]); localProfile.imageGen.currentWorkflowName = wfs[0]; saveProfileToMemory();
            }
        }
    } catch (e) { sel.append('<option disabled>Failed to load</option>'); }
}

async function igNewWorkflowClick() {
    let name = await prompt("New workflow file name (e.g. 'my_flux.json'):");
    if (!name) return; if (!name.toLowerCase().endsWith('.json')) name += '.json';
    try {
        const res = await fetch('/api/sd/comfy/save-workflow', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ file_name: name, workflow: '{}' }) });
        if (!res.ok) throw new Error(await res.text());
        toastr.success("Workflow created!"); await igPopulateWorkflows(); $("#ig_workflow_list").val(name).trigger('change');
        setTimeout(igOpenWorkflowEditorClick, 500);
    } catch (e) { toastr.error(e.message); }
}

async function igDeleteWorkflowClick() {
    const name = localProfile.imageGen.currentWorkflowName;
    if (!name) return; if (!confirm(`Delete ${name}?`)) return;
    try {
        const res = await fetch('/api/sd/comfy/delete-workflow', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ file_name: name }) });
        if (!res.ok) throw new Error(await res.text());
        toastr.success("Deleted."); await igPopulateWorkflows();
    } catch (e) { toastr.error(e.message); }
}

async function igOpenWorkflowEditorClick() {
    const name = localProfile.imageGen.currentWorkflowName;
    if (!name) return toastr.warning("No workflow selected");
    let loadedContent = "{}";
    try {
        const res = await fetch('/api/sd/comfy/workflow', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ file_name: name }) });
        if (res.ok) {
            const rawBody = await res.json(); let jsonObj = rawBody;
            if (typeof rawBody === 'string') { try { jsonObj = JSON.parse(rawBody); } catch (e) { } }
            loadedContent = JSON.stringify(jsonObj, null, 4);
        }
    } catch (e) { toastr.error("Failed to load file. Starting empty."); }

    let currentJsonText = loadedContent;
    const $container = $(`
        <div style="display: flex; flex-direction: column; width: 100%; gap: 10px; font-family: 'Inter', sans-serif; color: var(--text-main);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
                <h3 style="margin:0; color: var(--gold);">${name}</h3>
                <div style="display:flex; gap:8px;">
                    <button class="ps-modern-btn secondary wf-format" title="Beautify JSON"><i class="fa-solid fa-align-left"></i> Format</button>
                    <button class="ps-modern-btn secondary wf-import" title="Upload .json file"><i class="fa-solid fa-upload"></i> Import</button>
                    <button class="ps-modern-btn secondary wf-export" title="Download .json file"><i class="fa-solid fa-download"></i> Export</button>
                    <input type="file" class="wf-file-input" accept=".json" style="display:none;" />
                </div>
            </div>
            <div style="display: flex; gap: 15px;">
                <textarea class="ps-modern-input wf-textarea" spellcheck="false" style="flex: 1; min-height: 500px; font-family: 'Consolas', 'Monaco', monospace; white-space: pre; resize: none; font-size: 13px; line-height: 1.4; background: #000;"></textarea>
                <div style="width: 250px; flex-shrink: 0; display: flex; flex-direction: column; border-left: 1px solid var(--border-color); padding-left: 10px; max-height: 500px;">
                    <h4 style="margin: 0 0 10px 0; color: var(--text-muted);">Placeholders</h4>
                    <div class="wf-list" style="overflow-y: auto; flex: 1; padding-right: 5px;"></div>
                </div>
            </div>
        </div>
    `);

    const $textarea = $container.find('.wf-textarea'); const $list = $container.find('.wf-list'); const $fileInput = $container.find('.wf-file-input');
    $textarea.val(currentJsonText);

    KAZUMA_PLACEHOLDERS.forEach(item => {
        const $itemDiv = $('<div></div>').css({ 'padding': '8px', 'margin-bottom': '6px', 'background': 'rgba(255,255,255,0.05)', 'border-radius': '6px', 'border': '1px solid transparent', 'transition': '0.2s' });
        $itemDiv.append($('<span></span>').text(item.key).css({ 'font-weight': 'bold', 'color': 'var(--gold)', 'font-family': 'monospace' })).append($('<div></div>').text(item.desc).css({ 'font-size': '0.7rem', 'color': 'var(--text-muted)', 'margin-top': '4px' }));
        $list.append($itemDiv);
    });

    const updateState = () => {
        currentJsonText = $textarea.val();
        $list.children().each(function () {
            const cleanKey = $(this).find('span').first().text().replace(/"/g, '');
            if (currentJsonText.includes(cleanKey)) $(this).css({ 'border-color': '#10b981', 'background': 'rgba(16, 185, 129, 0.1)' });
            else $(this).css({ 'border-color': 'transparent', 'background': 'rgba(255,255,255,0.05)' });
        });
    };
    $textarea.on('input', updateState); setTimeout(updateState, 100);

    $container.find('.wf-format').on('click', () => { try { $textarea.val(JSON.stringify(JSON.parse($textarea.val()), null, 4)); updateState(); toastr.success("Formatted"); } catch (e) { toastr.warning("Invalid JSON"); } });
    $container.find('.wf-import').on('click', () => $fileInput.click());
    $fileInput.on('change', (e) => { if (!e.target.files[0]) return; const r = new FileReader(); r.onload = (ev) => { $textarea.val(ev.target.result); updateState(); toastr.success("Imported"); }; r.readAsText(e.target.files[0]); $fileInput.val(''); });
    $container.find('.wf-export').on('click', () => { try { JSON.parse(currentJsonText); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([currentJsonText], { type: "application/json" })); a.download = name; a.click(); } catch (e) { toastr.warning("Invalid content"); } });

    const popup = new Popup($container, POPUP_TYPE.CONFIRM, '', { okButton: 'Save Changes', cancelButton: 'Cancel', wide: true, large: true, onClosing: () => { try { JSON.parse(currentJsonText); return true; } catch (e) { toastr.error("Invalid JSON."); return false; } } });
    if (await popup.show()) {
        try {
            const res = await fetch('/api/sd/comfy/save-workflow', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ file_name: name, workflow: JSON.stringify(JSON.parse(currentJsonText)) }) });
            if (!res.ok) throw new Error(await res.text()); toastr.success("Workflow Saved!");
        } catch (e) { toastr.error("Save Failed."); }
    }
}

function showKazumaProgress(text = "Processing...") {
    if ($("#kazuma_progress_overlay").length === 0) {
        $("body").append(`
            <div id="kazuma_progress_overlay" style="position: fixed; bottom: 20px; right: 20px; width: 300px; background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 15px; z-index: 99999; box-shadow: 0 10px 30px rgba(0,0,0,0.8); display: none; align-items: center; gap: 15px; font-family: 'Inter', sans-serif;">
                <div style="flex:1">
                    <span id="kazuma_progress_text" style="font-weight: 600; font-size: 0.85rem; color: #fff; margin-bottom: 8px; display: block;">Generating Image...</span>
                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: 100%; background: linear-gradient(45deg, #a855f7 25%, transparent 25%, transparent 50%, #a855f7 50%, #a855f7 75%, transparent 75%, transparent); background-size: 20px 20px; animation: kazuma-stripe-anim 1s linear infinite;"></div>
                    </div>
                </div>
            </div>
            <style>@keyframes kazuma-stripe-anim { 0% { background-position: 0 0; } 100% { background-position: 20px 0; } }</style>
        `);
    }
    $("#kazuma_progress_text").text(text); $("#kazuma_progress_overlay").css("display", "flex");
}

async function igManualGenerate() {
    const s = localProfile?.imageGen;
    if (!s || !s.enabled) return;

    showKazumaProgress("Analyzing Scene...");

    try {
        let promptText;
        if (s.generatorBackend === "direct") {
            promptText = await generateImagePromptText();
        } else {
            // Use the "Megumin Image" preset, but still run the exact same prompt logic
            await useMeguminEngine(async () => {
                promptText = await generateImagePromptText();
            }, "Megumin Image");
        }

        const imgRegex = /<img\s+prompt=["'](.*?)["']\s*\/?>/i;
        const match = promptText.match(imgRegex);
        if (match) promptText = match[1];

        toastr.info("Sending to ComfyUI...", "Megumin Suite");
        igGenerateWithComfy(promptText, null);

    } catch (e) {
        console.error(e);
        $("#kazuma_progress_overlay").hide();
        toastr.error("Manual generation failed.");
    } finally {
        activeImageGenRequest = null;
    }
}

// New Helper Function for generating the prompt text
async function generateImagePromptText() {
    const s = localProfile.imageGen;
    const chat = getContext().chat;
    const badStuffRegex = /(<disclaimer>.*?<\/disclaimer>)|(<guifan>.*?<\/guifan>)|(<danmu>.*?<\/danmu>)|(<options>.*?<\/options>)|```start|```end|<done>|`<done>`|(.*?<\/(?:ksc??|think(?:ing)?)>(\n)?)|(<(?:ksc??|think(?:ing)?)>[\s\S]*?<\/(?:ksc??|think(?:ing)?)>(\n)?)/gs;

    const lastMessages = chat.filter(m => !m.is_system).slice(-5).map(m => {
        let text = m.mes;
        text = text.replace(badStuffRegex, "").replace(/<details>[\s\S]*?<\/details>/gs, "").replace(/<summary>[\s\S]*?<\/summary>/gs, "").replace(/<[^>]*>?/gm, "");
        return `${m.name}: ${text.trim()}`;
    }).join("\n\n");

    let styleStr = s.promptStyle === "illustrious" ? "Use Danbooru-style tags separated by commas." : (s.promptStyle === "sdxl" ? "Use natural, descriptive prose and full sentences." : "Use a comma-separated list of detailed keywords and visual descriptors.");
    let perspStr = s.promptPerspective === "pov" ? "Frame the scene strictly from a First-Person (POV) perspective." : (s.promptPerspective === "character" ? "Focus intensely on the character's appearance." : "Describe the entire environment and atmosphere.");

    activeImageGenRequest = { chatText: lastMessages, styleStr: styleStr, perspStr: perspStr, extraStr: s.promptExtra || "None" };

    let rawOutput = await generateQuietPrompt({ prompt: "___PS_IMAGE_GEN___" });
    return rawOutput.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

async function igGenerateWithComfy(positivePrompt, target = null) {
    const s = localProfile.imageGen;
    let finalPrompt = positivePrompt;

    // --- INTERCEPT PROMPT IF PREVIEW IS ENABLED ---
    if (s.previewPrompt) {
        $("#kazuma_progress_overlay").hide(); // Hide the progress bar temporarily

        const $content = $(`
            <div style="display:flex; flex-direction:column; gap:10px; font-family: 'Inter', sans-serif;">
                <div style="font-size: 0.85rem; color: var(--text-muted);">Review or modify the prompt before it goes to ComfyUI.</div>
                <textarea class="ps-modern-input ig-preview-textarea" style="height: 150px; resize: vertical; font-family: monospace; font-size: 0.85rem; padding: 10px;">${finalPrompt}</textarea>
            </div>
        `);

        // CRITICAL FIX: SillyTavern destroys the popup HTML when it closes. 
        // We MUST capture the text while the user is typing!
        let liveText = finalPrompt;
        $content.find(".ig-preview-textarea").on("input", function () {
            liveText = $(this).val();
        });

        const popup = new Popup($content, POPUP_TYPE.CONFIRM, "Preview Image Prompt", { okButton: "Send to ComfyUI", cancelButton: "Cancel", wide: true });
        const confirmed = await popup.show();

        if (!confirmed) {
            toastr.info("Generation cancelled.");
            return;
        }

        finalPrompt = liveText.trim();
        if (!finalPrompt) return toastr.warning("Prompt cannot be empty.");

        showKazumaProgress("Preparing to Render..."); // Bring progress bar back
    }

    let workflowRaw;
    try {
        const res = await fetch('/api/sd/comfy/workflow', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ file_name: s.currentWorkflowName }) });
        if (!res.ok) throw new Error("Load failed"); workflowRaw = await res.json();
    } catch (e) { return toastr.error(`Could not load ${s.currentWorkflowName}`); }

    let workflow = (typeof workflowRaw === 'string') ? JSON.parse(workflowRaw) : workflowRaw;
    let finalSeed = parseInt(s.customSeed); if (finalSeed === -1 || isNaN(finalSeed)) finalSeed = Math.floor(Math.random() * 1000000000);

    let seedInjected = false;
    for (const nodeId in workflow) {
        const node = workflow[nodeId];
        if (node.inputs) {
            for (const key in node.inputs) {
                const val = node.inputs[key];
                if (val === "%prompt%") node.inputs[key] = finalPrompt;
                if (val === "%negative_prompt%") node.inputs[key] = s.customNegative || "";
                if (val === "%seed%") { node.inputs[key] = finalSeed; seedInjected = true; }
                if (val === "%sampler%") node.inputs[key] = s.selectedSampler || "euler";
                if (val === "%model%") node.inputs[key] = s.selectedModel || "v1-5-pruned.ckpt";
                if (val === "%steps%") node.inputs[key] = parseInt(s.steps) || 20;
                if (val === "%scale%") node.inputs[key] = parseFloat(s.cfg) || 7.0;
                if (val === "%denoise%") node.inputs[key] = parseFloat(s.denoise) || 1.0;
                if (val === "%clip_skip%") node.inputs[key] = -Math.abs(parseInt(s.clipSkip)) || -1;
                if (val === "%lora1%") node.inputs[key] = s.selectedLora || "None";
                if (val === "%lora2%") node.inputs[key] = s.selectedLora2 || "None";
                if (val === "%lora3%") node.inputs[key] = s.selectedLora3 || "None";
                if (val === "%lora4%") node.inputs[key] = s.selectedLora4 || "None";
                if (val === "%lorawt1%") node.inputs[key] = parseFloat(s.selectedLoraWt) || 1.0;
                if (val === "%lorawt2%") node.inputs[key] = parseFloat(s.selectedLoraWt2) || 1.0;
                if (val === "%lorawt3%") node.inputs[key] = parseFloat(s.selectedLoraWt3) || 1.0;
                if (val === "%lorawt4%") node.inputs[key] = parseFloat(s.selectedLoraWt4) || 1.0;
                if (val === "%width%") node.inputs[key] = parseInt(s.imgWidth) || 512;
                if (val === "%height%") node.inputs[key] = parseInt(s.imgHeight) || 512;
            }
            if (!seedInjected && node.class_type === "KSampler" && 'seed' in node.inputs && typeof node.inputs['seed'] === 'number') { node.inputs.seed = finalSeed; }
        }
    }

    try {
        const res = await fetch(`${s.comfyUrl}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: workflow }) });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();

        showKazumaProgress("Rendering Image...");
        const checkInterval = setInterval(async () => {
            try {
                const h = await (await fetch(`${s.comfyUrl}/history/${data.prompt_id}`)).json();
                if (h[data.prompt_id]) {
                    clearInterval(checkInterval);
                    let finalImage = null;
                    for (const nodeId in h[data.prompt_id].outputs) {
                        const nodeOut = h[data.prompt_id].outputs[nodeId];
                        if (nodeOut.images && nodeOut.images.length > 0) { finalImage = nodeOut.images[0]; break; }
                    }
                    if (finalImage) {
                        showKazumaProgress("Downloading...");
                        const imgUrl = `${s.comfyUrl}/view?filename=${finalImage.filename}&subfolder=${finalImage.subfolder}&type=${finalImage.type}`;

                        // Download & Compress
                        const response = await fetch(imgUrl); const blob = await response.blob();
                        const base64Raw = await new Promise((res) => { const r = new FileReader(); r.onloadend = () => res(r.result); r.readAsDataURL(blob); });
                        let base64Clean = base64Raw; let format = "png";
                        if (s.compressImages) {
                            base64Clean = await new Promise((res) => { const img = new Image(); img.src = base64Raw; img.onload = () => { const cvs = document.createElement('canvas'); cvs.width = img.width; cvs.height = img.height; cvs.getContext('2d').drawImage(img, 0, 0); res(cvs.toDataURL("image/jpeg", 0.9)); }; img.onerror = () => res(base64Raw); });
                            format = "jpeg";
                        }

                        // Insert to Chat
                        const charName = getContext().characters[getContext().characterId]?.name || "User";
                        const savedPath = await saveBase64AsFile(base64Clean.split(',')[1], charName, `${charName}_${humanizedDateTime()}`, format);
                        const mediaAttach = {
                            url: savedPath,
                            type: "image",
                            source: "generated",
                            title: finalPrompt,
                            generation_type: "free"
                        };

                        if (target && target.message) {
                            if (!target.message.extra) target.message.extra = {}; if (!target.message.extra.media) target.message.extra.media = [];
                            target.message.extra.media_display = "gallery"; target.message.extra.media.push(mediaAttach); target.message.extra.media_index = target.message.extra.media.length - 1;
                            if (typeof appendMediaToMessage === "function") appendMediaToMessage(target.message, target.element);
                            await saveChat(); toastr.success("Gallery updated!");
                        } else {
                            const newMsg = { name: "Image Gen Kazuma", is_user: false, is_system: true, send_date: Date.now(), mes: "", extra: { media: [mediaAttach], media_display: "gallery", media_index: 0 }, force_avatar: "img/five.png" };
                            getContext().chat.push(newMsg); await saveChat();
                            if (typeof addOneMessage === "function") addOneMessage(newMsg); else await reloadCurrentChat();
                            toastr.success("Image inserted!");
                        }
                        $("#kazuma_progress_overlay").hide();
                    } else { $("#kazuma_progress_overlay").hide(); }
                }
            } catch (e) { }
        }, 1000);
    } catch (e) { $("#kazuma_progress_overlay").hide(); toastr.error("Comfy Error: " + e.message); }
}

// -------------------------------------------------------------
// AI GENERATION & BAN LIST HELPER FUNCTIONS (RESTORED)
// -------------------------------------------------------------
function getCleanedChatHistory() {
    const context = getContext();
    if (!context.chat || context.chat.length === 0) return "";

    const aiMessages = context.chat.filter(m => !m.is_user && !m.is_system).slice(-50);
    const badStuffRegex = /(<disclaimer>.*?<\/disclaimer>)|(<guifan>.*?<\/guifan>)|(<danmu>.*?<\/danmu>)|(<options>.*?<\/options>)|```start|```end|<done>|`<done>`|(.*?<\/(?:ksc??|think(?:ing)?)>(\n)?)|(<(?:ksc??|think(?:ing)?)>[\s\S]*?<\/(?:ksc??|think(?:ing)?)>(\n)?)/gs;

    let cleanedMessages = aiMessages.map(m => {
        let text = m.mes;
        text = text.replace(badStuffRegex, "");
        text = text.replace(/<details>[\s\S]*?<\/details>/gs, "");
        text = text.replace(/<summary>[\s\S]*?<\/summary>/gs, "");
        text = text.replace(/<[^>]*>?/gm, "");
        return text.trim();
    });

    cleanedMessages = cleanedMessages.filter(t => t.length > 0);
    return cleanedMessages.join("\n\n");
}

async function analyzeSlopDirectly(chatText) {
    activeBanListChat = chatText;
    try {
        let rawOutput = await generateQuietPrompt({ prompt: "___PS_BANLIST___" });
        return rawOutput.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    } catch (e) {
        console.error(`[${extensionName}] Ban List Analysis Failed:`, e);
        return null;
    } finally {
        activeBanListChat = null;
    }
}

async function analyzeSlopWithPreset(chatText) {
    let result = null;
    await useMeguminEngine(async () => {
        // We still use the interceptor! This just makes the engine switch first.
        result = await analyzeSlopDirectly(chatText);
    });
    return result;
}

async function useMeguminEngine(task, targetPreset = TARGET_PRESET_NAME) { // Added parameter with default value
    const selector = $("#settings_preset_openai");
    const option = selector.find(`option`).filter(function () { return $(this).text().trim() === targetPreset; }); // Use the new parameter
    let originalValue = null;

    if (option.length) {
        originalValue = selector.val();
        selector.val(option.val()).trigger("change");
        toastr.info(`Switched to ${targetPreset} preset... Please wait.`);
        await new Promise(r => setTimeout(r, 3000));
    } else {
        toastr.error(`"${targetPreset}" not found in OpenAI presets.`);
        return;
    }

    try {
        await task();
    } catch (e) {
        console.error(`[${extensionName}] AI Error:`, e);
    } finally {
        await new Promise(r => setTimeout(r, 500));
        selector.val(originalValue).trigger("change");
    }
}

async function runMeguminTask(orderText) {
    activeGenerationOrder = orderText;
    try {
        return await generateQuietPrompt({ prompt: "___PS_DUMMY___" });
    } finally {
        activeGenerationOrder = null;
    }
}

$("body").on("input", "#ps_main_current_rule", function () {
    localProfile.aiRule = $(this).val(); saveProfileToMemory();
});

// -------------------------------------------------------------
// EVENT LISTENERS & INITS
// -------------------------------------------------------------
function buildBaseDict() {
    const dict = {};
    if (!localProfile) return dict;

    // 1. GLOBAL DEFAULTS (Language, Pronouns, Word Count)
    const targetLang = (localProfile.userLanguage && localProfile.userLanguage.trim() !== "")
        ? localProfile.userLanguage.toUpperCase()
        : "ENGLISH";
    dict["[[Language]]"] = `[LANGUAGE RULE]\nALL OUTPUT EXCEPT THINKING MUST BE IN ${targetLang} ONLY.`;

    if (localProfile.userPronouns === "male") dict["[[pronouns]]"] = `{{user}} is male. Always portray and address him as such.`;
    else if (localProfile.userPronouns === "female") dict["[[pronouns]]"] = `{{user}} is female. Always portray and address her as such.`;

    const wordCountStr = (localProfile.userWordCount && String(localProfile.userWordCount).trim() !== "")
        ? String(localProfile.userWordCount).trim()
        : null;

    if (wordCountStr) {
        dict["[[count]]"] = `— maximum ${wordCountStr} words`;
    } else {
        dict["[[count]]"] = "";
    }

    // 2. STANDARD STAGE SELECTIONS (Stage 2, 4, 5, 6)

    // Personality (Stage 2) - Will be overwritten later if Custom Engine is active
    const pData = hardcodedLogic.personalities.find(p => p.id === localProfile.personality);
    dict["[[main]]"] = pData ? pData.content : "";
    dict["[[AI1]]"] = "Understood."; // Default
    dict["[[AI2]]"] = "Understood."; // Default

    if (localProfile.personality === "megumin") {
        dict["[[AI1]]"] = "Fine i read the rules.";
        dict["[[AI2]]"] = "OK i Understnd it.";
    }

    // Standard Toggles & Addons
    if (localProfile.toggles.ooc) dict["[[OOC]]"] = hardcodedLogic.toggles.ooc.content;
    if (localProfile.toggles.control) dict["[[control]]"] = hardcodedLogic.toggles.control.content;
    if (localProfile.aiRule) dict["[[aiprompt]]"] = localProfile.aiRule;
    localProfile.addons.forEach(aId => {
        const item = hardcodedLogic.addons.find(a => a.id === aId);
        if (item) dict[item.trigger] = item.content;
    });

    // Stage 5 Defaults (Format Blocks)
    localProfile.blocks.forEach(bId => {
        const item = hardcodedLogic.blocks.find(b => b.id === bId);
        if (item) dict[item.trigger] = item.content;
    });

    // Stage 6 Defaults (CoT Framework & Language)
    const modData = hardcodedLogic.models.find(m => m.id === localProfile.model);
    if (modData) {
        dict["[[COT]]"] = modData.content;
        if (modData.prefill) dict["[[prefill]]"] = modData.prefill;
    }

    if (localProfile.thinkingV2) {
        let thinkExt = "";
        let effort = localProfile.thinkEffort || "unspecified";
        if (effort !== "unspecified") {
            let words = effort === "custom" ? (localProfile.customThinkEffort || "100") : effort;
            thinkExt = ` - maximum ${words} words.`;
        }
        dict["[[THINK]]"] = `<think>\n<think>\n<think>\n{Thinking${thinkExt}}\n</think>`;
    } else {
        dict["[[THINK]]"] = ""; // Stays empty if V2 is off
    }

    if (localProfile.dnRatio && localProfile.dnRatio.enabled) {
        const d = localProfile.dnRatio.dialogue;
        const n = 100 - d;
        dict["[[DNRATIO]]"] = `- Ratio: Maintain a balance of ${d}% Dialogue and ${n}% Narration.`;
    } else {
        dict["[[DNRATIO]]"] = "";
    }

    if (localProfile.onomatopoeia && localProfile.onomatopoeia.enabled) {
        let onoRule = `- Narration must utilize onomatopoeia. Use precise, context-specific phonetic representations for physical interactions (e.g., the click of a latch, the thud of a heavy object, the soughing of wind) rather than abstract descriptions of sound.`;
        if (localProfile.onomatopoeia.useStyling) {
            onoRule += `\nAll onomatopoeic words must animated and colored using HTML and CSS. The selected style tag and color must objectively correspond to the physical nature or movement of the sound produced; for example, a repetitive friction sound such as "shush-shush" must utilize a sliding animation tag to represent the physical action.`;
        }
        dict["[[onomato]]"] = onoRule;
    } else {
        dict["[[onomato]]"] = "";
    }

    // MVU Logic
    if (localProfile.blocks.includes("mvu")) {
        let baseMvu = hardcodedLogic.blocks.find(b => b.id === "mvu").content;
        if (wordCountStr) dict["[[MVU]]"] = baseMvu.replace("[[count]]", `maximum ${wordCountStr} words`);
        else dict["[[MVU]]"] = baseMvu.replace("[[count]]", "...");
    } else {
        dict["[[MVU]]"] = wordCountStr ? `{main response — maximum ${wordCountStr} words}` : `{main response}`;
    }

    // 3. ENGINE OVERRIDES (The "Superior" Layer)
    // This part runs last so it can overwrite standard Stage choices
    const allAvailableModes = [...hardcodedLogic.modes, ...(extension_settings[extensionName].customModes || [])];
    const activeEngine = allAvailableModes.find(m => m.id === localProfile.mode);
    const isCustom = activeEngine && !hardcodedLogic.modes.find(x => x.id === activeEngine.id);

    if (activeEngine) {
        // Map p1-p6
        for (let i = 1; i <= 6; i++) {
            const val = activeEngine[`p${i}`] || "";
            dict[`[[prompt${i}]]`] = val;
            dict[`[prompt${i}]`] = val;
        }

        // Custom Engines kill [[main]] personality ONLY if they are truly built from scratch
        if (isCustom && activeEngine.isCoreClone !== true) {
            dict["[[main]]"] = "";
        }

        // Engine-specific AI Prefills (If defined in the engine)
        if (activeEngine.A1) dict["[[AI1]]"] = activeEngine.A1;
        if (activeEngine.A2) dict["[[AI2]]"] = activeEngine.A2;

        // Engine-specific Block Overwrites
        const overrides = [
            { key: "cot", trigger: "[[COT]]", condition: true },
            { key: "prefill", trigger: "[[prefill]]", condition: true },
            { key: "think", trigger: "[[THINK]]", condition: localProfile.thinkingV2 },
            { key: "info", trigger: "[[infoblock]]", condition: localProfile.blocks.includes("info") },
            { key: "summary", trigger: "[[summary]]", condition: localProfile.blocks.includes("summary") },
            { key: "cyoa", trigger: "[[cyoa]]", condition: localProfile.blocks.includes("cyoa") },
            { key: "mvu", trigger: "[[MVU]]", condition: localProfile.blocks.includes("mvu") },
            { key: "death", trigger: "[[death]]", condition: localProfile.addons.includes("death") },
            { key: "combat", trigger: "[[combat]]", condition: localProfile.addons.includes("combat") },
            { key: "direct", trigger: "[[Direct]]", condition: localProfile.addons.includes("direct") },
            { key: "dn", trigger: "[[DN]]", condition: localProfile.addons.includes("dn") },
            { key: "dialogueColor", trigger: "[[COLOR]]", condition: localProfile.addons.includes("color") }, // FIXED NAME COLLISION
            { key: "storytracker", trigger: "[[storytracker]]", condition: localProfile.storyPlan && localProfile.storyPlan.enabled },
            { key: "language", trigger: "[[Language]]", condition: true },
            { key: "pronouns", trigger: "[[pronouns]]", condition: true },
            { key: "count", trigger: "[[count]]", condition: true },
            { key: "dnratio", trigger: "[[DNRATIO]]", condition: localProfile.dnRatio && localProfile.dnRatio.enabled },
            { key: "onomato", trigger: "[[onomato]]", condition: localProfile.onomatopoeia && localProfile.onomatopoeia.enabled },
            { key: "banlist", trigger: "[[banlist]]", condition: true }
        ];

        overrides.forEach(o => {
            // Only inject the override if the toggle is ON (or if it's a global setting)
            if (o.condition && activeEngine[o.key] && activeEngine[o.key].trim() !== "") {
                dict[o.trigger] = activeEngine[o.key];
            }
        });

        // Custom Toggles Appender
        if (activeEngine.customToggles) {
            activeEngine.customToggles.forEach(ct => {
                if (localProfile.toggles[ct.id]) {
                    const targetKey = "[[prompt" + ct.attachPoint.replace('p', '') + "]]";
                    if (dict[targetKey] !== undefined) {
                        dict[targetKey] += `\n\n${ct.content}`;
                    }
                }
            });
        }
    }

    if (localProfile.mode.includes("v6-dream-team")) {
        dict["[[main]]"] = "";
    }

    // Story Planner Injection
    if (localProfile.storyPlan && localProfile.storyPlan.enabled) {
        const planText = localProfile.storyPlan.currentPlan;
        if (planText && planText.trim() !== "") {
            dict["[[storyplan]]"] = `<Story_Plan>\nThis is a possible event for the story, take from it:\n${planText}\n</Story_Plan>`;
        } else {
            dict["[[storyplan]]"] = "";
        }

        // The refined tracker block you asked for
        dict["[[storytracker]]"] = `<Story_Tracker>\narc: The Arc that is now active.\nchapter: The chapter that is now active.\nEpisode: The episode that is now active.\nSecrets: Any secret that the user/{{user}} doesn't know.\n</Story_Tracker>`;
    } else {
        dict["[[storyplan]]"] = "";
        dict["[[storytracker]]"] = "";
    }

    // 4. FINAL INJECTIONS (Banlist & Image Gen)
    if (localProfile.banList && localProfile.banList.length > 0) {
        const banStr = localProfile.banList.map(b => `- ${b}`).join("\n");
        dict["[[banlist]]"] = `[BAN LIST]\nNever rely on these clichés, tropes, or repetitive patterns. They are dead language:\n${banStr}`;
    } else {
        dict["[[banlist]]"] = "";
    }

    if (localProfile.imageGen && localProfile.imageGen.enabled) {
        const ig = localProfile.imageGen;
        let shouldInject = false;
        let conditionalText = "";
        const mode = ig.triggerMode || "always";

        if (mode === "always") shouldInject = true;
        else if (mode === "frequency") {
            const chat = getContext().chat || [];
            const aiMsgCount = chat.filter(m => !m.is_user && !m.is_system).length;
            const freq = parseInt(ig.autoGenFreq) || 1;
            if ((aiMsgCount + 1) % freq === 0) shouldInject = true;
        } else if (mode === "conditional") {
            shouldInject = true;
            conditionalText = "CRITICAL INSTRUCTION: ONLY output the <img prompt=\"...\"> tag if the character is explicitly taking a photo, sending a picture, or sharing an image in this exact moment. If not, do NOT output the image tags at all.\n\n";
        }

        if (shouldInject) {
            let styleStr = ig.promptStyle === "illustrious" ? "Use Danbooru-style tags. Focus on anime." : (ig.promptStyle === "sdxl" ? "Use natural descriptive sentences. Focus on photorealism." : "Use keywords.");
            let perspStr = ig.promptPerspective === "pov" ? "First-Person (POV)." : (ig.promptPerspective === "character" ? "Focus on character appearance." : "Describe environment.");
            dict["[[img1]]"] = `[IMAGE GENERATION]\n${conditionalText}Style: ${styleStr}\nPerspective: ${perspStr}${ig.promptExtra ? `\nExtra: ${ig.promptExtra}` : ""}`;
            dict["[[img2]]"] = `<img prompt="prompt">`;
        } else {
            dict["[[img1]]"] = ""; dict["[[img2]]"] = "";
        }
    } else {
        dict["[[img1]]"] = ""; dict["[[img2]]"] = "";
    }

    if (localProfile.thinkingV2 && dict["[[prefill]]"]) {
        dict["[[prefill]]"] = dict["[[prefill]]"].replace(/\n<think>[\s\S]*/, "\n<think>\n<think>");
    }

    // Resolve early-evaluated tokens inside all other strings to prevent them from being missed and then cleaned up
    const earlyTokens = ["[[count]]", "[[Language]]", "[[pronouns]]", "[[DNRATIO]]"];
    earlyTokens.forEach(et => {
        if (dict[et] !== undefined) {
            const val = dict[et];
            Object.keys(dict).forEach(k => {
                if (k !== et && typeof dict[k] === 'string' && dict[k].includes(et)) {
                    dict[k] = dict[k].split(et).join(val);
                }
            });
        }
    });

    return dict;
}

function escapeRegex(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function handlePromptInjection(data) {
    const messages = data?.messages || data?.chat || (Array.isArray(data) ? data : null);
    if (!messages || !Array.isArray(messages)) return;
    const disablePrefill = localProfile && localProfile.disableUtilityPrefill === true;

    // --- INJECT STORY PLANNER PROMPT ---
    if (activeStoryPlanRequest) {
        messages.length = 0;

        // SillyTavern macro substitutions to get Lore and Persona
        const charLore = typeof substituteParams === 'function' ? substituteParams('{{description}}') : "No character description found.";
        const userPersona = typeof substituteParams === 'function' ? substituteParams('{{persona}}') : "No user persona found.";

        messages.push({
            "role": "system",
            "content": `Role: You are an expert Story Architect and Plot Planner.\n\n<lore>\n${charLore}\n</lore>\n\nUser Persona ({{user}}):\n<user_persona>\n${userPersona}\n</user_persona>\n\n<Story>\n${activeStoryPlanRequest}\n</Story>`
        });
        messages.push({
            "role": "user",
            "content": `Task: Brainstorm a minimum of 10 theoretical, medium-to-long-term plot developments based on the story so far.\n\nStrict Rules & Constraints:\n1. DO NOT write the immediate next scene. Skip past the current moment and look ahead to future structural milestones.\n2. Use Narrative Structure, NOT Timeframes: Do not use phrases like "three days later" or "next month." Instead, frame every idea as a theoretical future Arc, Chapter, or Episode.\n3. Create a Menu of Possibilities: Treat this list as a theoretical menu of branching paths. Focus on major plot shifts, new character introductions, or escalating conflicts that could anchor a future chapter.\n4. Zero Agency Theft: You are STRICTLY FORBIDDEN from writing dialogue, actions, thoughts, or emotional reactions for {{user}}. You must never describe what {{user}} does, feels, or says under any circumstances.\n5. No Assumptions or Suggestions: Do not predict, suggest, or assume what {{user}} will do next. Never end a response by telling or hinting at what {{user}} should do.\n\nFormat & Style: Keep the ideas punchy, plot-focused, and clearly labeled by narrative structure.`
        });
        messages.push({
            "role": "system",
            "content": "<thinking_steps>\nBefore creating the response, think deeply.\nThoughts must be wrapped in <think></think>. The first token must be <think>. The main text must immediately follow </think>.\n<think>\nReflect in approximately 100–150 words as a seamless paragraph.\n</think>\n</thinking_steps>\n\n[OUTPUT ORDER]\nEvery response must follow this exact structure in this exact order:\n<think>\n{Thinking}\n</think>\n<plot>\n{main response}\n</plot>"
        });
        if (!disablePrefill) {
            messages.push({
                "role": "assistant",
                "content": "ok i will start thinking \n<think>\n"
            });
        }

        console.log(`[${extensionName}] 🎯 Injected Story Planner array in memory.`);
        return;
    }

    if (activeBanListChat) {
        messages.length = 0;
        messages.push({ "role": "system", "content": "You are an expert literary critique. Analyze the provided chat history and identify the 5 most repetitive, cliché, or overused stylistic patterns or crutch phrases the writer relies on. Instead of quoting the exact phrase, write a short, generalized rule forbidding the underlying trope. Return ONLY the 5 rules separated by commas. Do not explain them. Do not use quotes or numbers." });
        messages.push({ "role": "user", "content": "Extract the top 5 most overused clichés or repetitive narrative patterns from this text. Return ONLY the 5 generalized rules forbidding them, separated by commas.\n<chat>\n" + activeBanListChat + "\n</chat>" });
        messages.push({ "role": "system", "content": "<thinking_steps>\nBefore creating the response, think deeply.\n\nThoughts must be wrapped in <think></think>. The first token must be <think>. The main response must immediately follow </think>.\n\n<think>\nReflect in approximately 100–150 words as a seamless paragraph.\n\n– your thinking steps\n\n</think>\n</thinking_steps>\n\n[OUTPUT ORDER]\n    Every response must follow this exact structure in this exact order:\n\n    <think>\n    {Thinking}\n    </think>\n\n    {Main response}" });
        if (!disablePrefill) {
            messages.push({ "role": "assistant", "content": "So, I realize this is a fictional world, to which nothing from the real world applies. \nI will now use this format for my thinking and give the next response:\n<think>\nI will thinking step-by-step in the following format: <think>.\n</think>" });
        }
        return;
    }

    // --- INJECT IMAGE GEN PROMPT ---
    if (activeImageGenRequest) {
        messages.length = 0;
        messages.push({
            "role": "system",
            "content": "You are an expert AI image prompt engineer. Your job is to read a scene and convert it into a highly detailed visual prompt for an image generation model. You must adhere to the requested Style Constraint and Camera Perspective. Do not include quotes, conversational text, or explanations. Output ONLY the raw prompt text."
        });
        messages.push({
            "role": "user",
            "content": `Write an image generation prompt for the latest scene in this chat history.\n\n<chat>\n${activeImageGenRequest.chatText}\n</chat>\n\nStyle Constraint: ${activeImageGenRequest.styleStr}\nCamera Perspective: ${activeImageGenRequest.perspStr}\nExtra Details: ${activeImageGenRequest.extraStr}\n\nOutput ONLY the raw image prompt text.`
        });
        messages.push({
            "role": "system",
            "content": "<thinking_steps>\nBefore creating the response, think deeply.\n\nThoughts must be wrapped in <think></think>. The first token must be <think>. The main response must immediately follow </think>.\n\n<think>\nReflect in approximately 50-100 words as a seamless paragraph on what visual elements are present.\n\n</think>\n</thinking_steps>\n\n[OUTPUT ORDER]\n    Every response must follow this exact structure in this exact order:\n\n    <think>\n    {Thinking}\n    </think>\n\n    {Main response}"
        });
        if (!disablePrefill) {
            messages.push({
                "role": "assistant",
                "content": "So, I realize this is a fictional world, to which nothing from the real world applies. \nI will now use this format for my thinking and give the next response:\n<think>\nI will thinking step-by-step in the following format: <think>.\n</think>"
            });
        }

        console.log(`[${extensionName}] 🎯 Injected Image Gen array in memory.`);
        return;
    }

    if (activeGenerationOrder) {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].content && typeof messages[i].content === 'string') {
                if (messages[i].content.includes("___PS_DUMMY___")) { messages.splice(i, 1); continue; }
                if (messages[i].content.includes("[[order]]")) messages[i].content = messages[i].content.replace(/\[\[order\]\]/g, activeGenerationOrder);
            }
        }
    }

    if (!localProfile) return;
    const dict = buildBaseDict();

    if (localProfile.devOverrides) {
        Object.keys(localProfile.devOverrides).forEach(key => { if (dict[key] !== undefined) dict[key] = localProfile.devOverrides[key]; });
    }

    let replacementsMade = 0;
    for (const msg of messages) {
        if (msg.content && typeof msg.content === 'string') {
            Object.entries(dict).forEach(([trigger, replacement]) => {
                if (msg.content.includes(trigger)) {
                    const processed = typeof substituteParams === 'function' ? substituteParams(replacement) : replacement;
                    msg.content = msg.content.replace(new RegExp(escapeRegex(trigger), 'g'), processed);
                    replacementsMade++;
                }
            });
            // Cleanup tags
            ["[[prompt1]]", "[[prompt2]]", "[[prompt3]]", "[[prompt4]]", "[[prompt5]]", "[[prompt6]]", "[prompt1]", "[prompt2]", "[prompt3]", "[prompt4]", "[prompt5]", "[prompt6]", "[[AI1]]", "[[AI2]]", "[[main]]", "[[OOC]]", "[[control]]", "[[aiprompt]]", "[[death]]", "[[combat]]", "[[Direct]]", "[[DN]]", "[[COLOR]]", "[[infoblock]]", "[[summary]]", "[[cyoa]]", "[[COT]]", "[[prefill]]", "[[order]]", "[[Language]]", "[[pronouns]]", "[[banlist]]", "[[count]]", "[[MVU]]", "[[img1]]", "[[img2]]", "[[storyplan]]", "[[storytracker]]", "[[DNRATIO]]", "[[THINK]]", "[[onomato]]", "[[npc_events]]"].forEach(tr => {
                if (msg.content.includes(tr)) msg.content = msg.content.replace(new RegExp(escapeRegex(tr), 'g'), "");
            });
        }
    }

    if (replacementsMade > 0 && !activeGenerationOrder) {
        console.log(`[${extensionName}] ✅ Executed ${replacementsMade} block replacements.`);
    }
}


// -------------------------------------------------------------
// DEV MODE: VISUAL ENGINE BUILDER
// -------------------------------------------------------------
function renderDevMode(view = "landing", selectedModeId = null, passedModeData = null, returnTo = "landing") {
    const c = $("#ps_stage_content");
    c.empty();
    c.off(".devDirty");

    // Hide the dock and the apply to all button
    $(".dock").hide();
    $("#btn_apply_tab_all").hide();
    $("#ps_btn_save_close").hide();

    // Update Dev button visually
    $("#ps_btn_dev_mode").html(`<i class="fa-solid fa-right-from-bracket"></i> Exit Dev`).css("color", "#10b981");

    if (!extension_settings[extensionName].customModes) extension_settings[extensionName].customModes = [];

    // Inject custom headers depending on which Dev view we are in
    const devTitle = view === "landing" ? "Engine Builder" : "Visual Engine Builder";
    const devSub = view === "landing" ? "Design your own chronological AI logic flow. Clone an existing template or start from scratch." : "Configure your custom engine blocks.";

    // Update Dev button visuals
    $("#ps_btn_dev_mode")
        .html(`<i class="fa-solid fa-right-from-bracket"></i> Exit Dev`)
        .css("color", "#10b981");

    if (!extension_settings[extensionName].customModes) extension_settings[extensionName].customModes = [];

    // --- VIEW 1: DASHBOARD (Merged Landing & List) ---
    if (view === "landing") {
        isDevEngineDirty = false;
        $("#ps_stage_sub").text("Design your own chronological AI logic flow. Clone an existing template or start from scratch.");

        // Top Action Bar (Moved Import up here!)
        c.append(`
            <div style="display: flex; gap: 15px; margin-top: 10px; margin-bottom: 30px;">
                <button id="dev_btn_new" class="ps-modern-btn primary" style="background: #10b981; color: #fff; flex: 1; padding: 12px; font-size: 1rem;"><i class="fa-solid fa-wand-magic-sparkles"></i> Create Blank Engine</button>
                <button id="dev_btn_import" class="ps-modern-btn secondary" style="flex: 1; padding: 12px; font-size: 1rem;"><i class="fa-solid fa-file-import"></i> Import Engine (JSON)</button>
                <input type="file" id="dev_import_file" accept=".json" style="display:none;" />
            </div>
        `);

        // Event Listeners for Top Bar
        $("#dev_btn_new").on("click", () => renderDevMode("editor", "NEW"));
        $("#dev_btn_import").on("click", () => $("#dev_import_file").click());
        $("#dev_import_file").on("change", function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const imported = JSON.parse(e.target.result);
                    imported.id = "custom_" + Date.now(); // Ensure unique ID on import
                    extension_settings[extensionName].customModes.push(imported);
                    saveSettingsDebounced();
                    toastr.success(`Imported ${imported.label}!`);
                    renderDevMode("landing"); // Refresh UI
                } catch (e) { toastr.error("Invalid JSON file."); }
            };
            reader.readAsText(file);
        });

        // --- SECTION 1: CORE TEMPLATES (CLONE) ---
        c.append(`<div class="ps-rule-title" style="color: var(--gold); margin-bottom: 12px;"><i class="fa-solid fa-cube"></i> Core Templates (Clone)</div>`);
        const coreGrid = $(`<div class="ps-grid" style="margin-bottom: 30px;"></div>`); // Added margin-bottom so it breathes before the next section
        hardcodedLogic.modes.forEach(m => {
            const card = $(`
                <div class="ps-card" style="justify-content: space-between;">
                    <div style="width: 100%;">
                        <div class="ps-card-title"><span>${m.label}</span></div>
                        <div class="ps-card-desc">System Default Engine</div>
                    </div>
                    <div style="width: 100%; margin-top: 20px;">
                        <button class="ps-modern-btn secondary dev-clone" style="width: 100%; padding: 8px; font-size: 0.8rem; border-color: var(--gold); color: var(--gold);"><i class="fa-solid fa-copy"></i> Clone & Edit</button>
                    </div>
                </div>
            `);
            card.find(".dev-clone").on("click", () => renderDevMode("editor", m.id));
            coreGrid.append(card);
        });
        c.append(coreGrid);

        // --- SECTION 2: YOUR CUSTOM ENGINES ---
        const customModes = extension_settings[extensionName].customModes || [];
        c.append(`<div class="ps-rule-title" style="color: #10b981; margin-bottom: 12px;"><i class="fa-solid fa-microchip"></i> Your Custom Engines</div>`);

        if (customModes.length === 0) {
            c.append(`<div style="padding: 20px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 12px; margin-bottom: 30px;">No custom engines yet. Create or import one above!</div>`);
        } else {
            const customGrid = $(`<div class="ps-grid" style="margin-bottom: 30px;"></div>`);
            customModes.forEach(m => {
                const card = $(`
                    <div class="ps-card" style="border-color: #10b981; background: rgba(16, 185, 129, 0.05); justify-content: space-between;">
                        <div style="width: 100%;">
                            <div class="ps-card-title"><span style="color: #10b981;">${m.label}</span></div>
                            <div class="ps-card-desc">Custom User Logic Flow</div>
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 20px; width: 100%;">
                            <button class="ps-modern-btn secondary dev-export" style="flex: 1; padding: 6px; font-size: 0.8rem; border-color: rgba(255,255,255,0.2);" title="Export"><i class="fa-solid fa-download"></i></button>
                            <button class="ps-modern-btn primary dev-edit" style="flex: 2; padding: 6px; font-size: 0.8rem; background: var(--gold); color: #000;"><i class="fa-solid fa-pen"></i> Edit</button>
                            <button class="ps-modern-btn secondary dev-delete" style="flex: 1; padding: 6px; font-size: 0.8rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `);

                card.find(".dev-edit").on("click", () => renderDevMode("editor", m.id));
                card.find(".dev-export").on("click", () => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(m));
                    const downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", dataStr);
                    downloadAnchorNode.setAttribute("download", m.label.replace(/\s+/g, '_') + ".json");
                    document.body.appendChild(downloadAnchorNode);
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                });
                card.find(".dev-delete").on("click", () => {
                    if (confirm(`Delete ${m.label}?`)) {
                        extension_settings[extensionName].customModes = extension_settings[extensionName].customModes.filter(x => x.id !== m.id);
                        saveSettingsDebounced(); renderDevMode("landing");
                    }
                });
                customGrid.append(card);
            });
            c.append(customGrid);
        }

        return;
    }

    // --- VIEW 3: EDITOR ---
    if (view === "editor") {
        let modeData;
        let isNew = false;
        if (passedModeData) {
            modeData = passedModeData;
        } else if (selectedModeId === "NEW") {
            isNew = true;
            modeData = {
                id: "custom_" + Date.now(),
                label: "New Custom Engine",
                isCoreClone: false,
                p1: "", p2: "", p3: "", p4: "", p5: "", p6: "",
                cot: "", prefill: "", cyoa: "", info: "", summary: "",
                customToggles: []
            };
        } else {
            const coreMatch = hardcodedLogic.modes.find(m => m.id === selectedModeId);
            if (coreMatch) {
                isNew = true; modeData = JSON.parse(JSON.stringify(coreMatch));
                modeData.id = "custom_" + Date.now(); modeData.label = coreMatch.label + " (Copy)";
                modeData.isCoreClone = true;
                if (!modeData.cot) modeData.cot = "";
                if (!modeData.prefill) modeData.prefill = "";
                if (!modeData.cyoa) modeData.cyoa = "";
                if (!modeData.info) modeData.info = "";
                if (!modeData.summary) modeData.summary = "";
            } else {
                modeData = extension_settings[extensionName].customModes.find(m => m.id === selectedModeId);
            }
        }
        if (!modeData.customToggles) modeData.customToggles = [];

        c.append(`
            <div style="position: sticky; top: -11px; z-index: 100; background: var(--bg-panel); padding: 10px 0 15px 0; margin-top: -10px; margin-bottom: 20px; display: flex; gap: 10px; border-bottom: 1px solid var(--border-color); box-shadow: 0 10px 15px -10px rgba(0,0,0,0.6);">
                <button id="dev_back_list" class="ps-modern-btn secondary"><i class="fa-solid fa-arrow-left"></i> Back</button>
                <input type="text" id="dev_mode_name" class="ps-modern-input" value="${modeData.label}" style="flex: 1; font-weight: bold; font-size: 1.1rem; border-color: var(--gold);" />
                <button id="dev_save_mode" class="ps-modern-btn primary" style="background: #10b981; color: #fff;"><i class="fa-solid fa-floppy-disk"></i> Save Engine</button>
            </div>
        `);

        // NEW: Track if the user types anything
        c.off("input.devDirty change.devDirty").on("input.devDirty change.devDirty", "input, textarea, select", function () {
            isDevEngineDirty = true;
        });

        // NEW: Back button with unsaved changes warning
        $("#dev_back_list").on("click", () => {
            if (isDevEngineDirty) {
                if (!confirm("You have unsaved changes in this engine. Are you sure you want to go back? Changes will be lost.")) return;
            }
            isDevEngineDirty = false; // Reset tracker
            if (returnTo === "tab") { $(".ps-sidebar").show(); switchTab(0); }
            else { renderDevMode("landing"); }
        });

        const saveCurrentTextState = () => {
            modeData.label = $("#dev_mode_name").val();
            if ($("#dev_edit_p1").length) modeData.p1 = $("#dev_edit_p1").val();
            modeData.p3 = $("#dev_edit_p3").val();
            modeData.p4 = $("#dev_edit_p4").val(); modeData.p5 = $("#dev_edit_p5").val(); modeData.p6 = $("#dev_edit_p6").val();

            // Loop through all override fields
            const fields = ["cot", "prefill", "cyoa", "info", "summary", "death", "combat", "direct", "dn", "dialogueColor", "mvu", "storytracker", "think", "language", "pronouns", "count", "dnratio", "onomato", "banlist"];
            fields.forEach(f => {
                if ($(`#dev_edit_${f}`).length) modeData[f] = $(`#dev_edit_${f}`).val();
            });
        };

        // UI Helpers
        const createInsertPoint = (attach) => `<div class="dev-insert-point" data-attach="${attach}" style="text-align: center; padding: 10px; cursor: pointer; color: var(--gold); border: 2px dashed rgba(245,158,11,0.3); border-radius: 8px; margin: 10px 0;"><i class="fa-solid fa-plus"></i> Add Module Here</div>`;
        const createLockedBlock = (t, c) => `<div style="background: rgba(0,0,0,0.4); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;"><div style="font-weight: bold; color: var(--text-muted); font-size: 0.8rem; margin-bottom: 6px;">${t} <i class="fa-solid fa-lock" style="float: right;"></i></div><div style="font-family: monospace; font-size: 0.75rem; color: #666; white-space: pre-wrap;">${c}</div></div>`;
        const createEditableBlock = (t, k, v) => `<div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;"><div style="font-weight: bold; color: var(--accent-color); font-size: 0.8rem; margin-bottom: 6px;">${t}</div><textarea id="dev_edit_${k}" class="ps-modern-input" style="height: 80px; resize: vertical; font-family: monospace; font-size: 0.8rem;">${v || ""}</textarea></div>`;
        const createOverrideBlock = (t, k, v, presets) => {
            let btnsHtml = presets.map(p => {
                const isActive = (v || "") === p.value;
                const style = isActive ? 'background: rgba(16, 185, 129, 0.15); border-color: #10b981; color: #10b981;' : '';
                return `<button type="button" class="ps-modern-btn secondary dev-preset-btn" data-target="dev_edit_${k}" data-val="${encodeURIComponent(p.value)}" style="padding: 4px 10px; font-size: 0.7rem; border-radius: 4px; ${style}">${p.label}</button>`;
            }).join('');

            return `<div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="font-weight: bold; color: var(--accent-color); font-size: 0.8rem;">${t}</div>
                    <div style="display: flex; gap: 6px;">${btnsHtml}</div>
                </div>
                <textarea id="dev_edit_${k}" class="ps-modern-input" style="height: 80px; resize: vertical; font-family: monospace; font-size: 0.8rem;">${v || ""}</textarea>
            </div>`;
        };

        // Special Dropdown for CoT Languages
        const createCotDropdownBlock = (t, k, v, type) => {
            let options = `<option value="">[ Clear Box ]</option>`;
            hardcodedLogic.models.forEach(m => {
                if (m.id === "cot-off") return;
                const val = (type === "cot") ? m.content : m.prefill;
                options += `<option value="${encodeURIComponent(val || '')}">${m.id}</option>`;
            });

            return `<div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="font-weight: bold; color: var(--accent-color); font-size: 0.8rem;">${t}</div>
                    <select class="ps-modern-input dev-preset-dropdown" data-target="dev_edit_${k}" style="width: 250px; padding: 4px; font-size: 0.75rem; cursor: pointer; color: var(--gold); border-color: var(--gold);">
                        <option value="" disabled selected>✨ Load Language Template...</option>
                        ${options}
                    </select>
                </div>
                <textarea id="dev_edit_${k}" class="ps-modern-input" style="height: 120px; resize: vertical; font-family: monospace; font-size: 0.8rem;">${v || ""}</textarea>
            </div>`;
        };

        const flow = $(`<div style="display: flex; flex-direction: column;"></div>`);

        if (modeData.isCoreClone) {
            flow.append(createLockedBlock("[[prompt1]]", modeData.p1));
            flow.append(createLockedBlock("[[prompt2]]", modeData.p2));
        } else {
            flow.append(createEditableBlock("[[prompt1]]", "p1", modeData.p1));
        }
        flow.append(createEditableBlock("[[prompt3]]", "p3", modeData.p3));

        // Custom Modules Logic
        const modRender = (ap) => {
            const wrap = $("<div></div>");
            modeData.customToggles.filter(t => t.attachPoint === ap).forEach(m => {
                const div = $(`
                    <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid #10b981; border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; font-weight: bold; color: #10b981; font-size: 0.75rem; margin-bottom: 5px;">
                            <span>${m.name}</span>
                            <div style="display:flex; gap: 8px;">
                                <i class="ps-btn-edit-mod fa-solid fa-pen-to-square" style="cursor:pointer; color:var(--gold);"></i>
                                <i class="ps-btn-del-mod fa-solid fa-trash" style="cursor:pointer; color:#ef4444;"></i>
                            </div>
                        </div>
                        <div style="font-size:0.7rem; opacity:0.8; font-family: monospace; white-space: pre-wrap;">${m.content}</div>
                    </div>
                `);
                div.find(".ps-btn-del-mod").on("click", () => { modeData.customToggles = modeData.customToggles.filter(x => x.id !== m.id); saveCurrentTextState(); renderDevMode("editor", modeData.id, modeData); isDevEngineDirty = true; });
                div.find(".ps-btn-edit-mod").on("click", async () => {
                    saveCurrentTextState();
                    const $p = $(`<div style="display:flex; flex-direction:column; gap:10px;"><input type="text" id="m_n" class="ps-modern-input" value="${m.name}" /><select id="m_l" class="ps-modern-input"><option value="settings" ${m.location === 'settings' ? 'selected' : ''}>Stage 4: Settings</option><option value="addons" ${m.location === 'addons' ? 'selected' : ''}>Stage 5: Add-ons</option></select><textarea id="m_c" class="ps-modern-input" style="height:150px;">${m.content}</textarea></div>`);
                    if (await new Popup($p, POPUP_TYPE.CONFIRM, "Edit Module", { okButton: "Save", cancelButton: "Cancel", wide: true }).show()) { m.name = $p.find("#m_n").val() || "Module"; m.location = $p.find("#m_l").val(); m.content = $p.find("#m_c").val(); renderDevMode("editor", modeData.id, modeData); isDevEngineDirty = true; }
                });
                wrap.append(div);
            });
            return wrap;
        };

        flow.append(modRender("p3")); flow.append(createInsertPoint("p3"));
        flow.append(createLockedBlock("[[AI1]]", "Understood."));
        flow.append(createEditableBlock("[[prompt4]]", "p4", modeData.p4));
        flow.append(createEditableBlock("[[prompt5]]", "p5", modeData.p5));
        flow.append(modRender("p5")); flow.append(createInsertPoint("p5"));
        flow.append(createEditableBlock("[[prompt6]]", "p6", modeData.p6));
        flow.append(modRender("p6")); flow.append(createInsertPoint("p6"));
        flow.append(createLockedBlock("[[AI2]]", "Understood."));

        // Fetch raw template data for overrides
        const getAddon = id => hardcodedLogic.addons.find(a => a.id === id)?.content || "";
        const getBlock = id => hardcodedLogic.blocks.find(b => b.id === id)?.content || "";

        // Section 1: CoT & Logic Overrides
        flow.append(`<div class="ps-rule-title" style="margin: 30px 0 10px 0; color: #3b82f6;"><i class="fa-solid fa-brain"></i> CoT & Logic Overrides</div>`);
        flow.append(createCotDropdownBlock("[[COT]]", "cot", modeData.cot, "cot"));
        flow.append(createCotDropdownBlock("[[prefill]]", "prefill", modeData.prefill, "prefill"));
        flow.append(createOverrideBlock("[[THINK]]", "think", modeData.think, [{ label: "No Change", value: "" }, { label: "Default", value: "<think>\n<think>\n<think>\n{Thinking}\n</think>" }]));

        // Section 2: Add-ons & Formatting
        flow.append(`<div class="ps-rule-title" style="margin: 30px 0 10px 0; color: #10b981;"><i class="fa-solid fa-puzzle-piece"></i> Add-ons & Formatting Overrides</div>`);
        flow.append(createOverrideBlock("[[cyoa]]", "cyoa", modeData.cyoa, [{ label: "No Change", value: "" }, { label: "Default", value: getBlock("cyoa") }]));
        flow.append(createOverrideBlock("[[infoblock]]", "info", modeData.info, [{ label: "No Change", value: "" }, { label: "Default", value: getBlock("info") }]));
        flow.append(createOverrideBlock("[[summary]]", "summary", modeData.summary, [{ label: "No Change", value: "" }, { label: "Default", value: getBlock("summary") }]));
        flow.append(createOverrideBlock("[[death]]", "death", modeData.death, [{ label: "No Change", value: "" }, { label: "Default", value: getAddon("death") }]));
        flow.append(createOverrideBlock("[[combat]]", "combat", modeData.combat, [{ label: "No Change", value: "" }, { label: "Default", value: getAddon("combat") }]));
        flow.append(createOverrideBlock("[[Direct]]", "direct", modeData.direct, [{ label: "No Change", value: "" }, { label: "Default", value: getAddon("direct") }]));
        flow.append(createOverrideBlock("[[DN]]", "dn", modeData.dn, [{ label: "No Change", value: "" }, { label: "Default", value: getAddon("dn") }]));
        flow.append(createOverrideBlock("[[COLOR]]", "dialogueColor", modeData.dialogueColor, [{ label: "No Change", value: "" }, { label: "Default", value: getAddon("color") }])); flow.append(createOverrideBlock("[[MVU]]", "mvu", modeData.mvu, [{ label: "No Change", value: "" }, { label: "Default", value: getBlock("mvu") }]));
        flow.append(createOverrideBlock("[[storytracker]]", "storytracker", modeData.storytracker, [{ label: "No Change", value: "" }, { label: "Default", value: "# at the very end of the response put this block:\n<Story_Tracker>\narc: The Arc that is now active.\nchapter: The chapter that is now active.\nEpisode: The episode that is now active.\nSecrets: Any secret that the user/{{user}} doesn't know.\n</Story_Tracker>" }]));

        // Section 3: Global Variables
        flow.append(`<div class="ps-rule-title" style="margin: 30px 0 10px 0; color: #f59e0b;"><i class="fa-solid fa-earth-americas"></i> Global Variables Overrides</div>`);
        flow.append(createOverrideBlock("[[Language]]", "language", modeData.language, [{ label: "No Change", value: "" }, { label: "English Template", value: "[LANGUAGE RULE]\nALL OUTPUT EXCEPT THINKING MUST BE IN ENGLISH ONLY." }]));
        flow.append(createOverrideBlock("[[pronouns]]", "pronouns", modeData.pronouns, [{ label: "No Change", value: "" }, { label: "Male Template", value: "{{user}} is male. Always portray and address him as such." }]));
        flow.append(createOverrideBlock("[[count]]", "count", modeData.count, [{ label: "No Change", value: "" }, { label: "Example 400", value: "— maximum 400 words" }]));
        flow.append(createOverrideBlock("[[DNRATIO]]", "dnratio", modeData.dnratio, [{ label: "No Change", value: "" }, { label: "Example 50/50", value: "- Ratio: Maintain a balance of 50% Dialogue and 50% Narration." }]));
        flow.append(createOverrideBlock("[[onomato]]", "onomato", modeData.onomato, [{ label: "No Change", value: "" }, { label: "Default", value: "- Narration must utilize onomatopoeia. Use precise, context-specific phonetic representations for physical interactions (e.g., the click of a latch, the thud of a heavy object, the soughing of wind) rather than abstract descriptions of sound." }]));
        flow.append(createOverrideBlock("[[banlist]]", "banlist", modeData.banlist, [{ label: "No Change", value: "" }, { label: "Example", value: "[BAN LIST]\nNever rely on these clichés, tropes, or repetitive patterns. They are dead language:\n- A shiver ran down their spine." }]));

        c.append(flow);

        // Events for Buttons & Dropdowns
        c.find(".dev-preset-btn").on("click", function () {
            const targetId = $(this).attr("data-target");
            const val = decodeURIComponent($(this).attr("data-val"));
            $("#" + targetId).val(val);
            $(this).siblings().css({ "background": "transparent", "border-color": "var(--border-color)", "color": "var(--text-main)" });
            $(this).css({ "background": "rgba(16, 185, 129, 0.15)", "border-color": "#10b981", "color": "#10b981" });
        });

        c.off("change.devPreset").on("change.devPreset", ".dev-preset-dropdown", function () {
            const targetId = $(this).attr("data-target");
            const val = decodeURIComponent($(this).val());
            if (val !== "null" && val !== undefined) {
                $("#" + targetId).val(val);
                isDevEngineDirty = true;
            }
            $(this).prop('selectedIndex', 0); // Reset dropdown
        });

        flow.find(".dev-insert-point").on("click", async function () {
            const ap = $(this).attr("data-attach"); saveCurrentTextState();
            const $p = $(`<div style="display:flex; flex-direction:column; gap:10px;"><input type="text" id="m_n" class="ps-modern-input" placeholder="Module Name" /><select id="m_l" class="ps-modern-input"><option value="settings">Stage 4: Settings</option><option value="addons">Stage 5: Add-ons</option></select><textarea id="m_c" class="ps-modern-input" placeholder="Prompt Content" style="height:100px;"></textarea></div>`);
            if (await new Popup($p, POPUP_TYPE.CONFIRM, "Add Module", { wide: true }).show()) {
                const content = $p.find("#m_c").val();
                if (content) { modeData.customToggles.push({ id: "mod_" + Date.now(), name: $p.find("#m_n").val() || "Module", location: $p.find("#m_l").val(), content: content, attachPoint: ap }); renderDevMode("editor", modeData.id, modeData); }
            }
        });

        $("#dev_save_mode").on("click", () => {
            saveCurrentTextState();
            isDevEngineDirty = false;
            if (isNew) { extension_settings[extensionName].customModes.push(modeData); }
            else { const idx = extension_settings[extensionName].customModes.findIndex(m => m.id === modeData.id); if (idx > -1) extension_settings[extensionName].customModes[idx] = modeData; }
            saveSettingsDebounced(); toastr.success("Engine Flow Saved!");
            if (returnTo === "tab") { $(".ps-sidebar").show(); switchTab(0); }
            else { renderDevMode("landing"); }
        });
    }
}
// UNIFIED DEV BUTTON CLICK LISTENER
$("body").off("click", "#ps_btn_dev_mode").on("click", "#ps_btn_dev_mode", function (e) {
    e.preventDefault();
    if ($(this).text().includes("Exit Dev")) {
        if (isDevEngineDirty) {
            if (!confirm("You have unsaved changes in your custom engine. Are you sure you want to exit? Changes will be lost.")) return;
        }
        isDevEngineDirty = false;
        switchTab(0);
    } else {
        renderDevMode("landing");
    }
});

jQuery(async () => {
    try {
        const h = await $.get(`${extensionFolderPath}/example.html`);
        $("body").append(h);
        $("body").append('<div id="ps-global-tooltip"></div>');
        // Modify DOM to transition from Wizard -> Tabs
        $(".ps-breadcrumbs").hide();
        $("#ps_btn_prev, #ps_btn_next").hide();

        $("body").off("click", "#btn_apply_tab_all").on("click", "#btn_apply_tab_all", applyTabToAll);

        $("body").on("mouseenter", ".ps-modern-tag", function () { const hint = $(this).attr("data-hint"); if (!hint) return; const title = $(this).text().trim(); $("#ps-global-tooltip").html(`<span class="ps-tooltip-title">${title}:</span> ${hint}`).addClass("visible"); });
        $("body").on("mouseenter", "#ps_live_token_count", function (e) {
            const hint = $(this).attr("data-breakdown");
            if (!hint) return;
            $("#ps-global-tooltip").html(hint).addClass("visible");
        });
        $("body").on("mousemove", "#ps_live_token_count", function (e) {
            const tooltip = $("#ps-global-tooltip");
            // Position to the left of the mouse so it doesn't go off the screen!
            let x = e.clientX - tooltip.outerWidth() - 15;
            let y = e.clientY + 15;
            tooltip.css({ left: x + 'px', top: y + 'px' });
        });
        $("body").on("mouseleave", "#ps_live_token_count", function () {
            $("#ps-global-tooltip").removeClass("visible");
        });
        $("body").on("mousemove", ".ps-modern-tag", function (e) { if (!$(this).attr("data-hint")) return; const tooltip = $("#ps-global-tooltip"); let x = e.clientX + 15; let y = e.clientY + 15; if (x + tooltip.outerWidth() > window.innerWidth) x = e.clientX - tooltip.outerWidth() - 15; if (y + tooltip.outerHeight() > window.innerHeight) y = e.clientY - tooltip.outerHeight() - 15; tooltip.css({ left: x + 'px', top: y + 'px' }); });
        $("body").on("mouseleave", ".ps-modern-tag", function () { $("#ps-global-tooltip").removeClass("visible"); });

        $("body").on("click", ".sidebar-step", function () { const index = parseInt($(this).attr("id").replace("dot_", "")); if (!isNaN(index)) switchTab(index); });

        $("body").on("click", "#ps_btn_reset", function () {
            if (confirm("Are you sure you want to completely reset this character's profile to the default template?")) {
                const key = getCharacterKey() || "default"; delete extension_settings[extensionName].profiles[key]; saveSettingsDebounced();
                initProfile(); switchTab(0); toastr.info("Profile has been reset to defaults.");
            }
        });

        $("body").on("click", "#ps_btn_save_close", function () { saveProfileToMemory(); $("#prompt-slot-modal-overlay").fadeOut(200); toastr.success("Workflow Configured & Applied Successfully!"); });

        if (typeof eventSource !== 'undefined' && typeof event_types !== 'undefined') {
            eventSource.on(event_types.APP_READY, () => {
                cleanGhostProfiles();
                discoverDefaultImages();
            });
            eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, handlePromptInjection);
            eventSource.on(event_types.CHAT_CHANGED, () => {
                initProfile(); updateCharacterDisplay();
                if ($("#prompt-slot-modal-overlay").is(":visible")) switchTab(currentTab);
            });
            // IMAGE GEN AUTO-GEN & SWIPE TRIGGERS
            eventSource.on(event_types.MESSAGE_RECEIVED, async () => {
                // AUTO-TRIGGER STORY PLANNER
                const sp = localProfile?.storyPlan;
                if (sp && sp.enabled && sp.triggerMode === 'frequency') {
                    const chat = getContext().chat;
                    const aiMsgCount = chat.filter(m => !m.is_user && !m.is_system).length;
                    if (aiMsgCount > 0 && aiMsgCount % sp.autoFreq === 0) {
                        toastr.info("Auto-Generating new Story Plan...", "Megumin Suite");
                        setTimeout(async () => {
                            const chatText = getCleanedChatHistory();
                            if (chatText.length < 100) return;
                            try {
                                let output = sp.backend === "direct" ? await generateStoryPlanLogic(chatText) : await new Promise(r => useMeguminEngine(async () => r(await generateStoryPlanLogic(chatText))));
                                const plotMatch = output?.match(/<plot>([\s\S]*?)<\/plot>/i);
                                if (plotMatch) {
                                    sp.currentPlan = plotMatch[1].trim();
                                    saveProfileToMemory();
                                    if ($("#sp_current_plan").length) $("#sp_current_plan").val(sp.currentPlan);
                                    toastr.success("Story Plan Updated silently!");
                                }
                            } catch (e) { console.error("Story Plan auto-gen failed", e); }
                        }, 2000); // Small delay to let chat save first
                    }
                }
                const s = localProfile?.imageGen;
                if (!s || !s.enabled) return;

                const chat = getContext().chat;
                if (!chat || !chat.length) return;

                const lastMsg = chat[chat.length - 1];
                if (lastMsg.is_user || lastMsg.is_system) return;

                // Look for the <img prompt="..."> tag in the AI's response
                const imgRegex = /<img\s+prompt=["'](.*?)["']\s*\/?>/i;
                const match = lastMsg.mes.match(imgRegex);

                if (match) {
                    const extractedPrompt = match[1];

                    // 1. Remove the raw tag from the chat text so the user doesn't see it
                    lastMsg.mes = lastMsg.mes.replace(imgRegex, "").trim();
                    await saveChat();
                    reloadCurrentChat(); // Refreshes the chat window instantly

                    // 2. Send the extracted prompt to ComfyUI!
                    setTimeout(() => {
                        toastr.info("Image tag detected. Sending to ComfyUI...");
                        igGenerateWithComfy(extractedPrompt, null);
                    }, 500);
                }
            });
            const meguminSwipeHandler = async (data) => {
                const s = localProfile?.imageGen;
                if (!s || !s.enabled) return;

                const { message, direction, element } = data;

                // Only trigger on right swipes
                if (direction !== "right") return;

                const media = message.extra?.media || [];
                const idx = message.extra?.media_index || 0;

                // Only trigger on the LAST image in the gallery (overswipe)
                if (idx < media.length - 1) return;

                const mediaObj = media[idx];

                // If there is no title (prompt), we can't regenerate it.
                if (!mediaObj || !mediaObj.title) return;

                // PRIORITY HACK: Temporarily stun both old and new ST Image Gen settings
                // so the native ST listener aborts itself!
                let ogPower = null;
                if (window.power_user && window.power_user.image_overswipe) {
                    ogPower = window.power_user.image_overswipe;
                    window.power_user.image_overswipe = "off";
                }

                let ogExt = null;
                if (extension_settings.image_generation && extension_settings.image_generation.overswipe) {
                    ogExt = extension_settings.image_generation.overswipe;
                    extension_settings.image_generation.overswipe = false;
                }

                // Restore ST's native settings 200ms later after the default listener aborts
                setTimeout(() => {
                    if (ogPower && window.power_user) window.power_user.image_overswipe = ogPower;
                    if (ogExt && extension_settings.image_generation) extension_settings.image_generation.overswipe = ogExt;
                }, 200);

                toastr.info("Regenerating Image...", "Megumin Suite");
                await igGenerateWithComfy(mediaObj.title, { message: message, element: $(element) });
            };

            // Bind the listener
            eventSource.on(event_types.IMAGE_SWIPED, meguminSwipeHandler);

            // FORCE IT TO THE FRONT OF THE REAL ARRAY
            // This ensures our extension evaluates the swipe BEFORE SillyTavern does.
            if (eventSource._events && Array.isArray(eventSource._events[event_types.IMAGE_SWIPED])) {
                const arr = eventSource._events[event_types.IMAGE_SWIPED];
                if (arr.length > 1 && arr[arr.length - 1] === meguminSwipeHandler) {
                    arr.unshift(arr.pop());
                }
            }
        }

        $("body").on("click", "#prompt-slot-fixed-btn", function () { initProfile(); updateCharacterDisplay(); switchTab(0); $("#prompt-slot-modal-overlay").fadeIn(250).css("display", "flex"); });
        $("body").off("click", "#close-prompt-slot-modal, #prompt-slot-modal-overlay").on("click", "#close-prompt-slot-modal, #prompt-slot-modal-overlay", function (e) {
            if (e.target === this) {
                if (isDevEngineDirty) {
                    if (!confirm("You have unsaved changes in your custom engine. Are you sure you want to close? Changes will be lost.")) return;
                    isDevEngineDirty = false;
                }
                saveProfileToMemory();
                $("#prompt-slot-modal-overlay").fadeOut(200);
            }
        });
        let att = 0;
        const int = setInterval(() => {
            if ($("#kazuma_quick_gen").length > 0) {
                clearInterval(int);
                return;
            }
            const b = `<div id="kazuma_quick_gen" class="interactable" title="Visualize Last Scene (Manual)" style="cursor: pointer; width: 35px; height: 35px; display: none; align-items: center; justify-content: center; margin-right: 5px; color: var(--gold);"><i class="fa-solid fa-image fa-lg"></i></div>`;
            let t = $("#send_but_sheld");
            if (!t.length) t = $("#send_textarea");
            if (t.length) {
                t.attr("id") === "send_textarea" ? t.before(b) : t.prepend(b);
                toggleQuickGenButton(); // Ensure correct visibility immediately upon injection
                clearInterval(int);
            }
            att++;
            if (att > 10) clearInterval(int);
        }, 1000);

        $(document).on("click", "#kazuma_quick_gen", function (e) {
            e.preventDefault();
            e.stopPropagation();
            igManualGenerate();
        });

    } catch (e) { console.error(`[${extensionName}] Failed to load:`, e); }
});