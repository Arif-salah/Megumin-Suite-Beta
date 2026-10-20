# 018: Model Setup and the V11 loadouts

## Why

V11 was tested per model (`Desktop/prompt/loadouts.md`): each model works
best with its own mix of prompt version, thinking, length, ban list and
Chomusuke routes. Today a user has to find those settings across four tabs.
The test presets also showed limits that only code can fix (`loadouts.md`,
"Limits of the test presets").

## What we agreed (2026-10-20)

- A new first tab, **Model Setup**. Cards for each model ("Pick your model").
  Clicking a card shows that loadout's settings as switches; **"Use this
  loadout"** applies them all. Nothing is applied by clicking the card.
- **Each switch is the real setting**, a shortcut to the one in its own tab,
  with a small button that opens that tab. A switch that differs from the
  loadout is marked "Changed from the loadout". A loadout recommends, it
  never locks.
- The page is also a quick picker for the **two V11 writing styles**
  (V11 Default, V11 Inside), each with a button to the Writing Style tab.
- A loadout applies to **every character**: the tabs it touches get Global
  sync turned on.
- Loadouts not yet tested (Overthinkers, Gemini Flash, Local) are shown
  dimmed as "coming soon".
- The Model guide popup is replaced by the page.
- **Everything the page switches between is built first**: the preset
  layout, the split rules, V11 Inside, the one-voice presets. The page is
  the last phase.

## Phases

Every text change (anything sent to the model) gets a change list and the
developer's approval before it is written, one at a time.

1. **Preset layout.** The V11 preset gets the layout tested in the loadout
   presets: a fixed part that is the same every turn (so it caches), then a
   changing part after the chat history. Rules move up into the fixed part;
   what changes each turn (which blocks to write now, the dice numbers, the
   image tag when due, World State snapshot or update, the notebook setup)
   goes into one short "This turn" part at the end. Older presets keep their
   slots and layout unchanged.
2. **Rules rewritten in V11's style**, each split into fixed rules plus a
   short per-turn line: blocks, dice, images, add-ons.
3. **V11 Inside** (candidate 7 in `loadouts.md`) and the style reaching V11
   through `[[aiprompt]]`.
4. **The V11 presets in the preset list**: one voice (the base) and the
   writers' room, for Enhanced and Big open models. The short ban list as a
   ban list choice. The length option ("usually 250–350, longer only while a
   fight or sex scene is under way"). A V11 `<formatting>` section, empty when
   all its parts are off. Chomusuke writes the notebook setup when the
   notebook goes to it and the reply has none.
5. **The Model Setup tab.**

## Phase 1: the layout (agreed 2026-10-20)

| Part | Message | Slots |
|---|---|---|
| Top, same every turn | Main Prompt, Main 2 | the engine's text |
| | Add-on rules | `[[onomato]]` `[[death]]` `[[combat]]` `[[npc_events]]` `[[html]]` `[[storyplan_rules]]` (the Story Director's unrestricted content rule) |
| | Ban list | `[[banned]]` |
| | Block rules | `[[block_rules]]` (World State, Notebook) `[[npc_dossier]]` `[[dice_rules]]` `[[img_rules]]` |
| | character sheet, persona, consent note, `<history>` (memory), chat | no NPC list, no story plan |
| Bottom, depth 1 | `</history>` (100), Current info (101: `[[infoblockcurrent]]` `[[npc list]]` `[[storyplan_now]]`), Content (102), Story settings (103), Thinking (104), This turn (105: `[[this_turn]]` `[[formatting]]` `[[reminder]]`…) | |

- `<turn_notes>` holds only what is new each turn: `Dice rolls: 14, 3, 19`, the
  image line on turns one is due (with the V2 cast and previous prompt, or the
  Classic character tags), and the `<Blocks>` skeleton.
- Reworded (approved): the dice rules say "this turn's rolls are listed in
  <turn_notes>"; the image rules open "When <turn_notes> asks for an image…";
  the block rules open "These rules say how to fill the blocks <turn_notes>
  asks for." In "only when a photo is taken" mode the line is "Image: up to 1
  image tag this turn, only if a character is taking or sharing a picture
  right now."
- **Only the rules in use go up top**: World State's first-reply rules or its
  update rules, the Notebook's setup or its update rules. The cache breaks
  once when they switch, then holds.
- **The NPC dossier stays up top as before**, OOC trigger included: it breaks
  the cache only on the turns you ask for one, and you choose those.
- **Memory stays in `<history>`.** Moved down it would confuse the model about
  what happened; the Memory tab already says it isn't cache friendly.
- Older presets get every old slot exactly as before (checked by building
  both versions and comparing every slot, V10 and V11).

## Progress

- [x] Phase 1 built 2026-10-20 (249 tests pass, import check clean). The V11
      Universal preset has the new layout; `data/skeleton.js` regenerated.
      Waiting for the developer to test.
