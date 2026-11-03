# 024 — Every prompt editable in Dev Mode

## Why

Dev Mode only edited the texts that sit under a `[[tag]]` in the preset. Many
texts the story model and Chomusuke get are built in code instead, so they had
no box. One box was even wrong: "World State Block" edited an old text that
nothing sends since plan 005.

## How

- `src/prompts/edits.js` (pure): `setPromptEditReader` (index.js hands it
  `getSharedFragment`), `promptEdit(key)`, `editable(key, builtin, tokens)`,
  `editableTree(obj, prefix)` (a Proxy: every string or list of lines in an
  object of texts reads `${prefix}.${path}`), `fillPromptTokens`.
- Each text is read through `editable` where it is built. Not edited = the
  built-in text, byte for byte (the existing tests check the built-in output).
- An edit can hold `{{tokens}}` for what changes with the settings; Dev Mode
  opens the built-in text with the tokens in place.
- Dev Mode: one shared slot per text in `data/slots.js` (`text(...)`, trigger
  `[[edit:key]]` is a name only), with `placement` (a sentence) instead of the
  preset map. New groups: V11 Preset Rules, Scene & Names, Author's Notebook,
  Chomusuke, Images (V2).
- Framing rule: the texts are the same ones as before; only the user changes
  them.

## Progress

- [x] World State full scene / update (rules and template), Bonds, Character
  Sheet rules (`41ba25d`); the old "World State Block" box hidden.
- [x] V11 preset rules: block rules opening, Blocks opening, Choices, Inner
  Chatter (rules + line), Story Tracker (rules + lines), Dice (player /
  everyone), Death, Combat, Onomatopoeia (plain / styled), NPC Bank new
  characters, story settings opening, final check opening.
- [x] Scene rules + template (Chomusuke's version derived from the edit),
  Known Names lines, final-check block lines.
- [x] Custom block lines (only when it changes, starts fresh, last copy note).
- [x] Author's Notebook: setup ({{truths}}, {{truth_form}}), truth form,
  update rules and the Chomusuke-clues version ({{max}}).
- [x] Chomusuke: World State read opening, Blocks read opening + task line,
  Notebook read opening + rules, Notebook setup opening + rules, combined call
  opening ({{jobs}}) + image task line.
- [x] Images V2: every text in `IMAGE_V2_PROMPTS`, outfit tags task
  ({{who}}), looks task ({{names}}).
- [ ] The developer's test in SillyTavern.

## Not covered

- Structure around the texts (`<Latest_Exchange>`, "# Task", answer shapes):
  the answers are read by those.
- Texts already edited in their own tabs (Story Plan, Memory, NPC Bank, ban
  list, Image Gen Classic).
