// ────────────────────────────────────────────────────────────────────────────
// Bonds / Sheet editor (plan 008).
//
//   Bonds   — every character's bonds, each value editable; add a character,
//             forget one.
//   Sheet   — the player's sheet, each value editable.
//   History — every Bonds and Sheet entry (replies, imports, your edits),
//             newest first; a reply's changes can be turned off, an edit deleted.
//
// Same rules as the World State editor: an edit is kept as the user's own change,
// so swipes, rewinds and deletes never undo it; deleting it from History takes
// it back.
// ────────────────────────────────────────────────────────────────────────────

import { Popup, POPUP_TYPE, getContext, substituteParams } from "../../st.js";
import {
    statsState, statsEdit, statsHistory, statsSetEntryDisabled, statsRemoveUserEntry, statBlockOn
} from "../../state/index.js";
import { parseStatValue, statKey } from "../../state/modules/stats/parse.js";
import { meguminStatFields } from "../blocks/registry.js";
import { meguminScheduleBlocksRefresh } from "../blocks/chat.js";

const esc = v => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sub = t => { try { return substituteParams(t); } catch (e) { return t; } };

// The configured fields first (in their order), then any the model added.
function fieldList(onFile, blockId) {
    const cfg = meguminStatFields(blockId).map(f => ({ key: statKey(f.label), label: f.label, cfg: f }));
    const extra = Object.entries(onFile || {})
        .filter(([k]) => !cfg.some(c => c.key === k))
        .map(([k, f]) => ({ key: k, label: f.label, cfg: null }));
    return [...cfg, ...extra];
}

function hintFor(cfg) {
    if (!cfg) return "";
    if (cfg.type === "meter") return `0-${cfg.max || 100}`;
    if (cfg.type === "number") return "number";
    return cfg.hint || "";
}

function cell(who, f, onFile) {
    const value = (onFile && onFile[f.key] && onFile[f.key].text) || "";
    return `<label class="meg-wsed-cell"><span>${esc(f.label)}</span>
        <input type="text" class="ps-modern-input meg-wsed-input meg-sted-input"
            data-who="${esc(who)}" data-key="${esc(f.key)}" data-label="${esc(f.label)}"
            data-type="${esc(f.cfg ? f.cfg.type : "")}" data-max="${esc(f.cfg && f.cfg.max ? f.cfg.max : "")}"
            value="${esc(value)}" data-was="${esc(value)}" placeholder="${esc(hintFor(f.cfg))}" />
    </label>`;
}

// ── Bonds view ───────────────────────────────────────────────────────────

function renderBondsView() {
    const state = statsState("bonds") || { people: {} };
    const people = Object.values(state.people || {}).sort((a, b) => (b.seq || 0) - (a.seq || 0) || a.name.localeCompare(b.name));
    const off = statBlockOn("bonds") ? "" : `<div class="meg-wsed-hint">The Bonds block is off, so these are kept but not handed to the story.</div>`;
    const person = p => `
        <div class="meg-wsed-person meg-sted-person" data-name="${esc(p.name.toLowerCase())}">
            <div class="meg-wsed-person-head">
                <b>${esc(p.name)}</b>
                <button type="button" class="meg-wsed-mini meg-sted-forget" data-who="${esc(p.name)}" title="Forget this character's bonds entirely"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="meg-wsed-grid">${fieldList(p.fields, "bonds").map(f => cell(p.name, f, p.fields)).join("")}</div>
        </div>`;
    return `
        <div class="meg-wsed-section">
            <div class="meg-wsed-title"><i class="fa-solid fa-heart"></i> Bonds <span class="meg-wsed-tag">${people.length}</span>
                ${people.length > 6 ? `<input type="search" class="ps-modern-input meg-sted-search" placeholder="Search a name…"/>` : ""}
            </div>
            ${off}
            <div class="meg-wsed-listrow">
                <input type="text" class="ps-modern-input meg-sted-addchar" placeholder="+ Add a character (name, then Enter)" />
            </div>
            ${people.map(person).join("") || `<div class="meg-wsed-empty">No bonds on file for this chat yet.</div>`}
        </div>`;
}

// ── Sheet view ───────────────────────────────────────────────────────────

