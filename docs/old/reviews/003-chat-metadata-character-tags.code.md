# 003 — Code Review (Pi, Reviewer)

Date: 2026-09-25 · Verdict: **PASS**

Reviewed diff: `git diff c06446e..6eb27dd` (baseline → `feat(003): persist character tags in chat metadata and isolate from global sync`).

## Compliance with the approved plan

Every scope item landed, and nothing else moved — exactly the two planned files:

- **initProfile (profile.js):** `charTags` added to `metaHadOnEntry`; hydration from `chat_metadata["megumin_character_tags"]` (metadata wins over the settings copy, same precedence as the siblings); first-open migration seed using the map-shaped `Object.keys(…).length > 0` test; residue cleanup `delete stored.imageGen.characterTags` inside the existing chat-level-key guard, mirroring memory/plan/npcs. He even took the optional defensive `if (localProfile.imageGen)` guard from my Round 2 plan note.
- **saveProfileToMemory (profile.js):** content-or-key-exists write guard (map-shaped), block added to `hasAnyBlock` *and* the `metaStamp` serialization, and the `profileToSave` strip.
- **flushProfileSettingsToLoadedKey (profile.js):** the second writer carries the identical strip line — required change 2 from the plan review.
- **sync.js:** `k === "imageGen"` special case in the "settings travel, content stays put" chain, with map-flavored `preservedTags || {}` — exactly per the plan's non-blocking note.

## Verification (ran it, didn't take his word for it)

- `node --check` on both files: clean.
- Extracted the three new code blocks **verbatim from the committed files** (CRLF-normalized) and ran **16 functional cases: 16/16 green**:
  - *Sync:* sampler/width travel from the source profile; a destination's own tags survive byte-for-byte; a tagless destination receives `{}` — the active chat's tags do **not** leak in; a destination with no imageGen block gets the full block plus `{}`; unrelated keys (banList) still broadcast normally.
  - *Init:* chat-file copy overwrites the settings copy on load; first open migrates settings-residue into the chat file and saves; an empty map creates no phantom block; `null` chat_metadata (ST absent) doesn't crash.
  - *Save guard:* no phantom block for empty/undefined tags; an existing key stays alive with `{}` (so a fully-cleared tag list can't be re-migrated from stale residue); content writes on change.
- Change report checked against the diff: all names and claims accurate (the `002` lesson applied — no phantom functions this time).
- The intervening `2ee6d0d docs(002): task complete` commit is docs-only (5 files, all under `docs/`) — no code leakage from the 002 closeout.

## Notes (non-blocking)

1. The change report's test-evidence section says "verified" without describing *how*; the 16-case extraction run above now documents the actual evidence. Optional to backfill.

## Next

Ready for developer verification in SillyTavern: set character tags in one chat, confirm (a) they survive a chat switch, (b) a second chat does not inherit them, and (c) with Image Gen "Sync Tab Globally" on, sampler/resolution still propagate while tags stay put.
