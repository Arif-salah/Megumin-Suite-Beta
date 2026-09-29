# 008: Blocks into the state store ("Current Info")

## Why

Today the story model carries Bonds and the Character Sheet forward by reading
its OWN old blocks in the chat ("carry every number forward from the previous
Bonds block"). A long chat sends it a hundred Bonds blocks (20, 35, 65, 42
affection…) just so it can find the last one.

New approach: the extension keeps the values and hands the model only what it
needs, and the blocks are hidden from what the model reads. The model sees one
clean section, "Current Info", with the true values.

## What we agreed (2026-09-29)

- **Bonds** and **Character Sheet** become state-store modules, like World State
  (005): read from each reply, undone by swipes/edits/deletes, kept per chat.
- **Old chats**: the first time a chat opens, every block already in it is read
  (text only, no AI call), so old characters' bonds are there from day one.
- **Bonds are fed only when needed**: characters in the scene (World State cast,
  when on), anyone named in the last few messages, anyone in the last Bonds
  block. Everyone else stays on file for when they come back.
- **Character Sheet**: always fed while the block is on (it is the player).
- **NPC Inner Chatter** and **Story Tracker**: the last one is fed back.
- **New NPC / NPC Update**: nothing new; the NPC Bank already remembers and
  feeds them. **CYOA, Dice**: nothing to feed.
- **Custom blocks**: no memory and no feeding.
- **Hide blocks from the AI**: the extension removes every block from the chat
  history it sends the story model. On by default, with a switch to turn it off.
  (No preset regex needed.)
- **Placement**: everything goes into `[[infoblockcurrent]]`, as one
  "Current Info" section (World State notes + Bonds + Sheet + last chatter +
  last tracker). Each part only when its block is on and has something.
- The chat looks the same: blocks stay in the message and the cards draw as now.
- Framing rule: the section is in-story wording; never mentions the extension.

## Design

- `src/state/modules/bonds/` — `parse.js` (the `<Bonds>` lines: `Name: Label:
  value | …`; meters as `45/100 (+5 reason)`; labels generic, so user-added
  fields work), `model.js` (per-character record, latest value per field,
  first-wins inside one reply), `render.js` (the notes lines), `index.js`.
- `src/state/modules/sheet/` — same shape, one record (the player).
- `src/state/modules/latest/` — one small module used twice (chatter, tracker):
  keeps the last block's text.
- `src/state/index.js` registers them; each is on only when its block is in the
  stack (any on/off combination valid). Backfill of an old chat on load.
- The template rules change from "carry forward from the previous block" to
  "start from Current Info" (`meguminStatRules` in `features/blocks/registry.js`).
- Hide blocks: in `handlePromptInjection`, strip the `<Blocks>` envelope, every
  registered block tag and the lead `<Dice>` from the chat-history messages.
  Setting in the Blocks tab.

## Phases

1. **Pure modules + tests**: bonds, sheet, latest (parse, model, render).
2. **Bridge**: register modules, backfill on chat load, relevance selection for
   Bonds, "Current Info" in `[[infoblockcurrent]]`.
3. **Prompt wording**: Bonds / Sheet rules read from Current Info.
4. **Hide blocks from the AI**: the stripping + its switch.
5. Developer test in SillyTavern; `CLAUDE.md` update.

## Progress

- [x] Phase 1: pure modules
- [x] Phase 2: bridge + Current Info
- [x] Phase 3: prompt wording
- [x] Phase 4: hide blocks
- [x] Phase 5: test + docs (tested by the developer 2026-09-29)
- [x] Extra: "All characters" button on the Bonds card; hide-blocks marked Recommended
- [x] Extra: Bonds / Sheet editor (Bonds | Sheet), opened from the cards
