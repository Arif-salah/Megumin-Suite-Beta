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
let currentStage = 0;
let localProfile = {};
let activeGenerationOrder = null;
let activeBanListChat = null;
let activeImageGenRequest = null;

function getCharacterKey() {
    const context = getContext();
    if (context.groupId !== undefined && context.groupId !== null) { return `group_${context.groupId}`; }
    if (context.characterId !== undefined && context.characterId !== null && context.characters[context.characterId]) { return context.characters[context.characterId].avatar; }
    return null;
}

function initProfile() {
    const key = getCharacterKey();
    const context = getContext();
    const isGroup = context.groupId !== undefined && context.groupId !== null;

    if (!extension_settings[extensionName]) extension_settings[extensionName] = { profiles: {} };
    if (!extension_settings[extensionName].profiles) extension_settings[extensionName].profiles = {};
    if (!extension_settings[extensionName].customModes) {
        extension_settings[extensionName].customModes =[];
    }

    const defaults = {
        mode: "balance", 
        personality: "engine", 
        toggles: { ooc: false, control: false },
        aiTags:[], 
        aiGeneratedOptions:[], 
        aiRule: "", 
        customStyles:[],   
        activeStyleId: null,
        addons: [], 
        blocks:[], 
        model: "cot-v1-english", 
        userNotes: "",
        userWordCount: "",
        userLanguage: "", 
        userPronouns: "off",
        devOverrides: {}, 
        banList:[],
        customModes:[],
        // NEW: INTEGRATED IMAGE GEN STATE
        imageGen: {
            enabled: false,
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

    if (localProfile.devOverrides && Object.keys(localProfile.devOverrides).length > 0) {
        localProfile.devOverrides = {};
        saveSettingsDebounced();
    }

    if (!extension_settings[extensionName].profiles["default"]) {
        extension_settings[extensionName].profiles["default"] = JSON.parse(JSON.stringify(defaults));
    }

    if (key && extension_settings[extensionName].profiles[key]) {
        localProfile = extension_settings[extensionName].profiles[key];
        if (isGroup) {
            $("#ps_rule_status_main").css({"color": "#3b82f6", "text-shadow": "0 0 10px rgba(59,130,246,0.5)"}).text(`CUSTOM GROUP PROFILE`);
        } else {
            $("#ps_rule_status_main").css({"color": "#10b981", "text-shadow": "0 0 10px rgba(16,185,129,0.5)"}).text(`CUSTOM CHARACTER PROFILE`);
        }
    } else {
        localProfile = JSON.parse(JSON.stringify(extension_settings[extensionName].profiles["default"]));
        if(key) {
            $("#ps_rule_status_main").css({"color": "#f59e0b", "text-shadow": "0 0 10px rgba(245,158,11,0.5)"}).text(`USING SYSTEM DEFAULT`);
        } else {
            $("#ps_rule_status_main").css({"color": "#a855f7", "text-shadow": "0 0 10px rgba(168,85,247,0.5)"}).text(`MODIFYING GLOBAL DEFAULT`);
        }
    }

    // PATCH missing keys
    Object.keys(defaults).forEach(k => {
        if (localProfile[k] === undefined) localProfile[k] = defaults[k];
    });
    if (!localProfile.toggles) localProfile.toggles = defaults.toggles;
    if (!localProfile.imageGen) localProfile.imageGen = defaults.imageGen; // Patch ImageGen

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
}

function saveProfileToMemory() {
    const key = getCharacterKey() || "default";
    const ruleBox = $("#ps_main_current_rule");
    if (ruleBox.length > 0) { localProfile.aiRule = ruleBox.val(); }
    extension_settings[extensionName].profiles[key] = localProfile;
    saveSettingsDebounced();

    const saveInd = $("#ps_save_indicator");
    if(saveInd.length) {
        saveInd.html(`<i class="fa-solid fa-check"></i> Saved`).fadeIn(150);
        clearTimeout(window.psSaveTimer);
        window.psSaveTimer = setTimeout(() => saveInd.fadeOut(400), 2000);
    }
}

function updateCharacterDisplay() {
    const context = getContext();
    const pfpElement = $("#ps_char_pfp");
    if (context.groupId !== undefined && context.groupId !== null) {
        pfpElement.attr("src", `${extensionFolderPath}/img/group.png`);
    } else if (context.characterId !== undefined && context.characterId !== null && context.characters[context.characterId]) {
        pfpElement.attr("src", `/characters/${context.characters[context.characterId].avatar}`);
    } else {
        pfpElement.attr("src", `${extensionFolderPath}/img/default.png`);
    }
}

function cleanAIOutput(text) {
    if (!text) return "";
    const re = new RegExp("(<disclaimer>.*?</disclaimer>)|(<guifan>.*?</guifan>)|(<danmu>.*?</danmu>)|(<options>.*?</options>)|```start|```end|<done>|`<done>`|(.*?</think(ing)?>(\\n)?)|(<think(ing)?>[\\s\\S]*?</think(ing)?>(\\n)?)", "gs");
    return text.replace(re, "").trim();
}

// -------------------------------------------------------------
// UI WIZARD RENDERER
// -------------------------------------------------------------
const stagesUI =[
    { title: "Stage 1: System Mode", sub: "Select the core logic engine.", render: renderMode },
    { title: "Stage 2: Personality", sub: "Define the persona and Extra Toggles.", render: renderPersonality },
    { title: "Stage 3: Writing Style", sub: "Manage your custom writing styles. Select one to activate it.", render: renderStyleLibrary },
    { title: "Stage 4: Settings", sub: "Toggle advanced modules.", render: renderAddons },
    { title: "Stage 5: Add-ons", sub: "Append mechanical blocks to the end of responses.", render: renderBlocks },
    { title: "Stage 6: Chain of Thought (CoT)", sub: "Select the thinking language to enforce reasoning before responding.", render: renderModels },
    { title: "Stage 7: Dynamic Ban List", sub: "Scan chat history to catch and ban repetitive AI phrases.", render: renderBanList },
    { title: "Stage 8: Image Gen", sub: "Advanced ComfyUI integration for visual storytelling.", render: renderImageGen } // NEW STAGE
];

function drawWizard(index) {
    $(".ps-sidebar").show(); 
    // Reset Dev button visuals
    $("#ps_btn_dev_mode")
        .html(`<i class="fa-solid fa-code"></i> Dev`)
        .css("color", "#a855f7");
    
    currentStage = index;
    const stage = stagesUI[index];
    $("#ps_stage_title").text(stage.title); $("#ps_stage_sub").text(stage.sub);
    $("#ps_breadcrumb_num").text(index + 1); 
    
    // Add dynamically the dots if they don't exist
    const dotsContainer = $("#ps_dynamic_dots");
    if (dotsContainer.children(".ps-dot").length < stagesUI.length) {
        dotsContainer.find(".ps-dot").remove();
        stagesUI.forEach((stg, i) => {
            dotsContainer.append(`<div class="ps-dot sidebar-step" id="dot_${i}"><span class="step-num">${i+1}</span> <span class="step-text">${stg.title.split(':')[1].trim()}</span></div>`);
        });
    }

    $(".ps-dot").removeClass("active"); for(let i=0; i<=index; i++) { $(`#dot_${i}`).addClass("active"); }
    const container = $("#ps_stage_content");
    container.empty(); stage.render(container);
    
    $("#ps_btn_prev").toggle(index > 0); 
    $("#ps_btn_next").toggle(index < stagesUI.length - 1);
}

function renderMode(c) {
    const descriptions = {
        "balance": "The original Secret Sauce. NPCs react naturally — no simping, no needless hostility.",
        "balance Test": "New and improved balance mode that aims to use less tokens and more creativity.",
        "cinematic": "Hollywood-inspired storytelling. Dramatic beats and heightened tension.",
        "dark": "Balance but harsher. The world is unforgiving and consequences hit harder."
    };

    // --- SECTION 1: CORE ENGINES ---
    c.append(`<div class="ps-rule-title" style="margin-bottom:10px;">Megumin Core Engines</div>`);
    const coreGrid = $(`<div class="ps-grid" style="margin-bottom: 30px;"></div>`);
    hardcodedLogic.modes.forEach(m => {
        const recText = m.recommended ? `<span class="ps-rec-text"><i class="fa-solid fa-star"></i> Recommended</span>` : '';
        const newBadge = m.isNew ? `<div style="position: absolute; bottom: 15px; right: 15px; background: #3b82f6; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 3px 10px; border-radius: 8px; text-transform: uppercase;">New</div>` : '';
        const card = $(`<div class="ps-card ${localProfile.mode === m.id ? 'selected' : ''}" style="position:relative; padding-bottom: ${m.isNew ? '40px' : '20px'};">
            <div class="ps-card-title"><span>${m.label}</span> ${recText}</div>
            <div class="ps-card-desc">${descriptions[m.id] || ""}</div>${newBadge}
        </div>`);
        card.on("click", () => { localProfile.mode = m.id; saveProfileToMemory(); drawWizard(currentStage); });
        coreGrid.append(card);
    }); 
    c.append(coreGrid);

    // --- SECTION 2: CUSTOM ENGINES ---
    const customModes = extension_settings[extensionName].customModes || [];
    if (customModes.length > 0) {
        c.append(`<div class="ps-rule-title" style="margin-bottom:10px; color: #10b981;">Custom User Engines</div>`);
        const customGrid = $(`<div class="ps-grid"></div>`);
        customModes.forEach(m => {
            const isSel = localProfile.mode === m.id;
            const card = $(`<div class="ps-card ${isSel ? 'selected' : ''}" style="border-color: ${isSel ? '#10b981' : 'var(--border-color)'};">
                <div class="ps-card-title"><span style="color: ${isSel ? '#000' : '#10b981'};">${m.label}</span></div>
                <div class="ps-card-desc">Custom Engine Flow</div>
            </div>`);
            card.on("click", () => { localProfile.mode = m.id; saveProfileToMemory(); drawWizard(currentStage); });
            customGrid.append(card);
        });
        c.append(customGrid);
    }
}

function renderPersonality(c) {
    const descriptions = {
        "megumin": "Explosive personality. The system channels chaotic energy and playful narration style.",
        "director": "Professional narrator. Clean, authoritative story direction with cinematic awareness.",
        "Nora": "Nora should i say more.",
        "engine": "Pure mechanical precision. Maximum control, minimum personality injection. Just clean output."
    };
    c.append(`<div class="ps-rule-title" style="margin-bottom:10px;">Select Persona</div>`);
    const grid = $(`<div class="ps-grid" style="margin-bottom: 25px;"></div>`);
    hardcodedLogic.personalities.forEach(p => {
        const recText = p.recommended ? `<span class="ps-rec-text"><i class="fa-solid fa-star"></i> Recommended</span>` : '';
        const card = $(`<div class="ps-card ${localProfile.personality === p.id ? 'selected' : ''}">
            <div class="ps-card-title"><span>${p.label}</span> ${recText}</div>
            <div class="ps-card-desc">${descriptions[p.id] || ""}</div>
        </div>`);
        card.on("click", () => { localProfile.personality = p.id; saveProfileToMemory(); drawWizard(currentStage); });
        grid.append(card);
    }); c.append(grid);
    c.append(`<div class="ps-rule-title" style="margin-bottom:10px;">Extra Toggles</div>`);
    Object.entries(hardcodedLogic.toggles).forEach(([key, tog]) => {
        const recText = tog.recommendedOff ? `<span class="ps-rec-text"><i class="fa-solid fa-star"></i> Keep OFF for best results not needed on V5</span>` : '';
        const tCard = $(`<div class="ps-toggle-card ${localProfile.toggles[key] ? 'active' : ''}">
            <div style="display:flex; flex-direction:column;"><span style="font-weight:600;">${tog.label}</span><div style="margin-top:4px;">${recText}</div></div>
            <div class="ps-switch"></div></div>`);
        tCard.on("click", () => { localProfile.toggles[key] = !localProfile.toggles[key]; saveProfileToMemory(); drawWizard(currentStage); });
        c.append(tCard);
    });
}

function renderStyleLibrary(c) {
    $("#ps_stage_title").text("Stage 3: Writing Style");
    $("#ps_stage_sub").text("Select a template to generate, create your own, or turn off extra styling.");
    $("#ps_btn_next").show(); $("#ps_btn_prev").show();
    const listContainer = $(`<div style="display: flex; flex-direction: column; gap: 12px;"></div>`);
    const isOff = !localProfile.activeStyleId;
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

    const existingNames = localProfile.customStyles ? localProfile.customStyles.map(s => s.name) :[];
    if (localProfile.customStyles && localProfile.customStyles.length > 0) {
        listContainer.append(`<div class="ps-stages-label" style="margin-top: 10px; color: var(--gold);">Active Library</div>`);
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
                if($(e.target).closest("button, .ps-btn-regen").length) return;
                localProfile.activeStyleId = style.id; localProfile.aiRule = style.rule; saveProfileToMemory(); renderStyleLibrary(c);
            });
            card.find(".ps-btn-edit").on("click", () => renderStyleEditor(c, style.id));
            card.find(".ps-btn-delete").on("click", () => {
                if(confirm(`Delete "${style.name}"?`)) {
                    localProfile.customStyles = localProfile.customStyles.filter(s => s.id !== style.id);
                    if(localProfile.activeStyleId === style.id) { localProfile.activeStyleId = null; localProfile.aiRule = ""; }
                    saveProfileToMemory(); renderStyleLibrary(c);
                }
            });
            card.find(".ps-btn-regen").on("click", async function() {
                $(this).html(`<i class="fa-solid fa-spinner fa-spin"></i>`);
                await useMeguminEngine(async () => {
                    const orderText = `Inspired by ${style.notes}. Write a writing style rule based on: ${style.tags.join(", ")}. Direct instructions only. 2-3 paragraphs. No fluff.`;
                    let rule = await runMeguminTask(orderText);
                    style.rule = cleanAIOutput(rule).trim();
                    if (localProfile.activeStyleId === style.id) localProfile.aiRule = style.rule;
                    saveProfileToMemory(); renderStyleLibrary(c);
                    toastr.success("Rule Regenerated!");
                });
            });
            listContainer.append(card);
        });
    }

    listContainer.append(`<div class="ps-stages-label" style="margin-top: 10px;">Template Library</div>`);
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
        card.find(".ps-btn-tpl-gen").on("click", async function() {
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
        listContainer.append(card);
    });

    const addBtn = $(`
        <div class="ps-card" style="width: 100%; padding: 16px; border-style: dashed; border-color: #52525b; justify-content: center; background: transparent; cursor: pointer;">
            <div style="font-weight: 700; color: var(--text-muted);"><i class="fa-solid fa-plus"></i> Create Custom Style</div>
        </div>
    `);
    addBtn.on("click", () => renderStyleEditor(c, null));
    listContainer.append(addBtn);
    c.empty().append(listContainer);
}

