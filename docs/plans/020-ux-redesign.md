# 020: UX redesign

## Why

The settings window grew one feature at a time, and it shows:

- **15 dock tabs, labels hidden until hover**, and three levels to dig through
  (dock group → tab → sub-tabs). Four tabs are kept only for old chats: Side
  Panel ("Discontinued"), Persona (hidden on every modern preset), Story
  Director ("V10 does not really need this"), Memory.
- **"This character or every character" works three different ways**: the
  per-tab `Global: On/Off` button (keyed by tab *title*, `core/sync.js:19-36`),
  Story Config's own opt-out inside Preset & Thinking, and Model Setup's
  "Only this character" switch, which works the other way round. On top of
  that, Settings has "Per Character / Per Chat", which changes what "this
  character" means.
- **World State has no home tab.** You add it as a block in Blocks, its
  settings sit under that row (`features/blocks/ui.js:132-197`), its Chomusuke
  route is in the Chomusuke tab, Images V2 has its own "Turn on World State"
  button, and its editor opens from two places.
- **Three visual generations**: the newer `ui/controls.js` tabs, the old
  `mtab-*` tabs with inline styles (293 hex colours in JS), and Writing Style
  with its own header and nav. Five tabs each have the same dead "Background
  Worker — managed by the Chomusuke tab" row. About 18 native `confirm()` and 5
  `prompt()` dialogs.
- **Long setups**: turning on Chomusuke takes about 7 steps across 2 tabs plus
  SillyTavern's profile screen. Drawing an image by hand needs the "Only when
  I ask" mode before the send-bar button even shows, and nothing says so.
- **Hard to find in the chat**: Shift+click to send a choice, the folded
  "Changed in this reply" strip, the image regenerate button that only shows
  on hover, the Notebook confirm on every reply.
- **Several names for one thing**: Preset / engine / mode; Story Config / Story
  settings / Story Director / Story Planner; Chomusuke / Background Worker /
  helper model; NPC Bank / NPC Book; the close toast "Workflow Configured &
  Applied Successfully!".

Goal: fewer places to look, one way to do each thing, one look, and a
step-by-step guide for the two long setups (Chomusuke, Images). Nothing is
removed, and the legacy modules keep working.

## What we agreed (2026-10-31)

- Every phase below is in (A–G).
- Memory, Story Director, Side Panel and Persona go into a collapsed
  **Legacy** group. Nothing removed.
- Scope stays **per tab** (Preset can be shared by every character while
  Story settings stay with one character), with one control and the same
  words on every tab.
- Language & Add-ons becomes a sub-page of **Writing Style**.
- One plan, one phase per idea. Each phase is tested by the developer in
  SillyTavern.
- Eight fixes taken from the audit in `UX-REDESIGN-PLAN.md` go into the
  phases where they fit (loadout summary, save-mode confirm, Chomusuke test,
  greyed controls with a reason, row-only redraw, preset note, one delete
  confirm, placeholder text). The rest of that file stays out of 020.

## Phases

### Phase 1: Dock (A)

- `src/ui/tabs.js`, new order and groups:
  - top: Model Setup
  - **Story**: Preset & Thinking · Writing Style · Blocks · World State
    (from phase 3; until then the Blocks tab covers it) · The Notebook
  - **Helpers**: Images · NPC Bank · Chomusuke · Banned Phrases
  - **Legacy** (collapsed, greyed): Memory · Story Director · Side Panel ·
    Persona. Group tooltip: "Older tools, kept for old chats".
  - bottom: Settings
  - Story and Helpers are headings, always open. Only Legacy folds (opens by
    itself when you're on one of its tabs).
- Language & Add-ons becomes a second sub-page of Writing Style, "Language &
  rules". **Each page keeps its own "every character" switch** (decided
  2026-10-31): the sync keys stay split, the Global button follows the page
  on screen. A merge would have to pick one when they differ, and picking
  "global" overwrites every character's writing style. No migration needed.
