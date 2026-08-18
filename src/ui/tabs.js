// ────────────────────────────────────────────────────────────────────────────
// The settings window's tab list and its dock.
//
// This is the one module that knows which renderer draws which tab, so it must
// import all of them. The renderers therefore must not import back: a tab that
// needs to redraw itself fires REFRESH.SWITCH_TAB instead, which is registered
// at the bottom of this file.
// ────────────────────────────────────────────────────────────────────────────

import { localProfile, currentTab, setCurrentTab } from "../core/state.js";
import { registerRefreshHook, REFRESH } from "../core/refreshHooks.js";
import { TAB_SYNC_KEYS, TABS_ALREADY_GLOBAL, meguminGlobalSyncMap, meguminIsTabSynced, applyTabKeysToAllProfiles } from "../core/sync.js";
import { saveSettingsDebounced } from "../st.js";
import { updateLiveTokenCount } from "../core/tokens.js";
import { renderCoreAndCot } from "./tabs/coreAndCot.js";
import { renderPersonality } from "./tabs/personality.js";
import { renderGlobalAndBlocks } from "./tabs/globalAndBlocks.js";
import { renderSidePanelTab } from "./tabs/sidePanelTab.js";
import { renderGlobalSettings } from "./tabs/globalSettings.js";
import { renderStoryConfig } from "../features/storyconfig/ui.js";
import { renderStoryPlanner } from "../features/storyplan/ui.js";
import { renderBanList } from "../features/banlist/ui.js";
import { renderImageGen } from "../features/imagegen/index.js";
import { renderNpcBank } from "../features/npc/ui.js";
import { renderMemoryCore } from "../features/memory/index.js";
import { renderBlocksTab } from "../features/blocks/ui.js";

export const tabsUI = [
    { title: "PRESETS & COT", sub: "Choose the core preset, and COT.", icon: "fa-server", render: renderCoreAndCot },
    { title: "Persona", sub: "Define the personality.", icon: "fa-user-astronaut", render: renderPersonality },
    { title: "Story Config", sub: "Set the standing rules of the story, then pick the prose style that carries them.", icon: "fa-sliders", render: renderStoryConfig },
    { title: "Global Toggles & Blocks", sub: "Configure global parameters, add-ons, and UI tracker blocks.", icon: "fa-earth-americas", render: renderGlobalAndBlocks },
    { title: "BLOCKS", sub: "What goes inside the master block, in what order, and how it looks.", icon: "fa-cubes", render: renderBlocksTab },
    { title: "Story Director", sub: "Direct the narrative. Shape what happens next.", icon: "fa-clapperboard", render: renderStoryPlanner },
    { title: "Dynamic Ban List", sub: "Scan and ban repetitive AI phrases.", icon: "fa-ban", render: renderBanList },
    { title: "Image Generation", sub: "Wire up ComfyUI to auto-generate scene images during roleplay.", icon: "fa-image", render: renderImageGen },
    { title: "NPCs Bank", sub: "Automatically extract and track significant NPCs in the story.", icon: "fa-address-book", render: renderNpcBank },
    { title: "Memory Core", sub: "Advanced 3-Tier Context & History Management.", icon: "fa-memory", render: renderMemoryCore },
    { title: "Side Panel", sub: "Pop the tracker blocks out of the chat into a fixed side panel.", icon: "fa-table-columns", render: renderSidePanelTab },
    { title: "Global Settings", sub: "Extension preferences and about info.", icon: "fa-gear", render: renderGlobalSettings }
];

