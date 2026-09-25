# 004 — Code Review (Pi, Reviewer)

Date: 2026-09-25 · Verdict: **PASS**

Reviewed diff: `git diff 736d2fd..ec6887b` (baseline → `feat(004): character name drift resolution and aliases`). Exactly the four files from the plan's table, nothing else.

## Compliance with the approved plan

- **nameMatcher.js (new, pure, node-importable):** all four exported functions present; the ladder runs exact CI → aliases → token/honorific → prefix, and the resolution function enforces the uniqueness guard at every rung (multiple candidates → `null`, never a guess).
- **ledger.js:** `getActiveCastNames()` sources characterTags (+aliases), npcBank, and the ST context card/group cast — the plan's list plus my Round 2 suggestion. Door normalization in `applyWorldStateUpdate()` as specified; deletion runs exact-key first, then non-exact only via the resolver (which returns `null` on ambiguity) — the pinned guard. He also normalized `setWorldStateBootstrap()` — beyond the plan's wording, same door, strictly better, and the report says so.
- **imagegen/index.js:** scanner splits `Matthew "Matt"` / `Matthew (Matt)` into canonical name + `aliases: []` with **zero prompt changes** (pinned scope, out-of-scope line kept); aliases input is comma-display/split-trim-filter (pinned shape); the badge uses the **whole-cast** `activeNpcOutfitsByChar` map — my Round 2 non-blocking note, adopted; `buildVisualContinuityContext()` emits canonical names into the prompt.
- **npc/data.js:** relevance scoring now draws candidates from characterTags *and* npcBank, merges dossier text into existing candidates via the matcher, and matches chat keywords through `isCharacterNameMatch`. The behavior change (sheet-scanned characters without dossiers are now tier-1 eligible) is a genuine improvement and it's documented in the report.

## Verification (ran it, didn't take his word for it)

- `node --check` on all four files: clean.
- Imported `nameMatcher.js` **directly in Node** (pure module — no extraction needed this time) and ran **29 functional cases: 28 pass, 1 non-blocking note** (below). The developer's actual case is the anchor test: candidate "Matt" against cast `["Matthew", "Nia", "Aqua"]` → resolves to "Matthew"; "Sam" against `["Samantha", "Samuel"]` → declines to `null`; a cast holding both "Matt" and "Matthew" resolves "Matt" by exact, not prefix.
- The 1 failure: `stripHonorificsAndParentheticals("Aqua-sama")` — the honorific regex requires whitespace before the suffix (`\s+(sama|…)`), so *hyphen-joined* Japanese honorifics aren't stripped. Non-blocking: the prefix rung rescues the common case ("aqua-sama" starts with "aqua"), and it only bites in a cast where two-plus names share that prefix. One-character-class fix (`[\s-]+`) if you ever care.
- Change report checked against the diff: accurate, and it names its own test suite (`scratch/test-004-suite.js`) — the scratch file was removed after the run, no tree contamination.

## Notes (non-blocking)

1. The hyphen-honorific regex detail above — one-character-class fix, no urgency.
2. `getRelevantNpcImageTags` now returning tags for scanned-but-undossiered characters is a behavior change users will notice (tier 1 injection widens). It's the right direction and it's documented; just worth a line in the README changelog when you next touch it.

## Next

Ready for developer verification: recreate the screenshot scenario — ledger "Matt", Appearance "Matthew" — badge should light; add `Matt, Matty` to the Aliases box and rescan behavior should merge instead of duplicating; and a "Matt left the scene" should clear his outfit without touching a hypothetical second character's.
