// ────────────────────────────────────────────────────────────────────────────
// Image Gen V2 — looks: scans, the review popup, natural descriptions, and the
// automatic look for a character who just arrived (+ Name in World State).
//
// Established looks change only when the user clicks a scan, and then only
// through the review popup. The automatic scan only ever ADDS a look for
// someone who has none.
// ────────────────────────────────────────────────────────────────────────────

import { getContext, generateQuietPrompt, Popup, POPUP_TYPE } from "../../../st.js";
import { localProfile } from "../../../core/state.js";
import { saveProfileToMemory } from "../../../core/profile.js";
import { setActiveImageGenRequest } from "../../../core/activeRequests.js";
import { runWithChomusuke } from "../../../engine/tasks.js";
import { meguminCleanChatHistoryText } from "../../../engine/chatText.js";
import { worldEnabled, worldHasState, getWorldState } from "../../../state/index.js";
import { presentCast } from "../../../state/modules/world/model.js";
import { buildCharacterSheets } from "../classic/prompt.js";
import { getLooks } from "./index.js";
import {
    LOOK_SCAN_SYSTEM, renderLookScanPrompt, parseLookBlocks, planLookUpdates, findLookKey,
    NATURAL_SYSTEM, renderNaturalPrompt, parseNaturalBlocks, matchScanToTargets
} from "./looksCore.js";

const esc = v => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// One background call through Chomusuke's Image Generation route (or the main
// model when that route is off). The marker is set inside the job: Chomusuke
// runs are queued.
async function ask(system, user) {
    const raw = await runWithChomusuke("imageGen", async () => {
        setActiveImageGenRequest({ v2: { system, user } });
        try {
            return await generateQuietPrompt({ prompt: "___PS_IMAGE_GEN___" });
        } finally {
            setActiveImageGenRequest(null);
        }
    });
    return String(raw || "");
}

function chatSource(count = 30) {
    const chat = (getContext() && getContext().chat) || [];
    return chat.filter(m => m && !m.is_system).slice(-count)
        .map(m => `${m.name}: ${meguminCleanChatHistoryText(m.mes)}`).join("\n\n");
}

function sheetSource() {
    return buildCharacterSheets().replace(/^Use these sheets for what each character looks like:\s*/, "").trim();
}

function writeLook(looks, item, source) {
    const k = item.key;
    const cur = looks[k] || {};
    const aliases = [...(cur.aliases || [])];
    for (const a of item.aliases || []) {
        if (a && a.toLowerCase() !== k.toLowerCase() && !aliases.some(x => x.toLowerCase() === a.toLowerCase())) aliases.push(a);
    }
    // New tags make an old natural description stale; it is remade on request.
    const natural = cur.tags && cur.tags !== item.tags ? "" : (cur.natural || "");
    looks[k] = { ...cur, tags: item.tags, natural, aliases, locked: Boolean(cur.locked), source, updatedAt: Date.now() };
}

// ── The review popup (established looks) ────────────────────────────────

async function reviewChanges(plan) {
    if (!plan.change.length) return [];
    const rows = plan.change.map((c, i) => `
        <div class="ig2-review-row">
            <div class="ig2-review-name"><b>${esc(c.key)}</b></div>
            <div class="ig2-review-tags"><span>Now</span>${esc(c.old)}</div>
            <div class="ig2-review-tags new"><span>Scan</span>${esc(c.tags)}</div>
            <div class="ig2-review-pick">
                <label><input type="radio" name="ig2r${i}" value="keep" checked> Keep</label>
                <label><input type="radio" name="ig2r${i}" value="new"> Use new</label>
            </div>
        </div>`).join("");
    const $body = $(`
        <div class="ig2-review">
            <div class="ig2-review-head">The scan found a different look for ${plan.change.length === 1 ? "this character" : "these characters"}. Choose what to keep:</div>
            <div class="ig2-review-all">
                <button type="button" class="menu_button ig2-keep-all">Keep all</button>
                <button type="button" class="menu_button ig2-use-all">Use all new</button>
            </div>
            ${rows}
            ${plan.locked.length ? `<div class="ig2-review-locked"><i class="fa-solid fa-lock"></i> Locked, not changed: ${plan.locked.map(l => esc(l.key)).join(", ")}</div>` : ""}
        </div>
    `);
    $body.find(".ig2-keep-all").on("click", () => $body.find('input[value="keep"]').prop("checked", true));
    $body.find(".ig2-use-all").on("click", () => $body.find('input[value="new"]').prop("checked", true));
    const ok = await new Popup($body, POPUP_TYPE.CONFIRM, "Review looks", { okButton: "Apply", cancelButton: "Keep all", wide: true }).show();
    if (!ok) return [];
    return plan.change.filter((c, i) => $body.find(`input[name="ig2r${i}"]:checked`).val() === "new");
}

// ── Scans ────────────────────────────────────────────────────────────────

/**
 * @param {{ from: "sheet"|"chat", targets?: Array<{ name: string, aliases?: string[] }>, interactive?: boolean }} opts
 *   targets: only these characters (by name or nickname); empty = everyone the text describes.
 *   interactive: false (the automatic scan) only ever adds missing looks.
 * @returns {Promise<{ added: string[], changed: string[], locked: string[], same: string[] } | null>}
 */
