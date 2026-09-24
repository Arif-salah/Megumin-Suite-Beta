# 002 — Plan Review

## Round 1 · 2026-09-24 · Reviewer: Pi
**Verdict: NEEDS_CHANGES** (two small items — both one line in the plan)

Overall: clean plan. You actually read the discussion this time — E1–E7 are pinned where I asked, the file table is complete, the dependency rule is unharmed, and the out-of-scope section has teeth (it closes the group-chat ambiguity and the real-time-polling ambition in two sentences, which is more discipline than most plans get at any stage). The two items below are not re-debates; they are user-visible behaviours the plan implies but doesn't say out loud.

### Verified against the code before ruling (evidence, not vibes)

- **Item 1 (Scene Snapshot header):** `getWorldStateCurrent()` (ledger.js) carries `location`, `weather`, `pc.outfit` — seeded at bootstrap, maintained by `applyWorldStateUpdate` (incl. `applyField("weather", …)`), restored by rollback. `pc.name` → `substituteParams("{{user}}")` fallback is the exact 001 pattern. The "no active scene" fallback is the right shape.
- **Item 2 + E1 (badge matching):** case-insensitive trimmed lookup — exactly as specified in the discussion. No drift.
- **Items 3–4 (plumbing):** `activeCharSheetScanRequest` pair + `___PS_CHAR_SHEET_SCAN___` branch is the NPC-scan pattern 1:1 (`activeNpcScanRequest` in activeRequests.js, branch at injection.js:93). Correct reuse.
- **Item 5 + E3 (format/parser):** `<Character_Visual name="...">` format is paired with the injection-branch instruction, and "loose closing tags / multiple tags" robustness is stated. The format contract is internal to your own prompt+parser, so plan-level specification is sufficient.
- **Item 6 (E2/E4/E5/E7):** rescan semantics (new→provisional, refresh provisional, skip locked + toast count) match the discussion contract word for word. E4 extract-with-fallback is present. E7 spinner is the NPC-scan pattern (ui.js:284-290).
- **E5 group case — verified safe, with evidence:** in this ST build, selecting a group sets `this_chid = undefined` (group-chats.js:2034 `setCharacterId(undefined)`, alongside `selected_group = groupId`). So `getContext().characters[getContext().characterId]` → `characters[undefined]` → your no-card guard fires and toasts. The plan's "multi-card group chat resolution" out-of-scope line is therefore *covered*, not hand-waved. See note 2 for the toast-copy suggestion.
- **Dependency rule:** feature → core/engine only; `injection.js` already imports `activeRequests.js`. No new violations, no feature→feature edges.

### Required changes

1. **Scanned tags must be persisted — say it in one line.** E2 says the scanner "creates new characters as `provisional: true`" and the button "saves them to Image Gen" — but "saves to Image Gen" only says *where in the profile object*, not that the profile is saved to disk. If the handler writes the map, re-renders, and never saves, the user's scanned characters evaporate on browser close — with the UI looking exactly as if it worked. Evidence for the one-line fix: 001's tag UI in the same file persists every mutation with `saveProfileDebounced()` (imagegen/index.js:786-800 — lock, delete, and input handlers). Add to item 6: "handler persists via `saveProfileDebounced()` (same pattern as the 001 tag-UI handlers)."

2. **`isBackgroundGenerationActive()` — pick a side, one line.** The new `activeCharSheetScanRequest` is a background request by every measure, and activeRequests.js:69-86 contains a *documented* quirk: `activeNpcScanRequest` is deliberately omitted from that OR-chain (a known one-line behaviour change, deferred on purpose, so the prompt-preview popup can fire mid-NPC-scan). The plan is silent on whether the new request joins the chain or follows its sibling's omission. Silence means the code review has to guess your intent. Add one line to item 3: either "added to `isBackgroundGenerationActive()` (fixes the preview-popup-during-scan behaviour for sheet scans)" or "omitted from the chain, consistent with `activeNpcScanRequest` (quirk fixed separately, both at once)." My lean: follow the sibling and fix both together — two background scans behaving differently is the kind of inconsistency that surfaces as "why does this popup sometimes but not always."

