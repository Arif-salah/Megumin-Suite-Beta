# 023: Custom blocks that remember

Status: **planned**, waiting for the developer's answers to the open
questions at the end. Choices made with the developer on 2026-11-02.

## Why

A custom block today is a name, an emoji, Shown / Hidden and a free
template (`features/blocks/ui.js` `renderCustomBlockEditor`). Only the story
model writes it, it is drawn as plain text, and nothing keeps it: it is not
in the state store, has no edit, no Revert, no "Read again".

The real problem is memory. "Hide old blocks from the AI" (on by default)
strips custom tags from old replies (`injection.js` →
`hideBlocksInMessages(messages, meguminAllBlockTags())`) and puts nothing back.
So the model never sees its last copy, and a block like `Trust: [0-100]`
gets a made-up number every reply.

## What the developer picked

| Question | Choice |
|---|---|
| What it remembers | **Per block**: fresh each reply, or carried forward |
| How it is carried (developer's note) | **Per block**: kept in the chat (old copies stay in the history the model reads), or the last one in Current Info |
| How it is built | **Both**: a field list (like the Character Sheet) or a free template (as now) |
| Who writes it | **Per block**: the story model or Chomusuke |
| When it is written | **Per block** |
| How it looks | **Auto**: bars for meters, chips for lists |
| Extras | Edit the values by hand, Read again |
| Starter blocks | None |

## The block, as the user sets it up

The editor (Blocks → Create custom block / ✏️) grows from four rows to
these. Labels are drafts (rule 8: the user's words, the effect on the story).

1. **Name, Emoji, Shown / Hidden**: as now.
2. **What it holds**: *Fields* | *Free text*.
   - Fields: the same field list editor as Bonds and the Sheet
     (`renderStatFieldEditor`): Meter (max, start), Number (start), Text,
     List. The template is built from the list, like the Sheet's.
   - Free text: the template box, as now.
3. **What the story remembers of it** (three tiles):
   - **Starts fresh**: the story doesn't see the last one. Old copies are
     hidden with the other blocks. (Today's behaviour.)
   - **Stays in the chat**: old copies are left in the replies the story
     reads, even with "Hide old blocks from the AI" on. Costs tokens on every
     old reply; the tile says so.
   - **Last one in Current Info**: the story reads only the latest, once, in
     `<Current_Info>`. For a Fields block that is the kept values (a field the
     reply leaves out keeps its value, `+5` moves it, like the Sheet); for
     Free text, the last copy as written.
4. **Who writes it**: *The story* | *Chomusuke*. Chomusuke shows as
   unavailable, with the reason, when Chomusuke is off or has no connection
   (it never changes Chomusuke's own switches).
5. **When it is written**:
   - **Every reply**
   - **Only when something in it changes** (not offered with *Starts
     fresh*: the story can't know what changed from a block it doesn't see)
   - **Every N replies** (N box, 2 to 20)

Stored on the block's entry in `blockStack.custom` (so it follows the Blocks
tab's "This character only / Every character" choice), new keys with
defaults that keep old blocks working exactly as now:
`kind: "text" | "fields"`, `fields: []`, `memory: "fresh" | "chat" | "info"`,
`writer: "story" | "chomusuke"`, `when: "every" | "changes" | "everyN"`,
`everyN: 3`, `tags: []` (old tags after a rename, see below).

## How it works

### Kept in the store (all three memory choices)
One store module `custom` (`src/state/modules/custom/`, pure): its state is
`{ blocks: { <block id>: Sheet-shaped fields | Latest-shaped text } }`. Its
parse reads every custom block's tag (and its old `tags`) from a reply,
using the block list handed in from the bridge (`setCustomBlockDefs`), so the
module stays pure. Field blocks reuse `parseSheet`'s cell reader and
`applySheet`; text blocks reuse `parseLatest` / `applyLatest`. Swipes, edits
and deletes undo it like every other block, and the card's
"Changed in this reply" can list it.

Every block is kept, even *Starts fresh* ones: the card, the editor and
"Read again" work from the store, and a block switched to another memory
choice later already has its history.

### Sent to the story
- **Envelope** (`blocksEnvelopeParts`): a custom block is in the skeleton
  only on a turn it is due: *Every reply* always; *Every N replies* when N
  replies have passed since its last copy on file; *Only when it changes*
  always, with a line in its template "Leave this block out when nothing in
  it changed this turn." (the skeleton already says a block may be left
  out); *Chomusuke* never (it writes after the reply).
- **Current Info** (`buildCurrentInfo`): a block on *Last one in Current
  Info* adds `<Name_Now>` (fields, kept values) or `<Last_Name>` (free text),
  after the Story Tracker, in the stack's order. Its template starts "Start
  from <Name_Now> in <Current_Info>…" the way Bonds' does.
- **Hide old blocks** (`meguminAllBlockTags`): leaves out the tags of blocks
  on *Stays in the chat*, so only those survive in the history.

### Written by Chomusuke
`BLOCK_ROUTE_TAGS` and `blockViaChomusuke` grow to take custom blocks whose
`writer` is Chomusuke (with Chomusuke's Blocks route on). The separate blocks
read and the combined call (`combinedTurn.js`) get the block's template and,
for *Last one in Current Info* and *Stays in the chat*, its values from
before the reply in the notes (`renderWorkerNotes`), like Bonds. Recorded
with `source: "sidemodel"` on the reply's swipe; the card draws it from the
store with the pending / missing states it has now.

### Drawn
- Fields: the Sheet's drawing (`parseSheet` / `renderSheet` in
  `blocks/treatments.js`) with the block's own field list
  (`meguminStatFieldMap`), so meters are bars and lists are chips.
- Free text: the plain drawing, as now (it already draws `Label: 45/100`
  lines as bars).

### Edit by hand, Read again
- **Edit**: a button on the block's tab in the card opens a popup: the
  fields (clear a box = remove the value) or the text. Saved as the user's
  own change (`addUserEntry`), never undone by swipes, like the Sheet editor.
- **Read again**: on a block Chomusuke writes, as on the routed blocks
  today (`blocksBeginRead(index, { force: true })`).

### Renaming a block
The tag comes from the name. A rename moves the old tag into `tags`, so old
replies still read as this block and the store keeps its history.

## Plan check: what the model can't see

One turn on each route, for a block "Trust" (meter) and a block "Quest log"
(free text).

**Story model, Starts fresh.** It sees no old copy. It writes Trust from
the story alone, so the number can jump. That is the user's pick; the tile
says "the story doesn't see the last one". Can its writing replace good data?
The store keeps it, but nothing it keeps is sent back, so no. "Only when it
changes" is not offered here.

**Story model, Last one in Current Info.** It sees `<Trust_Now>` with the
kept value. A reply that leaves the block out (*only when it changes*)
changes nothing on file. A field it leaves out keeps its value. Risk: the
**Quest log copies itself and grows**, since it is handed the last copy and
asked for a new one (Inner Chatter did exactly this, `8835536`). Guard: the
Current Info section for a free-text block says "Write the whole block again
as it stands now: keep what still matters, drop what is finished." The block
also gets an optional line limit (open question 2).

**Story model, Stays in the chat.** It sees every old copy in the replies
still in its context, as it would with hiding off. Nothing is handed back
twice. Token cost grows with the chat; the tile says so. A reply cut off by
the context window loses the oldest copies first, which is fine for values
that live in the newest one.

**Chomusuke.** It gets the exchange and, unless *Starts fresh*, the values
before the reply. It can't see later replies, so a swipe or edit of the
reply drops its answer (the token check that exists today). If its answer
has no block, the entry is "missing": nothing on file changes, and the card
offers Read again. *Only when it changes*: Chomusuke may answer with the
block left out; that records nothing, the old values stand.

**Manual (Edit).** The user's values become the next Current Info. A
later reply builds on them; its change can still move them, which is the
point.

**Can the writing keep itself in the prompt forever?** Only the free-text
*Last one in Current Info* case, covered above. A field block can't: its
size is the field list.

## Phases

1. **Store module (pure) + tests.** `modules/custom/` parse / model /
   render, block list handed in, tag aliases, fields and text, "left out"
   = no change. Tests in `tests/custom-blocks.test.mjs`.
2. **The editor and the story route.** New editor rows and defaults,
   envelope per *when*, Current Info sections, hiding per *memory*, the
   bridge recording replies (`stateOnMessageReceived`, swipes, chat load,
   import of old replies once).
3. **Chomusuke route.** Separate read and combined call, card states,
   Read again, the Chomusuke tab's per-block switches list custom blocks too.
4. **Card: drawing and Edit.** Field blocks drawn like the Sheet; the
   Edit popup.
5. **Docs.** CLAUDE.md architecture note, README entry.

## Progress

- [x] Phase 1 (2026-11-03): `src/state/modules/custom/` (model, parse,
  render, index with `createCustomModule(getBlocks)`), texts in
  `src/prompts/customBlocks.js`, `parseFields(text, tag)` in stats/parse.js,
  `stripBlocksForModel(text, tags, { keep, whole })` for the per-block memory
  choice. 12 tests in `tests/custom-blocks.test.mjs`. Not wired in yet:
  nothing changes for the user until phase 2.
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
- [ ] Phase 5

## Decided with the developer (2026-11-03)

1. **No rows per character.** A field block has one set of fields. Anything
   per character is written into the template by the user; we don't build it.
2. **No line limit** on a free-text block that carries forward. The "keep
   what still matters, drop what is finished" line is the only guard.
3. **Read again only on blocks Chomusuke writes**, as now.
4. **Chomusuke can't run** (off, or no connection) for a block set to
   Chomusuke: the block is **left unwritten** and its tab in the card says
   so in plain words. The story model is not asked for it instead.
5. **A custom block's memory choice is its own.** It works the same with
   "Hide old blocks from the AI" on or off, and is never greyed out: a block
   on *Stays in the chat* keeps its old copies while every other block is
   hidden, and a block on *Starts fresh* or *Last one in Current Info* has
   its old copies taken out even when hiding is off.
