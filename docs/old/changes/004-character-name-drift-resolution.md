# 004 — Change Report

Plan: docs/plans/004-character-name-drift-resolution.md · Author: Gemini

## Round 1 · 2026-09-25
Baseline commit: 736d2fd → Head commit: ec6887b

Files touched:
| File | What changed | Why |
|---|---|---|
| `src/utils/nameMatcher.js` | Created pure name matcher with deterministic ladder: exact CI match, explicit aliases, token containment & honorifics/parenthetical stripping, and unambiguous prefix matching (min length >= 3, strictly single candidate). Exported `normalizeName`, `stripHonorificsAndParentheticals`, `isCharacterNameMatch`, and `resolveCanonicalCharacterName`. | Provides a centralized, node-testable character name resolution engine that bridges narrative nickname drift without fuzzy guessing or false positives. |
| `src/features/worldstate/ledger.js` | Added `getActiveCastNames()` helper sourcing canonical names and aliases from `characterTags`, `npcBank`, and ST context (`getContext()`). Updated `setWorldStateBootstrap()` to normalize `npcOutfits` at the door. Updated `applyWorldStateUpdate()` to normalize incoming `fields.outfit` and perform uniqueness-guarded stale outfit deletion on character departure. | Prevents alias drift from poisoning the World State ledger and eliminates ghost outfits when characters leave a scene under a nickname. |
| `src/features/imagegen/index.js` | Updated `parseCharSheetScanOutput()` to parse structured nicknames (`Matthew "Matt"`, `Matthew (Matt)`) into canonical names and `aliases: []`. Added Aliases input field (`.ig-char-aliases-input`) in character appearance cards. Implemented whole-cast attire lookup in `renderCharacterTagsList()` resolving `ws.npcOutfits` against the registered cast via `resolveCanonicalCharacterName`. Updated `buildVisualContinuityContext()` to resolve outfit names against canonical cast. Updated scan merge and add character buttons to initialize and preserve aliases. | Connects visual appearance tags to active scene attire regardless of whether dialogue uses formal names or nicknames, and exposes an editable Aliases field in the UI. |
| `src/features/npc/data.js` | Updated `getRelevantNpcImageTags()` to pull candidate characters from both `characterTags` (including sheet-scanned characters without NPC Bank dossiers) and `npcBank.npcs`. Included character names and aliases in search tokens and matched keywords using `isCharacterNameMatch`. | Ensures relevant NPC image tags are accurately injected into ComfyUI prompts even when chat uses character nicknames. |

What the user will see / feel:
- If a character is named "Matthew" in Character Appearance and the story or World State ledger calls him "Matt", the `👗 Attire (current scene)` badge links immediately instead of showing `(Not in active scene)`.
- Image generation prompt visual continuity correctly pairs static traits (hair, eyes, body) with active outfits when dialogue refers to characters by nicknames.
- Each character card in the Image Generation tab now has an editable `Aliases` field (e.g. `Matt, Matty`) so users can add known nicknames or alternate names.
- The Character Sheet Scanner automatically extracts nicknames (e.g. `Matthew "Matt"` or `Matthew (Matt)`) and pre-fills both the canonical name and aliases.
- When characters leave a scene in the story, their outfits are cleanly removed from the World State ledger without leaving ghost entries.

Test evidence:
- Node syntax checks: `node --check src/utils/nameMatcher.js`, `src/features/worldstate/ledger.js`, `src/features/imagegen/index.js`, `src/features/npc/data.js` all passed with 0 errors.
- Automated test suite (`scratch/test-004-suite.js`):
  - `normalizeName` & `stripHonorificsAndParentheticals`: Verified stripping quotes, titles (e.g. `Lady Darkness` -> `Darkness`), and parentheticals (`Aqua (Goddess)` -> `Aqua`).
  - `isCharacterNameMatch`: Verified exact CI, explicit aliases, title containment, and prefix >= 3 matching.
  - `resolveCanonicalCharacterName`: Verified single candidate prefix resolution, and verified ambiguous prefix decline (e.g. "Sam" with "Samantha" and "Samuel" declines and returns null).
  - `parseCharSheetScanOutput`: Verified extraction of canonical names and aliases from both quoted and parenthesized forms with unescaped/escaped quotes.
  - Stale outfit deletion: Verified deletion on alias with uniqueness guard.

Known limitations:
- If a character's nickname is completely unrelated phonetically and semantically to their canonical name (e.g. "Shadow" for "Arthur") and is not written in quotes in the character sheet or declared in Aliases, the matcher will not guess it. The user can easily type it into the new Aliases input field.
