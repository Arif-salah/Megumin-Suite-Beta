// ────────────────────────────────────────────────────────────────────────────
// State store ↔ SillyTavern.
//
// The one place that knows both sides: builds the store over the open chat's
// metadata, answers the prompt builder and the card renderer, and turns ST's
// chat events into store calls. Everything it calls into is pure and tested
// under node (tests/).
// ────────────────────────────────────────────────────────────────────────────

import { getContext, saveMetadataDebounced, saveChatDebounced, substituteParams, name1, generateQuietPrompt } from "../st.js";
import { runWithChomusuke } from "../engine/tasks.js";
import { setActiveWorldExtractRequest } from "../core/activeRequests.js";
import { localProfile } from "../core/state.js";
import { createStateStore } from "./store.js";
import { worldModule } from "./modules/world/index.js";
import { presentCast } from "./modules/world/model.js";
import {
    renderWorldForPrompt, renderWorldInstructions, renderWorldCard, findReturning, isEmptyWorld, describeWorldChange,
    renderWorldExtractPrompt
} from "./modules/world/render.js";

// Settings only: the state itself lives in the chat file, never in settings.json.
export const WORLD_SETTINGS_DEFAULTS = {
    updateMode: "inline",        // "inline" (automatic) | "manual". Who writes the automatic updates is Chomusuke's call: see worldUpdateMode()
    injectionDetail: "full",     // full | scene
    showReturning: true,
    showChanges: true,
    journalDepth: 200
};

export function worldSettings() {
    return { ...WORLD_SETTINGS_DEFAULTS, ...((localProfile && localProfile.worldState) || {}) };
}

/**
 * How replies update the World State right now:
 *   "manual"    — they don't (Blocks tab: Updates → Manual)
 *   "sidemodel" — Chomusuke reads each reply (Chomusuke tab: World State route on)
 *   "inline"    — the story model writes the block in its reply (everything else)
 * The Chomusuke route is decided in the Chomusuke tab with every other routed
 * feature, so the Blocks tab only says whether updates happen at all.
 */