export async function scanLooks({ from, targets = [], interactive = true }) {
    const names = targets.map(t => t.name);
    const source = from === "sheet" ? sheetSource() : chatSource();
    if (!source) {
        if (interactive) toastr.info(from === "sheet" ? "No character or persona description to read." : "The chat is empty.", "Megumin Suite");
        return null;
    }
    const chatAtStart = getContext()?.chatId;
    const user = renderLookScanPrompt({ source, sourceLabel: from === "sheet" ? "Character_Sheets" : "Recent_Story", names });
    const raw = await ask(LOOK_SCAN_SYSTEM, user);
    if (getContext()?.chatId !== chatAtStart) return null; // the user moved on: this belongs to another chat

    const scanned = matchScanToTargets(parseLookBlocks(raw), targets);
    if (!scanned.length) {
        if (interactive) toastr.warning("The scan found no appearance to use.", "Megumin Suite");
        return { added: [], changed: [], locked: [], same: [] };
    }

    const looks = getLooks();
    const plan = planLookUpdates(looks, scanned);
    const src = from === "sheet" ? "sheet" : "chat";
    for (const item of plan.add) writeLook(looks, item, src);
    const accepted = interactive ? await reviewChanges(plan) : [];
    for (const item of accepted) writeLook(looks, item, src);
    // Nicknames the scan found are worth keeping even where the tags were not.
    for (const item of [...plan.same, ...plan.locked, ...plan.change]) {
        const cur = looks[item.key];
        if (!cur) continue;
        cur.aliases = cur.aliases || [];
        for (const a of item.aliases) if (!cur.aliases.some(x => x.toLowerCase() === a.toLowerCase()) && a.toLowerCase() !== item.key.toLowerCase()) cur.aliases.push(a);
    }
    saveProfileToMemory();

    const result = {
        added: plan.add.map(x => x.key),
        changed: accepted.map(x => x.key),
        locked: plan.locked.map(x => x.key),
        same: plan.same.map(x => x.key)
    };
    if (interactive) {
        const bits = [];
        if (result.added.length) bits.push(`added ${result.added.join(", ")}`);
        if (result.changed.length) bits.push(`updated ${result.changed.join(", ")}`);
        if (!bits.length) bits.push("no changes");
        toastr.success(`Looks: ${bits.join("; ")}.`, "Megumin Suite");
    }
    return result;
}

/** Natural descriptions for the given looks (default: every look without one). */
export async function describeLooks(names = null) {
    const looks = getLooks();
    const targets = Object.entries(looks)
        .filter(([k, v]) => v && String(v.tags || "").trim() && (names ? names.includes(k) : !String(v.natural || "").trim()))
        .map(([k, v]) => ({ name: k, tags: v.tags }));
    if (!targets.length) {
        toastr.info("Every look already has a description.", "Megumin Suite");
        return 0;
    }
    const chatAtStart = getContext()?.chatId;
    const raw = await ask(NATURAL_SYSTEM, renderNaturalPrompt(targets));
    if (getContext()?.chatId !== chatAtStart) return 0;
    let n = 0;
    for (const d of parseNaturalBlocks(raw)) {
        const k = findLookKey(looks, d.name);
        if (k && looks[k]) { looks[k].natural = d.natural; n++; }
    }
    saveProfileToMemory();
    toastr[n ? "success" : "warning"](n ? `Described ${n} look${n === 1 ? "" : "s"}.` : "No descriptions came back.", "Megumin Suite");
    return n;
}

// ── A character just arrived ─────────────────────────────────────────────

const attempted = new Set();   // "chatId|name": one automatic try per character per chat

/**
 * Someone in the scene has no look (and no NPC Bank tags): read one for them
 * from the recent chat, in the background, and add it. Never changes an
 * existing look. Only while V2 is the active image engine.
 */
export function v2LooksForArrivals() {
    const ig = localProfile && localProfile.imageGen;
    if (!ig || !ig.enabled || ig.engine !== "v2" || !worldEnabled() || !worldHasState()) return;
    const chatId = getContext()?.chatId;
    if (!chatId) return;
    const looks = getLooks();
    const npcs = (localProfile.npcBank && localProfile.npcBank.npcs) || [];
    const missing = presentCast(getWorldState()).filter(c => {
        if (attempted.has(`${chatId}|${c.name.toLowerCase()}`)) return false;
        const k = findLookKey(looks, c.name, c.aliases || []);
        if (k && String(looks[k].tags || "").trim()) return false;
        return !npcs.some(n => n && n.name && n.name.toLowerCase() === c.name.toLowerCase() && String(n.imageTags || "").trim());
    }).map(c => ({ name: c.name, aliases: c.aliases || [] }));
    if (!missing.length) return;
    missing.forEach(t => attempted.add(`${chatId}|${t.name.toLowerCase()}`));
    scanLooks({ from: "chat", targets: missing, interactive: false })
        .then(r => { if (r && r.added.length) toastr.info(`New look${r.added.length === 1 ? "" : "s"} for ${r.added.join(", ")}.`, "Megumin Suite", { timeOut: 3500 }); })
        .catch(e => console.error("[Megumin-Suite] Automatic look scan failed", e));
}
