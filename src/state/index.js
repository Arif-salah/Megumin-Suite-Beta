// ────────────────────────────────────────────────────────────────────────────
// State store ↔ SillyTavern.
//
// The one place that knows both sides: builds the store over the open chat's
// metadata, answers the prompt builder and the card renderer, and turns ST's
// chat events into store calls. Everything it calls into is pure and tested
// under node (tests/).
// ────────────────────────────────────────────────────────────────────────────

import { getContext, saveMetadataDebounced, saveChatDebounced, substituteParams, name1 } from "../st.js";
import { localProfile } from "../core/state.js";
import { createStateStore } from "./store.js";
import { worldModule } from "./modules/world/index.js";
import { presentCast } from "./modules/world/model.js";
import {
    renderWorldForPrompt, renderWorldInstructions, renderWorldCard, findReturning, isEmptyWorld, describeWorldChange
} from "./modules/world/render.js";

// Settings only: the state itself lives in the chat file, never in settings.json.
export const WORLD_SETTINGS_DEFAULTS = {
    updateMode: "inline",        // inline | sidemodel | manual
    injectionDetail: "full",     // full | scene
    showReturning: true,
    showChanges: true,
    journalDepth: 200
};

export function worldSettings() {
    return { ...WORLD_SETTINGS_DEFAULTS, ...((localProfile && localProfile.worldState) || {}) };
}

/** The World State block is switched on in the block stack. */
export function worldEnabled() {
    return Boolean(localProfile && Array.isArray(localProfile.blocks) && localProfile.blocks.includes("info"));
}

function sub(text) {
    try { return typeof substituteParams === "function" ? substituteParams(text) : text; } catch (e) { return text; }
}

const adapter = {
    getChat: () => getContext()?.chat || [],
    getMeta: () => {
        const ctx = getContext();
        if (!ctx || !ctx.chatId) return null;   // no chat open: nowhere to keep state
        return ctx.chatMetadata || null;
    },
    saveMeta: () => saveMetadataDebounced(),
    saveChat: () => saveChatDebounced(),
    getUserNames: () => {
        const names = [];
        try { if (name1) names.push(name1); } catch (e) { /* not ready */ }
        const u = sub("{{user}}");
        if (u && u !== "{{user}}") names.push(u);
        return names;
    }
};

export const stateStore = createStateStore({
    adapter,
    modules: { world: worldModule },
    journalDepth: () => worldSettings().journalDepth
});

// ── Reading ──────────────────────────────────────────────────────────────

export function getWorldState() {
    return stateStore.getState("world");
}

export function worldHasState() {
    return worldEnabled() && stateStore.hasState("world");
}

function recentText() {
    const chat = adapter.getChat();
    const parts = [];
    for (let i = chat.length - 1; i >= 0 && parts.length < 3; i--) {
        const m = chat[i];
        if (!m || m.is_system) continue;
        parts.push(String(m.mes || "").replace(/<[^>]+>/g, " "));
    }
    return parts.join(" ");
}

/** [[infoblockcurrent]]: the continuity notes, or "" when there is nothing yet. */
export function worldPromptBlock() {
    if (!worldHasState()) return "";
    const cfg = worldSettings();
    const state = getWorldState();
    const returning = cfg.showReturning ? findReturning(state, recentText()) : [];
    return sub(renderWorldForPrompt(state, { detail: cfg.injectionDetail, returning }));
}

/**
 * What the <Blocks> envelope asks the model to write for World State, or null
 * when the main model is not asked (side-model or manual mode, or block off).
 * @returns {{ rules: string, template: string, mode: string } | null}
 */
export function worldBlockRequest() {
    if (!worldEnabled()) return null;
    if (worldSettings().updateMode !== "inline") return null;
    const mode = !stateStore.hasState("world") || stateStore.isPendingFullRewrite("world") ? "bootstrap" : "update";
    const ins = renderWorldInstructions(mode);
    return { rules: sub(ins.rules), template: sub(ins.template), mode };
}

