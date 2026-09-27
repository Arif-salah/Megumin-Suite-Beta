# 003 — Chat Metadata Character Appearance Tags & Global Sync Protection

Status: DONE
Date: 2026-09-25 · Author: Gemini · Reviewer: Pi

## Goal
Save Character Appearance tags (`characterTags`) directly inside the chat file (`chat_metadata["megumin_character_tags"]`), strip them from `settings.json` across all save/flush paths, and protect them from global tab synchronization so character visual tags never leak or jump across chats.

## What the user will see / feel
- When the user enables "Sync Tab Globally" on the Image Generation tab, their preferred ComfyUI workflows, LoRAs, samplers, and resolutions propagate smoothly across all character profiles, but their character appearance tags stay strictly isolated inside the chat where they belong.
- When opening different chats or different character cards, each chat maintains its own distinct character visual identity tags without being overwritten by or contaminating other stories.
- Existing character tags saved previously under `settings.json` seamlessly migrate into the chat file on first load.

## In scope
1. **Chat File Loading & Migration (`src/core/profile.js` - `initProfile`):**
   - Check `chat_metadata["megumin_character_tags"]`. If present, hydrate `localProfile.imageGen.characterTags = chat_metadata["megumin_character_tags"].characterTags || {}`.
   - Migration fallback: if `chat_metadata` lacks `megumin_character_tags`, but `localProfile.imageGen.characterTags` exists and has content (explicitly tested via map content check: `Object.keys(localProfile.imageGen.characterTags || {}).length > 0`), seed `chat_metadata["megumin_character_tags"] = { characterTags: localProfile.imageGen.characterTags || {} }` and call `saveMetadata()`.
   - Add `charTags: !!(chat_metadata && chat_metadata["megumin_character_tags"])` to `metaHadOnEntry`.
   - Drop residue from `settings.json`: once confirmed that chat metadata carries `megumin_character_tags`, delete `stored.imageGen.characterTags` from `extension_settings.Megumin.profiles[activeKey]` (mirroring the memory, plan, and npcBank cleanup pattern).

2. **Chat File Saving & settings.json Strip Across Both Writers (`src/core/profile.js`):**
   - In `saveProfileToMemory()`, when `chat_metadata` is available, save `localProfile.imageGen.characterTags` into `chat_metadata["megumin_character_tags"].characterTags` (content check: `Object.keys(charTags || {}).length > 0 || chat_metadata["megumin_character_tags"] !== undefined`).
   - Add `chat_metadata["megumin_character_tags"]` to `hasAnyBlock` and include it in `metaStamp` serialization so any changes to character tags immediately trigger `saveMetadata()`.
   - Strip `characterTags` in **BOTH writers** to prevent chat-switch leaks:
     - In `saveProfileToMemory()`: `if (profileToSave.imageGen) delete profileToSave.imageGen.characterTags;`
     - In `flushProfileSettingsToLoadedKey()` (regression H8 chat-switch flush): `if (profileToSave.imageGen) delete profileToSave.imageGen.characterTags;`

3. **Global Tab Sync Isolation (`src/core/sync.js` - `applyTabKeysToAllProfiles`):**
   - In `applyTabKeysToAllProfiles(title)`, add special handling for `k === "imageGen"` under the *"settings travel, content stays put"* pattern (alongside `storyPlan`, `npcBank`, and `memoryCore`).
   - When broadcasting `imageGen` settings across stored profiles, preserve destination profile `characterTags` using map-flavored fallback: `const preservedTags = prof[k].characterTags; ... prof[k].characterTags = preservedTags || {};`. Never copy the active chat's `currentData.imageGen.characterTags` to other profiles.

## Out of scope (explicitly NOT done)
- Changing the UI of Character Appearance & Continuity (already established in 001/002).
- Altering visual continuity prompts or 3-tier injection mechanics.
- Migrating general generator configuration settings (LoRAs, workflows, aspect ratios, etc.) to chat_metadata (those are intentionally profile/global settings).

## Files / modules likely touched
| File / module | Why |
|---|---|
| `src/core/profile.js` | Load, migrate, and save `characterTags` in `chat_metadata["megumin_character_tags"]`; strip from `settings.json` in both `saveProfileToMemory()` and `flushProfileSettingsToLoadedKey()`. |
| `src/core/sync.js` | Prevent `characterTags` from being broadcast across profiles during Image Generation global tab sync, preserving map-shaped tags. |

## Risks & open questions
- *Risk: Environments without chat_metadata (e.g. unit tests or early init).*
  - *Mitigation:* Strictly guarded by `if (chat_metadata)` checks. In-memory `localProfile.imageGen.characterTags` remains functional.
- *Risk: Stale flush writing tags across chats during chat-switch.*
  - *Mitigation:* Both `saveProfileToMemory()` and `flushProfileSettingsToLoadedKey()` strip `characterTags` before persisting `profileToSave`.
