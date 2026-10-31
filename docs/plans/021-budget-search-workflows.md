# 021: Prompt size meter, dock search, starter workflows

Status: **for later**. Three ideas kept out of 020 (UX redesign) on purpose.
Start this only after 020 is done and tested: phase 2 needs 020's dock, and
all three use 020's controls (`header`, `note`, `confirmPopup`).

## Why

- **The token badge counts the wrong half.** `core/tokens.js` estimates the
  preset, thinking, style and add-ons, but skips everything that grows with
  the chat (`excludeKeys`: Blocks, Current Info, Memory, NPC list and
  dossiers, image rules, Story Director, Ban List). Those are the parts users
  actually need to watch: the README's "3–4 blocks at most" advice exists
  because of them, and nothing in the window shows it. The breakdown is a
  hover-only tooltip with four buckets ("Engine Core", "CoT / Logic"…) in
  words the rest of the window doesn't use.
- **Finding a setting means knowing which tab it lives in.** 020 makes the
  dock readable, but "where is the dice setting?" still means opening tabs.
  A plain search box in the dock answers that without a command palette.
- **"New workflow" makes an empty `{}` file** (`imagegen/comfy.js`
  `igNewWorkflowClick`) and opens a JSON editor. A new user has to build a
  ComfyUI workflow with our `%prompt%` / `%seed%`… placeholders
  (`data/image_data.js` `KAZUMA_PLACEHOLDERS`) before the first image. Most
  give up there.

## Phases

### Phase 1: Prompt size meter

What the user sees: the badge in the top bar shows the real size of what
the story model gets, and a click opens a short list of what makes it up.

- Pure part, new `src/core/promptSize.js` (tested): takes the built dict
  (`buildBaseDict(true)`) and `data/slots.js`, returns one row per part with
  its estimate, its label and its owning tab (the slots' `where`). No double
  counting: keep today's rules (the `[promptN]` aliases, `[[blocks]]` vs its
  per-block tags, `[[style]]` vs `[[aiprompt]]`, the V11 split copies) as a
  table in this file, with a test for each.
- Two groups, in the user's words:
  - **Every reply**: preset, thinking, writing style, story settings,
    language, add-on rules, block rules, ban list.
  - **Grows with the story**: Current Info (World State, Bonds, Sheet,
    Notebook), Memory, NPC Bank, Story Director's plan. Measured on the
    open chat, labelled "in this chat right now".
- `tokens.js`: the badge shows both ("~3,100 + 1,450 in this chat"). The
  estimate stays chars ÷ 4.8 and the popup says "Estimate". If SillyTavern's
  tokenizer (`getTokenCountAsync`) is cheap enough on the open-popup path,
  use it there only; the badge keeps the fast estimate.
- Click the badge → popup (`Popup`): a bar per row, sorted by size, each
  row with a "Go to tab" link (switch tab by id). Rows for modules that are
  off are not shown (rule 2: no module is assumed on).
- One note, not a hard limit: with more than 4 blocks on, a line under the
  list: "More blocks means less room for the story. Most chats run best with
  3–4." No numeric cap, nothing is turned off for the user.
- Not counted, and the popup says so in one line: the chat history itself,
  the character card, and lorebooks (SillyTavern's side).
- Tests: `tests/promptSize.test.mjs` (grouping, no double counting, modules
  off → no row, V11 split).

### Phase 2: Search box in the dock

What the user sees: a box at the top of the dock, "Find a setting". Typing
shows matching settings with the tab they live in; Enter or a click opens
that tab and briefly highlights the setting.

- Index, two sources:
  1. Each entry in `tabsUI` (`src/ui/tabs.js`) gets `keywords`: the words a
     user would type that aren't on screen ("dice" → Language & rules,
     "uncensored" → Chomusuke, "comfy" → Images, "context" / "tokens" → the
     meter from phase 1).
  2. The setting labels themselves: after a tab renders, read its row labels
     (`.set-label`, the `header()` titles from 020) into a cache per tab id.
     Tabs not opened yet in this session are covered by their keywords only;
     the first search renders nothing in the background (no hidden
     renders: some tabs fetch from ComfyUI or the server).
- Matching: plain, case-insensitive, word start first. No fuzzy library.
- Jump: `switchTab(id)`, then scroll to the first row whose label matches,
  open its fold if it's inside one, and flash it once. If the row is inside
  a sub-page (Writing Style → Language & rules), open that sub-page.
- Legacy tabs show in results with their group name ("Memory · Older
  tools").
- Phone (≤ 768 px bottom bar): a search icon in the bar opens the same box
  as a sheet.
- Keyboard: `/` focuses the box while the window is open and no text field
  has focus. Nothing else; no global shortcut (SillyTavern owns those).
- Tests: the pure matcher (`src/ui/searchIndex.js`): keywords, label cache,
  ordering.

### Phase 3: Starter ComfyUI workflows

What the user sees: "New workflow" offers "Start from: Empty / Illustrious
(SDXL) / Z Image". Picking a starter saves a working workflow with the
placeholders already in place; the user only picks their model.

- The developer provides the two workflow files (exported from ComfyUI
  "Save (API format)", tested on his machine) for the two tag styles the
  extension already writes for (`classic/ui.js` rules: Illustrious, Z
  Image). Stored in `data/workflows/` as `.json`, loaded with `fetch` like
  the other data files.
- Each starter uses only nodes that ship with ComfyUI (no custom nodes), and
  the placeholders `%prompt%`, `%negative_prompt%`, `%seed%`, `%steps%`,
  `%scale%`, `%model%`, `%sampler%`, `%width%`, `%height%`. LoRA slots left
  out of the starters (they need a custom loader or empty-name handling).
- `igNewWorkflowClick`: the name prompt becomes 020's `askName` with the
  "Start from" choice; saves with `/api/sd/comfy/save-workflow` as today.
  Same name as an existing file → ask before overwriting.
- After saving a starter: one note on the Images tab, "Pick your model
  below, then Test", and the model list refreshes.
- Plugs into 020's Images checklist step "2 Workflow and model": with no
  workflow yet, the step shows the "Start from" buttons directly.
- Check: a starter's JSON contains every placeholder the generator fills
  (small test against `KAZUMA_PLACEHOLDERS`), and parses.

## Not in scope

- A command palette, merging tabs, setup wizards, undo for every AI write
  (talked through on 2026-10-31 and left out: too much work for what they
  give, or 020 already covers the need).
- Anything sent to the story model or Chomusuke (rule 1): phase 1 only
  measures, it never trims or changes the prompt.
- Prompt content in `data/` (rule 3). The workflows are new data files, not
  prompt text.

## Open questions

1. Phase 1: should the meter also show Chomusuke's prompt size per job (from
   the background prompt preview, plan 013), or stay story-model only?
2. Phase 1: is SillyTavern's real tokenizer fast enough on the popup path
   with a long chat, or do we keep the estimate everywhere?
3. Phase 3: which checkpoints should the starters name by default (or leave
   `%model%` and let the list pick the first)? Need the developer's files.

## Progress

- [ ] Phase 1: Prompt size meter
- [ ] Phase 2: Search box in the dock
- [ ] Phase 3: Starter ComfyUI workflows
