// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 — the page: prompt choices and the cast, with each character's
// look (editable, lockable, scannable) and their current outfit from World State.
// ────────────────────────────────────────────────────────────────────────────

import { localProfile } from "../../../core/state.js";
import { saveProfileToMemory, saveProfileDebounced } from "../../../core/profile.js";
import { substituteParams } from "../../../st.js";
import { v2Settings, currentImageCast, getLooks } from "./index.js";
import { scanLooks, describeLooks } from "./looks.js";
import { findLookKey } from "./looksCore.js";

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
const SOURCE_LABEL = { npc: "NPC Bank", sheet: "sheet scan", chat: "chat scan", manual: "manual" };

// The stored look for a cast member, created on first edit.
function lookFor(member) {
    const looks = getLooks();
    let k = findLookKey(looks, member.name, member.aliases || []);
    if (!k) {
        k = member.name;
        looks[k] = { tags: member.lookSource === "npc" ? member.look : "", natural: "", aliases: [], locked: false, source: "manual" };
    }
    return { key: k, look: looks[k] };
}

// A button that shows a spinner while its job runs, and redraws the page after.
function busy($btn, job, redraw) {
    $btn.on("click", async () => {
        if ($btn.prop("disabled")) return;
        const html = $btn.html();
        $btn.prop("disabled", true).html(`<i class="fa-solid fa-spinner fa-spin"></i> Working…`);
        try { await job(); } catch (e) { console.error(e); toastr.error("That did not work. See the console for details.", "Megumin Suite"); }
        finally { $btn.prop("disabled", false).html(html); redraw(); }
    });
}

