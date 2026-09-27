# 002 — Image Gen Character Sheet Scanner & Scene Snapshot UI

Status: DONE
Date: 2026-09-24 · Author: Gemini · Reviewer: Pi

## Goal
Enable users to extract and register Booru physical appearance tags for characters defined in a card's `<character_sheet>` / lore via a dedicated scanner button that completely bypasses the NPC Bank (zero full dossiers generated), and display a live Scene Snapshot (location, weather, PC outfit, and per-character active attire badges) directly inside the Image Gen UI.

## What the user will see / feel
- In the Image Generation tab, at the top of the Character Appearance & Continuity card, the user sees an **"Active Scene Snapshot"** box displaying the live location, weather/atmosphere, and PC outfit from the World State ledger (or *"No active scene on record"* if starting a fresh story).
- Inside each character's row in the list, right under their name, a dynamic pill displays their active outfit in the scene: `👗 Attire (current scene): "Crimson robe, wizard hat"` (or `(Not in active scene)` if off-screen).
- Next to "Add Character", a new **"Scan Character Sheet"** button allows 1-click discovery: it sends only the character card's sheet/lore (zero chat history) to the AI, extracts all characters, generates their Booru appearance tags, and saves them to Image Gen.
- Existing custom-locked character tags are strictly protected and never overwritten during a rescan.

## In scope
1. **Scene Snapshot Header in UI (`src/features/imagegen/index.js`):**
   - Renders a clean status bar in the Character Appearance panel showing `location`, `weather`, and `pc.outfit` from `getWorldStateCurrent()`.
   - Graceful fallback when no World State exists: displays *"No active scene on record"*.
   - PC name resolution: uses ledger `pc.name`, falling back to `substituteParams("{{user}}")`.
2. **Per-Character Live Attire Badge (`src/features/imagegen/index.js`):**
   - Displays each character's current outfit from `ws.npcOutfits[name]`.
   - **E1 (Name Matching):** Case-insensitive trimmed lookup against `ws.npcOutfits` keys (e.g. matching "megumin" to "Megumin").
   - Off-screen characters clearly marked `(Not in active scene)`.
3. **Active Request Plumbing (`src/core/activeRequests.js`):**
   - Add `activeCharSheetScanRequest` getter and setter (`setActiveCharSheetScanRequest`).
   - Omitted from `isBackgroundGenerationActive()` chain, consistent with sibling `activeNpcScanRequest` (quirk to be addressed separately for both background scans).
4. **Quiet Prompt Injection Branch (`src/engine/injection.js`):**
   - Intercepts `___PS_CHAR_SHEET_SCAN___` quiet prompt.
   - Injects targeted system and user prompt with zero chat history, asking the model to identify all characters in the provided sheet text and output their Booru appearance tags.
5. **Extraction Parser (`src/features/imagegen/index.js`):**
   - Parses `<Character_Visual name="...">[tags]</Character_Visual>` blocks.
   - Captures only physical appearance traits (hair, eyes, face, skin, body type, race/species).
6. **"Scan Character Sheet" Button & Handler (`src/features/imagegen/index.js`):**
   - Retrieves active card via `getContext().characters[getContext().characterId]`.
   - **E4 (Text extraction with fallback):** Extracts `/<character[-_]?sheet>[\s\S]*?(?:<\/character[-_]?sheet>|$)/i` from `card.description`; falls back to full `card.description` if no tag block is present.
   - **E2 (Rescan semantics):** Creates new characters as `provisional: true`; refreshes existing `provisional: true` tags; skips `locked: true` tags and reports count in toast.
   - **Persistence:** Handler persists mutations via `saveProfileDebounced()` (same pattern as the 001 tag-UI handlers).
   - **E5 (Guards):** If in group mode or no active card with text (`!card || !desc.trim()`), toasts warning: *"No single character card is active — switch out of group mode to scan."* and aborts.
   - **E7 (Feedback):** Disables button with a spinner during execution to prevent concurrent scans.

## Out of scope (explicitly NOT done)
- Full NPC Bank dossier generation (backstory, personality, bonds, agendas) — this scanner is strictly visual-only for Image Gen.
- Multi-card group chat resolution (scans the single active character card).
- Real-time event polling when the tab is closed or unfocused (UI renders fresh upon opening or list re-render).
- Modifying ComfyUI websocket pipelines or generation sockets.

## Files / modules likely touched
| File / module | Why |
|---|---|
| `src/core/activeRequests.js` | Add `activeCharSheetScanRequest` pair. |
| `src/engine/injection.js` | Add quiet prompt injection branch for `activeCharSheetScanRequest`. |
| `src/features/imagegen/index.js` | Add Scene Snapshot UI, per-character attire badges, "Scan Character Sheet" button, scan handler, and visual tag parser. |

## Risks & open questions
- **E1 — Name drift:** Mitigated by normalized case-insensitive trimmed matching between `characterTags` keys and `ws.npcOutfits`.
- **E2 — Rescan tag protection:** Locked tags are immutable to scanner updates; only provisional tags are refreshed.
- **E3 — Output format robustness:** Parser handles loose closing tags or multiple tags gracefully.
- **E5 — Group chat context:** Handled with a clear toast if no active card or description exists.
- **E7 — Model latency:** Handled with UI button disable + spinner state.
