# 011: Dock cleanup

## Why

The tab dock grew to 14 icons in build order. On a laptop the bottom ones fall
off the screen, related tabs sit apart, and some names are unclear: "Global" meant
both a tab and the per-tab Global: On/Off switch, and "PRESETS & COT" uses
jargon.

## What we agreed (2026-10-16)

The dock, top to bottom:

**Main tabs (always visible):**
1. Preset & Thinking (was PRESETS & COT)
2. Blocks (was BLOCKS)
3. The Notebook
4. NPC Bank (was NPCs Bank)
5. Images (was Image Generation)
6. Chomusuke

**Story Setup ▸** (a group that opens in place)
- Writing Style
- Language & Add-ons (was Global Toggles & Add Ons; not "Story Options",
  because Story Config already lives on Preset & Thinking)

**More Tools ▸**
- Story Director (V11 doesn't use it)
- Memory (was Memory Core)
- Banned Phrases (was Dynamic Ban List)
- Side Panel
- Persona: only shown when the active preset uses it (every V8+ preset
  locks it)

**Bottom:** Settings (was Global Settings)

- Clicking a group opens or closes it. Switching to a tab opens its group.
  A closed group holding the open tab is highlighted.
- Phone layout (bottom bar) stays flat: every tab is a pill, no group heads.
- The tab's own heading, the Chomusuke route names and the "Turn on" switches
  use the new names.
- Global sync is keyed by tab title: every rename goes into `RENAMED_TABS`
  (`core/migrations.js`) so a tab set to Global stays Global.
- Each tab gets an `id`. Code finds tabs by id, not by title or position (the
  side panel's NPC button did it by title).

## Phases

1. Dock: ids, order, groups, Persona visibility, CSS (desktop + phone).
2. Names: tab headings, sync keys + migration, Chomusuke labels, side panel
   lookup, other on-screen mentions.

## Progress

- [ ] Phase 1
- [ ] Phase 2
