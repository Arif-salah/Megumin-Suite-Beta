# 015: Chomusuke tab redesign

## Why

Nine long route rows in mixed order, the Blocks ticks in the middle of the
list, Combine calls in a separate panel that pointed back up the page, and no
way to see what the routes cost.

## What we agreed (2026-10-16)

- One page. Title with the **Chomusuke on/off** switch (like Images and the
  Notebook). **Worker connection:** the profile, Test and its result on one
  line; "Go back to after each job" (was "Primary Chat Profile (Restore
  To)") in an Advanced fold.
- **After every reply** (a call on every reply each): Blocks (World State,
  Bonds, Character Sheet, Inner Chatter, CYOA as chips under it; World State
  is a block, so it lives here; its chip is the World State route), The
  Notebook, Images. **Combine calls**
  and its fallback live in this group. A **cost line**: "Each reply costs up
  to N Chomusuke calls → with Combine calls on: 1", counting only jobs that
  are on here *and* in their own tab.
- **When the job runs** (occasional): Memory, NPC Bank, Story Director,
  Banned Phrases, Writing Style generator, as tiles in two columns.
- A job whose feature is off in its own tab shows a red chip ("The Notebook
  is off →") that opens that tab. `REFRESH.SWITCH_TAB` now takes a tab id
  too, so a tab can link to another without importing the tab list.
- "How Chomusuke works" is one muted line at the bottom.
- Same stored settings (`chomusuke.features`, `blockRoutes`, `combine`).

## Progress

- [x] Built 2026-10-16, waiting for the developer to test
