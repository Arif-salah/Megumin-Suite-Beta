# 009: Blocks written by Chomusuke (and one combined call per reply)

## Why

With 008 the extension keeps Bonds, the Sheet, Inner Chatter and the Story
Tracker, and hands the story model the true values in Current Info. The story
model still has to WRITE the blocks at the end of every reply, which costs
output tokens and attention it could spend on the prose. Chomusuke already
takes World State off its hands; it can take the blocks too.

## What we agreed (2026-09-30)

- Chomusuke tab: a **Blocks** route with a switch per block under it:
  **Bonds, Character Sheet, NPC Inner Chatter, CYOA choices.** A routed block
  is no longer asked of the story model; Chomusuke writes it after each reply.
- **Story Tracker stays with the story model** (it is the model's own steering
  notes; a reader outside cannot know its intent). Dice stays too (it is written
  before the prose). New NPC / NPC Update keep their own NPC Bank route.
- **Combine calls: one switch.** On: everything routed to Chomusuke for a reply
  (World State, the routed blocks, and the image when one is due) is ONE call.
  Off: separate calls, as today. Replaces the old "World State + image" switch
  (its value carries over).
- Cards look the same: a routed block's tab is drawn from what Chomusuke wrote
  for that message (kept in the store), not from the message text.
- Framing rule: the worker prompt is in-story ("you keep the story's notes"),
  never mentions an extension.

## Design

- **Settings**: `chomusuke.features.blocks` (main switch, off by default) +
  `chomusuke.blockRoutes = { bonds, sheet, chatter, cyoa }` (on by default under
  it). `blockViaChomusuke(id)` = Chomusuke on + profile + main switch + that
  block's switch + the block in the stack.
- **Envelope**: `buildBlocksEnvelope` skips routed blocks (like World State in
  side-model mode).
- **Store**: new `cyoa` module ("latest" kind, not fed to Current Info) so a
  written CYOA survives reloads and follows swipes. Chomusuke's answer is
  recorded per module with `source: "sidemodel"` and `raw` (the block text), on
  the reply's uid/swipe.
- **Worker prompt** (`src/state/modules/stats/worker.js`, pure): the notes as
  they stood BEFORE the reply (`<Bonds_Now>`, `<Character_Sheet_Now>`), earlier
  story, `<Latest_Exchange>`, then one task per routed block using the same
  templates the story model gets, answered as tagged sections
  (`<Bonds>`, `<Character_Sheet>`, `<NPC_Inner_Chatter>`, `<CYOA>`).
- **Separate read** (bridge): on each reply, queued like the World State read;
  dropped if the reply changed or is gone; "Read again" on the card.
- **Cards**: `applyBlocksToMessage` gets the routed blocks' text for that
  message from the store (like `worldStateText`), so tabs, CYOA buttons and the
  Bonds buttons work as before.
- **Combined call**: `combinedTurn.js` becomes the per-reply call for
  everything routed: World State task + blocks tasks + image task (when due).
  Turns with nothing to combine keep the single call they need.

## Phases

1. **Pure**: CYOA module, worker prompt + answer split, tests.
2. **Routing + separate read**: settings and UI (Chomusuke tab), envelope skip,
   per-reply read, recording.
3. **Cards** from the store for routed blocks, "Read again".
4. **Combine calls, one switch**: one call for world + blocks + image.
5. Developer test in SillyTavern; `CLAUDE.md` update.

## Progress

- [x] Phase 1: pure
- [x] Phase 2: routing + separate read
- [ ] Phase 3: cards
- [ ] Phase 4: combine
- [ ] Phase 5: test + docs