function renderSheetView() {
    const state = statsState("sheet") || { fields: {} };
    const off = statBlockOn("sheet") ? "" : `<div class="meg-wsed-hint">The Character Sheet block is off, so this is kept but not handed to the story.</div>`;
    return `
        <div class="meg-wsed-section">
            <div class="meg-wsed-title"><i class="fa-solid fa-shield-halved"></i> ${esc(sub("{{user}}"))} <span class="meg-wsed-tag">player</span></div>
            ${off}
            <div class="meg-wsed-grid">${fieldList(state.fields, "sheet").map(f => cell("", f, state.fields)).join("")}</div>
        </div>`;
}

// ── History view ─────────────────────────────────────────────────────────

function renderHistoryView(showAllSwipes) {
    const rows = statsHistory().filter(r => showAllSwipes || r.active || r.entry.disabled || r.entry.source === "user" || r.entry.orphan);
    const rowHtml = r => {
        const e = r.entry;
        let where;
        if (e.source === "user") where = `<i class="fa-solid fa-user-pen"></i> Your edit`;
        else if (e.orphan) where = `<i class="fa-solid fa-ghost"></i> Deleted message (changes kept)`;
        else if (r.index == null) where = `<i class="fa-regular fa-message"></i> Message not found`;
        else where = `<i class="fa-regular fa-message"></i> Message #${r.index}${r.shownSwipe !== e.swipe || e.swipe > 0 ? ` · swipe ${e.swipe + 1}` : ""}`;
        const badges = [`<span class="meg-wsed-badge">${r.module === "bonds" ? "bonds" : "sheet"}</span>`];
        if (e.source === "import") badges.push(`<span class="meg-wsed-badge">imported</span>`);
        if (e.disabled) badges.push(`<span class="meg-wsed-badge off">off</span>`);
        else if (!r.active) badges.push(`<span class="meg-wsed-badge dim">not showing</span>`);
        const lines = r.lines.length
            ? r.lines.slice(0, 5).map(l => `<div class="meg-wsed-line">${esc(l)}</div>`).join("") +
              (r.lines.length > 5 ? `<details class="meg-wsed-more"><summary>${r.lines.length - 5} more</summary>${r.lines.slice(5).map(l => `<div class="meg-wsed-line">${esc(l)}</div>`).join("")}</details>` : "")
            : `<div class="meg-wsed-line dim">No changes.</div>`;
        const action = e.source === "user"
            ? `<button type="button" class="meg-wsed-mini meg-sted-hdel" data-id="${esc(e.id)}" title="Delete this edit"><i class="fa-solid fa-trash"></i> Delete</button>`
            : `<button type="button" class="meg-wsed-mini meg-sted-htoggle" data-id="${esc(e.id)}" data-off="${e.disabled ? 1 : 0}">${e.disabled ? `<i class="fa-solid fa-rotate-right"></i> Turn on` : `<i class="fa-solid fa-rotate-left"></i> Turn off`}</button>`;
        return `
            <div class="meg-wsed-hrow ${r.active ? "" : "is-dim"}">
                <div class="meg-wsed-hhead"><span class="meg-wsed-where">${where}</span>${badges.join("")}<span class="meg-wsed-spacer"></span>${action}</div>
                ${lines}
            </div>`;
    };
    return `
        <div class="meg-wsed-section">
            <div class="meg-wsed-title"><i class="fa-solid fa-clock-rotate-left"></i> History
                <label class="meg-wsed-check"><input type="checkbox" class="meg-sted-allswipes" ${showAllSwipes ? "checked" : ""}/> show other swipes</label>
            </div>
            ${rows.map(rowHtml).join("") || `<div class="meg-wsed-empty">Nothing recorded yet.</div>`}
        </div>`;
}

// ── Popup ────────────────────────────────────────────────────────────────

/** One edited value as a field change; "" clears it. A meter keeps its max. */
function fieldChange(d, raw) {
    if (!raw) return { key: d.key, label: d.label, remove: true };
    const v = parseStatValue(raw);
    if (!v) return null;
    if (d.type === "meter" && v.value !== undefined && v.max === undefined && d.max) {
        v.max = Number(d.max);
        v.text = `${v.value}/${v.max}`;
    }
    return { key: d.key, label: d.label, ...v };
}

