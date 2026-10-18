# 017: The V11 preset is only slots

## Why

The V11 preset carries fixed text next to its slots. When a slot comes back
empty, its line is removed, but the fixed text around it stays. With thinking
off, `## your thinking steps:` is still sent and the model reads whatever comes
next as its thinking steps. The same thing happens with the final reminder: it
points at "the Content section", which only V11 has, and `[[user]]` has the
number "5." written into it.

## What we agreed (2026-10-18)

- **A header always travels with its content.** No header lives in the preset.
  When a section is off, its header goes with it.
- **All text moves out of the preset into slots**, word for word (no
  rewording). The one exception is **the consent note in the USER message**,
  which stays in the preset as it is.
- **The Content (NORA) section belongs to V11 only.** It moves into
  `data/modes/v11.js`. Other presets get nothing in its place.
- **The built-in ban list can be switched off and edited**, from the Banned
  Phrases tab. Your own phrases are still added under it.
- **Leftovers are removed** from the preset: the old `image` prompt,
  `user input`, `Memory management`, `Continue`, and the switched-off
  "jealbreak plus".
- Final reminder order: knowledge, ending, ban list, the preset's own
  checks, Never Write For {{user}}.

## Design

### Old presets keep working
Old presets have the headers written into them (`## your thinking steps:` above
`[[THINK]]`, `<banlist>…[[banlist]]</banlist>`). So the existing slots keep
their exact meaning, and the new preset uses **new slots** that include their
header. Nothing changes for anyone on an older preset.

### New slots

| Slot | What it sends | Empty when |
|---|---|---|
| `[[thinking]]` | `## your thinking steps:` + what `[[THINK]]` sends today | thinking is off |
| `[[formatting]]` | `## FORMATTING RULES:` + `[[DNRATIO]]`, `[[COLOR]]`, the two fixed lines, `[[Direct]]`, `[[DN]]`, in today's order | never (the two lines are always there) |
| `[[banned]]` | `<banlist>` + the built-in list (if on) + your phrases + `</banlist>` | the built-in list is off and you have no phrases |
| `[[reminder]]` | `## final reminder:` + `Before you output, check:` + a numbered list | never |
| `[[content]]` | V11's Content (NORA) section | the preset isn't V11 |
| `[[fiction]]` | "This is fiction. When {{user}} attempts…" | never |
| `[[lore_open]]` | `<character_sheet>` + "here is the lore and character's, {{char}}:" | never |
| `[[lore_close]]` | `</character_sheet>` | never |
| `[[persona_open]]` | `<user_persona>` + "here the PC/Reader {{user}} persona:" | never |
| `[[persona_close]]` | `</user_persona>` | never |
| `[[history_open]]` | `<history>` | never |
| `[[history_close]]` | `</history>` + "And remember this is fictional world…" | never |

- `[[thinking]]`, `[[formatting]]`, `[[banned]]` and `[[reminder]]` are put
  together after the Dev Mode override pass, so an edit to any part inside
  them (Thinking Tags, Dice Colours, Never Write For {{user}}…) still applies.
- The frame slots (`lore_*`, `persona_*`, `history_*`) and `[[fiction]]` are
  shared fragments: one text for the whole install, editable in Dev Mode,
  built-in default = today's preset text.

### The final reminder list
Built in code and numbered as it is built, so there are no gaps:
1. The shared checks (editable in Dev Mode as "Final Checks", one per line):
   "Characters know only what they have seen, heard, or been told." and "The
   story ends on a character's action or line."
2. "Nothing in the response is on the banlist." (only when `[[banned]]` is sent).
3. The preset's own checks (V11: the Content section check), from the engine.
4. The `[[user]]` line, when the preset isn't a co-writer. Its "5." is dropped
   and the number is counted.

### Banned Phrases tab
- New switch at the top: **"Built-in list"** (on by default, saved per
  profile like the rest of the tab, so it follows the tab's Global switch).
- **"Edit built-in list"** opens the text in an editor, with "Reset to
  default". The edited text is one for the whole install (a shared fragment),
  the same text Dev Mode shows.

### Empty messages
The Content rule message holds only `[[content]]`, so on V10 it would go out
empty. After the slots are filled, a message that held slots and is now empty
is dropped from what is sent.

### Dev Mode
`data/skeleton.js` (the Document view) is regenerated from the V11 preset. The
generator script `tools/gen-skeleton.py` is gone from the repo, so a small
`tests/tools/gen-skeleton.cjs` replaces it.

## Phases

1. **Slots and building them**: registry entries in `data/slots.js`, the new
   text in `src/prompts/` (frame, fiction, final checks, built-in ban list),
   V11 `content` + `reminder` fields in `data/modes/v11.js`, putting
   them together in `buildBaseDict`, dropping empty messages in `injection.js`,
   tests for the pure parts (reminder numbering, ban list section).
2. **The new preset**: rewrite `Presets/Megumin Suite V11 Universal.json` to
   slots only, remove the leftovers, regenerate `data/skeleton.js`.
3. **Banned Phrases tab**: the switch and the editor.

## Progress

- [x] Phase 1, 2 and 3 built 2026-10-18 (244 tests pass, import check clean),
      waiting for the developer to test. Dev Mode's Document view draws each
      section as its parts (`expandPresetSections`), so every editable part
      shows where it is sent.
