// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 — the page (phase 2 of plan 006: prompt choices and a read-only
// cast. Look editing, scans and the review popup arrive in phase 3.)
// ────────────────────────────────────────────────────────────────────────────

import { localProfile } from "../../../core/state.js";
import { saveProfileToMemory, saveProfileDebounced } from "../../../core/profile.js";
import { substituteParams } from "../../../st.js";
import { v2Settings, currentImageCast } from "./index.js";

const esc = v => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STYLE_HELP = {
    tags: "Booru tags (Illustrious, Pony, SDXL anime).",
    natural: "Plain sentences (Z Image, Flux)."
};
const SHOT_HELP = {
    cinematic: "A film still of the moment.",
    pov: "Through the player's eyes.",
    portrait: "One character, head and shoulders."
};
const SOURCE_LABEL = { npc: "NPC Bank", sheet: "sheet", chat: "chat scan", manual: "manual" };

export function renderV2ImageGen(c) {
    c.empty();
    const ig = localProfile.imageGen;
    const cfg = v2Settings();
    const cast = currentImageCast();
    const user = (() => { try { return substituteParams("{{user}}"); } catch (e) { return "{{user}}"; } })();

    const castRows = cast.map(m => {
        const where = m.isPc ? "player" : m.inScene ? "in scene" : m.mentioned ? "mentioned" : "away";
        const look = m.look || m.lookNatural;
        return `
            <div class="ig2-cast-row ${m.inScene || m.isPc ? "" : "is-away"}">
                <div class="ig2-cast-head">
                    <b>@${esc(m.name)}</b>
                    ${(m.aliases || []).map(a => `<span class="ig2-chip">@${esc(a)}</span>`).join("")}
                    <span class="ig2-chip ${where === "in scene" || where === "player" ? "on" : ""}">${where}</span>
                    ${m.lookSource ? `<span class="ig2-chip">${esc(SOURCE_LABEL[m.lookSource] || m.lookSource)}</span>` : ""}
                </div>
                <div class="ig2-cast-line"><span>Look</span>${look ? esc(look) : `<i class="ig2-missing">no saved look yet</i>`}</div>
                <div class="ig2-cast-line"><span>Outfit</span>${m.outfit ? esc(m.outfit) : `<i class="ig2-missing">none in World State</i>`}</div>
            </div>`;
    }).join("");

    const page = $(`
        <div class="ig2">
            <div class="ig2-card">
                <div class="ig2-title"><i class="fa-solid fa-pen-nib"></i> Prompt</div>
                <div class="ig2-grid">
                    <label class="ig2-field"><span>Style</span>
                        <select id="ig2_style" class="ps-modern-input">
                            <option value="tags" ${cfg.style === "tags" ? "selected" : ""}>Tags</option>
                            <option value="natural" ${cfg.style === "natural" ? "selected" : ""}>Natural language</option>
                        </select>
                        <small>${STYLE_HELP[cfg.style] || ""}</small>
                    </label>
                    <label class="ig2-field"><span>Shot</span>
                        <select id="ig2_shot" class="ps-modern-input">
                            <option value="cinematic" ${cfg.shot === "cinematic" ? "selected" : ""}>Cinematic</option>
                            <option value="pov" ${cfg.shot === "pov" ? "selected" : ""}>POV</option>
                            <option value="portrait" ${cfg.shot === "portrait" ? "selected" : ""}>Portrait</option>
                        </select>
                        <small>${SHOT_HELP[cfg.shot] || ""}</small>
                    </label>
                </div>
                <label class="ig2-field"><span>Extra instructions</span>
                    <input type="text" id="ig2_extra" class="ps-modern-input" value="${esc(cfg.extra)}" placeholder="e.g. soft film grain, moody lighting" />
                </label>
                <div class="ig2-hint">The model writes who is in the shot as <code>@Name</code>; each character's saved look and current outfit go in word for word, so they look the same in every image.</div>
            </div>

            <div class="ig2-card">
                <div class="ig2-title"><i class="fa-solid fa-users"></i> Cast <span class="ig2-chip">${cast.length}</span></div>
                ${castRows || `<div class="ig2-hint">No one yet. Looks come from the NPC Bank's Image Tags and your existing character tags; scanning and editing arrive in the next update.</div>`}
                <div class="ig2-hint">Outfits come from World State. Looks: NPC Bank Image Tags or your saved character tags. Editing and scanning arrive in the next update.</div>
            </div>

            <div class="ig2-card">
                <div class="ig2-title"><i class="fa-solid fa-sliders"></i> Images &amp; generator</div>
                <div class="ig2-hint">When images are made, where they go, and the ComfyUI setup (workflow, model, LoRAs, sampler, prompt prefix…) are shared with Classic. Until this page has its own, switch to <b>Classic</b> to change them; they apply to V2 too.</div>
                <div class="ig2-status">Image generation is <b>${ig.enabled ? "on" : "off"}</b>. ${esc(user)} is the player.</div>
            </div>
        </div>
    `);

    page.find("#ig2_style").on("change", function () {
        ig.v2 = { ...cfg, ...(ig.v2 || {}), style: $(this).val() };
        saveProfileToMemory(); renderV2ImageGen(c);
    });
    page.find("#ig2_shot").on("change", function () {
        ig.v2 = { ...cfg, ...(ig.v2 || {}), shot: $(this).val() };
        saveProfileToMemory(); renderV2ImageGen(c);
    });
    page.find("#ig2_extra").on("input", function () {
        ig.v2 = { ...cfg, ...(ig.v2 || {}), extra: String($(this).val() || "") };
        saveProfileDebounced();
    });
    c.append(page);
}
