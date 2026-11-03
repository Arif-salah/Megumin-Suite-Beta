# CLAUDE.md — Megumin Suite (Beta)

A SillyTavern extension (ES modules + jQuery, no build step). Its heart is the
**placeholder swapper**: engines + prompt injection that run on every send. Every
other feature (Blocks, World State, Image Gen, NPC Bank, Memory, Story Plan,
Ban List, Side Panel, Chomusuke worker…) is an optional module.

- Full map of the codebase: `PROJECT_OVERVIEW.md` — still accurate for the core and
  older modules, but written **before** plans 005/006. For World State and Image
  Gen, trust this file and `docs/plans/005-*.md`, `docs/plans/006-*.md`.
- `docs/old/` = archive (Gemini-era plans/reviews 001–004, old spec, the retired
  two-agent loop files). Read only for history; don't follow its rules.

## How we work

- **Chat first.** Talk the idea through with the developer, agree, then write a plan
  in `docs/plans/NNN-name.md` (phases + Progress section), then build phase by phase.
  The developer tests each phase in SillyTavern and reports back.
- **Commit locally after each milestone**, staging by path (never `git add -A`, the
  `.claude/` folder is untracked on purpose). Style: `feat(NNN): …`, `fix(NNN): …`,
  `docs(NNN): …`, plain-language subject about what the user sees. End with the
  `Co-Authored-By` line. **Never push.**
- Tests: `node --test "tests/*.test.mjs"` (Node 25). Only pure modules are tested —
  anything importing SillyTavern (`src/st.js`, `../../../../script.js`…) can't load
  in Node. For those, run `node tests/tools/check-imports.cjs` (every relative
  import resolves and every imported name is exported).
- Windows + **CRLF** files. For multi-line edits by script, write a `.cjs` file to the
  scratchpad that normalises `\r\n` → `\n`, replaces exact unique strings, writes
  back with CRLF. Don't do it with `node -e` (escaping breaks strings and regexes).
- Git may print a `multi-pack-index … Permission denied` repack warning: harmless.

## Standing rules

1. **Framing rule.** Anything sent to the story model or Chomusuke must stay in-story:
   never mention an extension, app, system, ledger, tool or "the user's settings".
   The model is just telling a story with the user.
2. **Core vs Modules.** Engines + injection must always work. Every module has its
   own switch; any on/off combination is valid; never assume a module is on.
3. **Prompt content in `data/`** (engines, CoT, styles) is the developer's design.
   Build the machinery; don't rewrite that content unasked.
4. **`window.LukaSuite`** (side panel) is a tribute to Luka, who contributed the side
   panel. Never rename or remove it.
5. Side panel is **out of scope** for World State / Image Gen work unless asked.
6. World State "deep current" fields (Mood, Agenda, Secret, Unresolved threads) are
   meant to change rarely — the prompts explain this in words, not numeric rules.
7. When a model writes the same field twice in one update block, **the first wins**.
   `Condition` belongs to the player only.

## Architecture: what 005–008 built

### State store (`src/state/`)
- `store.js` — `createStateStore({adapter, modules, journalDepth, rootKey})`. A
  journal of entries keyed by message uid/seq (stamped in `extra.megumin_uid` /
  `megumin_seq` on every swipe) + swipe index. Active entries = message present and
  showing that swipe, or orphan, or user entry. `reconcile`: missing message with
  later survivors → orphan (kept); otherwise rewind (dropped). Old entries fold into
  a checkpoint at `journalDepth`. `reparseStale` re-reads raw text when a module's
  `version` goes up. Pure — fully unit-tested.
- `modules/world/` — `parse.js` (line format + legacy markdown, exact labels, block
  markers), `model.js` (`applyWorldChanges`: cast present/offscreen/aliases,
  first-wins, PC-only Condition, timers by subject), `render.js` (prompt notes,
  update/bootstrap instructions, card, Chomusuke read task), `index.js`
  (`worldModule`, `version: 2`).
- `modules/stats/` (plan 008) — Bonds, Character Sheet, Inner Chatter, Story
  Tracker. `parse.js` ("Label: value | …" cells, labels read as written so
  user-added fields work; meters `45/100 (+5 reason)`, bare `+5` moves the old
  value), `model.js` (bonds per character, never dropped; first-wins; name match
  exact then unique first name; `pickBondsFor`: scene cast + names in the last 3
  messages + the latest Bonds block), `render.js`, `index.js` (`bondsModule`,
  `sheetModule`, `chatterModule`/`trackerModule` = last copy only).