/** @param {{ view?: "bonds"|"sheet"|"history" }} [opts] */
export async function openStatsEditor({ view = "bonds" } = {}) {
    if (!getContext()?.chatId) {
        toastr.info("Open a chat first: bonds and the sheet belong to a chat.", "Megumin Suite");
        return;
    }
    let current = view;
    let showAllSwipes = false;
    let search = "";
    const $root = $(`<div class="meg-wsed meg-sted"></div>`);

    const commit = (moduleId, parsed) => {
        statsEdit(moduleId, parsed);
        meguminScheduleBlocksRefresh();
        draw();
    };

    function draw() {
        const scrollBox = $root.closest(".popup-content")[0] || $root[0];
        const keepScroll = scrollBox ? scrollBox.scrollTop : 0;
        const tab = (id, icon, label) => `<button type="button" class="meg-wsed-tab ${current === id ? "active" : ""}" data-view="${id}"><i class="fa-solid ${icon}"></i> ${label}</button>`;
        $root.html(`
            <div class="meg-wsed-top">
                <div class="meg-wsed-tabs">
                    ${tab("bonds", "fa-heart", "Bonds")}${tab("sheet", "fa-shield-halved", "Sheet")}${tab("history", "fa-clock-rotate-left", "History")}
                </div>
                <div class="meg-wsed-hint">Your edits are kept as your own changes: swipes, rewinds and deletes never undo them. Delete one from History to take it back. Clear a box to remove that value.</div>
            </div>
            ${current === "bonds" ? renderBondsView() : current === "sheet" ? renderSheetView() : renderHistoryView(showAllSwipes)}
        `);
        bind();
        if (search) $root.find(".meg-sted-search").val(search).trigger("input");
        if (scrollBox) scrollBox.scrollTop = keepScroll;
    }

    function bind() {
        $root.find(".meg-wsed-tab").on("click", function () { current = $(this).data("view"); draw(); });

        $root.find(".meg-sted-input").on("change", function () {
            const raw = String($(this).val() || "").trim();
            if (raw === String($(this).attr("data-was") || "")) return;
            const d = this.dataset;
            const f = fieldChange(d, raw);
            if (!f) { toastr.warning("That value was not understood.", "Megumin Suite"); return; }
            if (current === "sheet") commit("sheet", { kind: "delta", fields: [f] });
            else commit("bonds", { kind: "delta", people: [{ name: d.who, fields: [f] }] });
        }).on("keydown", function (e) { if (e.key === "Enter") this.blur(); });

        $root.find(".meg-sted-addchar").on("keydown", function (e) {
            if (e.key !== "Enter") return;
            const name = String($(this).val() || "").trim();
            if (!name) return;
            // Starts at the configured starting values.
            const fields = meguminStatFields("bonds")
                .filter(f => f.type === "meter" || f.type === "number")
                .map(f => {
                    const start = f.start !== undefined ? f.start : 0;
                    return f.type === "meter"
                        ? { key: statKey(f.label), label: f.label, text: `${start}/${f.max || 100}`, value: start, max: f.max || 100 }
                        : { key: statKey(f.label), label: f.label, text: String(start), value: start };
                });
            if (!fields.length) { toastr.warning("Bonds has no number fields to start from.", "Megumin Suite"); return; }
            commit("bonds", { kind: "delta", people: [{ name, fields }] });
        });

        $root.find(".meg-sted-forget").on("click", function () {
            const $b = $(this);
            if ($b.attr("data-armed") !== "1") {
                $b.attr("data-armed", "1").addClass("armed").html(`<i class="fa-solid fa-trash"></i> Forget?`);
                setTimeout(() => $b.attr("data-armed", "0").removeClass("armed").html(`<i class="fa-solid fa-trash"></i>`), 3000);
                return;
            }
            commit("bonds", { kind: "delta", people: [], forget: [this.dataset.who] });
        });

        $root.find(".meg-sted-search").on("input", function () {
            search = String($(this).val() || "");
            const q = search.toLowerCase().trim();
            $root.find(".meg-sted-person").each(function () {
                $(this).toggle(!q || String($(this).attr("data-name")).includes(q));
            });
        });

        // History
        $root.find(".meg-sted-allswipes").on("change", function () { showAllSwipes = this.checked; draw(); });
        $root.find(".meg-sted-htoggle").on("click", function () {
            statsSetEntryDisabled(this.dataset.id, this.dataset.off !== "1");
            meguminScheduleBlocksRefresh();
            draw();
        });
        $root.find(".meg-sted-hdel").on("click", function () {
            statsRemoveUserEntry(this.dataset.id);
            meguminScheduleBlocksRefresh();
            draw();
        });
    }

    draw();
    await new Popup($root, POPUP_TYPE.TEXT, "", { wide: true, large: true, allowVerticalScrolling: true, okButton: "Close" }).show();
    meguminScheduleBlocksRefresh();
}
