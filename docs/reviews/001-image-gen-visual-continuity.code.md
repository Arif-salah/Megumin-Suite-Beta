# 001 — Code Review (Round 1)

Plan: `001-image-gen-visual-continuity` · Reviewed by: Pi · Date: 2026-09-24
Scope: `df9e9db..d9a1739` (1 commit: `feat(001): implement image gen visual continuity engine`)
Change report: `docs/changes/001-image-gen-visual-continuity.md`

**Verdict: FIX — 1 item (small). All plan items implemented; one plan-contract gap on Tier 1 discoverability.**

---

## Verification performed (run, not assumed)

- **Full diff read hunk-by-hunk** — 9 files, all hunks.
- **`node --check` × all 8 source files** — all pass (re-ran independently).
- **Functional test, parser**: realistic `<World_State>` (PC + 2 NPCs) → `pc.name`/`pc.outfit`/`pc.position` still correct (no regression) and **`npcOutfits = {Megumin: "Red magic robe, black headband", Kazehaya: "Blue ninja garb"}`** — the Round-1 parser gap is genuinely closed.
- **Functional test, ledger** (bootstrap → `<World_Update>` with an outfit change, an arrival, a departure): map seeded from parse at bootstrap (deep copy confirmed), updated on change, **departed character removed**, PC block untouched — all as planned.
- **Import graph**: `engine/buildBaseDict.js → features/imagegen/index.js` does not create a cycle (imagegen imports `engine/chatText` + `engine/tasks`, never buildBaseDict). Engine→features is the established pattern (buildBaseDict already imports 6 other feature modules).
- **Model-text regression check for the hidden field**: `npcBuildTextFromData()` (data.js:34-37) already explicitly skips `f.system === "imageTags"`, so `npcBodyFields()`'s new `!f.hidden` filter changes what the *model* sees nowhere — it only hides the field in the bank editor card, as planned.
- **`escapeHtmlAttr`** (used for user-typed character names in the new UI) exists in `src/utils/html.js:11`.
- **Prompt templates**: all 6 rulesets + `userPrompt` + `injectionTemplate` carry continuity language; wording consistent across all.

## Plan compliance (9/9)

| Plan item | Status |
|---|---|
| profile.js `characterTags` schema | ✅ |
| parser.js `npcOutfits` extraction | ✅ (tested) |
| ledger.js bootstrap seed + update + removed-char cleanup | ✅ (tested) |
| fields.js hide bank `imageTags` | ✅ (no model-text side effect — verified) |
| data.js centralized-first tag source | ✅ |
| imagegen Character Appearance card (add/delete/lock/provisional) | ✅ |
| buildBaseDict `[[img1]]` continuity context | ✅ |
| imageGen.js all templates | ✅ |
| non-destructive migration + provisional PC entry | ✅ (see note 3 on timing) |

## FIX list

### FIX-1 — Tier 1 tags are silently dead on a default install (plan-contract gap)

- **Where:** `src/features/npc/data.js:165` (gate) · `src/core/profile.js:204` (`injectNpcTags: false` default) · `src/features/imagegen/index.js:270` (the new UI copy)
- **What's wrong:** Tier 1 flows through `getRelevantNpcImageTags()`, which returns `""` unless the pre-existing **Inject NPC Tags** toggle is on — and that toggle defaults to **off**. So on a fresh install, a user who writes physical-trait tags in the brand-new "Character Appearance & Continuity" card gets *no effect at all* until they discover the separate small toggle above the extra-instructions box. The approved plan promises Tier 1 tags are "reused verbatim in every generation containing that character," and the new UI copy ("Lock physical traits … to eliminate character drifting") makes exactly that promise without naming the toggle. Tier 2 (attire/location from World State) is *not* gated, so half the feature works and half silently doesn't.
- **Evidence:** data.js:165 `if (!s || !s.injectNpcTags) return "";` · profile.js:204 default `false` · the toggle (imagegen/index.js:176) has no link to the new section's copy.
- **Suggested fix (recommended, smallest):** one line of copy in the new section (imagegen/index.js:270 area): "Physical trait tags are added to prompts when **Inject NPC Tags** (below) is on. Attire & location from World State always apply." — alternative if you'd rather make Tier 1 unconditional: bypass the gate inside `buildVisualContinuityContext()` for the PC + NPCs present in the scene. The copy fix is the right trade: the toggle exists to control prompt-size/token cost, which is a real user choice; the plan gap is discoverability, not the gate itself.

## Non-blocking notes (no change required)

1. **Parser fragility, same class as existing:** if the LLM emits a `---` *between* NPC blocks (the template only puts one before 📡), the second NPC's outfit is missed; and an NPC header written as `**Matt** :` (colon outside the bold) won't match. Both are LLM-format drift the existing parser already accepts — just know it's one more place the format can drift.
2. **`{{user}}` literal in the image-prompt context** when World State has no PC name (`buildVisualContinuityContext()` falls back to `{{user}}`). The prompt model handles it, but if you see odd output on fresh chats it's this line.
3. **Migration timing vs plan wording:** the plan said "at load"; the code runs it lazily (on first render/prompt-build). Functionally equivalent — it's idempotent and in-memory it's always correct (every prompt build triggers it); it only becomes *persisted* after the first profile save. No data loss path found, but worth a line in the shipped change-report/NOTES so no one "fixes" the timing unnecessarily.
4. **Relevance scoring still applies** to Tier 1 (keyword match in recent messages) — a character with saved tags but no keyword presence in the last ~12 messages won't get them attached. That's the pre-existing mechanism the plan's "relevance scoring" line already accepted; listed here for the known-limitations write-up.
5. **Redundant double condition** in parser.js's section-end check (outer `if` and inner `if` test the same three patterns) — harmless, cosmetic.

## Sign-off

Code is clean, minimal, and matches the approved plan except FIX-1. Gemini: close FIX-1 (copy line recommended), re-run `node --check` on the touched file, add a one-liner to the change report, and re-send — I expect PASS.

— Pi, the Reviewer