- `index.js` — the SillyTavern bridge: settings, `worldUpdateMode()`
  (`inline` = story model writes `<World_Update>`; `sidemodel` = Chomusuke reads
  the reply, when the Chomusuke tab's World State route is on; `manual`), prompt
  block for `[[infoblockcurrent]]`, event handlers (`stateOn*`), Chomusuke read,
  external-read API used by the combined call.
- UI: `src/features/worldstate/card.js` ("Changed in this reply" strip, folded by
  default; Revert/Restore/Read again/Edit), `editor.js` (State + History popup),
  settings in `src/features/blocks/ui.js`.
- Stats in the bridge: `STAT_MODULES`, `statBlockOn(id)` (block in
  `blockStack.order`; tracker follows `storyPlan.enabled`). All four are recorded
  while any is on; old chats are imported once on load (text only).
  `statsPromptParts` + `bondsOverview`.
- **Current Info** (`buildCurrentInfo` in `engine/buildBaseDict.js`) fills
  `[[infoblockcurrent]]`: `<Current_Info>` = World State notes + `<Bonds_Now>` +
  `<Character_Sheet_Now>` + `<Last_Inner_Chatter>` + `<Last_Story_Tracker>`, each
  only when its block is on. Bonds/Sheet rules say "start from <Bonds_Now> in
  <Current_Info>" (`meguminStatRules`).
- **Hide old blocks from the AI** (`engine/hideBlocks.js`, setting
  `hideBlocksFromAI`, default on, Blocks tab, marked Recommended): strips the
  envelope, every block tag, lead Dice and old `<details>` cards from
  **assistant** messages before placeholders are filled (the preset's block
  template stays). Chat Completion only. Custom blocks: stripped, never fed.
- Bonds card: "All characters" button → popup of every kept character
  (`features/bonds/overview.js`), "In the story now" first. "Edit" (Bonds card,
  overview) and "Edit sheet" (Sheet card) open `features/bonds/editor.js`:
  Bonds | Sheet tabs, no History (the developer's call: to change a value, edit
  it again). Edits are user entries; clear a box = remove the value; Forget =
  `parsed.forget`.
- **Blocks via Chomusuke** (plan 009): Chomusuke tab Blocks route
  (`chomusuke.features.blocks`, off by default) + per-block switches
  `chomusuke.blockRoutes = { bonds, sheet, chatter, cyoa }`.
  `blockViaChomusuke(id)` in `state/index.js`. A routed block is skipped in the
  envelope; Chomusuke writes it after the reply (prompt + answer split in
  `modules/stats/worker.js`, pure), recorded with `source: "sidemodel"` on the
  reply's uid/swipe. CYOA has its own `cyoaModule` (latest only, not in Current
  Info). Cards draw routed blocks from the store, with "Read again". Story
  Tracker and Dice stay with the story model.
- Storage: `chat_metadata.megumin_state`.

### Image Gen (`src/features/imagegen/`)
- `index.js` — shell. Top of the tab switches **Classic | V2**. V2 is only active when
  World State is on (else it falls back to Classic; red banner + enable popup).
- `comfy.js` — shared ComfyUI generator. `setImagePromptResolver` lets V2 swap
  `@Name` before sending (prefix/triggers added after, and not re-added on retry).
- `classic/` — the pre-001 tab (`df9e9db`) + character sheets in the manual prompt.
- `v2/` — the model writes `@Name` only; the extension fills in that character's
  saved look (+ body tags only for full-body framing) and current outfit from World
  State. `cast.js` builds `<Cast>` (sex, appearance, body, wearing, position);
  `resolve.js` does the substitution; `looks.js`/`looksCore.js` = look scan (NPC
  Bank / sheet / chat / manual), review popup (established looks change only on
  click; `+Name` arrivals get automatic looks), detailed outfit tags cached by
  outfit hash; `prompt.js` = all V2 prompt shapes incl. the combined call;
  `ui.js` = the V2 page (own cards + Classic's shared generator panels moved in).
  Method "Edit last prompt" is experimental.
- `auto.js` + `slot.js` — automatic images written by Chomusuke instead of the
  story model; placed at end or a random paragraph (never inside think/blocks).
- `combinedTurn.js` — **one Chomusuke call per reply** for everything routed to it:
  World State + routed blocks (009) + image when due ("Combine calls", one switch,
  off by default, with a separate-read fallback toggle), for V2 and Classic. Answers come back as
  tagged sections (`<Image_Prompt>`, `<Outfit_Tags>`, `<Character_Visual>`, world
  block), not JSON. `<Character_Sheets>` always go before the story; all tasks
  together at the end.
- Prompt texts: `src/prompts/imageGenV2.js`.
- Storage: `chat_metadata.megumin_character_tags` (looks),
  `chat_metadata.megumin_image_v2` (last prompt, outfit tags).

### Chomusuke worker (`src/engine/tasks.js`, tab `src/ui/tabs/chomusuke.js`)
- `runWithChomusuke` switches to the worker connection profile; runs are **queued
  one at a time**. **Never call it from inside a running task** (deadlock). Watchdog
  logs after 90 s. Set active-request markers **inside** the job, not before queueing.
- All "use Chomusuke for X" routes and the Combine-calls settings live in the
  Chomusuke tab, not scattered in feature tabs.

### Custom blocks (plan 023)
- **One list for every character**: `extension_settings[ext].customBlocks`,
  linked as `localProfile.blockStack.custom` (`linkGlobalCustomBlocks` in
  `core/profile.js`, run on every load: gathers each profile's copy with
  `mergeCustomLibrary`, same id = same block, a taken tag gets `_2` and keeps
  the old tag in `tags`; then drops the copies). Never stored in a profile:
  `saveGlobalCustomBlocks` writes back only the linked array, so a replaced
  `blockStack` can't wipe it. A character keeps only `order` + `overrides`.
  Delete block in the editor = `deleteCustomBlockEverywhere`.
- **A block's settings** (`normalizeCustomBlock`, old blocks = text / fresh /
  story / every): `kind` text | fields (fields have `desc`, sent as
  `- Label: desc` lines first in the rules, `customFieldNotes`), `memory`
  fresh | chat | info, `writer` story | chomusuke, `when` every | changes |
  everyN (`everyN` 2–20; "changes" not with fresh), `tags` (old tags).
