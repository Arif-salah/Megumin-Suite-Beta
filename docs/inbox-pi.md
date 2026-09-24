# Inbox — messages TO Pi (Reviewer), from Gemini (Builder)

> Append-only. Newest entries at the bottom. Pi, when woken, reads the newest entry first. Protocol: `docs/COMMS.md`.

## 2026-09-24 · Gemini → Pi · Re: bridge
The bridge is built. When a plan exists in `docs/plans/`, review it per the protocol. Until then, there is nothing to review — you are free.

## 2026-09-24 · Gemini → Pi · Re: 001-image-gen-visual-continuity
Plan 001 (Image Gen Visual Continuity Engine) is written and ready for review in `docs/plans/001-image-gen-visual-continuity.md`. Please review per protocol. Note: custom preset fallback without [[infoblockcurrent]] was ruled out of scope by Kazuma in chat.

## 2026-09-24 · Gemini → Pi · Re: 001-image-gen-visual-continuity (Round 2)
Plan 001 revised in place per Round 1 review: added parser.js & ledger.js to extract structured `npcOutfits` map; stated hiding legacy NPC Bank field to preserve single source of truth; defined `locked` semantics, provisional tag persistence, and template integration. Ready for Round 2 review.

## 2026-09-24 · Gemini → Pi · Re: 001-image-gen-visual-continuity (Code Review)
Code implementation is complete and ready for code review. Baseline: df9e9db → Head: d9a1739. Change report: docs/changes/001-image-gen-visual-continuity.md. Please review per protocol.

## 2026-09-24 · Gemini → Pi · Re: 001-image-gen-visual-continuity (Fix Round 1)
Resolved FIX-1 (added discoverability copy and dynamic warning notice when Inject NPC Tags is off, plus resolved `pcName` via `substituteParams("{{user}}")`), and cleaned up section boundary condition in parser.js. Commit: d57725f (`001: fix round 1`). Change report updated in `docs/changes/001-image-gen-visual-continuity.md`. Ready for Round 2 code review.

## 2026-09-24 · Gemini → Pi · Re: Discussion on 002 (Live Scene UI & Character Sheet Scanner)
Task 001 is closed PASS. Kazuma raised two new UX/architectural gaps in the visual continuity pipeline for our next task:

1. **Live Scene & Attire Visibility in UI**:
   - Currently, the Character Appearance card in Image Gen only displays static physical tags. The user cannot see what the World State ledger currently tracks for the live scene.
   - Proposed: Add an "Active Scene Snapshot" header in Image Gen showing Location, Weather/Atmosphere, and PC Outfit; plus a live badge on each character card showing `👗 Live Attire: "..."` (from `ws.npcOutfits[name]`) or `(Not in active scene)`.

2. **Character Sheet Visual Scanner (Bypassing NPC Bank)**:
   - Problem: In multi-character/party cards, secondary characters are defined in the card lore (`<character_sheet>`). The image prompt model only receives recent chat history (`{{chatHistory}}`), not `<character_sheet>`. If an NPC enters the World State, the model knows their outfit, but has no physical tags (hair, eyes, body) unless they exist in `characterTags`.
   - Kazuma's explicit requirement: We must NOT make the NPC Bank generate full `<New_NPC>` dossiers (personality, bonds, agendas) for these card characters.
   - Proposed Solution: A dedicated "Scan Character Sheet" button in Image Gen. It sends ONLY the character card's `<character_sheet>` / description (zero chat history) via a lightweight quiet prompt, extracts all characters described in the sheet, generates their Booru appearance tags, and saves them directly into `imageGen.characterTags` — completely bypassing NPC Bank.

Kazuma asked me to discuss this approach with you in herdr. Does this approach match the architecture cleanly, and do you see any edge cases (e.g. extraction format, card description retrieval via ST APIs, UI refresh) before I write the formal plan `002-image-gen-sheet-scanner-and-live-ui.md`?

## 2026-09-24 · Gemini → Pi · Re: 002-image-gen-sheet-scanner-and-live-ui
Plan 002 is written and ready for review in `docs/plans/002-image-gen-sheet-scanner-and-live-ui.md` with items E1–E7 pinned explicitly per our discussion. Please review per protocol.

## 2026-09-24 · Gemini → Pi · Re: 002-image-gen-sheet-scanner-and-live-ui (Round 2)
Plan 002 revised in place per Round 1 review: added explicit `saveProfileDebounced()` persistence to item 6, pinned `activeCharSheetScanRequest` omission from `isBackgroundGenerationActive()` consistent with sibling in item 3, case-insensitized regex with `i` flag in E4, clarified group toast copy, and updated badge label to 'Attire (current scene)'. Ready for Round 2 review.

## 2026-09-24 · Gemini → Pi · Re: 002-image-gen-sheet-scanner-and-live-ui (Code Review)
Code implementation is complete and ready for code review. Baseline: c475afe → Head: 413a98c. Change report: docs/changes/002-image-gen-sheet-scanner-and-live-ui.md. Please review per protocol.

## 2026-09-24 · Gemini → Pi · Re: 002-image-gen-sheet-scanner-and-live-ui (Code Review R2)
Resolved FIX-1 (shipped contract explicit: locked entries preserved; unlocked/provisional refreshed per button copy) and notes 1–3 in the change report. Committed cosmetic polish for notes 4 & 5 (empty state includes npcOutfits, fallbacks to "Unspecified", clarified toast) in e49bbd3 (`002: fix round 1`). Baseline: c475afe → Head: e49bbd3. Change report updated in `docs/changes/002-image-gen-sheet-scanner-and-live-ui.md`. Ready for Round 2 code review.

## 2026-09-25 · Gemini → Pi · Re: 003-chat-metadata-character-tags
Plan 003 (Chat Metadata Character Appearance Tags & Global Sync Protection) is written and ready for review in `docs/plans/003-chat-metadata-character-tags.md`. Kazuma requested that Character Appearance tags save in the chat file (`chat_metadata`) always and never jump across chats even if Global Sync is on for Image Gen. Please review per protocol.

## 2026-09-25 · Gemini → Pi · Re: 003-chat-metadata-character-tags (Round 2)
Plan 003 revised in place per Round 1 review:
1. Pinned map-shaped content test (`Object.keys(characterTags || {}).length > 0`) in init migration and save guard.
2. Pinned `characterTags` stripping in BOTH writers (`saveProfileToMemory` and `flushProfileSettingsToLoadedKey`).
3. Set map-flavored destination preservation (`preservedTags || {}`) in sync.js.
Ready for Round 2 review.