- `style.css`: the dock is 200 px with labels always visible; icons only under
  900 px; the ≤768 px bottom bar stays. Remove the leftover JS mobile drawer
  (`index.js:341-398`) once the bottom bar covers it (it also carries Global
  and Reset on phones: check they're reachable first).
- Remove the three "Background Worker" rows (Memory, Story Director, Banned
  Phrases). Memory and Story Director get one line saying who does the job
  now (Chomusuke or the story model), no button. Banned Phrases gets
  nothing: its scan only runs when you press it (decided 2026-10-31).

### Phase 2: One scope control (B)

- A pill in the top bar replaces `Global: On/Off`: **"This tab: This
  character only ▾ / Every character"**. Tabs that are always shared
  (Chomusuke, Settings, Side Panel) show a quiet "Shared by every character"
  label instead of a greyed-out button.
- `core/sync.js`: key `globalSyncTabs` by **tab id**, with a one-time
  migration from titles. Story Config's opt-out becomes an ordinary row in
  Story settings: "Story settings stay with this character even when the tab
  is shared".
- Model Setup's "Only this character" switch becomes the same pill (it still
  starts on "Every character", as today).
- Settings tab: "Remember settings per: Character / Chat" with one sentence on
  what changes, plus a read-only list, "Shared by every character right now".
