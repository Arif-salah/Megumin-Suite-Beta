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

## Architecture: what 005 / 006 built

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
- `index.js` — the SillyTavern bridge: settings, `worldUpdateMode()`
  (`inline` = story model writes `<World_Update>`; `sidemodel` = Chomusuke reads
  the reply, when the Chomusuke tab's World State route is on; `manual`), prompt
  block for `[[infoblockcurrent]]`, event handlers (`stateOn*`), Chomusuke read,
  external-read API used by the combined call.
- UI: `src/features/worldstate/card.js` ("Changed in this reply" strip, folded by
  default; Revert/Restore/Read again/Edit), `editor.js` (State + History popup),
  settings in `src/features/blocks/ui.js`.
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
- `combinedTurn.js` — **World State + image in one Chomusuke call** (off by default,
  with a separate-read fallback toggle), for V2 and Classic. Answers come back as
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

## Gotchas

- `CONNECTION_PROFILE_LOADED` fires before the backend handshake: also wait for
  `online_status !== 'no_connection'` + a short settle.
- On swipe, ST moves `swipe_id` before `mes` is updated — read `swipes[swipe_id]`.
- A block's redraw stamp must include the world text hash, or Revert won't redraw.
- ComfyUI polling: guard against overlapping async polls (busy/done flags), else
  duplicate images.

## Status (2026-09-29)

Plans **005 (state store + World State)**, **006 (Image Gen V2)** and **007 (image
prompt rewrite: one line per character, `<Last_Message>`)** are DONE and tested by
the developer. Also done: picking a tag style fills the prefix with quality tags
(`imagegen/qualityPrefix.js`); a cancelled image removes its placeholder, a
cancelled regenerate puts the old image back. 162 tests pass.
`docs/image-prompts.md` lists every image prompt (generated from the code).

## Open follow-ups (raise these when relevant)

- If V2 images still bleed between characters: shorter looks in the prompt (drop
  small face details), then BREAK, then a regional-prompting workflow.
- Review every background prompt (Chomusuke reads, look scan, outfit tags, combined).
- Convert **Bonds** and the other in-chat blocks into state-store modules.
- Release post must include: the bonds are injected neatly, so the model isn't
  reading a chat with 100 bond blocks saying 20, 35, 65, 42 affection — it just
  gets the true value.
- Settings bloat remainder: ComfyUI workflow states duplicated per profile
  (~300 KB each) + a stale pre-Beta key. Idea: one install-wide store like
  `core/sharedFragments.js`.
