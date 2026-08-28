// ────────────────────────────────────────────────────────────────────────────
// Shared fragments — one value for the whole install, for the slots that were
// never really the engine's property in the first place.
//
// The problem this solves: to change one line of the MVU block, the only route
// used to be "clone an entire engine, edit the MVU box, save, switch to the
// clone". That clone is a frozen snapshot of p1..p6 taken at clone time, so
// when the stock engine later improves, the clone never sees it. People ended
// up stranded on stale engines because they wanted to reword one paragraph.
//
// It works because no engine CONTAINS the MVU text. Engines carry p1..p6, cot
// and prefill; [[MVU]] is filled by buildBaseDict from data/blocks.js. The slot
// is simply left open for the dictionary. So a value parked here is picked up
// by stock V7, stock V10 and a custom clone alike, without modifying any of
// them — and clearing it drops every one of them straight back to the built-in.
//
// Resolution order, applied identically by the engine and by the Dev Mode UI:
//
//     engine override  →  shared fragment  →  built-in default
//
// The engine override stays first only so that custom engines built before
// this existed keep behaving exactly as they did. It is not the normal path:
// Dev Mode does not create engine overrides for shared slots, it offers
// "Reset to shared" to remove one.
//
// Storage is extension_settings, not the profile, because the ask was global:
// one MVU for every character and every chat. localProfile would have scoped it
// per chat/character, which is a different feature.
// ────────────────────────────────────────────────────────────────────────────

import { extension_settings, saveSettingsDebounced } from "../st.js";
import { extensionName } from "./constants.js";
import { localProfile } from "./state.js";

/** The bucket, created on first read so callers never have to null-check it. */
export function getSharedFragments() {
    const store = extension_settings[extensionName];
    if (!store) return {};
    if (!store.sharedFragments) store.sharedFragments = {};
    return store.sharedFragments;
}

/** A single fragment, or "" when the reader has not set one. */
export function getSharedFragment(key) {
    if (!key) return "";
    return getSharedFragments()[key] || "";
}

export function hasSharedFragment(key) {
    return getSharedFragment(key).trim() !== "";
}

/**
 * Set or clear a fragment. Blank clears rather than storing an empty string —
 * an empty override and no override mean the same thing to the resolver, and
 * keeping the key would make "Customised" badges lie in the UI.
 */
export function setSharedFragment(key, value) {
    if (!key) return;
    const bag = getSharedFragments();
    if (!value || value.trim() === "") delete bag[key];
    else bag[key] = value;
    saveSettingsDebounced();
}

export function clearSharedFragment(key) {
    setSharedFragment(key, "");
}

/**
 * Where a slot's text is coming from right now.
 *
 * Returns { value, source } with source one of "engine", "shared", "builtin".
 * "builtin" carries the value the shipped data would supply, which is what the
 * editor shows greyed as the thing you are about to replace — buildBaseDict
 * deliberately does NOT write it, because the existing code already put it in
 * the dictionary and re-writing it would change nothing but add a way to break.
 */
export function resolveSlot(slot, engine) {
    if (!slot || !slot.key) return { value: "", source: "builtin" };

    const fromEngine = engine && engine[slot.key];
    if (typeof fromEngine === "string" && fromEngine.trim() !== "") {
        return { value: fromEngine, source: "engine" };
    }

    const fromShared = getSharedFragment(slot.key);
    if (fromShared.trim() !== "") {
        return { value: fromShared, source: "shared" };
    }

    // The profile goes to the fallback because one default is not fixed: two
    // dice add-ons share the [[dice]] anchor and are mutually exclusive, so
    // "the built-in text" depends on which variant is switched on. Every other
    // fallback ignores the argument.
    let builtin = "";
    try { builtin = (typeof slot.fallback === "function" ? slot.fallback(localProfile) : "") || ""; }
    catch { builtin = ""; }
    return { value: builtin, source: "builtin" };
}

/**
 * Does this engine carry its own value for a slot that is otherwise shared?
 * Only true for engines built before shared fragments existed, or imported
 * ones. Drives the "This engine overrides the shared version" notice.
 */
export function engineShadowsShared(slot, engine) {
    if (!slot || !slot.key || !engine) return false;
    if (slot.scope !== "shared") return false;
    const v = engine[slot.key];
    return typeof v === "string" && v.trim() !== "";
}
