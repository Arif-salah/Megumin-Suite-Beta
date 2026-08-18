// ─────────────────────────────────────────────────────────────────────────────
// UI refresh hooks.
//
// THE PROBLEM THIS SOLVES
//
// Loading a profile, or pruning data after a chat rewind, changes what several
// tabs are showing. The old code handled that by calling the renderers directly:
// initProfile() called updateMemoryVisuals() and toggleQuickGenButton();
// pruneFutureData() called memRenderDashboard(), memRenderAccordion(),
// memRenderVault() and renderNpcList().
//
// That made the profile layer depend on the Memory Core, the NPC bank and image
// gen — while all three of those already depend on the profile layer to save
// themselves. Extracted as-is, that is an import cycle in both directions, and it
// would have forced core/profile.js to import from six feature modules.
//
// THE FIX
//
// Features register a refresh callback; the profile layer fires it by name and
// never learns who is listening. Dependencies now point one way: features → core.
//
// A hook nobody registered is a no-op, which is the behaviour we want — the
// original calls all ran against renderers that quietly did nothing when their
// tab was not on screen.
// ─────────────────────────────────────────────────────────────────────────────

const _hooks = new Map();

// Register a refresh callback. Call this from a feature's module scope.
// Registering the same name twice replaces the previous callback rather than
// stacking, so a hot-reloaded module cannot end up firing twice.
export function registerRefreshHook(name, fn) {
    if (typeof fn === "function") _hooks.set(name, fn);
}

// Fire one hook. Unknown names are ignored on purpose.
//
// A throwing hook is caught and logged rather than propagated: these fire from
// the middle of initProfile() and saveProfileToMemory(), and a broken renderer
// must not be able to abort a profile load or leave a save half-applied.
export function fireRefreshHook(name, ...args) {
    const fn = _hooks.get(name);
    if (!fn) return;
    try {
        return fn(...args);
    } catch (e) {
        console.error(`[Megumin Suite] Refresh hook "${name}" failed:`, e);
    }
}

// Fire several in order. Convenience for the prune path, which refreshes four.
export function fireRefreshHooks(...names) {
    for (const n of names) fireRefreshHook(n);
}

// The hook names in use. Kept here as the one list of what exists, so a typo at
// either end is visible next to its counterpart rather than silently doing
// nothing forever.
export const REFRESH = {
    MEMORY_VISUALS: "memory:visuals",
    MEMORY_DASHBOARD: "memory:dashboard",
    MEMORY_ACCORDION: "memory:accordion",
    MEMORY_VAULT: "memory:vault",
    NPC_LIST: "npc:list",
    QUICK_GEN_BUTTON: "imagegen:quickGenButton",

    // Not a redraw: tells the Memory Core its vault-retrieval cache no longer
    // matches the data behind it, after a prune has removed entries.
    MEMORY_CACHE_INVALIDATE: "memory:invalidateVaultCache",

    // Rewinding the chat moves the working window back over messages that were
    // already archived, leaving them both dimmed and stripped from the prompt.
    // This asks the Memory Core to hand those back. Unlike the others it RETURNS
    // a value — true when it removed archives — so the prune knows to save.
    MEMORY_SCRUB_OVERLAPS: "memory:scrubOverlappingArchives",

    // Redraws the token counter in the settings footer. It lives outside
    // profile.js because counting tokens means building the whole prompt, which
    // sits above the profile layer.
    TOKEN_COUNT: "ui:tokenCount",

    // Fired after a save so a tab marked "Global" re-broadcasts itself. Gated on
    // the settings window being open, which is why it is UI and not core/sync.
    TAB_PROPAGATE: "ui:propagateSyncedTab",

    // Redraw a settings tab. With no argument it redraws whichever is on screen,
    // which is what a tab does to itself after changing a setting that alters its
    // own layout; with an index it navigates.
    //
    // This exists so the tab renderers do not have to import the tab list in order
    // to redraw themselves. The list has to import THEM — it is what maps a tab to
    // its render function — so an import back the other way would be a cycle, and
    // the renderers would drag the whole settings shell in behind them.
    SWITCH_TAB: "ui:switchTab",
};