export function switchTab(index) {
    $(".dock").show();
    $("#ps_btn_save_close").show();
    $("#btn_apply_tab_all").show(); // Show on all tabs
    // The toggle is per tab, so its label has to follow the tab.
    setTimeout(updateGlobalSyncButton, 0);

    $("#ps_btn_dev_mode").html(`<i class="fa-solid fa-code"></i> Dev`).css("color", "#a855f7");

    let isSameTab = (currentTab === index);
    const container = $("#ps_stage_content");
    let savedScroll = 0;
    if (isSameTab && container.length) {
        savedScroll = container.scrollTop() || 0;
    }

    setCurrentTab(index);
    const tab = tabsUI[index];

    // Generate Icons
    const dotsContainer = $("#ps_dynamic_dots");
    if (dotsContainer.children(".sidebar-step").length < tabsUI.length) {
        dotsContainer.empty();
        
        // Render all normal tabs
        for (let i = 0; i < tabsUI.length - 1; i++) {
            const t = tabsUI[i];
            dotsContainer.append(`<div class="dock-icon sidebar-step" id="dot_${i}" title="${t.title}">
                <i class="fa-solid ${t.icon}"></i> <span>${t.title}</span>
            </div>`);
        }
        
        // Push the Global Settings gear to the absolute bottom of the dock
        dotsContainer.append(`<div style="flex-grow: 1;"></div>`); 
        const lastIdx = tabsUI.length - 1;
        const lastTab = tabsUI[lastIdx];
        dotsContainer.append(`<div class="dock-icon sidebar-step" id="dot_${lastIdx}" title="${lastTab.title}" style="margin-bottom: 15px; color: #a1a1aa; transition: 0.2s;">
            <i class="fa-solid ${lastTab.icon}"></i> <span>${lastTab.title}</span>
        </div>`);
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

export function toggleTabGlobalSync() {
    const title = (tabsUI[currentTab] || {}).title;
    if (!title) return;

    if (TABS_ALREADY_GLOBAL.includes(title)) {
        toastr.info(`${title} is stored globally already — it is the same on every character.`, "Megumin Suite");
        return;
    }
    if (!TAB_SYNC_KEYS[title]) {
        toastr.info("This tab has nothing to sync.", "Megumin Suite");
        return;
    }

    const map = meguminGlobalSyncMap();
    const next = !map[title];
    map[title] = next;
    saveSettingsDebounced();

    if (next) {
        const ok = applyTabKeysToAllProfiles(title);
        if (!ok) {
            map[title] = false;
            saveSettingsDebounced();
            toastr.warning("The panel is still showing the previous chat's settings. Reopen it and try again.", "Megumin Suite");
            updateGlobalSyncButton();
            return;
        }
        toastr.success(`${title} now applies to every character. Changes here follow automatically.`, "Megumin Suite");
    } else {
        toastr.info(`${title} is back to per-character.`, "Megumin Suite");
    }

    updateGlobalSyncButton();
}

export function meguminPropagateTabIfSynced() {
    // Only while the settings window is open: a save from a background feature
    // (an NPC banking itself, a summary landing) is not an edit to a tab.
    if (!$("#btn_apply_tab_all").length) return;
    const title = (tabsUI[currentTab] || {}).title;
    if (!meguminIsTabSynced(title)) return;
    applyTabKeysToAllProfiles(title);
}

export function updateGlobalSyncButton() {
    const btn = $("#btn_apply_tab_all");
    if (!btn.length) return;

    const title = (tabsUI[currentTab] || {}).title;
    const alreadyGlobal = TABS_ALREADY_GLOBAL.includes(title);
    const syncable = Boolean(TAB_SYNC_KEYS[title]);
    const on = meguminIsTabSynced(title);

    if (alreadyGlobal || !syncable) {
        btn.html(`<i class="fa-solid fa-earth-americas"></i> Global`)
            .attr("title", alreadyGlobal ? "This tab is stored globally already." : "This tab has nothing to sync.")
            .css({ color: "var(--text-muted)", "border-color": "var(--border-color)", opacity: "0.55" });
        return;
    }

    btn.html(`<i class="fa-solid fa-earth-americas"></i> Global: ${on ? "On" : "Off"}`)
        .attr("title", on
            ? `Every change on the ${title} tab is copied to all characters. Click to stop.`
            : `Changes on the ${title} tab stay with this character. Click to make them global.`)
        .css({
            color: on ? "#10b981" : "var(--gold)",
            "border-color": on ? "rgba(16,185,129,0.45)" : "rgba(245,158,11,0.3)",
            opacity: "1"
        });
}

// ────────────────────────────────────────────────────────────────────────────
// Wiring.
// ────────────────────────────────────────────────────────────────────────────

// With no index: redraw whatever is on screen. With one: navigate to it.
registerRefreshHook(REFRESH.SWITCH_TAB, (index) =>
    switchTab(typeof index === "number" ? index : currentTab));
registerRefreshHook(REFRESH.TAB_PROPAGATE, () => meguminPropagateTabIfSynced());
