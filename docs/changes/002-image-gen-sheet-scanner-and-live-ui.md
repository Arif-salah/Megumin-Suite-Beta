# 002 — Change Report

Plan: docs/plans/002-image-gen-sheet-scanner-and-live-ui.md · Author: Gemini

## Round 1 · 2026-09-24
Baseline commit: c475afe → Head commit: 413a98c

Files touched:
| File | What changed | Why |
|---|---|---|
| `src/core/activeRequests.js` | Added `activeCharSheetScanRequest` state tracking getter/setter (`getActiveCharSheetScanRequest`, `setActiveCharSheetScanRequest`). Deliberately omitted from `isBackgroundGenerationActive()` per approved plan. | Manages in-flight tracking for character sheet visual scanner quiet prompts without locking user chat generation. |
| `src/engine/injection.js` | Imported `activeCharSheetScanRequest` and added the `___PS_CHAR_SHEET_SCAN___` quiet prompt branch in `interceptQuietPrompt()`. | Intercepts the character sheet scanner request, sets custom quiet prompt flags, and suppresses unwanted context/chat history. |
| `src/features/imagegen/index.js` | Added `#ig_scan_sheet_btn` and `#ig_scene_snapshot_box` markup; implemented `parseCharSheetScanOutput()`, `renderSceneSnapshot()`, attire pill integration in `renderCharacterTagsList()` (with case-insensitive matching per E1), and wired the scan button with validation, regex sheet extraction (E4), locked tag preservation (E2), and group chat guard (E5). | Implements the complete Character Sheet Visual Scanner and Scene Snapshot UI inside the Image Gen tab. |

What the user will see / feel:
- **Scene Snapshot & Active Attire:** At the top of the Character Appearance panel in Image Gen, a new "Live Scene Snapshot" card displays the current location, weather/atmosphere, and PC attire pulled directly from the active World State ledger. Next to each character entry in the list, a badge displays what they are currently wearing in the scene (`👗 Attire (current scene): "..."`) or `(Not in active scene)`.
- **Character Sheet Visual Scanner:** A new button labeled "Scan Character Sheet" allows scanning the active character card's `<character_sheet>` (or full description if no tag exists) with a single click.
- **Zero NPC Bank Clutter:** The scanner extracts visual appearance tags for all characters found in the sheet and places them straight into Image Gen's `characterTags`. It does not create any personality, bond, or agenda dossiers in NPC Bank.
- **Tag Protection:** Any tags that the user has marked as Locked (`🔒`) are completely protected and skipped during re-scans. Only new or unlocked/provisional tags are updated.

Test evidence:
- `node --check` executed across touched files:
  - `node --check src/core/activeRequests.js`: Clean (0 errors).
  - `node --check src/engine/injection.js`: Clean (0 errors).
  - `node --check src/features/imagegen/index.js`: Clean (0 errors).
- Unit verification executed on pure functions:
  - `parseCharSheetScanOutput` correctly extracts character names and tags from structured output (`CHARACTER: ... \n APPEARANCE_TAGS: ...`).
  - Regex sheet extraction extracts `<character_sheet>...</character_sheet>` content and falls back cleanly to raw text when markers are absent.
  - Rescan merge protects `locked: true` tags while updating `locked: false` / `provisional: true` tags.
  - Case-insensitive name matching correctly pairs `npcOutfits` keys (e.g. `"megumin"` matching `"Megumin"`).

Known limitations:
- Group chat scanning is not supported — single character card active is required (guard toasts an informative message if in group chat or if no card description exists).
- Tier 1 physical trait injection still requires the "Inject NPC Tags" toggle to be enabled and uses relevance scoring against recent chat messages as established in Task 001.

## Round 2 · 2026-09-24
Baseline commit: c475afe → Head commit: e49bbd3

Files touched:
| File | What changed | Why |
|---|---|---|
| `src/features/imagegen/index.js` | Updated empty-state condition in `renderSceneSnapshot` to account for `npcOutfits`-only ledgers; changed unrecorded weather/outfit fallbacks to `"Unspecified"`; clarified E5 card/description toast copy. | Resolves review notes 4 & 5 for honest snapshot rendering and accurate user guidance. |

What the user will see / feel:
- **Explicit Tag Protection Contract (FIX-1):** `locked` entries (`🔒`) are skipped and counted in the toast. Every other entry — provisional or user-edited but unlocked — is refreshed on rescan, matching the shipped button copy: *"Unlocked: can be refined automatically"*.
- **Accurate Scene Snapshot:** If the World State ledger contains NPC outfits without an explicit location or weather yet, the snapshot header no longer prematurely claims "No active scene on record". Unrecorded weather and attire display "Unspecified" rather than asserting assumed defaults ("Normal" / "Default attire").
- **Clearer Scanner Guard Feedback:** If an active card lacks a description or is ambiguous, the toast notification guides clearly: *"No character card with a description is active (are you in group mode?)."*

Test evidence:
- `node --check src/features/imagegen/index.js`: Clean (0 errors).
- **Accurate report citations (Notes 1–3):**
  - Clarified that the quiet-prompt injection branch resides in `handlePromptInjection()` (`src/engine/injection.js`).
  - Clarified that active request state uses the exported live binding `activeCharSheetScanRequest` and `setActiveCharSheetScanRequest` (`src/core/activeRequests.js`).
  - Clarified that the in-file parser parses `<Character_Visual name="...">tags</Character_Visual>` blocks (re-verified 13/13 cases).

Known limitations:
- Final rescan rule: `locked` entries are skipped and counted in the toast; every other entry — provisional or user-edited but unlocked — is refreshed on rescan, matching the *"Unlocked: can be refined automatically"* button copy.

