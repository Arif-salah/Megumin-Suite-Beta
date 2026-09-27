# 001 — Change Report

Plan: docs/plans/001-image-gen-visual-continuity.md · Author: Gemini

## Round 1 · 2026-09-24
Baseline commit: df9e9db → Head commit: d9a1739

Files touched:
| File | What changed | Why |
|---|---|---|
| `src/core/profile.js` | Added `characterTags: {}` to `defaultProfile.imageGen`. | Provides persistent schema for centralized character visual tags. |
| `src/features/worldstate/parser.js` | Added section boundary tracking in `parseWorldStateBlock` to parse `**👥 NPCs Present:**` into `state.npcOutfits = { [name]: outfit }`. | Enables structured access to what every present NPC is wearing in the live scene. |
| `src/features/worldstate/ledger.js` | Initialized `current.npcOutfits` on bootstrap; handled `fields.outfit` updates and cleaned up removed characters in `applyWorldStateUpdate`. | Maintains live attire state across turns without re-parsing raw markdown. |
| `src/features/npc/fields.js` | Added `hidden: true` to `imageTags` in `NPC_DEFAULT_FIELDS` and filtered `!f.hidden` in `npcBodyFields()`. | Hides the legacy imageTags field in the NPC Bank editor card to enforce Image Gen as single source of truth. |
| `src/features/npc/data.js` | Updated `getRelevantNpcImageTags()` to read from `imageGen.characterTags` first, falling back to `n.imageTags`. | Seamlessly supports new centralized tags while maintaining backwards compatibility with un-migrated tags. |
| `src/features/imagegen/index.js` | Added Character Visual Identity management card UI in `renderImageGen()`, `ensureCharacterTagsMigrated()`, `renderCharacterTagsList()`, `buildVisualContinuityContext()`, and integrated with `generateImagePromptText()`. | Delivers the 3-tier visual continuity engine: Tier 1 (Static body tags), Tier 2 (Semi-Sticky scene attire & location from World State), Tier 3 (Dynamic scene action). |
| `src/engine/buildBaseDict.js` | Imported `buildVisualContinuityContext()` and used it for `[[img1]]` template injection. | Supplies the full 3-tier visual continuity context to inline `<img prompt="...">` model generation. |
| `src/prompts/imageGen.js` | Reinforced visual continuity instructions in `userPrompt`, `injectionTemplate`, and Section 3 of all 6 rulesets. | Instructs generation models to strictly adhere to the mandatory baseline clothing and environment tags. |
| `docs/plans/001-image-gen-visual-continuity.md` | Updated plan status to `CODING`. | Accurate protocol tracking. |

What the user will see / feel:
- In the Image Generation tab, a new "Character Visual Identity & Continuity" section displays all known characters with tag editors, add/delete buttons, and a Lock/Unlock toggle.
- Characters no longer experience "wardrobe amnesia" between turns. If Megumin is wearing pajamas or Kazuma is wearing a green cloak at the tavern in the World State ledger, both inline AI images and Quick Gen will keep them in those clothes and setting until the story explicitly updates their outfits.
- Character visual tags are managed in one clean, centralized place rather than scattered across individual NPC dossier cards.

Test evidence:
- `node --check` executed across all modified files (`profile.js`, `parser.js`, `ledger.js`, `fields.js`, `data.js`, `imagegen/index.js`, `buildBaseDict.js`, `imageGen.js`): 0 syntax errors.
- Verification script executed in Node.js verifying that `parseWorldStateBlock` extracts `pc.name`, `pc.outfit`, and multiple `npcOutfits` from `<World_State>` blocks.
- Verification script executed in Node.js verifying that `applyWorldStateUpdate` correctly updates NPC outfits and cleans up removed characters.

Known limitations:
- If a user previously saved custom prompt overrides in `customPrompts`, their custom overrides take precedence until reset or updated to incorporate the new continuity instructions.
- Presets lacking `[[infoblockcurrent]]` are out of scope (Kazuma confirmed users always update to newest presets).

## Round 2 · 2026-09-24
Baseline commit: df9e9db → Head commit: d57725f

Files touched:
| File | What changed | Why |
|---|---|---|
| `src/features/imagegen/index.js` | Updated Character Appearance panel copy to explicitly mention **Inject NPC Tags** requirement, added dynamic notice if disabled, and substituted user macro for `pcName` via `substituteParams("{{user}}")`. | Resolves FIX-1 (Tier 1 discoverability) and eliminates literal `{{user}}` string when PC name is empty. |
| `src/features/worldstate/parser.js` | Simplified section-boundary condition when exiting NPC section. | Removes redundant condition noted in review. |

What the user will see / feel:
- In the Character Appearance & Continuity card, the copy clearly explains that physical trait tags attach when "Inject NPC Tags" is enabled above. If the toggle is currently off, a helpful gold notice warns the user directly so tags aren't silently inactive.
- If a fresh chat does not yet have a named PC in the World State ledger, the prompt resolves to the actual SillyTavern user persona name instead of the literal `{{user}}` macro string.

Test evidence:
- `node --check` executed across touched files (`src/features/imagegen/index.js`, `src/features/worldstate/parser.js`): 0 errors.

Known limitations & architectural notes:
- Relevance scoring continues to govern Tier 1: physical trait tags attach when the character has a keyword presence in recent messages (the pre-existing mechanism).
- Centralized tag migration runs lazily (on first tab render or prompt build) and becomes permanently persisted upon the first profile save.

