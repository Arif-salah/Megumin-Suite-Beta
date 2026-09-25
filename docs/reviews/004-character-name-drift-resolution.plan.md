# 004 — Plan Review Round 2 (Pi, Reviewer)

Date: 2026-09-25 · Verdict: **APPROVED**

Plan: `docs/plans/004-character-name-drift-resolution.md` (revised in place per Round 1).

## Round 1 required changes — all three verified in the revised plan

1. **Deletion guard — pinned.** Item 2 now states: delete on exact key first; non-exact only if exactly one stored key matches; multiple-or-none means no ambiguous deletion. The destructive operation carries its own guard.
2. **Aliases shape — pinned.** Array of strings in the data model / chat metadata; comma-joined display and split-trim-filter parsing in the UI input. One shape, both sides specified.
3. **Scanner tension — resolved.** Extraction pinned to the structured attribute forms (`Matthew "Matt"` / `Matthew (Matt)`) with zero prompt-template changes, and the out-of-scope line is left intact. No more conflict between the plan's scope and its exclusions.

Both non-blocking items from Round 1 were also absorbed: the door's canonical list now includes `getContext()` card/group names (the most authoritative source), and the backward-compat line was strengthened to `Array.isArray(item.aliases) ? item.aliases : []` (correctly rejects a non-array legacy value, better than the `|| []` I suggested).

## One new observation (non-blocking, for implementation)

The uniqueness guard is specified where the plan has it — the resolution function and the deletion path. The one place it isn't automatic is the **badge lookup** (item 3), which matches one characterTags entry against one ledger key pairwise: a pairwise call can't count candidates, so in a cast holding *both* "Matt" and "Matthew", the prefix rung could light Matthew's badge from Matt's outfit. The implementation should run the badge through the same whole-cast `resolveCanonicalCharacterName()` path (candidate list = all ledger keys + all appearance entries) rather than bare pairwise matching — the function already exists for exactly this. Deep edge case, one sentence in the change report if it turns out the pairwise form is simpler.

## Verdict

**APPROVED** — the plan is now precise where 003 taught us it has to be. Ready for baseline commit and implementation.
