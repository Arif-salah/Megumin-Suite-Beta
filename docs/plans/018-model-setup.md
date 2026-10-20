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

## Progress

- [ ] Phase 1: change list sent 2026-10-20