export function worldUpdateMode() {
    if (worldSettings().updateMode === "manual") return "manual";
    const c = localProfile && localProfile.chomusuke;
    if (c && c.enabled && c.profileId && c.features && c.features.worldState === true) return "sidemodel";
    return "inline";
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
    if (worldUpdateMode() !== "inline") return null;
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
    const sideModel = worldUpdateMode() === "sidemodel";
    const pending = pendingExtract.has(uid + ":" + swipe);
    if (!entry) {
        // Side model: a reply not read yet (or being read right now).
        return sideModel
            ? { entry: null, pending, unread: true, sideModel, applied: [], notes: [], skipped: [], missing: false, disabled: false, noChanges: false }
            : null;
    }
    const step = entry.disabled ? null : stateStore.getStep("world", uid);
    return {
        entry,
        applied: (step?.applied || []).map(a => ({ ...a, label: sub(a.label) })),
        notes: step?.notes || [],
        skipped: entry.parsed?.skipped || [],
        missing: Boolean(entry.missing),
        disabled: Boolean(entry.disabled),
        noChanges: Boolean(entry.parsed?.noChanges),
        pending,
        sideModel,
        unread: false
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

// ── Side-model extraction ────────────────────────────────────────────────
// Mode "sidemodel" (Chomusuke tab: World State route on): the storytelling model
// is never asked for a block. After each reply Chomusuke's worker reads the
// latest exchange and writes
// the update, which is filed under that reply's swipe like any other entry.
// Runs one at a time; a result is dropped if the chat, or that swipe's text,
// changed while it was being written.

const pendingExtract = new Set();          // "uid:swipe" being read right now
let extractQueue = Promise.resolve();
let stateChangedHook = () => {};

/** Called whenever a background extraction starts or lands (cards redraw). */
export function setWorldStateChangedHook(fn) {
    stateChangedHook = typeof fn === "function" ? fn : () => {};
}

function hashText(t) {
    let h = 5381;
    const s = String(t || "");
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + ":" + s.length;
}

function swipeText(msg, swipe) {
    if (Array.isArray(msg.swipes) && typeof msg.swipes[swipe] === "string") return msg.swipes[swipe];
    const cur = typeof msg.swipe_id === "number" ? msg.swipe_id : 0;
    return cur === swipe ? String(msg.mes || "") : null;
}

function proseOnly(text) {
    return String(text || "")
        .replace(/<think\b[^>]*>[\s\S]*?(<\/think\s*>|$)/gi, "")
        .replace(/<Blocks\b[^>]*>[\s\S]*?(<\/Blocks\s*>|$)/gi, "")
        .replace(/<(World_State|World_Update)\b[^>]*>[\s\S]*?(<\/\1\s*>|$)/gi, "")
        .replace(/<img\b[^>]*>/gi, "")
        .trim();
}

// The reply plus the user turn(s) that led to it: a player's own message is
// often where their clothes change. A first snapshot gets a little more.
function exchangeFor(index, text, mode) {
    const chat = adapter.getChat();
    const parts = [];
    let aiSeen = 0;
    for (let i = index - 1; i >= 0; i--) {
        const m = chat[i];
        if (!m || m.is_system) continue;
        if (!m.is_user && mode !== "bootstrap") break;
        if (!m.is_user && ++aiSeen > 2) break;
        parts.unshift(`${m.name || (m.is_user ? sub("{{user}}") : "Narrator")}: ${proseOnly(m.mes)}`);
    }
    parts.push(`${adapter.getChat()[index]?.name || "Narrator"}: ${proseOnly(text)}`);
    return parts.join("\n\n");
}

/**
 * Reads one reply with the side model and files the result under its swipe.
 * @param {number} index
 * @param {{ force?: boolean }} [opts] force: read again even if it has an entry
 * @returns {Promise<boolean>} true when an entry was filed
 */
export function worldExtractMessage(index, { force = false } = {}) {
    if (!worldEnabled() || worldUpdateMode() !== "sidemodel" || !adapter.getMeta()) return Promise.resolve(false);
    const msg = adapter.getChat()[index];
    if (!msg || msg.is_user || msg.is_system) return Promise.resolve(false);
    const st = stateStore.stamp(msg);
    if (!st) return Promise.resolve(false);
    // The stamp lives in the message; without a save it would not survive a reload.
    if (st.dirty) adapter.saveChat();
    const uid = st.uid;
    const swipe = typeof msg.swipe_id === "number" ? msg.swipe_id : 0;
    const text = swipeText(msg, swipe);
    if (text == null) return Promise.resolve(false);            // still generating
    const key = uid + ":" + swipe;
    if (pendingExtract.has(key)) return Promise.resolve(false);
    if (!force && stateStore.getEntryFor("world", uid, swipe)) return Promise.resolve(false);

    const chatId = getContext()?.chatId;
    const hash = hashText(text);
    pendingExtract.add(key);
    stateChangedHook();

    const run = async () => {
        let out = null;
        let req = null;
        try {
            // Built when its turn comes, so a queued read sees the entries that
            // landed before it.
            const before = stateStore.getStateAt("world", st.seq - 0.5);
            const mode = isEmptyWorld(before) ? "bootstrap" : "update";
            const notes = mode === "bootstrap" ? "" : sub(renderWorldForPrompt(before, { detail: "full" }));
            const built = renderWorldExtractPrompt({ notes, exchange: exchangeFor(index, text, mode), mode });
            req = { system: sub(built.system), user: sub(built.user), prefill: built.prefill };
            setActiveWorldExtractRequest(req);
            out = await runWithChomusuke("worldState", () =>
                generateQuietPrompt({ prompt: "___PS_WORLD_EXTRACT___", quietPrompt: "___PS_WORLD_EXTRACT___" }));
        } catch (e) {
            console.error("[Megumin-Suite] World State side-model read failed", e);
        } finally {
            setActiveWorldExtractRequest(null);
            pendingExtract.delete(key);
        }

        // Same chat, same message, same text? Otherwise the answer is about
        // something that no longer exists.
        const chatNow = adapter.getChat();
        const at = chatNow.findIndex(m => m?.extra?.megumin_uid === uid);
        const textNow = at >= 0 ? swipeText(chatNow[at], swipe) : null;
        if (getContext()?.chatId !== chatId || at < 0 || textNow == null || hashText(textNow) !== hash) {
            console.debug("[Megumin-Suite] World State side-model result dropped: the reply changed or is gone.");
            stateChangedHook();
            return false;
        }

        let cleaned = String(out || "").replace(/<think\b[^>]*>[\s\S]*?(<\/think\s*>|$)/gi, "").trim();
        if (cleaned && req && !/<World_(State|Update)\b/i.test(cleaned)) cleaned = req.prefill + cleaned;
        const parsed = cleaned ? worldModule.parse(cleaned) : null;
        stateStore.recordMessage(at, { source: "sidemodel", expect: true, moduleIds: ["world"], swipe, parsed: parsed || null });
        if (!parsed) {
            toastr.warning("Chomusuke gave no usable World State update for that reply. Use Read again on its card.", "Megumin Suite");
        } else if (parsed.skipped.length) {
            console.debug(`[Megumin-Suite] World State (side model): lines not understood in message ${at}:`, parsed.skipped);
        }
        stateChangedHook();
        return true;
    };

    const p = extractQueue.then(run, run);
    extractQueue = p.catch(() => {});
    return p;
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
    return worldEnabled() && worldUpdateMode() !== "manual";
}

export function stateOnMessageReceived(messageId, type) {
    if (!repliesUpdate() || !adapter.getMeta()) return false;
    const chat = adapter.getChat();
    const index = typeof messageId === "number" ? messageId : chat.length - 1;
    const msg = chat[index];
    if (!msg || msg.is_user || msg.is_system) return false;
    stateStore.reconcile();
    const mode = worldUpdateMode();
    if (mode === "sidemodel") {
        // A reply that wrote its own block anyway is taken as it is; otherwise
        // the side model reads it (not awaited: the chat must not wait on it).
        if (worldModule.parse(String(msg.mes || ""))) {
            stateStore.recordMessage(index, { moduleIds: ["world"] });
            return true;
        }
        if (!NOT_A_REPLY.has(type)) worldExtractMessage(index, { force: type === "continue" });
        return false;
    }
    const expect = mode === "inline" && !NOT_A_REPLY.has(type);
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
    const mode = worldUpdateMode();
    // Side model: an edit keeps the entry the side model wrote, unless the edit
    // itself put a World block in (then that is what the user meant). "Read
    // again" on the card re-reads the edited text.
    if (mode === "sidemodel" && !worldModule.parse(String(msg.mes || ""))) return false;
    const expect = mode === "inline";
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
