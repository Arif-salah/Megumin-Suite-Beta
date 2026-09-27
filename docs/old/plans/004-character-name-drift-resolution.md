# 004 — Character Name Drift Resolution & Aliases

Status: CODING
Date: 2026-09-25 · Author: Gemini · Reviewer: Pi

## Goal
Resolve character name variations (e.g. "Matt" vs "Matthew", titles, honorifics, and aliases) between story dialogue, the World State ledger, and Image Gen Character Appearance tags by introducing a pure, centralized character name matcher in core, normalizing names at the World State ledger boundary upon entry, and providing an explicit Aliases field in the Character Appearance UI.

## What the user will see / feel
- If a character is registered as "Matthew" in Image Gen and the story/ledger refers to him as "Matt", the `👗 Attire (current scene)` badge connects automatically instead of showing `(Not in active scene)`.
- When generating image prompts, Matthew's visual traits (hair, eyes, body) correctly pair with Matt's active outfit and environment.
- In the Image Generation tab, each character entry in the Character Appearance list includes an editable "Aliases" input (e.g. `Aliases: Matt, Matty`), which the Character Sheet Scanner also automatically pre-fills when it finds quoted nicknames like `Matthew "Matt"`.
- When characters leave a scene in the story, the World State ledger cleanly removes their old outfits without leaving "ghost" entries caused by nickname variations.

## In scope
1. **Centralized Name Matcher Utility (`src/utils/nameMatcher.js`):**
   - Create a pure, node-testable name matching and resolution module:
     - `normalizeName(str)`: trims, lowercases, and strips common wrapping quotes/parentheticals.
     - `isCharacterNameMatch(nameA, nameB, aliasesA, aliasesB)`: evaluates whether two names match.
     - `resolveCanonicalCharacterName(candidateName, canonicalList, aliasesMap)`: resolves an arbitrary name against a list of known canonical names.
   - Matching ladder:
     a. **Exact Match (Case-Insensitive):** `cleanA === cleanB`.
     b. **Explicit Aliases:** checks if either name is in the other's declared alias list.
     c. **Token / Title Containment:** strips honorifics and parentheticals (`"Lady Darkness"` ➔ `"Darkness"`, `"Aqua (Goddess)"` ➔ `"Aqua"`, `"Matthew Miller"` matching `"Matthew"`).
     d. **Unambiguous Prefix Matching:** if `min(length) >= 3` and the longer name starts with the shorter name (`"Matthew".startsWith("Matt")`), it matches **only if exactly one** candidate in the active cast matches. If ambiguous (e.g. both "Samantha" and "Samuel" exist for "Sam"), it declines to guess and falls back to explicit aliases.

2. **Normalize at the Door in World State Ledger (`src/features/worldstate/ledger.js`):**
   - In `applyWorldStateUpdate()`:
     - Canonical candidate sources: builds known character names from `getContext()` (card names / group member names), `localProfile.imageGen.characterTags` keys, and `localProfile.npcBank.npcs`.
     - When receiving incoming `fields.outfit` updates for NPCs, resolve the incoming NPC name against the active cast using `resolveCanonicalCharacterName`. If an unambiguous match is found, store the outfit directly under the canonical name in `current.npcOutfits`.
     - When removing stale outfits (`delete current.npcOutfits[rName]`): delete on exact key match first; if non-exact, delete **only if exactly one** stored key in `npcOutfits` matches via the shared matcher. If multiple keys match or none match, do not perform ambiguous deletions.

3. **Aliases UI & Sheet Scanner Extraction (`src/features/imagegen/index.js`):**
   - **Data storage shape pinned:** `characterTags[name].aliases` is strictly an **array of strings** (`aliases: []`) in the data model and chat metadata (`{ tags, locked, provisional, aliases: [] }`).
   - **UI representation pinned:** Displayed as a comma-separated string in an input field (`(item.aliases || []).join(", ")`), and on user edit parsed by splitting on comma (`val.split(",").map(s => s.trim()).filter(Boolean)`). Saving debounces and persists to chat metadata.
   - **Attire badge lookup:** Uses the shared matcher against `ws.npcOutfits` and `ws.pc`.
   - **Sheet scanner extraction:** In `parseCharSheetScanOutput()`, extracts structured name attribute variations (`Matthew "Matt"` or `Matthew (Matt)`), setting canonical name to "Matthew" and pre-filling `aliases: ["Matt"]`. Zero prompt template changes required.

4. **Visual Continuity & Relevance Integration (`src/features/imagegen/index.js`, `src/features/npc/data.js`):**
   - In `buildVisualContinuityContext()`: Use the shared matcher when pulling active attire for character tags.
   - In `getRelevantNpcImageTags()`: Use the shared matcher so character entries match chat keywords even when the chat uses their nickname or alias.

## Out of scope (explicitly NOT done)
- Editing prompt engine templates or forcing the story LLM to generate formal names in narrative prose (the machinery bridges the gap seamlessly).
- Arbitrary edit-distance / Levenshtein fuzzy matching without token or prefix anchor (risks false positives in dense roleplay casts).

## Files / modules likely touched
| File / module | Why |
|---|---|
| `src/utils/nameMatcher.js` | Pure, testable name resolution and matching utility (ladder: exact → aliases → tokens → unambiguous prefix). |
| `src/features/worldstate/ledger.js` | Normalize incoming outfit names at the door and fix stale outfit deletion using the shared matcher with uniqueness guard. |
| `src/features/imagegen/index.js` | Add Aliases input to Character Appearance cards, extract attribute nicknames in scanner, and use shared matcher for badge and context lookup. |
| `src/features/npc/data.js` | Support aliases and name resolution during relevance scoring. |

## Risks & open questions
- *Risk: Ambiguous prefixes (e.g. "Sam" when cast has both "Samantha" and "Samuel").*
  - *Mitigation:* The matcher strictly counts candidates. If more than one candidate matches the prefix, automatic resolution declines and requires an explicit alias.
- *Risk: Backward compatibility with characterTags saved without an `aliases` property.*
  - *Mitigation:* `item.aliases = Array.isArray(item.aliases) ? item.aliases : []` fallback everywhere.
