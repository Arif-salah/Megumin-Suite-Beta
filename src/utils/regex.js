// Escape a string for literal use inside a RegExp.
//
// Three callers in three different layers (the chat cleaner, the profile's NPC
// pruning, and the prompt injector's trigger stripping), so it belongs to none
// of them.

export function escapeRegex(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
