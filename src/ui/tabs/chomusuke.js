// ──────────────────────────────────────────────────────────────────────────────
// Chomusuke — The Little Sub-Agent
//
// Manages the secondary worker model via SillyTavern Connection Profiles.
// Offloads heavy background chores (Memory Core summarization, NPC scanning,
// Story Director planning, Ban List analysis, ComfyUI prompt crafting)
// so the primary model never pauses or reloads presets.
// ──────────────────────────────────────────────────────────────────────────────

import { localProfile } from "../../core/state.js";
import { saveProfileToMemory } from "../../core/profile.js";
import {
    getSillyTavernConnectionProfiles,
    getCurrentConnectionProfileId,
    runWithChomusuke,
} from "../../engine/tasks.js";
import { generateQuietPrompt } from "../../st.js";

export function renderChomusuke(c) {
    c.empty();

    if (!localProfile.chomusuke) {
        localProfile.chomusuke = {
            enabled: false,
            profileId: "",
            primaryProfileId: "",
            features: {
                memory: true,
                storyPlan: true,
                npc: true,
                banList: true,
                imageGen: true,
                styleGen: true,
                worldState: false,
            },
        };
    }

    const cfg = localProfile.chomusuke;
    const availableProfiles = getSillyTavernConnectionProfiles();
    const currentActiveProfileId = getCurrentConnectionProfileId();
    const activeProfileObj = availableProfiles.find(p => p.id === cfg.profileId);

    const isRunning = Boolean(cfg.enabled && cfg.profileId);
    const badgeColor = isRunning ? "#10b981" : "var(--text-muted)";
    const badgeBg = isRunning ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.05)";
    const badgeBorder = isRunning ? "rgba(16, 185, 129, 0.3)" : "var(--border-color)";
    const badgeLabel = isRunning
        ? `<i class="fa-solid fa-cat" style="font-size:0.65rem;"></i> Active: ${activeProfileObj ? activeProfileObj.name : "Worker Ready"}`
        : `<i class="fa-solid fa-moon" style="font-size:0.65rem;"></i> Inactive`;

    // ── HEADER ──
    c.append(`
        <div class="mtab-header">
            <div class="mtab-header-left">
                <div class="mtab-header-icon" style="background: linear-gradient(135deg, #f43f5e, #be123c);">
                    <i class="fa-solid fa-cat"></i>
                </div>
                <div>
                    <h2>Chomusuke</h2>
                    <p>The Little Sub-Agent — secondary worker LLM for background tasks.</p>
                </div>
            </div>
            <div class="mtab-header-badge" id="chomusuke_header_badge" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
                ${badgeLabel}
            </div>
        </div>
    `);

    const $content = $(`<div style="display:flex; flex-direction:column; gap:16px;"></div>`);

    // ── CARD 1: SUB-AGENT CONNECTION SETTINGS ──
    const $settingsPanel = $(`
        <div class="mtab-panel" style="margin-bottom:0;">
            <div class="mtab-panel-title purple" style="margin-bottom: 12px;">
                <i class="fa-solid fa-microchip"></i> Worker Connection Settings
            </div>
        </div>
    `);

    // Master Enable Toggle
    const $masterToggle = $(`
        <div class="mtab-toggle-row ${cfg.enabled ? 'active' : ''}" id="chomusuke_master_toggle" style="cursor: pointer; margin-bottom: 14px;">
            <div class="toggle-info">
                <div class="toggle-label"><i class="fa-solid fa-power-off" style="color: ${cfg.enabled ? '#10b981' : 'var(--text-muted)'};"></i> Enable Chomusuke (Worker LLM)</div>
                <div class="toggle-desc">When enabled, assigned background tasks run silently on a separate model via SillyTavern Connection Profiles. Zero chat reloads, zero 3-second freezes.</div>
            </div>
            <div class="ps-switch" style="${cfg.enabled ? 'background: #10b981;' : ''}"></div>
        </div>
    `);

    $masterToggle.on("click", function () {
        cfg.enabled = !cfg.enabled;
        $(this).toggleClass("active", cfg.enabled);
        $(this).find(".ps-switch").css("background", cfg.enabled ? "#10b981" : "");
        $(this).find(".toggle-label i").css("color", cfg.enabled ? "#10b981" : "var(--text-muted)");
        saveProfileToMemory();
        renderChomusuke(c);
    });
    $settingsPanel.append($masterToggle);

    // Profile Dropdowns
    if (availableProfiles.length === 0) {
        $settingsPanel.append(`
            <div class="mtab-callout red" style="margin-top: 10px;">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>No Connection Profiles found in SillyTavern. Please create at least one Connection Profile in SillyTavern's connection settings first (e.g. for Gemini Flash or a fast local model).</span>
            </div>
        `);
    } else {
        // Worker Profile Selection
        let workerOptionsHtml = `<option value="">-- Select Worker Connection Profile --</option>`;
        availableProfiles.forEach(p => {
            const isSel = p.id === cfg.profileId;
            workerOptionsHtml += `<option value="${p.id}" ${isSel ? 'selected' : ''}>${p.name} (${p.mode === 'cc' ? 'Chat' : 'Text'})</option>`;
        });

        // Primary Profile Selection
        let primaryOptionsHtml = `<option value="" ${!cfg.primaryProfileId ? 'selected' : ''}>Auto-Detect (Current Active Profile)</option>`;
        availableProfiles.forEach(p => {
            const isSel = p.id === cfg.primaryProfileId;
            primaryOptionsHtml += `<option value="${p.id}" ${isSel ? 'selected' : ''}>${p.name}</option>`;
        });

        $settingsPanel.append(`
            <div class="mtab-setting-row" style="margin-bottom: 10px;">
                <div class="set-info">
                    <div class="set-label"><i class="fa-solid fa-robot" style="color: #a855f7;"></i> Worker Profile (Chomusuke)</div>
                    <div class="set-desc">The model that handles background jobs (recommended: a fast, cheap model like Claude Haiku, Gemini Flash, or a local 7B/8B).</div>
                </div>
                <select id="chomusuke_worker_profile" class="ps-modern-input" style="width: 260px; cursor: pointer;">
                    ${workerOptionsHtml}
                </select>
            </div>

            <div class="mtab-setting-row" style="margin-bottom: 12px;">
                <div class="set-info">
                    <div class="set-label"><i class="fa-solid fa-shield-halved" style="color: #3b82f6;"></i> Primary Chat Profile (Restore To)</div>
                    <div class="set-desc">The connection profile restored after each task finishes. Auto-detect uses whatever profile was active before the task ran.</div>
                </div>
                <select id="chomusuke_primary_profile" class="ps-modern-input" style="width: 260px; cursor: pointer;">
                    ${primaryOptionsHtml}
                </select>
            </div>

            <div style="display: flex; gap: 10px; align-items: center; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                <button id="btn_test_chomusuke" class="ps-modern-btn secondary" style="padding: 6px 16px; font-size: 0.8rem; color: #a855f7; border-color: rgba(168, 85, 247, 0.3);">
                    <i class="fa-solid fa-vial"></i> Test Chomusuke Connection
                </button>
                <span id="chomusuke_test_status" style="font-size: 0.78rem; color: var(--text-muted); font-style: italic;"></span>
            </div>
        `);
    }

    $content.append($settingsPanel);

    // ── CARD 2: FEATURE DELEGATION (ROUTING MATRIX) ──
    const $routingPanel = $(`
        <div class="mtab-panel" style="margin-bottom:0;">
            <div class="mtab-panel-title blue" style="margin-bottom: 6px;">
                <i class="fa-solid fa-diagram-project"></i> Secondary Feature Routing
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 14px;">
                Choose which background tasks Chomusuke takes over. Toggled features run through your Worker LLM; disabled features stay on <b>Direct Call</b> (your current chat model).
            </div>
        </div>
    `);

    const featuresList = [
        {
            key: "memory",
            title: "Memory Core",
            icon: "fa-memory",
            color: "#3b82f6",
            desc: "Summarizing chat chunks and creating archived entries for the long-term vault."
        },
        {
            key: "storyPlan",
            title: "Story Director",
            icon: "fa-clapperboard",
            color: "#a855f7",
            desc: "Auto-evolving the narrative directive and generating new story beats."
        },
        {
            key: "npc",
            title: "NPC Bank",
            icon: "fa-address-book",
            color: "#10b981",
            desc: "Auto-scanning message history for newly met characters and updating existing dossiers."
        },
        {
            key: "banList",
            title: "Dynamic Ban List",
            icon: "fa-ban",
            color: "#ef4444",
            desc: "Scanning recent turns for repetitive clichés and updating the active ban list."
        },
        {
            key: "imageGen",
            title: "Image Generation",
            icon: "fa-image",
            color: "#f59e0b",
            desc: "Extracting visual scene details and crafting descriptive prompts for ComfyUI."
        },
        {
            key: "worldState",
            title: "World State",
            icon: "fa-thumbtack",
            color: "#f59e0b",
            desc: "On: Chomusuke reads every reply for scene changes (outfits, who is present, threads) and the story model no longer writes them. Off: the story model writes them in its reply. One worker call per reply.",
            defaultOff: true
        },
        {
            key: "styleGen",
            title: "Writing Style Generator",
            icon: "fa-wand-magic-sparkles",
            color: "#ec4899",
            desc: "Generating custom prose styles from tag templates in the Writing Style library."
        }
    ];

    // Most routes are on unless switched off; a route that costs a call per reply
    // (defaultOff) is off unless switched on.
    const featOn = feat => feat.defaultOff ? cfg.features[feat.key] === true : cfg.features[feat.key] !== false;

    featuresList.forEach(feat => {
        const isFeatOn = featOn(feat);
        const $row = $(`
            <div class="mtab-toggle-row ${isFeatOn ? 'active' : ''}" data-feat="${feat.key}" style="cursor: pointer; margin-bottom: 8px;">
                <div class="toggle-info">
                    <div class="toggle-label">
                        <i class="fa-solid ${feat.icon}" style="color: ${feat.color}; margin-right: 6px;"></i> ${feat.title}
                    </div>
                    <div class="toggle-desc">${feat.desc}</div>
                </div>
                <div class="ps-switch" style="${isFeatOn ? 'background: #10b981;' : ''}"></div>
            </div>
        `);

        $row.on("click", function () {
            const next = !featOn(feat);
            cfg.features[feat.key] = next;
            $(this).toggleClass("active", next);
            $(this).find(".ps-switch").css("background", next ? "#10b981" : "");
            saveProfileToMemory();
            // "Combine calls" depends on these routes: redraw so it is never stale.
            renderChomusuke(c);
        });

        $routingPanel.append($row);
    });

    $content.append($routingPanel);

    // ── CARD 3: COMBINE CALLS ──
    // Several Chomusuke jobs in ONE call. For now: World State + the automatic image.
    if (!cfg.combine || typeof cfg.combine !== "object") cfg.combine = { worldImage: false, worldFallback: false };
    const combine = cfg.combine;
    const worldOn = cfg.features.worldState === true;
    const imageOn = cfg.features.imageGen !== false;
    const combineReady = Boolean(cfg.enabled && cfg.profileId && worldOn && imageOn);
    const $combinePanel = $(`
        <div class="mtab-panel" style="margin-top: 14px; margin-bottom:0;">
            <div class="mtab-panel-title blue" style="margin-bottom: 6px;">
                <i class="fa-solid fa-layer-group"></i> Combine calls
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 12px;">
                Do several Chomusuke jobs in one call instead of one call each.
                ${combineReady ? "" : "<br><b>Needs:</b> Chomusuke on, with both <b>World State</b> and <b>Image Generation</b> routed above."}
            </div>
        </div>
    `);
    const toggleRow = (key, title, desc, enabled, indent) => {
        const on = combine[key] === true;
        const $row = $(`
            <div class="mtab-toggle-row ${on ? "active" : ""}" style="cursor: ${enabled ? "pointer" : "not-allowed"}; margin-bottom: 8px; ${enabled ? "" : "opacity: .5;"} ${indent ? "margin-left: 22px;" : ""}">
                <div class="toggle-info">
                    <div class="toggle-label">${title}</div>
                    <div class="toggle-desc">${desc}</div>
                </div>
                <div class="ps-switch" style="${on ? "background: #10b981;" : ""}"></div>
            </div>
        `);
        $row.on("click", () => {
            if (!enabled) return;
            combine[key] = !(combine[key] === true);
            if (key === "worldImage" && !combine.worldImage) combine.worldFallback = false;
            saveProfileToMemory();
            renderChomusuke(c);
        });
        return $row;
    };
    $combinePanel.append(toggleRow(
        "worldImage",
        `<i class="fa-solid fa-thumbtack" style="color:#f59e0b; margin-right: 6px;"></i> World State and image in one call`,
        "On replies that get an automatic image, one call writes the World State update and the image prompt (on V2 also the outfit tags and new looks). Other replies keep the plain World State read, so every reply costs one call.",
        combineReady,
        false
    ));
    $combinePanel.append(toggleRow(
        "worldFallback",
        `<i class="fa-solid fa-life-ring" style="color:#10b981; margin-right: 6px;"></i> Fall back to a separate World State read`,
        "If the combined answer has no usable World State update, read the reply again on its own (one extra call, only then). Off: the card shows it had no update, with Read again.",
        combineReady && combine.worldImage === true,
        true
    ));
    $content.append($combinePanel);

    // ── CALLOUT / TIP ──
    $content.append(`
        <div class="mtab-callout purple">
            <i class="fa-solid fa-cat"></i>
            <span><b>How Chomusuke works:</b> When a background task fires, Chomusuke seamlessly switches SillyTavern's connection to your worker profile, completes the task quietly, and restores your primary profile. If any error occurs, your primary connection is guaranteed to be restored instantly.</span>
        </div>
    `);

    c.append($content);

    // ── EVENT WIRING ──
    c.find("#chomusuke_worker_profile").on("change", function () {
        cfg.profileId = $(this).val();
        saveProfileToMemory();
        renderChomusuke(c);
    });

    c.find("#chomusuke_primary_profile").on("change", function () {
        cfg.primaryProfileId = $(this).val();
        saveProfileToMemory();
    });

    c.find("#btn_test_chomusuke").on("click", async function () {
        const btn = $(this);
        const statusSpan = $("#chomusuke_test_status");

        if (!cfg.profileId) {
            toastr.warning("Please select a Worker Profile first.", "Chomusuke");
            return;
        }

        btn.prop("disabled", true).html(`<i class="fa-solid fa-spinner fa-spin"></i> Testing...`);
        statusSpan.text("Connecting to worker profile...");

        try {
            const testResult = await runWithChomusuke("test", async () => {
                const response = await generateQuietPrompt({ prompt: "Reply with the single word: OK", quietPrompt: "Reply with the single word: OK" });
                return typeof response === "string" ? response.trim() : "";
            }, { force: true });

            if (testResult) {
                statusSpan.html(`<span style="color: #10b981;"><i class="fa-solid fa-circle-check"></i> Connection successful! Worker replied.</span>`);
                toastr.success("Chomusuke connection verified! Primary connection restored.", "Chomusuke");
            } else {
                statusSpan.html(`<span style="color: #ef4444;"><i class="fa-solid fa-circle-xmark"></i> Worker did not return text. Primary connection restored.</span>`);
            }
        } catch (err) {
            statusSpan.html(`<span style="color: #ef4444;"><i class="fa-solid fa-circle-xmark"></i> Test failed: ${err.message || err}</span>`);
        } finally {
            btn.prop("disabled", false).html(`<i class="fa-solid fa-vial"></i> Test Chomusuke Connection`);
        }
    });
}
