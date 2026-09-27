# 001 — Image Gen Visual Continuity Engine

Status: CODING
Date: 2026-09-24 · Author: Gemini · Reviewer: Pi

## Goal
Connect ComfyUI image prompt generation directly to the compiled World State ledger and a centralized character appearance bank to eliminate visual drift across roleplay scenes.

## What the user will see / feel
Characters and scenes in generated images will maintain strict continuity instead of drifting randomly between turns.
- **Example:** Kazuma and Matt in Kazuma's bedroom. Matt's black hair, pale skin, and facial features remain locked word-for-word on every turn. His black band tee and pleated skirt remain locked until the Scene Board explicitly states he changed clothes. The room background remains Kazuma's apartment. Only Matt's pose, facial expression, and camera perspective change dynamically based on the current scene dialogue.
- **Unified Controls:** The user manages all character visual tags (hair, eyes, body, signature features) in a dedicated "Character Appearance" section directly inside the Image Generation settings tab, rather than digging into individual NPC Bank records.

## In scope
1. **Three-Tier Visual Prompt Architecture:**
   - **Tier 1 (Static Identity):** Character-specific physical tags (body, hair, eyes, face, race) stored persistently in `localProfile.imageGen.characterTags` and reused verbatim on every generation containing that character.
   - **Tier 2 (Semi-Sticky Scene):** Attire and location queried directly from the active World State ledger (`getWorldStateCurrent()`). The current outfit and location are fed as the authoritative baseline, remaining identical until the World State changes.
   - **Tier 3 (Dynamic Pose & Emotion):** Pose, action, expression, and camera angle derived dynamically from the immediate scene prose.
2. **Centralized Character Visual Store & Single Source of Truth:**
   - Add `localProfile.imageGen.characterTags` schema (`{ [name]: { tags: string, locked: boolean, provisional?: boolean } }`).
   - `locked` semantics: `locked: true` signifies user-authored or user-approved tags that auto-extraction will never overwrite. `locked: false` (or provisional) indicates tags generated on first sight that can be refined by the user.
   - One-time non-destructive migration: on load, copy existing `imageTags` from `npcBank.npcs` into `imageGen.characterTags`.
   - Single source of truth: after migration, the NPC Bank editor hides the legacy "Image Tags" field (`fields.js`), redirecting the user to the Image Gen tab to ensure there is never a split source of truth. `npc.imageTags` remains in schema solely as a read-fallback.
   - Auto-creation constraint: when an unseen character appears, initial tags are generated and persisted once (flagged `provisional: true`), preventing continuous profile rewrites on repeated generations.
3. **Structured World State NPC Attire Extraction:**
   - Extend `parseWorldStateBlock` in `src/features/worldstate/parser.js` to parse each NPC block under `**👥 NPCs Present:**` into a structured map: `state.npcOutfits = { [name]: outfit }`.
   - In `applyWorldStateUpdate` (`src/features/worldstate/ledger.js`), update `current.npcOutfits[name]` whenever an NPC's `outfit` field is modified, making NPC attire directly queryable alongside `current.location` and `current.pc.outfit`.
4. **Prompt Pipeline Integration:**
   - Update `generateImagePromptText()` in `src/features/imagegen/index.js` to query `getWorldStateCurrent()` for location and character outfits, pairing them with Tier 1 physical tags to form complete character descriptions.
   - Update inline image injection in `src/engine/buildBaseDict.js` (`[[img1]]`) to supply current World State outfit/location alongside character tags.
   - Update prompt templates in `src/prompts/imageGen.js` (`injectionTemplate`, `userPrompt`, and Section 3 character description rules across the 6 model rulesets) via the established `{{npcImageTags}}` slot to enforce strict adherence to the provided outfit and location baseline.

## Out of scope (explicitly NOT done)
- Modifying the ComfyUI backend WebSocket protocol, progress bar, or execution pipeline (`igGenerateWithComfy`, `comfyProgress.js`).
- Modifying Side Panel rendering or portraits.
- Supporting legacy/custom presets that omit `[[infoblockcurrent]]` (Kazuma confirmed in chat this is not important and out of scope; users always update to the bundled preset).

## Files / modules likely touched
| File / module | Why |
|---|---|
| `src/core/profile.js` | Add `characterTags` map to `defaultProfile.imageGen`. |
| `src/features/worldstate/parser.js` | Parse `**👥 NPCs Present:**` into `state.npcOutfits` map. |
| `src/features/worldstate/ledger.js` | Maintain live `current.npcOutfits` on updates and rollbacks. |
| `src/features/imagegen/index.js` | Update `generateImagePromptText()` to query `getWorldStateCurrent()`; render Character Appearance editor in Image Gen tab. |
| `src/features/npc/fields.js` | Hide legacy `imageTags` in NPC Bank editor to preserve single source of truth. |
| `src/features/npc/data.js` | Point `getRelevantNpcImageTags()` to read from centralized `imageGen.characterTags` with fallback. |
| `src/engine/buildBaseDict.js` | Feed live World State outfit and location into `[[img1]]` template context. |
| `src/prompts/imageGen.js` | Instruct prompt builder to treat World State outfit and location as mandatory baseline. |

## Risks & open questions
- **Risk:** New NPCs introduced during a scene may lack pre-defined physical tags.
  - *Mitigation:* When no static tags exist for a character, the prompt generator creates initial tags from the scene prose, which are saved once into `characterTags` (marked `provisional: true`) for subsequent turns.
- **Risk:** Overly verbose tag lists exceeding CLIP token limits.
  - *Mitigation:* Enforce concise Booru-style comma-separated tags for Tier 1 physical traits.
- **Risk:** User-edited prompt diffs in `storage.js` colliding with template updates.
  - *Mitigation:* Route continuity instructions through the existing `{{npcImageTags}}` placeholder slot in `injectionTemplate` and `userPrompt`, leaving base prompt skeletons untouched so user diffs continue merging cleanly.