/** The card body for one message: the world as it stood right after it. */
export function worldCardTextAt(msgIndex) {
    if (!worldEnabled()) return "";
    const msg = adapter.getChat()[msgIndex];
    const seq = msg?.extra?.megumin_seq;
    const state = typeof seq === "number" ? stateStore.getStateAt("world", seq) : getWorldState();
    if (isEmptyWorld(state)) return "";
    return sub(renderWorldCard(state, { pcName: sub("{{user}}") }));
}

/**
 * The old ledger's shape, for Image Gen and the NPC tag relevance until they
 * are rebuilt on the store (task 006). Only the PRESENT cast has outfits here.
 */
export function getWorldStateCurrent() {
    if (!worldHasState()) return null;
    const s = getWorldState();
    const npcOutfits = {};
    for (const c of presentCast(s)) if (c.fields.outfit) npcOutfits[c.name] = c.fields.outfit;
    return {
        dateTime: s.scene.time || "",
        location: s.scene.location || "",
        weather: s.scene.weather || "",
        pc: {
            name: s.pc.name || sub("{{user}}"),
            outfit: s.pc.fields.outfit || "",
            position: s.pc.fields.position || "",
            condition: s.pc.fields.condition || "",
            carrying: s.pc.fields.carrying || ""
        },
        npcOutfits
    };
}

// ── Card and editor ──────────────────────────────────────────────────────

/**
 * What one message's shown swipe did to the World State, for its card.
 * @returns {null | { entry: object, applied: any[], notes: string[], skipped: string[], missing: boolean, disabled: boolean, noChanges: boolean }}
 */
export function worldCardInfo(msgIndex) {
    if (!worldEnabled() || !adapter.getMeta()) return null;
    const msg = adapter.getChat()[msgIndex];
    const uid = msg?.extra?.megumin_uid;
    if (!msg || msg.is_user || !uid) return null;
    const swipe = typeof msg.swipe_id === "number" ? msg.swipe_id : 0;
    const entry = stateStore.getEntryFor("world", uid, swipe);
    if (!entry) return null;
    const step = entry.disabled ? null : stateStore.getStep("world", uid);
    return {
        entry,
        applied: (step?.applied || []).map(a => ({ ...a, label: sub(a.label) })),
        notes: step?.notes || [],
        skipped: entry.parsed?.skipped || [],
        missing: Boolean(entry.missing),
        disabled: Boolean(entry.disabled),
        noChanges: Boolean(entry.parsed?.noChanges)
    };
}

/** A manual edit from the editor. Returns the entry, or null with no chat open. */
export function worldEdit(changes) {
    if (!adapter.getMeta() || !Array.isArray(changes) || !changes.length) return null;
    return stateStore.addUserEntry("world", { kind: "delta", changes, skipped: [], noChanges: false });
}

export function worldSetEntryDisabled(entryId, disabled) {
    return stateStore.setDisabled(entryId, disabled);
}

export function worldRemoveUserEntry(entryId) {
    return stateStore.removeUserEntry(entryId);
}

/** History rows, newest first, with each change as a readable line. */
export function worldHistory() {
    const pcLabel = sub("{{user}}");
    return stateStore.listEntries("world").reverse().map(row => ({
        ...row,
        lines: (row.entry.parsed?.changes || []).map(ch => sub(describeWorldChange(ch, pcLabel))).filter(Boolean)
    }));
}

/** Re-reads World blocks from messages from..to (0-based, inclusive). */
export function worldImportRange(fromIndex, toIndex) {
    if (!adapter.getMeta()) return 0;
    return stateStore.importFromChat("world", { fromIndex, toIndex, force: true });
}

export function worldChatOpen() {
    return Boolean(adapter.getMeta());
}

