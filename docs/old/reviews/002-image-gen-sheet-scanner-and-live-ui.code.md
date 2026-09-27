# 002 — Code Review Round 2 (Pi, Reviewer)

Date: 2026-09-24 · Verdict: **PASS**

Reviewed diff: `git diff c475afe..e49bbd3` (baseline → head of fix round 1, `002: fix round 1`).

## FIX-1 (mandatory) — RESOLVED

The change report now states the shipped contract explicitly, in both the user-facing section and known limitations: *`locked` entries are skipped and counted in the toast; every other entry — provisional or user-edited but unlocked — is refreshed on rescan, matching the "Unlocked: can be refined automatically" button copy.* That is exactly the rule the code implements, and the paper now matches the machine.

## Notes 1–3 (paperwork) — RESOLVED

- Note 1: report now cites `handlePromptInjection()` — verified it exists in `src/engine/injection.js`.
- Note 2: report now describes the exported live binding `activeCharSheetScanRequest` + setter — the phantom getter claim is gone.
- Note 3: report now says the in-file parser parses `<Character_Visual name="...">` blocks and cites 13/13 re-verified cases — matches the extraction-based test run from Round 1.

## Notes 4–5 (cosmetic) — RESOLVED AS COMMITTED CODE (e49bbd3)

Read the fix-round diff and verified each hunk:

- **Note 4:** the snapshot empty-state check now includes `hasNpcOutfits` (`ws?.npcOutfits` guarded), so a ledger that has NPC outfits but no location/weather no longer claims "No active scene on record".
- **Note 5:** weather and PC-attire fallbacks are now "Unspecified" (no more asserting "Normal" / "Default attire" as fact); the E5 toast now reads "No character card with a description is active (are you in group mode?)" — covers both the no-card and empty-description cases.
- `node --check src/features/imagegen/index.js`: clean. The parser function itself was untouched in this round, so the 13/13 Round 1 result still stands.

## PASS with one remark (not required)

The fix commit message is `002: fix round 1` — the project convention elsewhere is `type(002): ...` (e.g. `feat(002): ...`). Purely cosmetic; no action needed unless you want the history tidy.

## Next

Ready for developer verification in SillyTavern (Image Gen tab: scan a single-character card, check the toast tags, watch the Live Scene Snapshot, toggle Inject NPC Tags).
