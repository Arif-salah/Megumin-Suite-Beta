// ────────────────────────────────────────────────────────────────────────────
// Presets & COT — engine choice, chain-of-thought, thinking effort.
// ────────────────────────────────────────────────────────────────────────────

import { extension_settings, saveSettingsDebounced, Popup, POPUP_TYPE } from "../../st.js";
import { extensionName } from "../../core/constants.js";
import { localProfile, currentTab } from "../../core/state.js";
import { lockedStyleIdFor, isV7Engine } from "../../core/engines.js";
import { saveProfileToMemory, saveProfileDebounced } from "../../core/profile.js";
import { fireRefreshHook, REFRESH } from "../../core/refreshHooks.js";
import { hardcodedLogic } from "../../../data/database.js";
import { renderDevMode } from "../devmode.js";
import { meguminCotForMode } from "../../../data/cot/index.js";
import { buildStoryConfigSection } from "../../features/storyconfig/ui.js";
import { countActiveConfigFields } from "../../features/storyconfig/config.js";

export function renderCoreAndCot(c) {
    // Preserve active sub-tab and filter before wiping the container
    let activeSubTab = c.find('.ws-nav-btn.active').attr('data-target') || 'sec-official';
    let activeFilter = c.find('.wstyle-filter-pill.active').attr('data-filter') || 'all';

    c.empty();
    const root = $(`<div style="display: flex; flex-direction: column; height: 100%;"></div>`);

    const descriptions = {
        "balance": "The original Secret Sauce. NPCs react naturally — no simping, no needless hostility.",
        "balance Test": "New and improved balance mode that aims to use less tokens and more creativity.",
        "cinematic": "Hollywood-inspired storytelling. Dramatic beats and heightened tension.",
        "dark": "Balance but harsher. The world is unforgiving and consequences hit harder.",
        "v6-anime-director": "Advanced cinematic framing and pacing. Designed to emulate high-budget anime direction.",
        "v6-dream-team": "The ultimate 6-specialist writer room. Unprecedented narrative consistency and realism.",
        "v6-dream-team-lite": "A streamlined version of the Dream Team. Faster generation with lower token overhead.",
        "v7-core": "The V7 Core engine. The perfect middle ground: cinematic pacing, realistic friction, and relentless world progression.",
        "v7-reality": "The V7 Reality engine. Grounded, unrelenting simulation with zero narrative protection.",
        "v7-gentle": "The V7 Gentle engine. A softer, more intimate storytelling flow.",
        "v7.5": "The Kismet engine. Focused purely on inescapable narrative momentum, pushing the story forward as the unseen author of fate.",
        "v8-m": "Unmatched in complex human psychology, authentic flawed dialogue, and autonomous, multi-layered story plotting.",
        "v8-lite": "A streamlined, highly efficient version of Obsidian. Retains the core rules of psychology, dialogue, and momentum with a much lighter token footprint.",
        "v8-fusion": "The absolute pinnacle of the Megumin Suite. A hybrid engine mixing V8 Obsidian's deep psychology with V6 Dream Team's specialist writer room framework.",
        "v10-core": "The storyteller. Ukiyo is the looser of the two — a teller with a temperament, spinning the world and its history, following whatever in the scene is most alive. It trades a little polish for invention: the prose wanders, reaches for an image, and occasionally overreaches. Pick it for atmosphere, momentum and a world that feels told rather than composed. Neither V10 is a downgrade of the other — run a few scenes on each and keep the one that sounds like the story you want to read.",
        "v10-shura": "The writer. Shura is the stricter of the two — no slop, no AI tells, no line that exists to manage the scene. Every character is the protagonist of their own story, acting from their own values, and none of them is a villain in their own eyes; there is no objective right or wrong for the narration to take sides on. Pick it for prose that reads like a book and a cast that drives the story itself. Neither V10 is a downgrade of the other — run a few scenes on each and keep the one that sounds like the story you want to read.",
        "v10-core-cw": "Ukiyo, with the narrator writing {{user}} as well. It reads how you write — diction, rhythm, how boldly you act — and plays your character in that voice. Anything you write yourself is canon and is never overwritten or corrected. Your history stays yours; only the acting is shared.",
        "v10-shura-cw": "Shura with shared authorship: every character is a protagonist, {{user}} among them, and the narrator writes them all in your voice. It yields the moment you take a turn back, and never invents your past. For hands-off, cinematic play — watching the story rather than steering each beat.",
        "v9-core": "The definitive, final Megumin V9 Preset. V9 Mirage is the absolute pinnacle of narrative simulation, delivering hyper-realistic psychology, visceral atmospheric grounding, and dynamic world consequences. This is the ultimate, highly recommended preset.",
        "v9-lite": "An experimental beta engine with a slightly different, highly stylized narrative flow. Proved interesting enough to include for those who want an alternative storytelling rhythm. Note: this doesn't support custom Writing style it have it own one. ",
        "v9-director": "A unique beta hybrid blending the specialized writer-room mechanics of V8 Fusion with the raw psychological depth of V9 Xin. Highly experimental. Note: this doesn't support custom Writing style it have it own one.",
        "v9-immersion": "A streamlined, lightweight version of V9 Mirage. It retains the core philosophy and brutal realism of Mirage but runs with a smaller context footprint. V9 Mirage is still recommended if your model can handle it."
    };

    const activeEng = hardcodedLogic.modes.find(m => m.id === localProfile.mode);
    const activeLabel = activeEng ? activeEng.label : localProfile.mode;

    let v4Count = 0, v5Count = 0, v6Count = 0, v7Count = 0, v8Count = 0, v9Count = 0, v10Count = 0;
    hardcodedLogic.modes.forEach(m => {
        if (m.label.includes("V4")) v4Count++;
        else if (m.label.includes("V5")) v5Count++;
        else if (m.id.includes("v6")) v6Count++;
        else if (m.id.includes("v7")) v7Count++;
        else if (m.id.includes("v8")) v8Count++;
        else if (m.id.includes("v10")) v10Count++;
        else if (m.id.includes("v9")) v9Count++;
    });
    const totalCount = hardcodedLogic.modes.length;
    const customCount = (extension_settings[extensionName].customModes || []).length;

    // ── UNIFIED HEADER ──
    root.append(`
        <div class="wstyle-header">
            <div class="wstyle-header-left">
                <div class="wstyle-header-icon" style="background: linear-gradient(135deg, #f59e0b, #a855f7);">
                    <i class="fa-solid fa-server"></i>
                </div>
                <div>
                    <h2>PRESETS & COT</h2>
                    <p>Choose the core preset, and COT.</p>
                </div>
            </div>
            <div class="wstyle-active-badge">
                <i class="fa-solid fa-circle-check"></i>
                ${activeLabel}
            </div>
        </div>
    `);

    // ── TWO COLUMN LAYOUT ──
    const layout = $(`<div class="ws-layout"></div>`);
    const sidebar = $(`<div class="ws-sidebar"></div>`);
    const mainArea = $(`<div class="ws-main"></div>`);

    // --- BUILD SIDEBAR ---
    sidebar.append(`<div class="ws-sidebar-title">Configuration</div>`);
    
    const btnOfficial = $(`<button class="ws-nav-btn active" data-target="sec-official"><span style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-server"></i> Official Engines</span> <span class="ws-badge">${totalCount}</span></button>`);
    const btnCustom = $(`<button class="ws-nav-btn" data-target="sec-custom"><span style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-microchip"></i> Custom Engines</span> <span class="ws-badge">${customCount}</span></button>`);
    
    sidebar.append(btnOfficial).append(btnCustom);
    sidebar.append(`<div style="height: 1px; background: var(--border-color); margin: 8px 0;"></div>`);
    
    const cfgCount = countActiveConfigFields(localProfile.storyConfig);
    const btnConfig = $(`<button class="ws-nav-btn" data-target="sec-config"><span style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-sliders" style="color: var(--gold);"></i> Story Config</span> <span style="display:flex; align-items:center; gap:6px;"><span class="ws-new-pill">✨ New</span>${cfgCount > 0 ? `<span class="ws-badge">${cfgCount}</span>` : ''}</span></button>`);
    sidebar.append(btnConfig);

    const btnCot = $(`<button class="ws-nav-btn" data-target="sec-cot"><span style="display:flex; align-items:center; gap:10px; color: ${localProfile.cotEnabled ? 'var(--text-main)' : 'var(--text-muted)'};"><i class="fa-solid fa-brain" style="color: ${localProfile.cotEnabled ? '#a855f7' : ''};"></i> Reasoning (CoT)</span> <span style="font-size: 0.6rem; font-weight: bold; color: ${localProfile.cotEnabled ? '#10b981' : '#ef4444'};">${localProfile.cotEnabled ? 'ON' : 'OFF'}</span></button>`);
    sidebar.append(btnCot);

    layout.append(sidebar);

    // --- BUILD MAIN CONTENT SECTIONS ---
    const secOfficial = $(`<div class="ws-section" id="sec-official"></div>`);
    const secCustom = $(`<div class="ws-section" id="sec-custom" style="display:none;"></div>`);
    const secCot = $(`<div class="ws-section" id="sec-cot" style="display:none;"></div>`);
    const secConfig = buildStoryConfigSection().hide();

    // ==========================================
    // ── A. OFFICIAL ENGINES ──
    // ==========================================
    secOfficial.append(`<h3 style="margin-top: 0; color: var(--gold); font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;"><i class="fa-solid fa-server"></i> Official Megumin Engines</h3>`);
    secOfficial.append(`
        <div class="mtab-callout gold" style="margin-bottom: 20px;">
            <i class="fa-solid fa-lightbulb"></i>
            <span><strong>Pro Tip:</strong> The Engine defines the "laws of physics" and pacing of your story. The Reasoning acts as the AI's internal scratchpad. For the best experience, match V9 Mirage with CoT V9 Mirage.</span>
        </div>
    `);

    const filterBar = $(`
        <div class="wstyle-filters" style="margin-bottom: 20px;">
            <button class="wstyle-filter-pill ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">All <span class="pill-count">${totalCount}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V4' ? 'active' : ''}" data-filter="V4">V4 <span class="pill-count">${v4Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V5' ? 'active' : ''}" data-filter="V5">V5 <span class="pill-count">${v5Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V6' ? 'active' : ''}" data-filter="V6"><i class="fa-solid fa-lock" style="font-size:0.6rem;"></i> V6 <span class="pill-count">${v6Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V7' ? 'active' : ''}" data-filter="V7">V7 <span class="pill-count">${v7Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V8' ? 'active' : ''}" data-filter="V8">V8 <span class="pill-count">${v8Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V9' ? 'active' : ''}" data-filter="V9">V9 <span class="pill-count">${v9Count}</span></button>
            <button class="wstyle-filter-pill ${activeFilter === 'V10' ? 'active' : ''}" data-filter="V10">V10 <span class="pill-count">${v10Count}</span></button>
        </div>
    `);
    secOfficial.append(filterBar);

    const coreGrid = $(`<div class="mtab-card-grid" style="margin-bottom: 20px;"></div>`);
    const v6Empty = $(`<div id="v6-empty-msg" style="display:none;"><div class="mtab-locked-state"><i class="fa-solid fa-hammer" style="color: var(--border-color);"></i><h3>V6 Engines are in the forge.</h3><p>Stay tuned for the next update! Later this week.</p></div></div>`);

    hardcodedLogic.modes.forEach(m => {
        let version = "all";
        if (m.label.includes("V4")) version = "V4";
        else if (m.label.includes("V5")) version = "V5";
        else if (m.id.includes("v6")) version = "V6";
        else if (m.id.includes("v7")) version = "V7";
        else if (m.id.includes("v8")) version = "V8";
        // Before the v9 test purely so the two lists stay in the same order.
        else if (m.id.includes("v10")) version = "V10";
        else if (m.id.includes("v9")) version = "V9";

        const isLocked = m.locked === true;
        const isSel = localProfile.mode === m.id;

        let badges = '';
        if (m.recommended) badges += `<span class="ecard-badge rec"><i class="fa-solid fa-star"></i> Recommended</span>`;
        if (m.isNew && !isLocked) badges += `<span class="ecard-badge new">New</span>`;
        if (isLocked) badges += `<span class="ecard-badge locked"><i class="fa-solid fa-lock"></i> Coming Soon</span>`;

        const card = $(`
            <div class="mtab-eng-card ${isSel ? 'active' : ''} ${isLocked ? 'locked-card' : ''}" data-version="${version}" style="${(activeFilter !== 'all' && activeFilter !== version) ? 'display:none;' : ''}">
                <div class="ecard-accent"></div>
                <div class="ecard-body">
                    <div class="ecard-title">
                        <span>${m.label}</span>
                        ${isSel ? `<span class="ecard-badge" style="background:rgba(16,185,129,0.15);color:#10b981;"><i class="fa-solid fa-check"></i> Active</span>` : ''}
                    </div>
                    <p class="ecard-desc">${descriptions[m.id] || ""}</p>
                    ${badges ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">${badges}</div>` : ''}
                </div>
            </div>
        `);

        if (!isLocked) {
            card.on("click", () => {
                localProfile.mode = m.id;

                // Same mapping the Writing Style tab uses when it finds a locked
                // engine with no style set. One list, so the two cannot disagree.
                const lockedStyle = lockedStyleIdFor(m);
                if (lockedStyle) {
                    localProfile.activeStyleId = lockedStyle;
                    const ds = hardcodedLogic.directStyles.find(x => x.id === lockedStyle);
                    if (ds) localProfile.aiRule = ds.rule;
                }

                const currentLang = (localProfile.model && localProfile.model.includes("-")) ? localProfile.model.split('-').pop() : "english";
                // The engine→CoT mapping lives in data/cot/index.js now, so Dev
                // Mode can fill a clone's reasoning script from the same source.
                const targetCot = meguminCotForMode(m.id, currentLang);
                if (targetCot) localProfile.model = targetCot;
                saveProfileToMemory();
                renderCoreAndCot(c);
            });
        }
        coreGrid.append(card);
    });

    secOfficial.append(coreGrid);
    secOfficial.append(v6Empty);
    if (activeFilter === "V6") v6Empty.show();

    filterBar.find('.wstyle-filter-pill').on('click', function () {
        filterBar.find('.wstyle-filter-pill').removeClass('active');
        $(this).addClass('active');
        const filter = $(this).attr('data-filter');
        if (filter === "all") {
            coreGrid.find('.mtab-eng-card').show(); v6Empty.hide();
        } else {
            coreGrid.find('.mtab-eng-card').each(function () {
                if ($(this).attr('data-version') === filter) $(this).show(); else $(this).hide();
            });
            if (filter === "V6") v6Empty.show(); else v6Empty.hide();
        }
    });

    const activeEngineForToggles = [...hardcodedLogic.modes, ...(extension_settings[extensionName].customModes || [])].find(m => m.id === localProfile.mode);
    const isV7ForToggles = isV7Engine(activeEngineForToggles);
    if (isV7ForToggles) {
        secOfficial.append(`<div class="wstyle-section-head blue" style="margin-top: 15px;"><i class="fa-solid fa-layer-group"></i> V7 Modules (Turn off to disable)</div>`);
        const v7ToggleList = $(`<div class="mtab-card-list"></div>`);
        const v7Toggles = [
            { id: "v7_ooc", label: "OOC Protocol", desc: "Allows out-of-character directives." },
            { id: "v7_pcsolo", label: "PC Solo Physicality", desc: "Narration of PC when unobserved." },
            { id: "v7_intro", label: "Introduction Protocol", desc: "How new NPCs enter the story." },
            { id: "v7_culture", label: "Cultural Anchoring", desc: "Real-world integration and references." },
            { id: "v7_scene", label: "Scene Choreography", desc: "Focus shifting and crowd management." }
        ];

        v7Toggles.forEach(tog => {
            if (localProfile.toggles[tog.id] === undefined) localProfile.toggles[tog.id] = true;
            const isOn = localProfile.toggles[tog.id];

            const tCard = $(`
                <div class="mtab-toggle-row ${isOn ? 'active' : ''}" style="cursor: pointer;">
                    <div class="toggle-info">
                        <div class="toggle-label">${tog.label}</div>
                        <div class="toggle-desc">${tog.desc}</div>
                    </div>
                    <div class="ps-switch"></div>
                </div>
            `);
            tCard.on("click", () => { localProfile.toggles[tog.id] = !localProfile.toggles[tog.id]; saveProfileToMemory(); renderCoreAndCot(c); });
            v7ToggleList.append(tCard);
        });
        secOfficial.append(v7ToggleList);
    }

    // ==========================================
    // ── B. CUSTOM ENGINES ──
    // ==========================================
    secCustom.append(`<h3 style="margin-top: 0; color: #10b981; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;"><i class="fa-solid fa-microchip"></i> Your Custom Engines</h3>`);
    const customModes = extension_settings[extensionName].customModes || [];

    if (customModes.length === 0) {
        secCustom.append(`<div style="padding: 30px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 14px;">No custom engines yet. Go to Dev Mode to create or import one!</div>`);
    } else {
        const customGrid = $(`<div class="mtab-card-grid"></div>`);
        customModes.forEach(m => {
            const isSel = localProfile.mode === m.id;
            const card = $(`
                <div class="mtab-eng-card ${isSel ? 'active' : ''}">
                    <div class="ecard-accent"></div>
                    <div class="ecard-body">
                        <div class="ecard-title">
                            <span>${m.label}</span>
                            <button class="ps-modern-btn secondary btn-quick-edit" style="padding:4px 10px;font-size:0.7rem;color:var(--gold);border-color:rgba(245,158,11,0.3);background:transparent;">
                                <i class="fa-solid fa-pen"></i> Edit
                            </button>
                        </div>
                        <p class="ecard-desc">Custom Engine Flow</p>
                    </div>
                </div>
            `);
            card.on("click", (e) => {
                if ($(e.target).closest('.btn-quick-edit').length) return;
                localProfile.mode = m.id; saveProfileToMemory(); renderCoreAndCot(c);
            });
            card.find(".btn-quick-edit").on("click", () => renderDevMode("editor", m.id, null, "tab"));
            customGrid.append(card);
        });
        secCustom.append(customGrid);
    }

    // ==========================================
    // ── C. CHAIN OF THOUGHT (REASONING) ──
    // ==========================================
    secCot.append(`<h3 style="margin-top: 0; color: #a855f7; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;"><i class="fa-solid fa-brain"></i> Chain of Thought (Reasoning)</h3>`);

    if (localProfile.cotEnabled === undefined) localProfile.cotEnabled = true;

    const cotToggle = $(`
        <div class="mtab-toggle-row ${localProfile.cotEnabled ? 'active' : ''}" style="margin-bottom: 20px; border-color: ${localProfile.cotEnabled ? '#a855f7' : 'var(--border-color)'}; cursor: pointer;">
            <div class="toggle-info">
                <div class="toggle-label" style="color: ${localProfile.cotEnabled ? '#a855f7' : 'var(--text-main)'};"><i class="fa-solid fa-power-off"></i> Enable Chain of Thought</div>
                <div class="toggle-desc">Toggle the entire AI reasoning system. When off, the AI generates responses directly.</div>
            </div>
            <div class="ps-switch" style="${localProfile.cotEnabled ? 'background:#a855f7;' : ''}"></div>
        </div>
    `);
    cotToggle.on("click", function() {
        localProfile.cotEnabled = !localProfile.cotEnabled;
        saveProfileToMemory();
        renderCoreAndCot(c);
    });
    secCot.append(cotToggle);

    if (localProfile.cotEnabled) {
        if (activeEng && activeEng.cot && activeEng.cot.trim() !== "") {
            secCot.append(`
                <div class="mtab-callout green" style="margin-bottom:20px;">
                    <i class="fa-solid fa-shield-halved"></i>
                    <span><strong>Custom Engine Logic Active</strong> — This Engine provides its own [[COT]] and [[prefill]]. Selections below will be overridden by the Engine's code.</span>
                </div>
            `);
        }

        const migrationMap = {
            "cot-english": "cot-v1-english", "cot-arabic": "cot-v1-arabic", "cot-spanish": "cot-v1-spanish", "cot-french": "cot-v1-french",
            "cot-zh": "cot-v1-zh", "cot-ru": "cot-v1-ru", "cot-jp": "cot-v1-jp", "cot-pt": "cot-v1-pt", "cot-english-test": "cot-v2-english"
        };
        if (migrationMap[localProfile.model]) { localProfile.model = migrationMap[localProfile.model]; saveProfileToMemory(); }

        if (localProfile.model === "cot-off") {
            localProfile.cotEnabled = false;
            localProfile.model = "cot-v7.5-english";
            saveProfileToMemory();
        }

        let currentType = "off", currentLang = "english";
        // The two specific V10 sets are tested before the general one, exactly as
        // v9-lite and v9-director are below: "cot-v10-shura-english" starts with
        // "cot-v10-" too, so a bare test would swallow it.
        // Longest prefix first: "cot-v10-shura-cap-" also starts with
        // "cot-v10-shura-", so the capped ids have to be tested ahead of the plain
        // ones or every cap reads back as its uncapped sibling.
        if (localProfile.model && localProfile.model.startsWith("cot-v10-ukiyo-cap-")) { currentType = "v10-ukiyo-cap"; currentLang = "english"; }
        else if (localProfile.model && localProfile.model.startsWith("cot-v10-shura-cap-")) { currentType = "v10-shura-cap"; currentLang = "english"; }
        else if (localProfile.model && localProfile.model.startsWith("cot-v10-ukiyo-")) { currentType = "v10-ukiyo"; currentLang = "english"; }
        else if (localProfile.model && localProfile.model.startsWith("cot-v10-shura-")) { currentType = "v10-shura"; currentLang = "english"; }
        else if (localProfile.model && localProfile.model.startsWith("cot-v1-")) { currentType = "v1"; currentLang = localProfile.model.replace("cot-v1-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v2-")) { currentType = "v2"; currentLang = localProfile.model.replace("cot-v2-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v6-lite-")) { currentType = "v6-lite"; currentLang = localProfile.model.replace("cot-v6-lite-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v6-")) { currentType = "v6"; currentLang = localProfile.model.replace("cot-v6-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v7.5-")) { currentType = "v7.5"; currentLang = localProfile.model.replace("cot-v7.5-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v7-lite-")) { currentType = "v7-lite"; currentLang = localProfile.model.replace("cot-v7-lite-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v7-")) { currentType = "v7"; currentLang = localProfile.model.replace("cot-v7-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v8-fusion-")) { currentType = "v8-fusion"; currentLang = localProfile.model.replace("cot-v8-fusion-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v8-")) { currentType = "v8"; currentLang = localProfile.model.replace("cot-v8-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v9-lite-")) { currentType = "v9-lite"; currentLang = localProfile.model.replace("cot-v9-lite-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v9-director-")) { currentType = "v9-director"; currentLang = localProfile.model.replace("cot-v9-director-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v9-immersion-")) { currentType = "v9-immersion"; currentLang = localProfile.model.replace("cot-v9-immersion-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v9-hybrid-")) { currentType = "v9-hybrid"; currentLang = localProfile.model.replace("cot-v9-hybrid-", ""); }
        else if (localProfile.model && localProfile.model.startsWith("cot-v9-")) { currentType = "v9"; currentLang = localProfile.model.replace("cot-v9-", ""); }

        let allowedCotTypes = null; 
        if (localProfile.mode.includes("v10")) allowedCotTypes = ["v10-ukiyo", "v10-ukiyo-cap", "v10-shura", "v10-shura-cap"];
        else if (localProfile.mode.includes("v6")) allowedCotTypes = ["v6", "v6-lite"];
        else if (localProfile.mode === "v7.5") allowedCotTypes = ["v7.5"];
        else if (localProfile.mode.includes("v7")) allowedCotTypes = ["v7", "v7-lite"];
        else if (localProfile.mode === "v8-fusion") allowedCotTypes = ["v8-fusion"]; 
        else if (localProfile.mode.includes("v8")) allowedCotTypes = ["v8"]; 
        else if (localProfile.mode.includes("v9")) allowedCotTypes = ["v9", "v9-lite", "v9-director", "v9-immersion", "v9-hybrid"];

        // Thinking Frameworks
        secCot.append(`<div class="wstyle-section-head purple"><i class="fa-solid fa-diagram-project"></i> Select Framework</div>`);
        const typeGrid = $(`<div class="mtab-card-grid" style="margin-bottom: 24px;"></div>`);
        const types = [
            { id: "v10-ukiyo", label: "CoT V10 Ukiyo", desc: "The long-form reasoning built for Ukiyo. Thinks like a novelist muttering before a draft \u2014 present tense, a little messy, never a plan. No phases, no checklists, no audits.", isNew: true },
            { id: "v10-ukiyo-cap", label: "CoT V10 Ukiyo \u2014 Thinking Cap", desc: "The same writer's mind with a hard ceiling on the thinking phase. For models that over-think.", isNew: true },
            { id: "v10-shura", label: "CoT V10 Shura", desc: "Seven rules carried into the writing rather than a plan made before it. Built for V10 Shura, and the lightest of the four.", isNew: true },
            { id: "v10-shura-cap", label: "CoT V10 Shura \u2014 Thinking Cap", desc: "The same seven rules with a hard ceiling on the thinking phase. For models that over-think.", isNew: true },
            { id: "v1", label: "CoT V1 (Classic)", desc: "The original 8-step framework. Focuses heavily on the NPC's internal emotional landscape vs their observable actions." },
            { id: "v2", label: "CoT V2 (New)", desc: "The new experimental framework. Stricter reality checks, info audits, better NPCs, and hook generation." },
            { id: "v6", label: "CoT V6 (Dream Team)", desc: "The full 4-phase sequence designed specifically for V6 engines. Specialized validation and modeling." },
            { id: "v6-lite", label: "CoT V6 (Lite)", desc: "A streamlined 3-phase sequence. Less token overhead while maintaining narrative rules." },
            { id: "v7", label: "CoT V7", desc: "The new V7 sequence with 5-phase strict ground truth rebuilding."},
            { id: "v7-lite", label: "CoT V7 (Lite)", desc: "A streamlined 5-phase sequence for V7." },
            { id: "v7.5", label: "CoT V7.5 Kismet", desc: "The new V7.5 sequence focused on story engine mechanics." },
            { id: "v8", label: "CoT V8", desc: "The new V8 narrative processing sequence." },
            { id: "v8-fusion", label: "CoT V8 Fusion", desc: "The new V8 Fusion narrative processing sequence." },
            { id: "v9", label: "CoT V9 Mirage", desc: "The primary and most balanced reasoning sequence, purpose-built for the V9 Mirage engine. The gold standard for modern roleplay.", isNew: true },
            { id: "v9-director", label: "CoT V9 Mirage Air", desc: "A lighter, version of CoT V9 Mirage, it give Different output Try and see if you like.", isNew: true },
            { id: "v9-immersion", label: "CoT V9 Mirage Max", desc: "The heavy-duty, maximum-thinking sequence. Forces the AI to dive incredibly deep into sensory data and psychological realism before generating a single word.", isNew: true },
            { id: "v9-hybrid", label: "CoT V9 Kuromaku", desc: "A specialized multi-agent reasoning sequence designed specifically to pair with the V9 Kuromaku engine.", isNew: true },
            { id: "v9-lite", label: "CoT V9 Cui (Lite)", desc: "A highly streamlined, fast-executing reasoning sequence perfectly paired with the V9 Cui engine to save tokens.", isNew: true }
        ];
        types.forEach(t => {
            const isSel = currentType === t.id;
            const isWarned = allowedCotTypes !== null && !allowedCotTypes.includes(t.id);
            
            let badges = '';
            if (isWarned) badges = `<span class="ecard-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;"><i class="fa-solid fa-triangle-exclamation"></i> May be Incompatible</span>`;
            else if (t.isNew) badges = `<span class="ecard-badge new">New</span>`;

            const card = $(`
                <div class="mtab-eng-card ${isSel ? 'active' : ''}">
                    <div class="ecard-accent"></div>
                    <div class="ecard-body">
                        <div class="ecard-title">
                            <span>${t.label}</span>
                            ${isSel ? `<span class="ecard-badge" style="background:rgba(168,85,247,0.15);color:#a855f7;"><i class="fa-solid fa-check"></i> Active</span>` : ''}
                        </div>
                        <p class="ecard-desc">${t.desc}</p>
                        ${badges ? `<div style="margin-top:4px;">${badges}</div>` : ''}
                    </div>
                </div>
            `);
            
            card.on("click", () => {
                if (t.id.startsWith("v10")) localProfile.model = `cot-${t.id}-english`;
                else if (t.id === "v7") localProfile.model = `cot-v7-english`;
                else if (t.id === "v7.5") localProfile.model = `cot-v7.5-english`;
                else if (t.id === "v7-lite") localProfile.model = `cot-v7-lite-english`;
                else if (t.id === "v8") localProfile.model = `cot-v8-english`;
                else if (t.id === "v8-fusion") localProfile.model = `cot-v8-fusion-english`;
                else if (t.id.startsWith("v9")) localProfile.model = `cot-${t.id}-english`;
                else localProfile.model = `cot-${t.id}-${currentLang}`;
                saveProfileToMemory(); renderCoreAndCot(c);
            }); 
            typeGrid.append(card);
        });
        secCot.append(typeGrid);

        // Thinking Effort
        if (!localProfile.thinkEffort) localProfile.thinkEffort = "unspecified";
        if (!localProfile.customThinkEffort) localProfile.customThinkEffort = "100";

        secCot.append(`<div class="wstyle-section-head purple"><i class="fa-solid fa-gauge-high"></i> Thinking Effort</div>`);
        const effortGrid = $(`<div class="mtab-card-grid" style="margin-bottom: 24px; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));"></div>`);
        const efforts = [
            { id: "100", label: "100 Words" },
            { id: "250", label: "250 Words" },
            { id: "450", label: "450 Words" },
            { id: "custom", label: "Custom" },
            { id: "unspecified", label: "Unspecified" }
        ];
        efforts.forEach(e => {
            const isSel = localProfile.thinkEffort === e.id;
            const card = $(`
                <div class="mtab-eng-card ${isSel ? 'active' : ''}" style="text-align:center;">
                    <div class="ecard-accent"></div>
                    <div class="ecard-body" style="padding:12px 10px; align-items:center;">
                        <span style="font-weight:700; font-size:0.85rem; color:${isSel ? '#a855f7' : 'var(--text-main)'};">${e.label}</span>
                    </div>
                </div>
            `);
            card.on("click", () => { localProfile.thinkEffort = e.id; saveProfileToMemory(); renderCoreAndCot(c); });
            effortGrid.append(card);
        });
        secCot.append(effortGrid);

        if (localProfile.thinkEffort === "custom") {
            const customBlock = $(`
                <div class="mtab-panel" style="margin-top:-14px; margin-bottom:24px;">
                    <div class="mtab-setting-row">
                        <div class="set-info"><div class="set-label">Custom Word Count</div></div>
                        <input type="number" id="ps_input_custom_effort" class="ps-modern-input" style="width: 150px;" value="${localProfile.customThinkEffort}" min="1" />
                    </div>
                </div>
            `);
            customBlock.find("#ps_input_custom_effort").on("change input", function () {
                localProfile.customThinkEffort = $(this).val(); saveProfileToMemory();
            });
            secCot.append(customBlock);
        }

        // Gemini Toggle
        if (localProfile.thinkingV2 === undefined) localProfile.thinkingV2 = false;
        const v2Card = $(`
            <div class="mtab-toggle-row ${localProfile.thinkingV2 ? 'active' : ''}" style="margin-bottom: 24px; cursor: pointer;">
                <div class="toggle-info">
                    <div class="toggle-label"><i class="fa-solid fa-sparkles" style="color:#a855f7;"></i> Gemini Thinking Override</div>
                    <div class="toggle-desc">Enable ONLY for Gemini models to inject specific XML tags.</div>
                </div>
                <div class="ps-switch"></div>
            </div>
        `);
        v2Card.on("click", function () { localProfile.thinkingV2 = !localProfile.thinkingV2; saveProfileToMemory(); renderCoreAndCot(c); });
        secCot.append(v2Card);

        // Language
        secCot.append(`<div class="wstyle-section-head gold"><i class="fa-solid fa-language"></i> Reasoning Language</div>`);
        const langGrid = $(`<div class="mtab-card-grid" style="margin-bottom: 20px; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));"></div>`);
        let langs = [
            { id: "english", label: "English" }, { id: "arabic", label: "Arabic (العربية)", rec: true }, { id: "spanish", label: "Spanish (Español)" },
            { id: "french", label: "French (Français)" }, { id: "zh", label: "Mandarin (中文)" }, { id: "ru", label: "Russian (Русский)" },
            { id: "jp", label: "Japanese (日本語)" }, { id: "pt", label: "Portuguese (Português)" }
        ];
        if (currentType.startsWith("v10") || currentType === "v7" || currentType === "v7-lite" || currentType === "v7.5" || currentType === "v8" || currentType === "v8-fusion" || currentType.startsWith("v9")) langs = [{ id: "english", label: "English" }];
        langs.forEach(l => {
            const isSel = currentLang === l.id;
            let badges = '';
            if (l.rec) badges = `<span class="ecard-badge rec"><i class="fa-solid fa-star"></i> Pro Tip</span>`;

            const card = $(`
                <div class="mtab-eng-card ${isSel ? 'active' : ''}">
                    <div class="ecard-accent"></div>
                    <div class="ecard-body" style="padding:12px 16px;">
                        <div class="ecard-title" style="font-size:0.88rem;">
                            <span>${l.label}</span>
                            ${isSel ? `<span class="ecard-badge" style="background:rgba(245,158,11,0.15);color:var(--gold);"><i class="fa-solid fa-check"></i></span>` : ''}
                        </div>
                        ${badges ? `<div style="margin-top:2px;">${badges}</div>` : ''}
                    </div>
                </div>
            `);
            card.on("click", () => { localProfile.model = `cot-${currentType}-${l.id}`; saveProfileToMemory(); renderCoreAndCot(c); });
            langGrid.append(card);
        }); 
        secCot.append(langGrid);
    }

    // --- ASSEMBLE ---
    mainArea.append(secOfficial).append(secCustom).append(secCot).append(secConfig);
    layout.append(mainArea);
    root.append(layout);
    c.append(root);

    // ── NAVIGATION LOGIC ──
    const navButtons = [btnOfficial, btnCustom, btnCot, btnConfig];
    const sections = [secOfficial, secCustom, secCot, secConfig];

    const switchSection = (targetId) => {
        navButtons.forEach(btn => {
            if (btn.attr('data-target') === targetId) btn.addClass('active');
            else btn.removeClass('active');
        });
        sections.forEach(sec => {
            if (sec.attr('id') === targetId) sec.show();
            else sec.hide();
        });
    };

    btnOfficial.on('click', () => switchSection('sec-official'));
    btnCustom.on('click', () => switchSection('sec-custom'));
    btnCot.on('click', () => switchSection('sec-cot'));
    btnConfig.on('click', () => switchSection('sec-config'));

    // Trigger initial state
    switchSection(activeSubTab);
}