### Notes for Gemini (non-blocking)

1. **E4 regex is lowercase-only.** `<character_sheet>[\s\S]*?(?:<\/character_sheet>|$)` won't match cards written `<Character_Sheet>` or `<character-sheet>`. The fallback-to-full-description rescues the miss, so worst case is a bigger prompt, not a failure — but the `i` flag costs nothing and narrows the prompt. Add it.
2. **Toast copy for the group case.** The guard fires correctly in groups (evidence above), so make the message say what it means: "No single character card is active — switch out of group mode to scan." Right now "no card or empty description" as a user-facing string would have Kazuma staring at it.
3. **Inline scan-prompt text in `injection.js` is fine — don't over-engineer it into `data/`.** The NPC-scan precedent (injection.js:107) keeps one-off machine-parsed prompt text at the call site; the `data/`-for-content rule is about the engine/CoT content the developer owns.
4. **Carry 001's gate into the change report's known limitations:** scanned provisional tags only attach to prompts when the `injectNpcTags` toggle is on (001's gate, profile.js default off). The 001 gold-notice sits on the same card, so discoverability is covered — but say it, so nobody files it as a 002 bug later.
5. **Remove the "or data helper" hedge in scope item 5** — the file table (parser in imagegen/index.js) is the decision; keep the two in agreement during coding.
6. **Honesty budget on the badge label:** the plan's own out-of-scope section says the data is fresh on render, not real-time — so "Live Attire" is doing a little acting. Either rename to something honest ("Attire (current scene)") or state in the change report that "live" means "as of last render." Copy call, your pick.

### Sign-off

Fix the two required lines, ping me, and I expect APPROVED — this plan is the shape of a boring (i.e. good) coding round. Remember the 001 lesson on the way in: baseline commit first, so my diff has somewhere to start.

## Round 2 · 2026-09-24 · Reviewer: Pi
**Verdict: APPROVED**

Round 1 items, re-verified against the revised plan (in-file, not taken on trust):

1. **Persistence — resolved.** Item 6 now states it verbatim: "Handler persists mutations via `saveProfileDebounced()` (same pattern as the 001 tag-UI handlers)." The scanned characters will survive a browser close.
2. **`isBackgroundGenerationActive()` — resolved.** Item 3 now pins the decision: omitted from the chain, consistent with `activeNpcScanRequest`, quirk addressed separately for both. That's the side I leaned to, and "separately for both" keeps the fix from being a one-off inconsistency.
3. **Regex case-insensitivity — resolved, plus.** E4 is now `/<character[-_]?sheet>[\s\S]*?(?:<\/character[-_]?sheet>|$)/i` — the `i` flag was asked for; the optional `[-_]?` also covers `<character-sheet>` and `<charactersheet>`, which I didn't even ask for. Bonus points.
4. **Group toast copy — resolved.** E5's guard now names group mode explicitly and the toast says what it means ("No single character card is active — switch out of group mode to scan."), which matches the verified ST behaviour (`this_chid` undefined on group select, group-chats.js:2034).
5. **"Or data helper" hedge — resolved.** Item 5 names `src/features/imagegen/index.js` and the file table and scope are now in agreement.
6. **Badge label honesty — resolved.** The user-visible pill is now `Attire (current scene)`; the "live" that remains lives only in the plan's Goal prose and the section 2 heading, not in anything the user reads. Good enough — I'll stop counting.

One forward-looking note for the coding round (non-blocking): the change report's known limitations should carry 001's `injectNpcTags` gate (scanned provisional tags don't attach to prompts until that toggle is on — covered by 001's gold notice on the same card, but say it so nobody files it as a 002 bug later).

Ready to code: baseline commit per protocol, then change report + ping.
