// ────────────────────────────────────────────────────────────────────────────
// Dev mode — the custom engine builder.
// ────────────────────────────────────────────────────────────────────────────

import { extension_settings, saveSettingsDebounced, Popup, POPUP_TYPE } from "../st.js";
import { extensionName } from "../core/constants.js";
import { localProfile } from "../core/state.js";
import { isDevEngineDirty, setDevEngineDirty } from "../core/state.js";
import { fireRefreshHook, REFRESH } from "../core/refreshHooks.js";
import { hardcodedLogic } from "../../data/database.js";

export function renderDevMode(view = "landing", selectedModeId = null, passedModeData = null, returnTo = "landing") {
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

    // Update Dev button visuals
    $("#ps_btn_dev_mode")
        .html(`<i class="fa-solid fa-right-from-bracket"></i> Exit Dev`)
        .css("color", "#10b981");

    if (!extension_settings[extensionName].customModes) extension_settings[extensionName].customModes = [];

    // --- VIEW 1: DASHBOARD (Merged Landing & List) ---
    if (view === "landing") {
        setDevEngineDirty(false);
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
                isV7: false,
                p1: "", p2: "", p3: "", p4: "", p5: "", p6: "",
                cot: "", prefill: "", cyoa: "", info: "", npc_inner_chatter: "",
                customToggles: []
            };
        } else {
            const coreMatch = hardcodedLogic.modes.find(m => m.id === selectedModeId);
            if (coreMatch) {
                isNew = true; modeData = JSON.parse(JSON.stringify(coreMatch));
                modeData.id = "custom_" + Date.now(); modeData.label = coreMatch.label + " (Copy)";
                modeData.isCoreClone = true;
                modeData.isV7 = coreMatch.id.startsWith("v7");
                if (!modeData.cot) modeData.cot = "";
                if (!modeData.prefill) modeData.prefill = "";
                if (!modeData.cyoa) modeData.cyoa = "";
                if (!modeData.info) modeData.info = "";
                if (!modeData.summary) modeData.summary = "";
                if (!modeData.npc_inner_chatter) modeData.npc_inner_chatter = "";
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
            setDevEngineDirty(true);
        });

        // NEW: Back button with unsaved changes warning
        $("#dev_back_list").on("click", () => {
            if (isDevEngineDirty) {
                if (!confirm("You have unsaved changes in this engine. Are you sure you want to go back? Changes will be lost.")) return;
            }
            setDevEngineDirty(false); // Reset tracker
            if (returnTo === "tab") { $(".ps-sidebar").show(); fireRefreshHook(REFRESH.SWITCH_TAB, 0); }
            else { renderDevMode("landing"); }
        });

        const saveCurrentTextState = () => {
            modeData.label = $("#dev_mode_name").val();
            if ($("#dev_edit_p1").length) modeData.p1 = $("#dev_edit_p1").val();
            if ($("#dev_edit_p2").length) modeData.p2 = $("#dev_edit_p2").val();
            modeData.p3 = $("#dev_edit_p3").val();
            modeData.p4 = $("#dev_edit_p4").val(); modeData.p5 = $("#dev_edit_p5").val(); modeData.p6 = $("#dev_edit_p6").val();

            // Loop through all override fields
            const fields = ["cot", "prefill", "cyoa", "info", "death", "combat", "direct", "dn", "dialogueColor", "mvu", "storytracker", "think", "language", "pronouns", "count", "dnratio", "onomato", "banlist", "npc_inner_chatter"];
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

        flow.append(createEditableBlock("[[prompt1]]", "p1", modeData.p1));
        flow.append(createEditableBlock("[[prompt2]]", "p2", modeData.p2));
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
                div.find(".ps-btn-del-mod").on("click", () => { modeData.customToggles = modeData.customToggles.filter(x => x.id !== m.id); saveCurrentTextState(); renderDevMode("editor", modeData.id, modeData); setDevEngineDirty(true); });
                div.find(".ps-btn-edit-mod").on("click", async () => {
                    saveCurrentTextState();
                    const $p = $(`<div style="display:flex; flex-direction:column; gap:10px;"><input type="text" id="m_n" class="ps-modern-input" value="${m.name}" /><select id="m_l" class="ps-modern-input"><option value="settings" ${m.location === 'settings' ? 'selected' : ''}>Stage 4: Settings</option><option value="addons" ${m.location === 'addons' ? 'selected' : ''}>Stage 5: Add-ons</option></select><textarea id="m_c" class="ps-modern-input" style="height:150px;">${m.content}</textarea></div>`);
                    if (await new Popup($p, POPUP_TYPE.CONFIRM, "Edit Module", { okButton: "Save", cancelButton: "Cancel", wide: true }).show()) { m.name = $p.find("#m_n").val() || "Module"; m.location = $p.find("#m_l").val(); m.content = $p.find("#m_c").val(); renderDevMode("editor", modeData.id, modeData); setDevEngineDirty(true); }
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
        flow.append(createOverrideBlock("[[death]]", "death", modeData.death, [{ label: "No Change", value: "" }, { label: "Default", value: getAddon("death") }]));
        flow.append(createOverrideBlock("[[combat]]", "combat", modeData.combat, [{ label: "No Change", value: "" }, { label: "Default", value: getAddon("combat") }]));
        flow.append(createOverrideBlock("[[Direct]]", "direct", modeData.direct, [{ label: "No Change", value: "" }, { label: "Default", value: getAddon("direct") }]));
        flow.append(createOverrideBlock("[[DN]]", "dn", modeData.dn, [{ label: "No Change", value: "" }, { label: "Default", value: getAddon("dn") }]));
        flow.append(createOverrideBlock("[[COLOR]]", "dialogueColor", modeData.dialogueColor, [{ label: "No Change", value: "" }, { label: "Default", value: getAddon("color") }])); flow.append(createOverrideBlock("[[MVU]]", "mvu", modeData.mvu, [{ label: "No Change", value: "" }, { label: "Default", value: getBlock("mvu") }]));
        flow.append(createOverrideBlock("[[storytracker]]", "storytracker", modeData.storytracker, [{ label: "No Change", value: "" }, { label: "Default", value: "# at the very end of the response put this block:\n<Story_Tracker>\narc: The Arc that is now active.\nchapter: The chapter that is now active.\nEpisode: The episode that is now active.\nSecrets: Any secret that the user/{{user}} doesn't know.\n</Story_Tracker>" }]));
        flow.append(createOverrideBlock("[[npc_inner_chatter]]", "npc_inner_chatter", modeData.npc_inner_chatter, [
            { label: "No Change", value: "" },
            { label: "Default", value: getBlock("npc_inner_chatter") },
            { label: "Simple", value: getBlock("npc_inner_chatter_v2") }
        ]));

        // Section 3: Global Variables
        flow.append(`<div class="ps-rule-title" style="margin: 30px 0 10px 0; color: #f59e0b;"><i class="fa-solid fa-earth-americas"></i> Global Variables Overrides</div>`);
        flow.append(createOverrideBlock("[[Language]]", "language", modeData.language, [{ label: "No Change", value: "" }, { label: "English Template", value: "## LANGUAGE RULE\nALL OUTPUT EXCEPT THINKING MUST BE IN ENGLISH ONLY." }]));
        flow.append(createOverrideBlock("[[pronouns]]", "pronouns", modeData.pronouns, [{ label: "No Change", value: "" }, { label: "Male Template", value: "{{user}} is male. Always portray and address him as such." }]));
        flow.append(createOverrideBlock("[[count]]", "count", modeData.count, [{ label: "No Change", value: "" }, { label: "Example 400", value: "— maximum 400 words" }]));
        flow.append(createOverrideBlock("[[DNRATIO]]", "dnratio", modeData.dnratio, [{ label: "No Change", value: "" }, { label: "Example 50/50", value: "Ratio: Maintain a balance of 50% Dialogue and 50% Narration." }]));
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
                setDevEngineDirty(true);
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
            setDevEngineDirty(false);
            if (isNew) { extension_settings[extensionName].customModes.push(modeData); }
            else { const idx = extension_settings[extensionName].customModes.findIndex(m => m.id === modeData.id); if (idx > -1) extension_settings[extensionName].customModes[idx] = modeData; }
            saveSettingsDebounced(); toastr.success("Engine Flow Saved!");
            if (returnTo === "tab") { $(".ps-sidebar").show(); fireRefreshHook(REFRESH.SWITCH_TAB, 0); }
            else { renderDevMode("landing"); }
        });
    }
}