function renderStyleEditor(c, editId, presetData = null) {
    $("#ps_stage_title").text(editId ? "Edit Style Profile" : "Create New Style");
    $("#ps_stage_sub").text("Configure tags and specific instructions for this writing style.");
    $("#ps_btn_next").hide(); $("#ps_btn_prev").hide();

    let currentStyle = presetData ? presetData : (editId ? JSON.parse(JSON.stringify(localProfile.customStyles.find(s => s.id === editId))) : {
        id: "style_" + Date.now(), name: "", tags: [], generatedOptions:[], notes: "", rule: ""
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

    $("#ps_style_template_dropdown").on("change", function() {
        const tplIndex = $(this).val(); if (tplIndex === null) return;
        const chosenTpl = hardcodedLogic.styleTemplates[tplIndex];
        currentStyle.name = chosenTpl.name; currentStyle.tags = [...chosenTpl.tags]; currentStyle.notes = chosenTpl.notes; currentStyle.rule = ""; currentStyle.generatedOptions =[];
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
                if(currentStyle.tags.includes(tagName)) currentStyle.tags = currentStyle.tags.filter(t => t !== tagName); else currentStyle.tags.push(tagName);
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
        (currentStyle.generatedOptions ||[]).forEach(tag => {
            const isSel = currentStyle.tags.includes(tag);
            const tEl = $(`<span class="ps-modern-tag ${isSel ? 'selected' : ''}">${tag.replace(" ✨", "")} <i class="fa-solid fa-sparkles" style="font-size:0.6rem; margin-left:4px; color:var(--gold);"></i></span>`);
            tEl.on("click", () => {
                if (isSel) currentStyle.tags = currentStyle.tags.filter(t => t !== tag); else currentStyle.tags.push(tag);
                tEl.toggleClass("selected");
            }); box.append(tEl);
        });
    };
    renderInsights();

    $("#ps_style_notes").on("input", function() { currentStyle.notes = $(this).val(); });
    $("#ps_style_rule_text").on("input", function() { currentStyle.rule = $(this).val(); });
    $("#ps_style_name").on("input", function() { currentStyle.name = $(this).val(); });

    $("#ps_btn_cancel_style").on("click", () => renderStyleLibrary(c));
    $("#ps_btn_save_style").on("click", () => {
        if (currentStyle.name.trim() === "") currentStyle.name = "Unnamed Style";
        if (!editId) { localProfile.customStyles.push(currentStyle); } 
        else { const idx = localProfile.customStyles.findIndex(s => s.id === editId); if(idx > -1) localProfile.customStyles[idx] = currentStyle; }
        if (localProfile.activeStyleId === currentStyle.id) { localProfile.aiRule = currentStyle.rule; }
        saveProfileToMemory(); renderStyleLibrary(c); toastr.success(`Saved "${currentStyle.name}"`);
    });

    $("#ps_btn_get_authors_style").on("click", async function() {
        if (!getCharacterKey()) return toastr.warning("Open a chat or group first so I can read the context!");
        $(this).prop("disabled", true).html(`<i class="fa-solid fa-spinner fa-spin"></i> Brainstorming...`);
        await useMeguminEngine(async () => {
            const orderText = `Based on the active characters and scenario, give me EXACTLY 2 famous author names or literary writing styles (e.g. Edgar Allan Poe, Jane Austen style, Dark Fantasy Author) and 5 tags that fit the rp (e.g. internet culture, femboy, virtual game) whose writing style perfectly fits the tone and world. Return ONLY the 7 items separated by a comma. Do not explain them.`;
            let aiRawOutput = await runMeguminTask(orderText);
            const aiTagsTemp = cleanAIOutput(aiRawOutput).split(",").map(t => t.trim().replace(/['"\[\]\.]/g, '')).filter(t => t.length > 0);
            if(aiTagsTemp.length > 0) {
                currentStyle.tags = currentStyle.tags.filter(tag => !tag.endsWith("✨"));
                currentStyle.generatedOptions = aiTagsTemp.map(tag => `${tag} ✨`);
                renderInsights(); toastr.success(`Generated ${aiTagsTemp.length} insights!`);
            }
        }); $(this).prop("disabled", false).html(`<i class="fa-solid fa-lightbulb"></i> Generate Insights`);
    });

    $("#ps_btn_generate_style").on("click", async function() {
        if (currentStyle.tags.length === 0) return toastr.warning("Select tags first!");
        $(this).prop("disabled", true).html(`<i class="fa-solid fa-spinner fa-spin"></i> Finalizing...`);
        await useMeguminEngine(async () => {
            const orderText = `Create a writing style prompt based on these traits:\n\nSelected style tags: ${currentStyle.tags.join(", ")}\n\nAdditional user instructions: ${currentStyle.notes}\n\nWrite a concise, well-structured writing style rule (2-4 paragraphs) that the AI must follow. Combine all tags into a cohesive directive. Write it as a direct instruction. Do not use bullet points or introductory text.`;
            let rule = await runMeguminTask(orderText);
            currentStyle.rule = cleanAIOutput(rule).trim(); 
            $("#ps_style_rule_text").val(currentStyle.rule); toastr.success("Live AI Rule Generated!");
        }); $(this).prop("disabled", false).html(`<i class="fa-solid fa-bolt"></i> Generate Writing Rule`);
    });
}

function renderAddons(c) {
    const descriptions = {
        "death": "Permanent death is on the table. You can actually get a Game Over. No plot armor.",
        "combat": "Lethal, tactical combat. Hits have weight, positioning matters, and fights can go badly fast.",
        "direct": "No euphemisms or flowery evasions. Characters say exactly what they mean.",
        "color": "Each character's dialogue is color-coded for easy visual parsing."
    };
    const grid = $(`<div class="ps-grid"></div>`);
    hardcodedLogic.addons.forEach(a => {
        const isSel = localProfile.addons.includes(a.id);
        const recText = a.recommended ? `<span class="ps-rec-text"><i class="fa-solid fa-star"></i> Recommended</span>` : '';
        const card = $(`<div class="ps-card ${isSel ? 'selected' : ''}">
            <div class="ps-card-title"><span>${a.label}</span> ${recText}</div>
            <div class="ps-card-desc">${descriptions[a.id] || ""}</div>
        </div>`);
        card.on("click", () => {
            if(isSel) localProfile.addons = localProfile.addons.filter(i => i !== a.id); else localProfile.addons.push(a.id);
            saveProfileToMemory(); drawWizard(currentStage);
        }); grid.append(card);
    }); c.append(grid);
    // --- INJECT CUSTOM ENGINE MODULES (STAGE 4) ---
    const activeMode = [...hardcodedLogic.modes, ...(extension_settings[extensionName].customModes ||[])].find(m => m.id === localProfile.mode);
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
                tCard.on("click", () => { localProfile.toggles[cs.id] = !localProfile.toggles[cs.id]; saveProfileToMemory(); drawWizard(currentStage); });
                c.append(tCard);
            });
        }
    }

    c.append(`
        <div style="margin-top: 32px; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 20px;">
            <div class="ps-rule-title" style="color: var(--text-main); font-size: 0.9rem; font-weight: 700;">
                <i class="fa-solid fa-earth-americas" style="margin-right: 8px; color: #4a90e2;"></i> Extra
            </div>
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
    $("#ps_input_wordcount").on("input", function() { localProfile.userWordCount = $(this).val(); saveProfileToMemory(); });
    $("#ps_input_language").on("input", function() { localProfile.userLanguage = $(this).val(); saveProfileToMemory(); });
    $("#ps_select_pronouns").on("change", function() { localProfile.userPronouns = $(this).val(); saveProfileToMemory(); });
}

function renderBlocks(c) {
    const activeEngine = [...hardcodedLogic.modes, ...(extension_settings[extensionName].customModes ||[])].find(m => m.id === localProfile.mode);
    const descriptions = {
        "info": "Appends a clean status block with current weather, time, location, and character clothing.",
        "summary": "A rolling summary the AI updates each response so it never forgets key events or details.",
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
            if(isSel) localProfile.blocks = localProfile.blocks.filter(i => i !== b.id); else localProfile.blocks.push(b.id);
            saveProfileToMemory(); drawWizard(currentStage);
        }); grid.append(card);
    });
    // --- INJECT CUSTOM ENGINE MODULES (STAGE 5) ---
    const activeMode =[...hardcodedLogic.modes, ...(extension_settings[extensionName].customModes ||[])].find(m => m.id === localProfile.mode);
    if (activeMode && activeMode.customToggles) {
        const customAddons = activeMode.customToggles.filter(t => t.location === "addons");
        if (customAddons.length > 0) {
            grid.append(`<div style="grid-column: 1 / -1; margin-top: 10px;"><div class="ps-rule-title" style="color: #10b981; margin-bottom: 0;">Custom Engine Add-ons</div></div>`);
            customAddons.forEach(ca => {
                const isSel = !!localProfile.toggles[ca.id];
                const card = $(`<div class="ps-card ${isSel ? 'selected' : ''}" style="border-color: ${isSel ? '#10b981' : 'var(--border-color)'}; background: ${isSel ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-panel)'};">
                    <div class="ps-card-title"><span style="color: ${isSel ? '#10b981' : 'var(--text-main)'};">${ca.name}</span></div>
                    <div class="ps-card-desc">Custom Module Attached to [[${ca.attachPoint}]]</div>
                </div>`);
                card.on("click", () => { localProfile.toggles[ca.id] = !localProfile.toggles[ca.id]; saveProfileToMemory(); drawWizard(currentStage); });
                grid.append(card);
            });
        }
    } c.append(grid);
}

function renderModels(c) {
    c.empty();
    const activeEngine = [...hardcodedLogic.modes, ...(extension_settings[extensionName].customModes ||[])].find(m => m.id === localProfile.mode);

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

    c.append(`<div class="ps-rule-title" style="margin-bottom:10px;">Select Thinking Framework</div>`);
    const typeGrid = $(`<div class="ps-grid" style="margin-bottom: 25px;"></div>`);
    const types =[
        { id: "off", label: "CoT Off", desc: "No Chain of Thought or prefill. The AI will respond normally." },
        { id: "v1", label: "CoT V1 (Classic)", desc: "The original 8-step framework. Focuses heavily on the NPC's internal emotional landscape vs their observable actions." },
        { id: "v2", label: "CoT V2 (New)", desc: "The new experimental framework. Stricter reality checks, info audits, better NPCs, and hook generation.", isNew: true }
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
        const langs =[
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

function renderBanList(c) {
    c.empty();
    if (!localProfile.banList) localProfile.banList =[];
    c.append(`
        <div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div><span style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">AI Slop Detector</span><div style="font-size: 0.75rem; color: var(--text-muted);">Scans the last 15 AI messages to catch overused clichés.</div></div>
                <button id="ps_btn_scan_slop" class="ps-modern-btn primary" style="padding: 8px 16px; font-size: 0.8rem; background: #a855f7; color: #fff;"><i class="fa-solid fa-radar"></i> Analyze Chat History</button>
            </div>
            <hr style="border: 0; border-top: 1px dashed var(--border-color); margin: 15px 0;" />
            <div style="display: flex; gap: 10px;">
                <input type="text" id="ps_manual_ban_input" class="ps-modern-input" placeholder="Manually add a phrase to ban..." style="flex: 1;" />
                <button id="ps_btn_add_ban" class="ps-modern-btn secondary" style="padding: 0 15px;">Add</button>
            </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div class="ps-rule-title" style="margin-bottom: 0;">Active Banned Phrases</div>
            <button id="ps_btn_clear_bans" class="ps-modern-btn secondary" style="padding: 4px 10px; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);"><i class="fa-solid fa-trash-can"></i> Clear All</button>
        </div>
        <div id="ps_banlist_container" style="display: flex; flex-wrap: wrap; gap: 8px; min-height: 50px; padding: 10px; border: 1px dashed var(--border-color); border-radius: 8px;"></div>
        <div style="margin-top: 20px; background: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; border-radius: 4px; padding: 12px 16px;">
            <div style="display: flex; align-items: center; gap: 8px; color: #3b82f6; font-weight: 600; font-size: 0.85rem; margin-bottom: 4px;"><i class="fa-solid fa-circle-info"></i> Note</div>
            <div style="color: var(--text-main); font-size: 0.8rem; line-height: 1.5;">This is a beta feature. Don't complain if you have to generate more than once.</div>
        </div>
    `);

    const renderTags = () => {
        const box = $("#ps_banlist_container"); box.empty();
        if (localProfile.banList.length === 0) { box.append(`<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">No phrases banned yet.</span>`); return; }
        localProfile.banList.forEach(phrase => {
            const tEl = $(`<span class="ps-modern-tag selected" style="background: rgba(239,68,68,0.1); border-color: #ef4444; color: #ef4444;">${phrase} <i class="fa-solid fa-xmark" style="margin-left: 6px;"></i></span>`);
            tEl.on("click", () => { localProfile.banList = localProfile.banList.filter(p => p !== phrase); saveProfileToMemory(); renderTags(); }); box.append(tEl);
        });
    }; renderTags();

    $("#ps_btn_add_ban").on("click", () => {
        const val = $("#ps_manual_ban_input").val().trim();
        if (val && !localProfile.banList.includes(val)) { localProfile.banList.push(val); saveProfileToMemory(); $("#ps_manual_ban_input").val(""); renderTags(); }
    });
    $("#ps_btn_clear_bans").on("click", () => {
        if (localProfile.banList.length === 0) return;
        if (confirm("Are you sure you want to delete all banned phrases?")) { localProfile.banList =[]; saveProfileToMemory(); renderTags(); toastr.info("Ban list cleared."); }
    });
    $("#ps_btn_scan_slop").on("click", async function() {
        const chatText = getCleanedChatHistory();
        if (chatText.length < 50) return toastr.warning("Not enough chat history to analyze!");
        $(this).prop("disabled", true).html(`<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...`);
        const rawResponse = await analyzeSlopDirectly(chatText);
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
                    ${[1,2,3,4].map(i => `
                        <div style="background: rgba(0,0,0,0.15); border: 1px solid var(--border-color); padding: 10px; border-radius: 8px; border-left: 3px solid #a855f7;">
                            <div style="font-size: 0.75rem; font-weight: bold; color: var(--text-muted); margin-bottom: 5px;">Slot ${i}</div>
                            <select id="ig_lora_${i}" class="ps-modern-input" style="padding: 6px; font-size: 0.75rem; margin-bottom: 8px;"><option value="">Loading...</option></select>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: bold;">Wt: <span id="ig_lorawt_lbl_${i}" style="color: var(--text-main);">${i===1?s.selectedLoraWt:i===2?s.selectedLoraWt2:i===3?s.selectedLoraWt3:s.selectedLoraWt4}</span></span>
                                <input type="range" id="ig_lorawt_${i}" min="-2" max="2" step="0.1" value="${i===1?s.selectedLoraWt:i===2?s.selectedLoraWt2:i===3?s.selectedLoraWt3:s.selectedLoraWt4}" style="flex: 1; cursor: pointer;">
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `);

    // --- EVENTS & BINDINGS ---
    $("#ig_enable_card").on("click", function() {
        s.enabled = !s.enabled;
        saveProfileToMemory();
        toggleQuickGenButton(); // <-- ADDED
        if (s.enabled) { $(this).addClass("active"); $(this).css("border-color", "var(--gold)"); $(this).find("span").css("color", "var(--gold)"); $("#ig_main_content").slideDown(200); igFetchComfyLists(); } 
        else { $(this).removeClass("active"); $(this).css("border-color", "var(--border-color)"); $(this).find("span").css("color", "var(--text-main)"); $("#ig_main_content").slideUp(200); }
    });

    $("#ig_trigger_mode").on("change", (e) => { 
        s.triggerMode = $(e.target).val(); 
        saveProfileToMemory(); 
        toggleQuickGenButton(); // <-- ADDED
        if (s.triggerMode === 'frequency') $("#ig_freq_container").show(); else $("#ig_freq_container").hide();
    });
    $("#ig_auto_freq").on("input", (e) => { let v = parseInt($(e.target).val()); if(v<1)v=1; s.autoGenFreq = v; saveProfileToMemory(); });

    $("#ig_preview_card").on("click", function() {
        s.previewPrompt = s.previewPrompt === true ? false : true; 
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
        $(`#ig_${id}`).on("input", function() { let v = isFloat ? parseFloat(this.value) : parseInt(this.value); s[key] = v; $(`#ig_${id}_val`).val(v); saveProfileToMemory(); });
        $(`#ig_${id}_val`).on("input", function() { let v = isFloat ? parseFloat(this.value) : parseInt(this.value); s[key] = v; $(`#ig_${id}`).val(v); saveProfileToMemory(); });
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
    for(let i=1; i<=4; i++) {
        const key = i===1 ? "selectedLora" : `selectedLora${i}`;
        const wtKey = i===1 ? "selectedLoraWt" : `selectedLoraWt${i}`;
        $(`#ig_lora_${i}`).on("change", (e) => { s[key] = $(e.target).val(); saveProfileToMemory(); });
        $(`#ig_lorawt_${i}`).on("input", function() { let v = parseFloat(this.value); s[wtKey] = v; $(`#ig_lorawt_lbl_${i}`).text(v); saveProfileToMemory(); });
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
            for(let i=1; i<=4; i++) {
                const sel = $(`#ig_lora_${i}`); const val = i===1 ? s.selectedLora : s[`selectedLora${i}`];
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
            if (typeof rawBody === 'string') { try { jsonObj = JSON.parse(rawBody); } catch(e) {} }
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
        $itemDiv.append($('<span></span>').text(item.key).css({'font-weight': 'bold', 'color': 'var(--gold)', 'font-family': 'monospace'})).append($('<div></div>').text(item.desc).css({ 'font-size': '0.7rem', 'color': 'var(--text-muted)', 'margin-top': '4px' }));
        $list.append($itemDiv);
    });

    const updateState = () => {
        currentJsonText = $textarea.val();
        $list.children().each(function() {
            const cleanKey = $(this).find('span').first().text().replace(/"/g, '');
            if (currentJsonText.includes(cleanKey)) $(this).css({'border-color': '#10b981', 'background': 'rgba(16, 185, 129, 0.1)'});
            else $(this).css({'border-color': 'transparent', 'background': 'rgba(255,255,255,0.05)'});
        });
    };
    $textarea.on('input', updateState); setTimeout(updateState, 100);

    $container.find('.wf-format').on('click', () => { try { $textarea.val(JSON.stringify(JSON.parse($textarea.val()), null, 4)); updateState(); toastr.success("Formatted"); } catch(e) { toastr.warning("Invalid JSON"); } });
    $container.find('.wf-import').on('click', () => $fileInput.click());
    $fileInput.on('change', (e) => { if (!e.target.files[0]) return; const r = new FileReader(); r.onload = (ev) => { $textarea.val(ev.target.result); updateState(); toastr.success("Imported"); }; r.readAsText(e.target.files[0]); $fileInput.val(''); });
    $container.find('.wf-export').on('click', () => { try { JSON.parse(currentJsonText); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([currentJsonText], {type:"application/json"})); a.download = name; a.click(); } catch(e) { toastr.warning("Invalid content"); } });

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
    
    const chat = getContext().chat;
    if (!chat || chat.length === 0) return toastr.warning("No chat history.");

    // The same Regex used in the Ban List analyzer
    const badStuffRegex = /(<disclaimer>.*?<\/disclaimer>)|(<guifan>.*?<\/guifan>)|(<danmu>.*?<\/danmu>)|(<options>.*?<\/options>)|```start|```end|<done>|`<done>`|(.*?<\/(?:ksc??|think(?:ing)?)>(\n)?)|(<(?:ksc??|think(?:ing)?)>[\s\S]*?<\/(?:ksc??|think(?:ing)?)>(\n)?)/gs;

    // Grab the last 5 real messages and clean them so the AI doesn't get confused by formatting
    const lastMessages = chat.filter(m => !m.is_system).slice(-5).map(m => {
        let text = m.mes;
        text = text.replace(badStuffRegex, "");
        text = text.replace(/<details>[\s\S]*?<\/details>/gs, "");
        text = text.replace(/<summary>[\s\S]*?<\/summary>/gs, "");
        text = text.replace(/<[^>]*>?/gm, "");
        return `${m.name}: ${text.trim()}`;
    }).join("\n\n");
    
    let styleStr = "Use a comma-separated list of detailed keywords and visual descriptors.";
    if (s.promptStyle === "illustrious") styleStr = "Use Danbooru-style tags separated by commas.";
    else if (s.promptStyle === "sdxl") styleStr = "Use natural, descriptive prose and full sentences.";
    
    let perspStr = "Describe the entire environment and atmosphere.";
    if (s.promptPerspective === "pov") perspStr = "Frame the scene strictly from a First-Person (POV) perspective.";
    else if (s.promptPerspective === "character") perspStr = "Focus intensely on the character's appearance.";
    
    // Load the data into the global variable for the interceptor
    activeImageGenRequest = {
        chatText: lastMessages,
        styleStr: styleStr,
        perspStr: perspStr,
        extraStr: s.promptExtra || "None"
    };

    showKazumaProgress("Analyzing Scene...");
    
    try {
        // Fire the request DIRECTLY. No preset switching!
        let rawOutput = await generateQuietPrompt({ prompt: "___PS_IMAGE_GEN___" });
        
        // Clean the thinking block out of the response
        let promptText = rawOutput.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        
        // Clean up in case the AI wraps it in image tags anyway
        const imgRegex = /<img\s+prompt=["'](.*?)["']\s*\/?>/i;
        const match = promptText.match(imgRegex);
        if (match) promptText = match[1];

        toastr.info("Sending to ComfyUI...", "Megumin Suite");
        igGenerateWithComfy(promptText, null);
    } catch(e) {
        console.error(e);
        $("#kazuma_progress_overlay").hide();
        toastr.error("Manual generation failed.");
    } finally {
        // Always reset the interceptor!
        activeImageGenRequest = null;
    }
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
        $content.find(".ig-preview-textarea").on("input", function() { 
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
        if(!res.ok) throw new Error("Failed");
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
                            if (!target.message.extra) target.message.extra = {}; if (!target.message.extra.media) target.message.extra.media =[];
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
            } catch (e) {}
        }, 1000);
    } catch(e) { $("#kazuma_progress_overlay").hide(); toastr.error("Comfy Error: " + e.message); }
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
        let text = rawOutput.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        return text;
    } catch (e) {
        console.error(`[${extensionName}] Ban List Analysis Failed:`, e);
        return null;
    } finally {
        activeBanListChat = null; 
    }
}

async function useMeguminEngine(task) {
    const selector = $("#settings_preset_openai");
    const option = selector.find(`option`).filter(function () { return $(this).text().trim() === TARGET_PRESET_NAME; });
    let originalValue = null;

    if (option.length) {
        originalValue = selector.val();
        selector.val(option.val()).trigger("change");
        await new Promise(r => setTimeout(r, 2000));
    } else {
        toastr.error(`"${TARGET_PRESET_NAME}" not found in OpenAI presets.`);
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
        if(item) dict[item.trigger] = item.content; 
    });

    // Stage 5 Defaults (Format Blocks)
    localProfile.blocks.forEach(bId => { 
        const item = hardcodedLogic.blocks.find(b => b.id === bId); 
        if(item) dict[item.trigger] = item.content; 
    });

    // Stage 6 Defaults (CoT Framework & Language)
    const modData = hardcodedLogic.models.find(m => m.id === localProfile.model);
    if (modData) {
        dict["[[COT]]"] = modData.content;
        if (modData.prefill) dict["[[prefill]]"] = modData.prefill;
    }

    // MVU Logic
    if (localProfile.blocks.includes("mvu")) {
        let baseMvu = hardcodedLogic.blocks.find(b => b.id === "mvu").content;
        if (wordCountStr) dict["[[MVU]]"] = baseMvu.replace("[[count]]", `maximum ${wordCountStr} words`);
        else dict["[[MVU]]"] = baseMvu.replace("[[count]]", "...");
    } else {
        dict["[[MVU]]"] = wordCountStr ? `{Main narrative response — maximum ${wordCountStr} words}` : `{Main narrative response}`;
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

        // Engine-specific Block Overwrites (Summary, CoT, etc.)
        if (activeEngine.cot && activeEngine.cot.trim() !== "") dict["[[COT]]"] = activeEngine.cot;
        if (activeEngine.prefill && activeEngine.prefill.trim() !== "") dict["[[prefill]]"] = activeEngine.prefill;
        if (localProfile.blocks.includes("info") && activeEngine.info) dict["[[infoblock]]"] = activeEngine.info;
        if (localProfile.blocks.includes("summary") && activeEngine.summary) dict["[[summary]]"] = activeEngine.summary;
        if (localProfile.blocks.includes("cyoa") && activeEngine.cyoa) dict["[[cyoa]]"] = activeEngine.cyoa;

        // Custom Toggles Appender
        if (activeEngine.customToggles) {
            activeEngine.customToggles.forEach(ct => {
                if (localProfile.toggles[ct.id]) {
                    const targetKey = "[[prompt" + ct.attachPoint.replace('p','') + "]]";
                    if (dict[targetKey] !== undefined) {
                        dict[targetKey] += `\n\n${ct.content}`;
                    }
                }
            });
        }
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
    
    return dict;
}

function escapeRegex(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function handlePromptInjection(data) {
    const messages = data?.messages || data?.chat || (Array.isArray(data) ? data : null);
    if (!messages || !Array.isArray(messages)) return;

    if (activeBanListChat) {
        messages.length = 0; 
        messages.push({ "role": "system", "content": "You are an expert literary critique. Analyze the provided chat history and identify the 5 most repetitive, cliché, or overused stylistic patterns or crutch phrases the writer relies on. Instead of quoting the exact phrase, write a short, generalized rule forbidding the underlying trope. Return ONLY the 5 rules separated by commas. Do not explain them. Do not use quotes or numbers." });
        messages.push({ "role": "user", "content": "Extract the top 5 most overused clichés or repetitive narrative patterns from this text. Return ONLY the 5 generalized rules forbidding them, separated by commas.\n<chat>\n" + activeBanListChat + "\n</chat>" });
        messages.push({ "role": "system", "content": "<thinking_steps>\nBefore creating the response, think deeply.\n\nThoughts must be wrapped in <think></think>. The first token must be <think>. The main text must immediately follow </think>.\n\n<think>\nReflect in approximately 100–150 words as a seamless paragraph.\n\n– your thinking steps\n\n</think>\n</thinking_steps>\n\n[OUTPUT ORDER]\n    Every response must follow this exact structure in this exact order:\n\n    <think>\n    {Thinking}\n    </think>\n\n    {Main response}" });
        messages.push({ "role": "assistant", "content": "So, I realize this is a fictional world, to which nothing from the real world applies. \nI will now use this format for my thinking and give the next response:\n<think>\nI will thinking step-by-step in the following format: <think>.\n</think>" });
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
            "content": "<thinking_steps>\nBefore creating the response, think deeply.\n\nThoughts must be wrapped in <think></think>. The first token must be <think>. The main text must immediately follow </think>.\n\n<think>\nReflect in approximately 50-100 words as a seamless paragraph on what visual elements are present.\n\n</think>\n</thinking_steps>\n\n[OUTPUT ORDER]\n    Every response must follow this exact structure in this exact order:\n\n    <think>\n    {Thinking}\n    </think>\n\n    {Main response}" 
        });
        messages.push({ 
            "role": "assistant", 
            "content": "So, I realize this is a fictional world, to which nothing from the real world applies. \nI will now use this format for my thinking and give the next response:\n<think>\nI will thinking step-by-step in the following format: <think>.\n</think>" 
        });
        
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
            ["[[prompt1]]","[[prompt2]]","[[prompt3]]","[[prompt4]]","[[prompt5]]","[[prompt6]]","[prompt1]","[prompt2]","[prompt3]","[prompt4]","[prompt5]","[prompt6]","[[AI1]]","[[AI2]]","[[main]]","[[OOC]]","[[control]]","[[aiprompt]]","[[death]]","[[combat]]","[[Direct]]","[[COLOR]]","[[infoblock]]","[[summary]]","[[cyoa]]","[[COT]]","[[prefill]]","[[order]]","[[Language]]","[[pronouns]]","[[banlist]]","[[count]]","[[MVU]]","[[img1]]","[[img2]]"].forEach(tr => {
                if(msg.content.includes(tr)) msg.content = msg.content.replace(new RegExp(escapeRegex(tr), 'g'), "");
            });
        }
    }
    
    if (replacementsMade > 0 && !activeGenerationOrder) {
        console.log(`[${extensionName}] ✅ Executed ${replacementsMade} block replacements.`);
    }
}

$("body").on("click", "#ps_btn_next", function() { if (currentStage < stagesUI.length - 1) drawWizard(currentStage + 1); });
$("body").on("click", "#ps_btn_prev", function() { if (currentStage > 0) drawWizard(currentStage - 1); });

// -------------------------------------------------------------
// DEV MODE: VISUAL ENGINE BUILDER
// -------------------------------------------------------------
function renderDevMode(view = "landing", selectedModeId = null, passedModeData = null) {
    const c = $("#ps_stage_content");
    c.empty();
    $("#ps_btn_prev, #ps_btn_next").hide();
    $(".ps-dot").removeClass("active");
    $("#ps_breadcrumb_num").text("DEV");
    $(".ps-sidebar").hide(); 

    // Update Dev button visuals
    $("#ps_btn_dev_mode")
        .html(`<i class="fa-solid fa-right-from-bracket"></i> Exit Dev`)
        .css("color", "#10b981");

    if (!extension_settings[extensionName].customModes) extension_settings[extensionName].customModes = [];

    // --- VIEW 1: DASHBOARD (Merged Landing & List) ---
    if (view === "landing") {
        $("#ps_stage_title").text("Engine Builder");
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
        $("#dev_import_file").on("change", function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const imported = JSON.parse(e.target.result);
                    imported.id = "custom_" + Date.now(); // Ensure unique ID on import
                    extension_settings[extensionName].customModes.push(imported);
                    saveSettingsDebounced();
                    toastr.success(`Imported ${imported.label}!`);
                    renderDevMode("landing"); // Refresh UI
                } catch(e) { toastr.error("Invalid JSON file."); }
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
            const baseCoT = hardcodedLogic.models.find(m => m.id === "cot-v1-english");
            modeData = { 
                id: "custom_" + Date.now(), 
                label: "New Custom Engine", 
                isCoreClone: false,
                p1: "", p2: "", p3: "", p4: "", p5: "", p6: "",
                cot: baseCoT.content, 
                prefill: baseCoT.prefill,
                cyoa: hardcodedLogic.blocks.find(b => b.id === "cyoa").content, 
                info: hardcodedLogic.blocks.find(b => b.id === "info").content, 
                summary: hardcodedLogic.blocks.find(b => b.id === "summary").content, 
                customToggles: [] 
            };
        } else {
            const coreMatch = hardcodedLogic.modes.find(m => m.id === selectedModeId);
            if (coreMatch) {
                isNew = true; modeData = JSON.parse(JSON.stringify(coreMatch));
                modeData.id = "custom_" + Date.now(); modeData.label = coreMatch.label + " (Copy)";
                modeData.isCoreClone = true;
                const baseCoT = hardcodedLogic.models.find(m => m.id === "cot-v1-english");
                if(!modeData.cot) modeData.cot = baseCoT.content;
                if(!modeData.prefill) modeData.prefill = baseCoT.prefill;
                if(!modeData.cyoa) modeData.cyoa = hardcodedLogic.blocks.find(b => b.id === "cyoa").content;
                if(!modeData.info) modeData.info = hardcodedLogic.blocks.find(b => b.id === "info").content;
                if(!modeData.summary) modeData.summary = hardcodedLogic.blocks.find(b => b.id === "summary").content;
            } else { 
                modeData = extension_settings[extensionName].customModes.find(m => m.id === selectedModeId); 
            }
        }
        if (!modeData.customToggles) modeData.customToggles = [];

        $("#ps_stage_title").text("Visual Engine Builder");
        c.append(`
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button id="dev_back_list" class="ps-modern-btn secondary"><i class="fa-solid fa-arrow-left"></i> Back</button>
                <input type="text" id="dev_mode_name" class="ps-modern-input" value="${modeData.label}" style="flex: 1; font-weight: bold;" />
                <button id="dev_save_mode" class="ps-modern-btn primary" style="background: #10b981; color: #fff;"><i class="fa-solid fa-floppy-disk"></i> Save Engine</button>
            </div>
        `);
        $("#dev_back_list").on("click", () => renderDevMode("landing"));

        const saveCurrentTextState = () => {
            modeData.label = $("#dev_mode_name").val();
            if ($("#dev_edit_p1").length) modeData.p1 = $("#dev_edit_p1").val(); 
            modeData.p3 = $("#dev_edit_p3").val();
            modeData.p4 = $("#dev_edit_p4").val(); modeData.p5 = $("#dev_edit_p5").val(); modeData.p6 = $("#dev_edit_p6").val();
            modeData.cot = $("#dev_edit_cot").val(); modeData.cyoa = $("#dev_edit_cyoa").val();
            modeData.info = $("#dev_edit_info").val(); modeData.summary = $("#dev_edit_summary").val(); modeData.prefill = $("#dev_edit_prefill").val();
        };

        // UI Helpers
        const createInsertPoint = (attach) => `<div class="dev-insert-point" data-attach="${attach}" style="text-align: center; padding: 10px; cursor: pointer; color: var(--gold); border: 2px dashed rgba(245,158,11,0.3); border-radius: 8px; margin: 10px 0;"><i class="fa-solid fa-plus"></i> Add Module Here</div>`;
        const createLockedBlock = (t, c) => `<div style="background: rgba(0,0,0,0.4); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;"><div style="font-weight: bold; color: var(--text-muted); font-size: 0.8rem; margin-bottom: 6px;">${t} <i class="fa-solid fa-lock" style="float: right;"></i></div><div style="font-family: monospace; font-size: 0.75rem; color: #666; white-space: pre-wrap;">${c}</div></div>`;
        const createEditableBlock = (t, k, v) => `<div style="background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px;"><div style="font-weight: bold; color: var(--accent-color); font-size: 0.8rem; margin-bottom: 6px;">${t}</div><textarea id="dev_edit_${k}" class="ps-modern-input" style="height: 80px; resize: vertical; font-family: monospace; font-size: 0.8rem;">${v || ""}</textarea></div>`;

        const flow = $(`<div style="display: flex; flex-direction: column;"></div>`);
        
        if (modeData.isCoreClone) {
            // Cloned Core Engine: P1 and P2 are locked and visible.
            flow.append(createLockedBlock("[[prompt1]]", modeData.p1));
            flow.append(createLockedBlock("[[prompt2]]", modeData.p2));
        } else {
            // Brand New Engine: P1 is editable. P2 does not exist.
            flow.append(createEditableBlock("[[prompt1]]", "p1", modeData.p1));
        }

        flow.append(createEditableBlock("[[prompt3]]", "p3", modeData.p3));
        
        // Modules
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
                
                // DELETE LOGIC
                div.find(".ps-btn-del-mod").on("click", () => { 
                    modeData.customToggles = modeData.customToggles.filter(x => x.id !== m.id); 
                    saveCurrentTextState(); renderDevMode("editor", modeData.id, modeData); 
                });

                // EDIT LOGIC
                div.find(".ps-btn-edit-mod").on("click", async () => {
                    saveCurrentTextState();
                    const $p = $(`<div style="display:flex; flex-direction:column; gap:10px;">
                        <input type="text" id="m_n" class="ps-modern-input" value="${m.name}" />
                        <select id="m_l" class="ps-modern-input">
                            <option value="settings" ${m.location==='settings'?'selected':''}>Stage 4: Settings</option>
                            <option value="addons" ${m.location==='addons'?'selected':''}>Stage 5: Add-ons</option>
                        </select>
                        <textarea id="m_c" class="ps-modern-input" style="height:150px;">${m.content}</textarea>
                    </div>`);
                    
                    if (await new Popup($p, POPUP_TYPE.CONFIRM, "Edit Module", { okButton: "Save", cancelButton: "Cancel", wide: true }).show()) {
                        m.name = $p.find("#m_n").val() || "Module";
                        m.location = $p.find("#m_l").val();
                        m.content = $p.find("#m_c").val();
                        renderDevMode("editor", modeData.id, modeData);
                    }
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
        flow.append(createEditableBlock("[[COT]]", "cot", modeData.cot));
        flow.append(createEditableBlock("[[cyoa]]", "cyoa", modeData.cyoa));
        flow.append(createEditableBlock("[[infoblock]]", "info", modeData.info));
        flow.append(createEditableBlock("[[summary]]", "summary", modeData.summary));
        flow.append(createEditableBlock("[[prefill]]", "prefill", modeData.prefill));

        c.append(flow);

        // Insertion Point Click
        flow.find(".dev-insert-point").on("click", async function() {
            const ap = $(this).attr("data-attach"); saveCurrentTextState();
            const $p = $(`<div style="display:flex; flex-direction:column; gap:10px;"><input type="text" id="m_n" class="ps-modern-input" placeholder="Module Name" /><select id="m_l" class="ps-modern-input"><option value="settings">Stage 4: Settings</option><option value="addons">Stage 5: Add-ons</option></select><textarea id="m_c" class="ps-modern-input" placeholder="Prompt Content" style="height:100px;"></textarea></div>`);
            if (await new Popup($p, POPUP_TYPE.CONFIRM, "Add Module", { wide: true }).show()) {
                const content = $p.find("#m_c").val();
                if (content) { modeData.customToggles.push({ id: "mod_" + Date.now(), name: $p.find("#m_n").val() || "Module", location: $p.find("#m_l").val(), content: content, attachPoint: ap }); renderDevMode("editor", modeData.id, modeData); }
            }
        });

        // Final Save Click
        $("#dev_save_mode").on("click", () => {
            saveCurrentTextState();
            if (isNew) { extension_settings[extensionName].customModes.push(modeData); } 
            else { const idx = extension_settings[extensionName].customModes.findIndex(m => m.id === modeData.id); if(idx > -1) extension_settings[extensionName].customModes[idx] = modeData; }
            saveSettingsDebounced(); toastr.success("Engine Flow Saved!"); renderDevMode("landing");
        });
    }
}
// UNIFIED DEV BUTTON CLICK LISTENER
$("body").on("click", "#ps_btn_dev_mode", function(e) { 
    e.preventDefault();
    if ($(this).text().includes("Exit Dev")) {
        drawWizard(0); 
    } else {
        renderDevMode("landing"); 
    }
});

jQuery(async () => {
    try {
        const h = await $.get(`${extensionFolderPath}/example.html`);
        $("body").append(h);

        $("body").append('<div id="ps-global-tooltip"></div>');
        
        $("body").on("mouseenter", ".ps-modern-tag", function() { const hint = $(this).attr("data-hint"); if (!hint) return; const title = $(this).text().trim(); $("#ps-global-tooltip").html(`<span class="ps-tooltip-title">${title}:</span> ${hint}`).addClass("visible"); });
        $("body").on("mousemove", ".ps-modern-tag", function(e) { if (!$(this).attr("data-hint")) return; const tooltip = $("#ps-global-tooltip"); let x = e.clientX + 15; let y = e.clientY + 15; if (x + tooltip.outerWidth() > window.innerWidth) x = e.clientX - tooltip.outerWidth() - 15; if (y + tooltip.outerHeight() > window.innerHeight) y = e.clientY - tooltip.outerHeight() - 15; tooltip.css({ left: x + 'px', top: y + 'px' }); });
        $("body").on("mouseleave", ".ps-modern-tag", function() { $("#ps-global-tooltip").removeClass("visible"); });

        $("body").on("click", ".sidebar-step", function() { const index = parseInt($(this).attr("id").replace("dot_", "")); if(!isNaN(index)) drawWizard(index); });

        $("body").on("click", "#ps_btn_reset", function() {
            if(confirm("Are you sure you want to completely reset this character's profile to the default template?")) {
                const key = getCharacterKey() || "default"; delete extension_settings[extensionName].profiles[key]; saveSettingsDebounced();
                initProfile(); drawWizard(0); toastr.info("Profile has been reset to defaults.");
            }
        });

        $("body").on("click", "#ps_btn_save_close", function() { saveProfileToMemory(); $("#prompt-slot-modal-overlay").fadeOut(200); toastr.success("Workflow Configured & Applied Successfully!"); });

        if (typeof eventSource !== 'undefined' && typeof event_types !== 'undefined') {
            eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, handlePromptInjection);
            eventSource.on(event_types.CHAT_CHANGED, () => {
                initProfile(); updateCharacterDisplay();
                if($("#prompt-slot-modal-overlay").is(":visible")) drawWizard(currentStage);
            });
            // IMAGE GEN AUTO-GEN & SWIPE TRIGGERS
            eventSource.on(event_types.MESSAGE_RECEIVED, async () => { 
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
                
                const media = message.extra?.media ||[]; 
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

        $("body").on("click", "#prompt-slot-fixed-btn", function() { initProfile(); updateCharacterDisplay(); drawWizard(0); $("#prompt-slot-modal-overlay").fadeIn(250).css("display", "flex"); });
        $("body").on("click", "#close-prompt-slot-modal, #prompt-slot-modal-overlay", function(e) { if (e.target === this) { saveProfileToMemory(); $("#prompt-slot-modal-overlay").fadeOut(200); } });
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
        
        $(document).on("click", "#kazuma_quick_gen", function(e) { 
            e.preventDefault(); 
            e.stopPropagation(); 
            igManualGenerate(); 
        });

    } catch (e) { console.error(`[${extensionName}] Failed to load:`, e); }
});