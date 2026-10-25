# 020 — World State lists stay short

## The problem

Some models add Unresolved Threads, Planted Seeds and Consequence Timers but
never remove them, so World State grows to 10–15 seeds. Adding is one line;
removing means noticing a seed paid off and copying its text back, and
nothing told the model there was a limit.

## Agreed with the developer (2026-10-25)

- **Limits:** at most 3 Threads, 3 Seeds, 2 Timers.
- **Numbers instead of copying:** `<Current_World_State>` lists the items
  numbered (`1. …`) with the count (`Seeds (2 of 3)`); a removal can be
  `Seed-: 2`. The number refers to the list as it stood before the reply.
  Copying the text still works.
- **The rules say the limit** and ask the model to remove the one that matters
  least (or the story already answered) before adding to a full list.
- **Hard cap:** after a reply (the story model's or Chomusuke's), a list over
  its limit drops its oldest items. Shown in "Changed in this reply", so the
  reply's Revert brings them back. A first World State that writes too many
  keeps the first ones. The user's own edits are never cut by the edit
  itself; the editor shows the limit.
- **Notebook on:** Seeds are hidden (prompt, rules, card, editor), the same
  way Secret is, because the Notebook's clues do that job.
- **Not done:** the extension counting timers down itself (developer's call).

## Phases

1. Model: `LIST_LIMITS`, number references, the cap (`byUser` edits exempt).
2. Prompt + rules: numbered lists with counts, limit rule, Seeds hidden with
   the Notebook on.
3. Card + editor: Seeds hidden with the Notebook on, editor titles show the
   limit.

## Progress

- [x] Phase 1–3 built, tests added. Waiting for the developer's test.
