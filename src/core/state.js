// ─────────────────────────────────────────────────────────────────────────────
// Cross-cutting mutable state.
//
// Only state that genuinely spans module boundaries lives here. Feature-local
// scratch (memory's query caches, the story-config open row, the blocks refresh
// timer, ...) stays inside its own feature module — hoisting it to a shared file
// would turn private bookkeeping into public API and make every feature look
// entangled with every other one.
//
// HOW THE LIVE BINDINGS WORK — read this before "simplifying" the setters away.
//
// An ES module export is a live binding: importers always observe the CURRENT
// value, so `import { localProfile } from ".../state.js"` re-reads correctly
// after initProfile() swaps the object. That is why ~490 read sites across the
// codebase need no change at all.
//
// What importers may NOT do is assign. `localProfile = x` in another module is a
// SyntaxError (assignment to an import binding). So every reassignment goes
// through the setter exported here. Property mutation (`localProfile.foo = 1`)
// is untouched by this rule and stays direct.
// ─────────────────────────────────────────────────────────────────────────────

// ── The active profile ───────────────────────────────────────────────────────
// Reassigned only by initProfile(); mutated in place by essentially every tab.
export let localProfile = {};
export function setLocalProfile(profile) {
    localProfile = profile;
}

// ── The profile key localProfile was last loaded from ────────────────────────
// The chat-switch flush uses it so a pending save lands under the OLD chat's
// key, not the one already selected. Read by the profile writer, the tab-sync
// helpers, the memory vault + vector-DB writers, and image gen.
export let _loadedProfileKey = null;
export function setLoadedProfileKey(key) {
    _loadedProfileKey = key;
}

// ── Which settings tab is open ───────────────────────────────────────────────
// Written by switchTab(); read by the global-sync helpers and several render
// functions that need to redraw only the tab currently on screen.
export let currentTab = 0;
export function setCurrentTab(index) {
    currentTab = index;
}

// ── Unsaved-changes guard for the custom engine editor ───────────────────────
// Set by the dev-mode editor, read by the modal close handler so closing with
// edits pending prompts instead of silently discarding.
export let isDevEngineDirty = false;
export function setDevEngineDirty(dirty) {
    isDevEngineDirty = dirty;
}
