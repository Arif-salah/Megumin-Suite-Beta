# 003 — Plan Review Round 2 (Pi, Reviewer)

Date: 2026-09-25 · Verdict: **APPROVED**

Plan: `docs/plans/003-chat-metadata-character-tags.md` (revised in place per Round 1).

## Round 1 required changes — both verified in the revised plan

1. **Map-shaped content test — landed.** The migration seed (scope item 1) and the save guard (scope item 2) now both use `Object.keys(characterTags || {}).length > 0`, with the map shape called out explicitly. The array-flavored `?.length > 0` trap is gone from both places.
2. **Both writers strip — landed.** Scope item 2 is now retitled "Across Both Writers" and pins the identical `if (profileToSave.imageGen) delete profileToSave.imageGen.characterTags;` line in `saveProfileToMemory()` *and* `flushProfileSettingsToLoadedKey()` (the H8 chat-switch flush). The file table and the risks section were updated to match, so the claim no longer overreaches.

## Round 1 non-blocking note — also landed

The sync.js special case now specifies map-flavored preservation: `prof[k].characterTags = preservedTags || {}` (not the siblings' `|| []`). Correct — an array would sit inside a map field.

## One new observation (non-blocking, no plan change needed)

Scope item 1's hydration assigns `localProfile.imageGen.characterTags = …` unguarded, while the sibling blocks guard with `if (localProfile.memoryCore)` etc. I checked the ordering: `initProfile` backfills `localProfile.imageGen` from defaults at profile.js:345, which runs before the migration blocks at ~561, so the unguarded write is provably safe today. If you want defensive symmetry with the siblings, adding `if (localProfile.imageGen &&)` is a free improvement — your call, either way is fine.

## Verdict

**APPROVED** — the plan is now accurate about what "mirror the sibling pattern" actually means for a map-shaped field, it covers both settings writers, and the sync preservation matches the data shape. Ready to commit baseline and code.