- "Use this loadout" no longer applies straight away. A popup first lists
  what it changes ("Changes 6 settings for every character: Preset → V11
  Тайна, Thinking → …") with Apply / Cancel. Same pill wording for who it
  applies to. Pure part (the list of changes) in `modelsetup/loadouts.js`.
- "Remember settings per: Character / Chat": switching asks first and says
  what happens ("Your current settings will be kept for this chat only…"),
  instead of only a toast afterwards (`globalSettings.js`).
- Tests: `tests/sync.test.mjs` for the pure part (key migration, filtered
  keys); loadout change list in the loadouts tests.

### Phase 3: World State tab (C)

- New `src/features/worldstate/ui.js`, dock id `world`:
  - Header switch: On/Off (adds or removes the block from
    `blockStack.order`).
  - **Who writes the updates**: Story model / Chomusuke / Me. One segmented
    control that sets the update mode **and** the Chomusuke route together.
  - Detail sent; "Show what changed on cards"; "Remind the model of returning
    characters".
  - Editor · Rewrite next · Reset.
  - Live preview of the card.
- The World State row in the Blocks tab keeps only order and visibility, plus
  a "Settings ↗ World State" button.
- These all link to the new tab: the World State chip in the Chomusuke tab,
  the Images V2 banner, and Model Setup.
- `TAB_SYNC_KEYS` gets a `world` entry with the world keys taken out of
  Blocks.

### Phase 4: Setup checklists and the Draw button (D)

- `src/ui/checklist.js`: numbered steps, each marked done or not, with the
  real control inside the step.
- Top of the Chomusuke tab: 1 Pick a connection profile (the "How do I make a
  connection profile?" help goes inside this step) · 2 Test it · 3 What
  Chomusuke does after each reply. Once every step is done the card shrinks
  to one line: "Ready · profile name".
- Step 2 "Test it" says what actually happened, not just pass/fail: asks for
  a short known answer and checks it; an empty answer says "Chomusuke got an
  empty answer. This model may refuse stories with adult content; try a less
  censored one (GLM 5.3 Flash, DeepSeek 4.1 Flash)". Same hint when a real
  read comes back empty (one toast per chat, not every reply).
- Top of the Images tab: 1 Connect ComfyUI · 2 Workflow and model · 3 When to
  draw (+ for V2: 4 World State is on).
- `imagegen/comfy.js:65-72`: the send-bar button shows whenever Images are
  on. Tooltip: "Draw this scene now".

### Phase 5: One set of controls (E), one tab per commit

- `ui/controls.js` gets `header({ title, sub, on, onChange })`,
  `confirmPopup`, `askName` (both use SillyTavern's `Popup`), and
  `note(tone, text)`.
- Move tabs over, worst first: Settings · NPC Bank · Memory · Story Director
  · Side Panel · Writing Style / Language & rules · Blocks · Notebook. Replace
  every native `confirm()` / `prompt()`.
- One way to confirm a delete: `confirmPopup` everywhere. The Notebook's
  "click again within 3 s" delete goes too.
- While moving each tab: an edit redraws only the row or card it changed,
  not the whole tab, so scroll position and open sections stay (Blocks and
  NPC Bank first).
- Controls that do nothing right now are greyed out with the reason next to
  them, never clickable and ignored: Thinking controls when the preset brings
  its own thinking ("This preset has its own thinking steps"); thinking
  length for frameworks that cap it; Model Setup rows for a loadout you
  haven't applied ("Preview, use this loadout to apply").
- Picking a preset that also changes Thinking or Writing Style says so in a
  short note under the picker ("Also set: Thinking → …, Writing Style → …"),
  instead of changing them silently.
- `style.css`: one `:root` set of colour variables (brand, select, live,
  danger, info, ai, gold, text, border, bg). Hex colours in JS become
  `var(--…)`. Delete the "COHERENCE LAYER" `!important` block once no tab
  needs it. Run `node tests/tools/check-imports.cjs` after each tab.

### Phase 6: The card in the chat (F)

- `blocks/render.js`: the World State tab button shows "· 3" when the reply
  changed something (the count from the "Changed in this reply" strip).
- Choices: a small send arrow on each choice. Shift+click still works.
- `imagegen/comfy.js`: the regenerate button always shows (small, in the
  corner) and gets brighter on hover.
- Notebook: the confirm gets "Show it" plus "Don't ask again in this chat"
  (`chat_metadata.megumin_notebook.spoilerOk`).
- While a message waits on the send guard, a line under the input says
  "Waiting for Chomusuke to finish reading… [Stop]"
  (`features/blocks/chomusukeIndicator.js`).

### Phase 7: Names (G)

One name for each thing, in every on-screen text: **Preset** (not engine or
mode), **Story settings**, **Chomusuke** (not worker, helper model or
background worker), **NPC Bank** (side panel too), **Choices**, **Dice**.
Close toast: "Saved". Regenerate any `docs/*-prompts.md` that shows UI words.
Fix leftover placeholder texts users can see (Persona: `"Nora": "Nora should
i say more."` in `ui/tabs/personality.js`).

## Not in scope

- Prompt content in `data/` (rule 3).
- Anything sent to the story model or Chomusuke (rule 1).
- `window.LukaSuite` (rule 4). The Side Panel tab only moves to Legacy and
  gets the phase 5 controls.

## Order and testing

Phases 1 → 2 → 3 change the structure, so they go first. Phases 4, 6 and 7
don't depend on each other and can go in between test rounds. Phase 5 is the
long tail, one tab per commit. After each phase: commit `feat(020): …`, the
developer tests in SillyTavern and reports back.

## Progress

- [~] Phase 1: Dock — built 2026-10-31, waiting for the developer's test.
  Also: the window is 1190 px wide on screens over 900 px so the page keeps
  its width; the old drawer's "Navigation" heading and Global / Reset
  buttons (added inside the dock on every screen) are gone; the Banned
  Phrases "AI Slop Detector" panel is closed properly (the rest of the tab
  used to sit inside it).
- [~] Phase 2: One scope control — built 2026-10-31, waiting for the
  developer's test. Decided: the pill opens a small menu; choosing "Every
  character" asks first (it replaces the other characters' settings for
  that tab), going back doesn't. In "Per Chat" save mode every text says
  chat instead of character (`scopeNoun()`). Tab ids/titles moved to the pure
  `src/ui/tabList.js`; the keys per tab to the pure `src/core/syncKeys.js`
  (`tests/sync.test.mjs`); `RENAMED_TABS` is closed, `syncMapByTabId` moves
  the old map to ids once. Model Setup's tab has no scope pill (the loadout
  has its own "Use it on" choice).
- [~] Phase 3: World State tab — built 2026-10-31, waiting for the
  developer's test. `src/features/worldstate/ui.js`, dock id `world`, own
  scope (`worldState`). "Who writes the updates" = The story model /
  Chomusuke / Only me: Only me sets manual and leaves Chomusuke's job alone
  (it is shared by every character); the tab says Chomusuke's choice is the
  same for every character, and warns with a link when Chomusuke isn't set
  up. The preview is this chat's real card (after the last message), not the
  template. Reset asks with a popup. Linked from the Blocks row, the
  Chomusuke tab's chips and the Images V2 banner. Model Setup has no World
  State mention to link from, so nothing there.
  Added after a user question (people couldn't find how to take someone out
  of the scene): an × on each character in the LATEST reply's World State
  card, asking "Left the scene" (kept, Off-screen) / "Forget them" / Cancel
  (`worldDecorateCast` in `worldstate/card.js`); the latest reply's card now
  shows the scene as it is now, so your edit shows at once; the tab has its
  own "Change this chat's World State" section with a big Open the Editor
  button and how-to lines; the Editor says "Left the scene" / "Off-screen"
  like the card (was "Away").
  Also (developer's request): people who stay "in the scene" forever.
  (1) The World Update rules (story model and Chomusuke) now ask to check
  everyone under Present each time and write "- Name: …" for anyone who left
  or didn't come along to a new place (`LEAVING_UPDATE` in
  `modules/world/render.js`). (2) "Who's in the scene" in the World State tab:
  anyone not named in the story (reply + the user's message before it, blocks
  and thinking left out, nicknames count) for 5 / 8 / 12 replies is moved out
  of the scene, never the last one left (`staleStep` in
  `modules/world/model.js`, default 8, `worldState.staleAfter`). It runs as
  part of replaying each reply (the store passes the message text,
  `adapter.applyContext`), so swipes, Revert and rewinds undo it, and the card
  shows "X left · not named for 8 replies". `tests/world-stale.test.mjs`.
  Phase-line fix: "Scene: Breather | Scene: Building" is two lines (first
  wins); world parser version 3 so old chats are re-read.
  "Each update writes: Only what changed / The whole scene (V10 + V11)"
  (never "like V10": V10 had the model write a big HTML block; this is V10's
  full rewrite in V11's short lines, kept and drawn by the extension)
  (`worldState.writeMode`, default changes; the developer chose this over a
  full V10 mode without the store, which was ~3 phases). Full = every reply,
  story model and Chomusuke, write the full <World_State> snapshot, starting
  from the last scene (`carry` in `renderWorldInstructions`); a snapshot now
  replaces Threads/Seeds/Timers, says only real arrivals and "X left" for
  whoever it left out. Rewrite next reply is greyed in that mode.
  The control is HIDDEN for now (`SHOW_WRITE_MODE = false` in
  `features/worldstate/ui.js`): the developer wants users on "only what
  changed" first, to find its bugs. Flip it to true to show it.
- [~] Phase 4: Setup checklists and the Draw button — built 2026-10-31,
  waiting for the developer's test. `ui/checklist.js` (+ pure
  `ui/checklistCore.js`, `tests/setup-checklist.test.mjs`). Chomusuke: the
  connection card became the checklist (pick · test · choose its jobs);
  "tested" is kept per connection (`chomusuke.testedProfileId`), a new
  connection must be tested again. Test asks for one word (`TEST_PROMPT`)
  and tells apart answered-as-asked / answered-something-else / empty
  (refusal hint). The empty-answer warning on real jobs shows once per chat.
  Images: the checklist replaces the "not connected" banner and the V2
  "needs World State" banner; step 1 has the address and Test, steps 2–3
  link to their pages. Draw button shows whenever Images are on.
- [ ] Phase 5: One set of controls
- [ ] Phase 6: The card in the chat
- [ ] Phase 7: Names