- **Store module `custom`** (`src/state/modules/custom/`, pure): one module for
  all blocks, `createCustomModule(getBlocks)`; state `{ blocks: { id:
  Sheet-shaped fields | { text } } }`; a field left out keeps its value.
- **Sent**: `meguminBuildCustomTemplate` (registry.js; field blocks get the
  Sheet's rules pointed at `<Tag_Now>`, "your last <Tag> block" or
  `CUSTOM_FRESH_FIELDS_LINE`); the envelope asks only when `customBlockDueNow`;
  Current Info `<Tag_Now>` / `<Last_Tag>` (memory info); `customHiding()` in
  injection.js: each block's memory decides with "Hide old blocks" on or off
  (`stripBlocksForModel(text, tags, { keep, whole })`). Texts in
  `src/prompts/customBlocks.js`.
- **Chomusuke**: custom ids join `routedBlockIds` (writer chomusuke +
  `chomusukeReady()`, the Blocks route switch not needed); the read runs as job
  `customBlocks` when it has no stat block (with the Blocks route off, job
  `blocks` would go to the story's connection). Its answer joins the reply in
  ONE `custom` entry (`joinCustomRead`, `<!--custom-read-->`, `facts.custom =
  { read, missing }`); an edit or continue keeps it. Chomusuke off = unwritten
  (the story is never asked), the latest reply's tab says so.
- **Card**: field blocks `treatment: "sheet"` (render.js looks up
  `def.treatment || def.id`); Edit button on every custom tab
  (`features/blocks/customEditor.js`, `customEdit` = user entry).

## Gotchas

- `CONNECTION_PROFILE_LOADED` fires before the backend handshake: also wait for
  `online_status !== 'no_connection'` + a short settle.
- On swipe, ST moves `swipe_id` before `mes` is updated — read `swipes[swipe_id]`.
- A block's redraw stamp must include the world text hash, or Revert won't redraw.
- ComfyUI polling: guard against overlapping async polls (busy/done flags), else
  duplicate images.

## Status (2026-10-07)

Plans **005 (state store + World State)**, **006 (Image Gen V2)**, **007 (image
prompt rewrite: one line per character, `<Last_Message>`)** and **008 (Bonds,
Sheet, Chatter, Tracker in the store; Current Info; old blocks hidden from the
AI)** and **009 (Bonds, Sheet, Chatter, CYOA written by Chomusuke; one combined
call per reply)** are DONE and tested by the developer. Also done: picking a tag style fills
the prefix with quality tags (`imagegen/qualityPrefix.js`); a cancelled image
removes its placeholder, a cancelled regenerate puts the old image back.
183 tests pass.
`docs/image-prompts.md` lists every image prompt (generated from the code).

## Open follow-ups (raise these when relevant)

- If V2 images still bleed between characters: shorter looks in the prompt (drop
  small face details), then BREAK, then a regional-prompting workflow.
- Review every background prompt (Chomusuke reads, look scan, outfit tags, combined).
- Release post must include: the bonds are injected neatly, so the model isn't
  reading a chat with 100 bond blocks saying 20, 35, 65, 42 affection — it just
  gets the true value.
- Settings bloat remainder: ComfyUI workflow states duplicated per profile
  (~300 KB each) + a stale pre-Beta key. Idea: one install-wide store like
  `core/sharedFragments.js`.
