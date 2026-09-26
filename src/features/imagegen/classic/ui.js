// ────────────────────────────────────────────────────────────────────────────
// Image Gen — the Classic page: the tab exactly as it was before task 001
// (df9e9db). Kept for anyone who prefers it to V2. Its generator settings are
// the same stored settings V2 uses, so switching pages loses nothing.
// ────────────────────────────────────────────────────────────────────────────

import { localProfile } from "../../../core/state.js";
import { saveProfileToMemory, saveProfileDebounced } from "../../../core/profile.js";
import { syncPromptsGlobally } from "../../../core/sync.js";
import { DEFAULT_PROMPTS } from "../../../prompts/index.js";
import { renderPromptEditor } from "../../../ui/promptEditor.js";
import { RESOLUTIONS } from "../../../../data/image_data.js";
import { igFetchComfyLists, toggleQuickGenButton, igTestConnection, igPopulateWorkflows, igNewWorkflowClick, igDeleteWorkflowClick, igOpenWorkflowEditorClick } from "../comfy.js";

export function renderClassicImageGen(c) {
    c.empty();
    const s = localProfile.imageGen;

    c.append(`
        <!-- HEADER -->
        <div class="mtab-header">
            <div class="mtab-header-left">
                <div class="mtab-header-icon" style="background: linear-gradient(135deg, #06b6d4, #0891b2);">
                    <i class="fa-solid fa-image"></i>
                </div>
                <div>
                    <h2>Image Generation</h2>
                    <p>ComfyUI integration for automatic scene rendering.</p>
                </div>
            </div>
            <div id="ig_header_badge" class="mtab-header-badge" style="background: ${s.enabled ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)'}; color: ${s.enabled ? '#10b981' : 'var(--text-muted)'}; border: 1px solid ${s.enabled ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'};">
                <i class="fa-solid fa-${s.enabled ? 'circle-check' : 'circle-xmark'}" style="font-size:0.6rem;"></i> ${s.enabled ? 'Enabled' : 'Disabled'}
            </div>
        </div>

        <div class="mtab-callout blue" style="margin-bottom: 16px;">
            <i class="fa-solid fa-book-open"></i>
            <span><strong>New to this? There's a setup guide.</strong> Getting ComfyUI talking to
            SillyTavern is the hard part, and none of the settings below matter until it is.
            <a href="https://www.reddit.com/r/SillyTavernAI/comments/1u87agq/tutorial_how_to_setup_inline_image_generation_in/"
               target="_blank" rel="noopener noreferrer"
               style="color:#3b82f6; text-decoration:underline;">Read the walkthrough</a> — it covers
            the install, the connection and the first working image.</span>
        </div>

        <!-- MASTER TOGGLE -->
        <div class="mtab-toggle-row ${s.enabled ? 'active' : ''}" id="ig_enable_card" style="margin-bottom: 20px;">
            <div class="toggle-info">
                <div class="toggle-label"><i class="fa-solid fa-image" style="color:#06b6d4;"></i> Enable Image Generation</div>
                <div class="toggle-desc">Activate ComfyUI integration for this specific character/group.</div>
            </div>
            <div class="ps-switch"></div>
        </div>

        <!-- Generator Backend -->
        <div class="mtab-panel" style="margin-bottom:16px;">
            <div class="mtab-panel-title blue"><i class="fa-solid fa-gears"></i> Prompt Generator Backend</div>
            <div class="mtab-setting-row">
                <div class="set-info">
                    <div class="set-label"><i class="fa-solid fa-cat" style="color: #f43f5e; margin-right: 6px;"></i> Background Worker</div>
                    <div class="set-desc">Managed by the <b>Chomusuke</b> tab. Configure Chomusuke to offload visual prompt crafting to a dedicated worker LLM.</div>
                </div>
            </div>
        </div>

        <div id="ig_main_content" style="display: ${s.enabled ? 'block' : 'none'};">
            
            <!-- Connection & Workflow -->
            <div class="mtab-panel" style="margin-bottom:16px;">
                <div class="mtab-panel-title blue"><i class="fa-solid fa-link"></i> ComfyUI Server & Workflow</div>
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

            <!-- Triggers & Formatting -->
            <div class="mtab-panel" style="margin-bottom:16px;">
                <div class="mtab-panel-title gold"><i class="fa-solid fa-pen-nib"></i> Triggers & Formatting</div>
                <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px;">Trigger Mode</div>
                        <select id="ig_trigger_mode" class="ps-modern-input" style="padding: 8px; font-size: 0.8rem; cursor: pointer;">
                            <option value="always" ${s.triggerMode === 'always' ? 'selected' : ''}>Always (Every Reply)</option>
                            <option value="frequency" ${s.triggerMode === 'frequency' ? 'selected' : ''}>After X Replies</option>
                            <option value="conditional" ${s.triggerMode === 'conditional' ? 'selected' : ''}>Only when character sends a pic</option>
                            <option value="manual" ${s.triggerMode === 'manual' ? 'selected' : ''}>Manual Button Only</option>
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px;">Inject Mode</div>
                        <select id="ig_inject_mode" class="ps-modern-input" style="padding: 8px; font-size: 0.8rem; cursor: pointer;">
                            <option value="new_msg" ${s.injectMode === 'new_msg' || !s.injectMode ? 'selected' : ''}>New Message (Gallery)</option>
                            <option value="inline" ${s.injectMode === 'inline' ? 'selected' : ''}>Inline (Inside AI Reply)</option>
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px;">Image Count</div>
                        <select id="ig_image_count" class="ps-modern-input" style="padding: 8px; font-size: 0.8rem; cursor: pointer;">
                            <option value="1" ${s.imageCount == 1 ? 'selected' : ''}>1 Image</option>
                            <option value="2" ${s.imageCount == 2 ? 'selected' : ''}>2 Images</option>
                            <option value="3" ${s.imageCount == 3 ? 'selected' : ''}>3 Images</option>
                            <option value="4" ${s.imageCount == 4 ? 'selected' : ''}>4 Images</option>
                        </select>
                    </div>
                    <div style="flex: 1; display: ${s.triggerMode === 'frequency' ? 'block' : 'none'};" id="ig_freq_container">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px;">Every X Replies</div>
                        <input type="number" id="ig_auto_freq" class="ps-modern-input" value="${s.autoGenFreq}" min="1" style="padding: 8px; font-size: 0.8rem; text-align: center;" />
                    </div>
                </div>

                <div class="mtab-toggle-row ${s.previewPrompt ? 'active' : ''}" id="ig_preview_card" style="padding: 12px 18px; margin-bottom: 15px;">
                    <div class="toggle-info">
                        <div class="toggle-label" style="font-size:0.85rem;">Preview Prompt Before Sending</div>
                        <div class="toggle-desc">Show a popup to view or edit the AI's prompt before rendering.</div>
                    </div>
                    <div class="ps-switch"></div>
                </div>

                <div id="ig_prompt_builder" style="background: rgba(0,0,0,0.15); padding: 15px; border-radius: 10px; border-left: 3px solid var(--gold);">
                    <div style="display: flex; gap: 15px; margin-bottom: 10px; align-items: center; flex-wrap: wrap;">
                        <div style="flex: 2; min-width: 150px;">
                            <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px;">Prompt Template</div>
                            <select id="ig_template" class="ps-modern-input" style="padding: 8px; font-size: 0.8rem; cursor: pointer;">
                                <option value="illus_cinematic" ${s.promptTemplate === 'illus_cinematic' ? 'selected' : ''}>Illustrious/Anima + Cinematic</option>
                                <option value="sdxl_cinematic" ${s.promptTemplate === 'sdxl_cinematic' ? 'selected' : ''}>Z Image + Cinematic</option>
                                <option value="illus_pov" ${s.promptTemplate === 'illus_pov' ? 'selected' : ''}>Illustrious/Anima + POV</option>
                                <option value="sdxl_pov" ${s.promptTemplate === 'sdxl_pov' ? 'selected' : ''}>Z Image + POV</option>
                                <option value="illus_portrait" ${s.promptTemplate === 'illus_portrait' ? 'selected' : ''}>Illustrious/Anima + Portrait</option>
                                <option value="sdxl_portrait" ${s.promptTemplate === 'sdxl_portrait' ? 'selected' : ''}>Z Image + Portrait</option>
                            </select>
                        </div>
                        <div style="flex: 1; min-width: 100px;">
                            <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
                                Include Examples <i class="fa-solid fa-circle-question" title="Make the image prompt better but increase input token." style="cursor: help; color: var(--gold);"></i>
                            </div>
                            <div class="ps-toggle-card ${s.includeExamples ? 'active' : ''}" id="ig_examples_toggle" style="padding: 4px; min-width: 44px; justify-content: center; background: transparent; border-color: ${s.includeExamples ? '#10b981' : 'var(--border-color)'}; cursor: pointer; border-radius: 8px;">
                                <div class="ps-switch" style="transform: scale(0.75); ${s.includeExamples ? 'background: #10b981;' : ''}"></div>
                            </div>
                        </div>
                        <div style="flex: 1; min-width: 100px;">
                            <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
                                Better Booru tags <i class="fa-solid fa-circle-question" title="It may increase empty responses." style="cursor: help; color: var(--gold);"></i>
                            </div>
                            <div class="ps-toggle-card ${s.directLanguage ? 'active' : ''}" id="ig_direct_toggle" style="padding: 4px; min-width: 44px; justify-content: center; background: transparent; border-color: ${s.directLanguage ? '#10b981' : 'var(--border-color)'}; cursor: pointer; border-radius: 8px;" title="Forces the AI to only use exact Booru tags">
                                <div class="ps-switch" style="transform: scale(0.75); ${s.directLanguage ? 'background: #10b981;' : ''}"></div>
                            </div>
                        </div>
                        <div style="flex: 1; min-width: 100px;">
                            <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
                                Inject NPC Tags <i class="fa-solid fa-circle-question" title="Automatically attach saved NPC image tags to the prompt if they are in the scene." style="cursor: help; color: var(--gold);"></i>
                            </div>
                            <div class="ps-toggle-card ${s.injectNpcTags ? 'active' : ''}" id="ig_npc_tags_toggle" style="padding: 4px; min-width: 44px; justify-content: center; background: transparent; border-color: ${s.injectNpcTags ? '#10b981' : 'var(--border-color)'}; cursor: pointer; border-radius: 8px;">
                                <div class="ps-switch" style="transform: scale(0.75); ${s.injectNpcTags ? 'background: #10b981;' : ''}"></div>
                            </div>
                        </div>
                    </div>
                    <input type="text" id="ig_extra" class="ps-modern-input" placeholder="Extra Instructions (e.g. moody lighting, dark atmosphere...)" value="${s.promptExtra}" style="padding: 8px; font-size: 0.8rem;" />
                </div>

            <!-- Parameters -->
            <div class="mtab-panel" style="margin-bottom:16px;">
                <div class="mtab-panel-title gold"><i class="fa-solid fa-sliders"></i> Image Parameters</div>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <select id="ig_model" class="ps-modern-input" style="flex: 2; cursor: pointer;"><option value="">Loading Models...</option></select>
                    <select id="ig_sampler" class="ps-modern-input" style="flex: 1; cursor: pointer;"><option value="">Loading Samplers...</option></select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px; background: rgba(0,0,0,0.1); padding: 15px; border-radius: 10px; border: 1px solid var(--border-color);">
                    <div class="mtab-param-row"><span class="param-label">Steps</span><input type="range" id="ig_steps" min="1" max="100" value="${s.steps}"><input type="number" id="ig_steps_val" value="${s.steps}"></div>
                    <div class="mtab-param-row"><span class="param-label">CFG</span><input type="range" id="ig_cfg" min="1" max="30" step="0.5" value="${s.cfg}"><input type="number" id="ig_cfg_val" value="${s.cfg}"></div>
                    <div class="mtab-param-row"><span class="param-label">Denoise</span><input type="range" id="ig_denoise" min="0" max="1" step="0.05" value="${s.denoise}"><input type="number" id="ig_denoise_val" value="${s.denoise}"></div>
                    <div class="mtab-param-row"><span class="param-label">CLIP</span><input type="range" id="ig_clip" min="1" max="12" step="1" value="${s.clipSkip}"><input type="number" id="ig_clip_val" value="${s.clipSkip}"></div>
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

                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase;">Seed (-1 for random)</div>
                        <div style="display: flex; gap: 5px;">
                            <input type="number" id="ig_seed" class="ps-modern-input" value="${s.customSeed}" style="padding: 8px; font-size: 0.8rem; flex: 1;" />
                            <button id="ig_seed_dice" class="ps-modern-btn secondary" style="padding: 8px 12px;" title="Set to Random (-1)"><i class="fa-solid fa-dice"></i></button>
                        </div>
                    </div>
                    <div style="flex: 2;">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase;">Negative Prompt Override</div>
                        <input type="text" id="ig_neg" class="ps-modern-input" value="${s.customNegative}" style="padding: 8px; font-size: 0.8rem;" />
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.7rem; font-weight: bold; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase;">Positive Prefix (Auto-Added to Front)</div>
                        <input type="text" id="ig_prefix" class="ps-modern-input" value="${s.promptPrefix || ''}" placeholder="e.g. score_9, score_8_up, masterpiece..." style="padding: 8px; font-size: 0.8rem;" />
                    </div>
                </div>
            </div>

            <!-- LoRA Lab -->
            <div class="mtab-panel">
                <div class="mtab-panel-title purple"><i class="fa-solid fa-flask"></i> LoRA Lab</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    ${[1, 2, 3, 4].map(i => {
                        const wtVal = i === 1 ? s.selectedLoraWt : s[`selectedLoraWt${i}`];
                        const trigVal = i === 1 ? s.loraTrigger1 : s[`loraTrigger${i}`];
                        return `
                        <div style="background: rgba(0,0,0,0.1); border: 1px solid var(--border-color); padding: 12px; border-radius: 10px; border-left: 3px solid #a855f7;">
                            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Slot ${i}</div>
                            
                            <select id="ig_lora_${i}" class="ps-modern-input" style="padding: 6px; font-size: 0.75rem; margin-bottom: 4px; width: 100%; box-sizing: border-box; cursor: pointer;">
                                <option value="">Loading...</option>
                            </select>
                            
                            <input type="text" id="ig_lora_trig_${i}" class="ps-modern-input" placeholder="Trigger words..." value="${trigVal || ''}" style="padding: 6px; font-size: 0.7rem; margin-bottom: 8px; width: 100%; box-sizing: border-box;" title="Words automatically injected into the prompt when this LoRA is active." />
                            
                            <div class="mtab-param-row" style="padding:0;">
                                <span class="param-label" style="min-width:30px;">Wt</span>
                                <input type="range" id="ig_lorawt_${i}" min="-6" max="6" step="0.1" value="${wtVal}">
                                <span id="ig_lorawt_lbl_${i}" style="font-size:0.78rem; font-weight:600; color:var(--text-main); min-width:30px; text-align:center;">${wtVal}</span>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `);

    // --- PROMPT EDITOR UI ---
    const igEditor = renderPromptEditor({
        id: "ig_prompt_editor",
        title: "Advanced: Edit Prompts",
        defaultData: DEFAULT_PROMPTS.imageGen,
        currentData: s.customPrompts,
        enabled: s.customPromptsEnabled, // <-- NEW
        onToggle: (val) => { 
            s.customPromptsEnabled = val; 
            syncPromptsGlobally('imageGen', 'customPromptsEnabled', val);
            saveProfileToMemory(); 
        },
        fields: [
            { key: "systemPrompt", label: "System Prompt", hint: "AI role definition." },
            { key: "userPrompt", label: "User Task Prompt", hint: "Tokens: <code>{{chatHistory}}</code>, <code>{{templateRules}}</code>, <code>{{extraStr}}</code>, <code>{{directLanguage}}</code>, <code>{{npcImageTags}}</code>, <code>{{templateExamples}}</code>" },
            { key: "thinkingPrompt", label: "Thinking Instructions", hint: "Must include output ordering instructions." },
            { key: "injectionTemplate", label: "Image Injection Template", hint: "Tokens: <code>{{conditionalText}}</code>, <code>{{templateRules}}</code>, <code>{{promptExtra}}</code>, <code>{{directLanguage}}</code>, <code>{{npcImageTags}}</code>, <code>{{templateExamples}}</code>" },
            { key: "rulesIllusPov", label: "Rules: Illustrious + POV", hint: "" },
            { key: "examplesIllusPov", label: "Examples: Illustrious + POV", hint: "" },
            { key: "rulesSdxlPov", label: "Rules: Z Image + POV", hint: "" },
            { key: "examplesSdxlPov", label: "Examples: Z Image + POV", hint: "" },
            { key: "rulesIllusCinematic", label: "Rules: Illustrious + Cinematic", hint: "" },
            { key: "examplesIllusCinematic", label: "Examples: Illustrious + Cinematic", hint: "" },
            { key: "rulesSdxlCinematic", label: "Rules: Z Image + Cinematic", hint: "" },
            { key: "examplesSdxlCinematic", label: "Examples: Z Image + Cinematic", hint: "" },
            { key: "rulesIllusPortrait", label: "Rules: Illustrious + Portrait", hint: "" },
            { key: "examplesIllusPortrait", label: "Examples: Illustrious + Portrait", hint: "" },
            { key: "rulesSdxlPortrait", label: "Rules: Z Image + Portrait", hint: "" },
            { key: "examplesSdxlPortrait", label: "Examples: Z Image + Portrait", hint: "" }
        ],
        onSave: (val, key) => {
            if (!s.customPrompts) s.customPrompts = JSON.parse(JSON.stringify(DEFAULT_PROMPTS.imageGen));
            s.customPrompts[key] = val;
            syncPromptsGlobally('imageGen', 'customPrompts', s.customPrompts);
            saveProfileDebounced();
            return s.customPrompts;
        },
        onReset: () => {
            s.customPrompts = null;
            syncPromptsGlobally('imageGen', 'customPrompts', null);
            saveProfileToMemory();
        }
    });
    c.find('#ig_main_content').append(igEditor);

    // --- EVENTS & BINDINGS ---
    $("#ig_enable_card").on("click", function () {
        s.enabled = !s.enabled;
        saveProfileToMemory();
        toggleQuickGenButton();
        if (s.enabled) {
            $(this).addClass("active"); $(this).css("border-color", "var(--gold)"); $(this).find("span").css("color", "var(--gold)");
            $("#ig_main_content").slideDown(200); 
            igPopulateWorkflows(); // <-- ADDED THIS!
            igFetchComfyLists();
            $("#ig_header_badge").css({ background: 'rgba(16,185,129,0.12)', color: '#10b981', 'border-color': 'rgba(16,185,129,0.25)' }).html(`<i class="fa-solid fa-circle-check" style="font-size:0.6rem;"></i> Enabled`);
        } else {
            $(this).removeClass("active"); $(this).css("border-color", "var(--border-color)"); $(this).find("span").css("color", "var(--text-main)");
            $("#ig_main_content").slideUp(200);
            $("#ig_header_badge").css({ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', 'border-color': 'var(--border-color)' }).html(`<i class="fa-solid fa-circle-xmark" style="font-size:0.6rem;"></i> Disabled`);
        }
    });
    $("#ig_template").on("change", (e) => { s.promptTemplate = $(e.target).val(); saveProfileToMemory(); });
    $("#ig_extra").on("input", (e) => { s.promptExtra = $(e.target).val(); saveProfileDebounced(); });
    $("#ig_image_count").on("change", (e) => { s.imageCount = parseInt($(e.target).val()); saveProfileToMemory(); });
    
    $("#ig_examples_toggle").on("click", function() {
        s.includeExamples = !s.includeExamples;
        saveProfileToMemory();
        if (s.includeExamples) {
            $(this).addClass("active").css("border-color", "#10b981");
            $(this).find(".ps-switch").css("background", "#10b981");
        } else {
            $(this).removeClass("active").css("border-color", "var(--border-color)");
            $(this).find(".ps-switch").css("background", "");
        }
    });
    $("#ig_direct_toggle").on("click", function() {
        s.directLanguage = !s.directLanguage;
        saveProfileToMemory();
        if (s.directLanguage) {
            $(this).addClass("active").css("border-color", "#10b981");
            $(this).find(".ps-switch").css("background", "#10b981");
        } else {
            $(this).removeClass("active").css("border-color", "var(--border-color)");
            $(this).find(".ps-switch").css("background", "");
        }
    });
    $("#ig_npc_tags_toggle").on("click", function() {
        s.injectNpcTags = !s.injectNpcTags;
        saveProfileToMemory();
        if (s.injectNpcTags) {
            $(this).addClass("active").css("border-color", "#10b981");
            $(this).find(".ps-switch").css("background", "#10b981");
        } else {
            $(this).removeClass("active").css("border-color", "var(--border-color)");
            $(this).find(".ps-switch").css("background", "");
        }
    });

    $("#ig_inject_mode").on("change", (e) => { s.injectMode = $(e.target).val(); saveProfileToMemory(); });
    $("#ig_trigger_mode").on("change", (e) => {
        s.triggerMode = $(e.target).val();
        saveProfileToMemory();
        toggleQuickGenButton(); // <-- ADDED
        if (s.triggerMode === 'frequency') $("#ig_freq_container").show(); else $("#ig_freq_container").hide();
    });
    $("#ig_auto_freq").on("input", (e) => { let v = parseInt($(e.target).val()); if (v < 1) v = 1; s.autoGenFreq = v; saveProfileDebounced(); });

    $("#ig_preview_card").on("click", function () {
        s.previewPrompt = !s.previewPrompt;
        saveProfileToMemory();
        if (s.previewPrompt) $(this).addClass("active");
        else $(this).removeClass("active");
    });

    // Inputs
    $("#ig_url").on("input", (e) => { s.comfyUrl = $(e.target).val(); saveProfileDebounced(); });
    $("#ig_style").on("change", (e) => { s.promptStyle = $(e.target).val(); saveProfileToMemory(); });
    $("#ig_persp").on("change", (e) => { s.promptPerspective = $(e.target).val(); saveProfileToMemory(); });
    $("#ig_extra").on("input", (e) => { s.promptExtra = $(e.target).val(); saveProfileDebounced(); });
    $("#ig_w, #ig_h").on("input", (e) => { s[e.target.id === "ig_w" ? "imgWidth" : "imgHeight"] = parseInt($(e.target).val()); saveProfileDebounced(); });
    $("#ig_neg").on("input", (e) => { s.customNegative = $(e.target).val(); saveProfileDebounced(); });
    $("#ig_seed").on("input", (e) => { s.customSeed = parseInt($(e.target).val()); saveProfileDebounced(); });
    $("#ig_seed_dice").on("click", () => {
        s.customSeed = -1;
        $("#ig_seed").val(-1);
        saveProfileToMemory();
    });
    $("#ig_prefix").on("input", (e) => { s.promptPrefix = $(e.target).val(); saveProfileDebounced(); });

    // Sliders
    const bindSlider = (id, key, isFloat) => {
        $(`#ig_${id}`).on("input", function () { let v = isFloat ? parseFloat(this.value) : parseInt(this.value); s[key] = v; $(`#ig_${id}_val`).val(v); saveProfileDebounced(); });
        $(`#ig_${id}_val`).on("input", function () { let v = isFloat ? parseFloat(this.value) : parseInt(this.value); s[key] = v; $(`#ig_${id}`).val(v); saveProfileDebounced(); });
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

    // LoRAs with Smart Dictionary Memory
    for (let i = 1; i <= 4; i++) {
        const key = i === 1 ? "selectedLora" : `selectedLora${i}`;
        const wtKey = i === 1 ? "selectedLoraWt" : `selectedLoraWt${i}`;
        const trigKey = i === 1 ? "loraTrigger1" : `loraTrigger${i}`;
        
        $(`#ig_lora_${i}`).on("change", (e) => { 
            const selectedLoraName = $(e.target).val();
            s[key] = selectedLoraName; 
            
            // Look up if we have saved trigger words for this specific LoRA
            if (selectedLoraName && s.loraTriggersMap && s.loraTriggersMap[selectedLoraName] !== undefined) {
                s[trigKey] = s.loraTriggersMap[selectedLoraName];
            } else {
                s[trigKey] = ""; // Clear box if no saved words
            }
            
            // Update the UI box to reflect the loaded triggers
            $(`#ig_lora_trig_${i}`).val(s[trigKey]);
            saveProfileToMemory(); 
        });

        $(`#ig_lora_trig_${i}`).on("input", (e) => { 
            const newTriggers = $(e.target).val();
            s[trigKey] = newTriggers; 
            
            // Save to the global dictionary so it remembers it next time you select this LoRA
            if (s[key] && s[key].trim() !== "") {
                if (!s.loraTriggersMap) s.loraTriggersMap = {};
                s.loraTriggersMap[s[key]] = newTriggers;
            }
            
            saveProfileDebounced(); 
        });

        $(`#ig_lorawt_${i}`).on("input", function () { let v = parseFloat(this.value); s[wtKey] = v; $(`#ig_lorawt_lbl_${i}`).text(v); saveProfileDebounced(); });
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
                selectedLora: s.selectedLora, selectedLoraWt: s.selectedLoraWt, loraTrigger1: s.loraTrigger1,
                selectedLora2: s.selectedLora2, selectedLoraWt2: s.selectedLoraWt2, loraTrigger2: s.loraTrigger2,
                selectedLora3: s.selectedLora3, selectedLoraWt3: s.selectedLoraWt3, loraTrigger3: s.loraTrigger3,
                selectedLora4: s.selectedLora4, selectedLoraWt4: s.selectedLoraWt4, loraTrigger4: s.loraTrigger4
            };
        }
        if (s.savedWorkflowStates && s.savedWorkflowStates[newWorkflow]) {
            Object.assign(s, s.savedWorkflowStates[newWorkflow]);
            toastr.success(`Restored settings for ${newWorkflow}`);
            renderClassicImageGen(c); // Re-render to update UI with restored values (the Classic page, inside the tab shell)
        } else { toastr.info(`New workflow context active`); }

        s.currentWorkflowName = newWorkflow;
        saveProfileToMemory();
    });

    if (s.enabled) {
        igPopulateWorkflows();
        igFetchComfyLists();
    }
}