// ── ST events ────────────────────────────────────────────────────────────
// Each returns true when something changed, so the caller can redraw cards.
//
// A chat that has never used World State is left alone entirely: no stamps in
// its messages, no empty store in its metadata. Undo handling still runs for a
// chat that HAS a store even while the block is switched off, so turning it
// back on later finds the state consistent.

function hasRoot() {
    const meta = adapter.getMeta();
    return Boolean(meta && meta.megumin_state);
}

function inPlay() {
    return Boolean(adapter.getMeta()) && (worldEnabled() || hasRoot());
}

const NOT_A_REPLY = new Set(["first_message", "command", "impersonate", "quiet"]);

// Manual mode: the state is read, never written by replies.
function repliesUpdate() {
    return worldEnabled() && worldSettings().updateMode !== "manual";
}

export function stateOnMessageReceived(messageId, type) {
    if (!repliesUpdate() || !adapter.getMeta()) return false;
    const chat = adapter.getChat();
    const index = typeof messageId === "number" ? messageId : chat.length - 1;
    const msg = chat[index];
    if (!msg || msg.is_user || msg.is_system) return false;
    stateStore.reconcile();
    const expect = worldSettings().updateMode === "inline" && !NOT_A_REPLY.has(type);
    const { recorded } = stateStore.recordMessage(index, { expect, moduleIds: ["world"] });
    for (const e of recorded) {
        if (e.parsed.skipped.length) console.debug(`[Megumin-Suite] World State: lines not understood in message ${index}:`, e.parsed.skipped);
    }
    return recorded.length > 0;
}

// Swiping switches which swipe's changes count; a swipe that was never
// recorded (older than this feature, or an alternate greeting) is parsed now.
// A swipe being generated is left to MESSAGE_RECEIVED — see store.onSwiped for
// why its text must not be read here.
export function stateOnSwiped(messageId) {
    if (!inPlay()) return false;
    const chat = adapter.getChat();
    const index = typeof messageId === "number" ? messageId : chat.length - 1;
    if (!repliesUpdate()) {
        stateStore.reconcile();
        return true;
    }
    stateStore.onSwiped(index, { moduleIds: ["world"] });
    return true;
}

export function stateOnSwipeDeleted(data) {
    if (!inPlay() || !data) return false;
    stateStore.onSwipeDeleted(data.messageId, data.swipeId);
    stateStore.reconcile();
    return true;
}

export function stateOnEdited(messageId) {
    if (!repliesUpdate() || !adapter.getMeta()) return false;
    const msg = adapter.getChat()[messageId];
    if (!msg || msg.is_user) return false;
    const expect = worldSettings().updateMode === "inline";
    const { folded } = stateStore.recordMessage(messageId, { expect, moduleIds: ["world"] });
    if (folded) toastr.info("That message is older than the undo window, so editing it no longer changes the World State. Use the World State editor instead.", "Megumin Suite");
    return !folded;
}

export function stateOnDeleted() {
    if (!inPlay()) return false;
    const { orphaned, dropped } = stateStore.reconcile();
    const kept = orphaned.filter(e => e.module === "world" && !e.missing && e.parsed.changes.length).length;
    if (kept) {
        toastr.info(
            `World State changes from ${kept} deleted message${kept === 1 ? " were" : "s were"} kept. Old messages being removed doesn't undo the story.`,
            "Megumin Suite"
        );
    }
    return orphaned.length > 0 || dropped.length > 0;
}

/** Chat opened or reloaded: stamp, square with deletions made meanwhile, one-time import. */
export function stateOnChatLoaded() {
    if (!inPlay()) return false;
    if (worldEnabled()) stateStore.stampAll();
    stateStore.reconcile();
    if (worldEnabled() && !stateStore.root()?.imported?.world) {
        const n = stateStore.importFromChat("world");
        if (n > 0) {
            toastr.info(`Picked up the World State from this chat's existing messages (${n}).`, "Megumin Suite");
        }
    }
    return true;
}