export function renderV2ImageGen(c) {
    c.empty();
    const ig = localProfile.imageGen;
    const cfg = v2Settings();
    const cast = currentImageCast();
    const looks = getLooks();
    const redraw = () => renderV2ImageGen(c);
    const user = (() => { try { return substituteParams("{{user}}"); } catch (e) { return "{{user}}"; } })();

    const card = m => {
        const k = findLookKey(looks, m.name, m.aliases || []);
        const stored = k ? looks[k] : null;
        const where = m.isPc ? "player" : m.inScene ? "in scene" : m.mentioned ? "mentioned" : "away";
        const tags = stored && String(stored.tags || "").trim() ? stored.tags : (m.lookSource === "npc" ? m.look : "");
        const source = stored && String(stored.tags || "").trim() ? stored.source : m.lookSource;
        return `
            <div class="ig2-cast-row ${m.inScene || m.isPc ? "" : "is-away"}" data-name="${esc(m.name)}">
                <div class="ig2-cast-head">
                    <b>@${esc(m.name)}</b>
                    <span class="ig2-chip ${where === "in scene" || where === "player" ? "on" : ""}">${where}</span>
                    ${source ? `<span class="ig2-chip">${esc(SOURCE_LABEL[source] || source)}</span>` : ""}
                    <span class="ig2-spacer"></span>
                    <button type="button" class="ig2-mini ig2-lock ${stored && stored.locked ? "on" : ""}" title="${stored && stored.locked ? "Locked: scans never change this look" : "Lock this look so scans never change it"}"><i class="fa-solid ${stored && stored.locked ? "fa-lock" : "fa-lock-open"}"></i></button>
                    <button type="button" class="ig2-mini ig2-rescan" title="Read this character's look from the recent chat"><i class="fa-solid fa-magnifying-glass"></i></button>
                    ${stored ? `<button type="button" class="ig2-mini ig2-forget" title="Delete the saved look"><i class="fa-solid fa-trash"></i></button>` : ""}
                </div>
                <label class="ig2-cast-field"><span>Nicknames</span>
                    <input type="text" class="ps-modern-input ig2-aliases" value="${esc([...new Set([...(stored ? stored.aliases || [] : []), ...(m.aliases || [])])].join(", "))}" placeholder="Matt, Matty" />
                </label>
                <label class="ig2-cast-field"><span>Look</span>
                    <textarea class="ps-modern-input ig2-tags" rows="2" placeholder="Permanent appearance only: female, long blue hair, blue eyes, slender…">${esc(tags)}</textarea>
                </label>
                ${cfg.style === "natural" ? `
                <label class="ig2-cast-field"><span>Description</span>
                    <textarea class="ps-modern-input ig2-natural" rows="2" placeholder="a slender young woman with long blue hair and blue eyes">${esc(stored ? stored.natural : "")}</textarea>
                </label>` : ""}
                <div class="ig2-cast-line"><span>Outfit</span>${m.outfit ? esc(m.outfit) : `<i class="ig2-missing">none in World State (the model will describe it)</i>`}</div>
            </div>`;
    };

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
            </div>

            <div class="ig2-card">
                <div class="ig2-title"><i class="fa-solid fa-users"></i> Cast <span class="ig2-chip">${cast.length}</span></div>
                <div class="ig2-actions">
                    <button type="button" class="menu_button ig2-scan-sheet" title="Read every character on the card, and your persona"><i class="fa-solid fa-id-card"></i> Scan character sheet</button>
                    <button type="button" class="menu_button ig2-scan-chat" title="Read looks from the recent chat for characters who have none"><i class="fa-solid fa-comments"></i> Scan chat</button>
                    ${cfg.style === "natural" ? `<button type="button" class="menu_button ig2-describe" title="Write a plain description for every look that has none"><i class="fa-solid fa-feather"></i> Describe missing</button>` : ""}
                </div>
                <div class="ig2-add">
                    <input type="text" class="ps-modern-input ig2-add-name" placeholder="Add a character by name" />
                    <button type="button" class="menu_button ig2-add-btn"><i class="fa-solid fa-plus"></i> Add</button>
                </div>
                ${cast.map(card).join("") || `<div class="ig2-hint">No one yet. Scan the character sheet, or add a character.</div>`}
                <div class="ig2-hint">A look is permanent appearance only; the outfit comes from World State. New characters get a look automatically when they enter the story; established looks only change when you scan and approve it.</div>
            </div>

            <div class="ig2-card">
                <div class="ig2-title"><i class="fa-solid fa-sliders"></i> Images &amp; generator</div>
                <div class="ig2-hint">When images are made, where they go, and the ComfyUI setup (workflow, model, LoRAs, sampler, prompt prefix…) are shared with Classic. Until this page has its own, switch to <b>Classic</b> to change them; they apply to V2 too.</div>
                <div class="ig2-status">Image generation is <b>${ig.enabled ? "on" : "off"}</b>. ${esc(user)} is the player.</div>
            </div>
        </div>
    `);

    const setCfg = patch => { ig.v2 = { ...cfg, ...(ig.v2 || {}), ...patch }; };
    page.find("#ig2_style").on("change", function () { setCfg({ style: $(this).val() }); saveProfileToMemory(); redraw(); });
    page.find("#ig2_shot").on("change", function () { setCfg({ shot: $(this).val() }); saveProfileToMemory(); redraw(); });
    page.find("#ig2_extra").on("input", function () { setCfg({ extra: String($(this).val() || "") }); saveProfileDebounced(); });

    busy(page.find(".ig2-scan-sheet"), () => scanLooks({ from: "sheet" }), redraw);
    busy(page.find(".ig2-scan-chat"), () => {
        const need = cast.filter(m => !String(m.look || m.lookNatural || "").trim()).map(m => ({ name: m.name, aliases: m.aliases || [] }));
        if (!need.length) { toastr.info("Everyone in the cast already has a look. Use a character's own scan button to re-read it.", "Megumin Suite"); return; }
        return scanLooks({ from: "chat", targets: need });
    }, redraw);
    busy(page.find(".ig2-describe"), () => describeLooks(), redraw);

    const addChar = () => {
        const name = String(page.find(".ig2-add-name").val() || "").trim();
        if (!name) return;
        const looks = getLooks();
        if (!findLookKey(looks, name)) looks[name] = { tags: "", natural: "", aliases: [], locked: false, source: "manual" };
        saveProfileToMemory(); redraw();
    };
    page.find(".ig2-add-btn").on("click", addChar);
    page.find(".ig2-add-name").on("keydown", e => { if (e.key === "Enter") addChar(); });

    page.find(".ig2-cast-row").each(function () {
        const $row = $(this);
        const member = cast.find(m => m.name === $row.data("name"));
        if (!member) return;
        $row.find(".ig2-tags").on("change", function () {
            const { look } = lookFor(member);
            look.tags = String($(this).val() || "").trim();
            look.source = "manual";
            saveProfileToMemory(); redraw();
        });
        $row.find(".ig2-natural").on("change", function () {
            const { look } = lookFor(member);
            look.natural = String($(this).val() || "").trim();
            saveProfileToMemory();
        });
        $row.find(".ig2-aliases").on("change", function () {
            const { key, look } = lookFor(member);
            look.aliases = String($(this).val() || "").split(",").map(a => a.trim())
                .filter((a, i, all) => a && a.toLowerCase() !== key.toLowerCase() && all.findIndex(x => x.toLowerCase() === a.toLowerCase()) === i);
            saveProfileToMemory(); redraw();
        });
        $row.find(".ig2-lock").on("click", () => {
            const { look } = lookFor(member);
            look.locked = !look.locked;
            saveProfileToMemory(); redraw();
        });
        busy($row.find(".ig2-rescan"), () => scanLooks({ from: "chat", targets: [{ name: member.name, aliases: member.aliases || [] }] }), redraw);
        const $forget = $row.find(".ig2-forget");
        $forget.on("click", () => {
            if ($forget.attr("data-armed") !== "1") {
                $forget.attr("data-armed", "1").addClass("armed").html(`<i class="fa-solid fa-trash"></i> Delete?`);
                setTimeout(() => { $forget.attr("data-armed", "0").removeClass("armed").html(`<i class="fa-solid fa-trash"></i>`); }, 3000);
                return;
            }
            const looks = getLooks();
            const k = findLookKey(looks, member.name, member.aliases || []);
            if (k) delete looks[k];
            saveProfileToMemory(); redraw();
        });
    });

    c.append(page);
}
