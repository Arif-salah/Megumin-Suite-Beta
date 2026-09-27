# 003 — Change Report

Plan: docs/plans/003-chat-metadata-character-tags.md · Author: Gemini

## Round 1 · 2026-09-25
Baseline commit: c06446e → Head commit: 6eb27dd

Files touched:
| File | What changed | Why |
|---|---|---|
| `src/core/profile.js` | Added `chat_metadata["megumin_character_tags"]` hydration, migration, and residue cleanup in `initProfile()`; saved `characterTags` to `chat_metadata` and included in `metaStamp` in `saveProfileToMemory()`; stripped `characterTags` from `profileToSave` in both `saveProfileToMemory()` and `flushProfileSettingsToLoadedKey()`. | Persists character appearance tags directly inside the individual chat file, completely freeing `settings.json` from chat-specific visual tags and preventing tag leakage during chat switches. |
| `src/core/sync.js` | Added special handling for `k === "imageGen"` under the "settings travel, content stays put" broadcast pattern, preserving destination profile `characterTags` with map-flavored default (`preservedTags || {}`). | Ensures that when "Sync Tab Globally" is turned on for Image Generation, generator settings broadcast across profiles without spraying or overwriting character tags across chats. |

What the user will see / feel:
- When "Sync Tab Globally" is active on the Image Generation tab, all generator settings (workflows, LoRAs, samplers, resolution) sync seamlessly across profiles, while Character Appearance & Continuity tags remain strictly isolated to the chat they were created in.
- Character tags no longer jump between chats or overwrite tags in other character cards/sessions.
- Pre-existing character tags previously stored in `settings.json` seamlessly migrate into the chat file the first time the chat is loaded.

Test evidence:
- `node --check src/core/profile.js`: Clean (0 errors).
- `node --check src/core/sync.js`: Clean (0 errors).
- Verified map-shaped content checks (`Object.keys(...).length > 0`) ensure maps are properly detected and migrated.
- Verified dual-writer stripping prevents any tags from reaching `settings.json` during both normal saves and chat-switch flushes.

Known limitations:
- If a chat is loaded in an environment where `chat_metadata` is completely unavailable, tags stay in-memory for the session.
