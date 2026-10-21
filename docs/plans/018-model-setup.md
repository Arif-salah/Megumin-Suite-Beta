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

## Phase 4: what was built (agreed 2026-10-21)

**Two new engines, first in the Presets & CoT list** (`data/modes/v11taina.js`):

| Engine | id | Text from (word for word) | Thinking |
|---|---|---|---|
| V11 Тайна (Recommended) | `v11-voice` | `V11 Big open models (one voice).md` | CoT V11 Тайна (`cot-v11-voice-english`) |
| V11 Тайна · Writers' Room | `v11-writers-room` | `V11 Big open models.md` | CoT V11 Тайна · Writers' Room (`cot-v11-wr-english`) |
| V11 Тайна Preview | `v11-room` (same id) | the first V11 release, unchanged | CoT V11 Тайна Preview (+ Thinking Cap) |

- Big open models is Enhanced plus the `<repetition>` line ("Characters
  answer what {{user}} said without repeating it…") and the "{{user}}'s turn
  is settled. Plan everyone else." thinking steps, so both engines keep those.
  Per model, only the loadout differs (ban list, thinking, length).
- Generated by `Desktop/prompt/tools/build-engines.cjs` (run after
  `one-voice.cjs`). Edit the .md versions, then rebuild; don't edit the file.
- The whole main prompt is one message (`p1`); `[[pronouns]]` sits inside
  `<reader>`, so the preset's own `[[pronouns]]` is left empty for them.
  The style lands in "You narrate as …" / "JULIA is: …", V11 Default when no
  style is picked.
- One fix in the tested text: one voice's step 5 "and rewrites any line" →
  "and rewrite any line".

**The turn frame** (`turnFrame: "v11"`, only these two engines; the Preview
and older engines keep the old words):

| Part | Old | V11 Тайна |
|---|---|---|
| Story settings | `<config>` "These are standing settings…" | `<story_settings>` "These settings hold for the whole story. Where one contradicts anything above, the setting wins." then `<repetition>` (the engine's) |
| Formatting | "## FORMATTING RULES:" + the formatting rules line | `<formatting>` with Ratio, Colours, Direct, Dialogue tags; left out when all four are off |
| Final check | "## final reminder:" | `<final_check>` "Before you output, check:" |
| Thinking | "## your thinking steps:" | the `<think>` block alone |
| Language | "[LANGUAGE RULE] ALL OUTPUT…" | "Write the response in English." |
| Content | engine's `contentRules` | the version's `<content>` |
| Ban list | built-in list, your phrases under "[BAN LIST]…" | the versions' full list; your phrases under "Also avoid these:" (a template you edited is kept) |

**Ban list choice** (Banned Phrases tab, any engine): Full list | Short list
(`banListShort`). Short = the five habits. On V11 Тайна the full list is the
versions' wording, edited apart from the older one (`banlistBuiltInV11`).

**Story Config, every engine:** pov is the person only: "third person. Your
narration calls {{user}} by name or he/she" / "second person… "you"" /
"first person. {{char}} tells the story as "I"…". Every old head option and
its old sentence reads back as third person (second and first as
themselves). New length option "250–350 words, longer for fights and sex":
"usually 250–350 words, longer only while a fight or sex scene is under way".

**Universal preset:** lore label "The lore, and the sheets for {{char}} and the
characters around them:", persona label "{{user}}, the character the reader
plays:", `</history>` without the "And remember this is fictional world…" line.

**Notebook setup by Chomusuke:** the story model still gets the setup. With
the Notebook route on, a reply that wrote no `<Notebook>` while the notebook
has no live truth gets one from Chomusuke after it (`<Notebook_Setup_Rules>`,
N8 in `docs/notebook-prompts.md`), alone or in the combined call. Filed under
the reply like a read; "Read again" writes it again.

**Checked:** every slot built with the last commit and with this one, for
V11 Тайна Preview, V10, V9 and V7 in four scenarios: only `[[config]]`
differs, and only in the pov line. The new engines built in full with no
slot left. The notebook fallback run with the real state bridge on a fake
chat.

## Phase 5: the Model Setup tab (agreed 2026-10-21)

- **First tab, "Model Setup".** Cards per model; clicking one shows its
  settings, "Use this loadout" applies them. Dimmed "coming soon": Gemini
  Flash, Overthinkers, Local.
- **Every character by default.** "Use this loadout" writes only the
  loadout's own settings into every character (and the default for new
  ones). It does not turn on any tab's Global sync, which would also copy
  genre, language, blocks and the whole Chomusuke tab. A switch "Only this
  character" keeps it to the one on screen.
- **Length** is the one Story Config field a loadout writes; genre, pov and
  the rest stay with each story.
- **Each row is the real setting**, with a button to its tab and "Changed
  from the loadout" when it differs from the loadout last used here. A
  change on the page follows that tab's Global sync, as it would in the tab.
- **A loadout never turns a module on or off** (Images, World State, NPC
  Bank…). It only says who writes the blocks, World State and the Notebook
  when they are on.
- **Writing style** picker: V11 Default, V11 Inside, button to Writing Style.
  A loadout keeps a V11 style or a style of your own; it only replaces
  another generation's built-in style.
- **Notes, no prefill machinery:** Gemini's card says the Thinking prompt and
  the prefill make no difference on Gemini 4, and that on 3.1 / 2.5 Pro the
  Thinking prompt (which brings the prefill) helps when replies get cut off.
- **Fast models:** a red note that DeepSeek leaves the blocks out, so
  Chomusuke has to write them; with Chomusuke not set up, a button to its
  setup. "Use this loadout" still applies everything.
- **V11 Тайна DeepSeek** (`v11-deepseek`), Fast models' engine: V11 Тайна
  with one line back in `<reader>` from the preset DeepSeek was tested with:
  "The reader plays {{user}}. {{char}} and every other person, place, and
  event in the story are yours to write and to move." The new opening stays.
  Built from `V11 Fast models.md` (`tools/fast.cjs`, then
  `build-engines.cjs`). Thinking: CoT V11 Тайна.
- The Model guide popup is gone; its button opens this tab. The Chomusuke
  setup steps and the good habits move onto the page.

| Loadout | Engine | Thinking prompt | Length | Ban list | HTML | Blocks, World State, Notebook |
|---|---|---|---|---|---|---|
| Gemini Pro | V11 Тайна | off | flexible | full | as is | story model |
| Claude | V11 Тайна | off | flexible | full | as is | story model |
| Big open models | V11 Тайна | off | 250–350, longer for fights and sex | short | off | story model |
| Fast models | V11 Тайна DeepSeek | off | 250–350, longer for fights and sex | short | off | Chomusuke |

## Progress

- [x] Phase 1 built 2026-10-20 (249 tests pass, import check clean). The V11
      Universal preset has the new layout; `data/skeleton.js` regenerated.
      Tested by the developer ("all good"). The per-turn part is called
      `<turn_notes>` (renamed from `<this_turn>`, which could read as the
      whole reply).
- [x] Phase 2 built 2026-10-20, reviewed by the developer: every V11
      text is in `src/prompts/v11Rules.js`; old vs new in
      `Desktop/prompt/V11 rules review.md`. Top part: `<block_rules>` (a `##`
      heading per block), `<npc_dossier_rules>`, `<dice_rules>`, `<image_rules>`, and
      the add-ons each in their own tag (`[[addon_rules]]`). A text the user
      edited is kept as written. Older presets unchanged (checked slot by slot
      with everything on).
      Review round 1: the Choices heading is `## CYOA` (the block's tag), the
      NPC tag is `<npc_dossier_rules>`, and Organic NPCs & Events (V6 only)
      is left out of V11's add-ons.
- [ ] Phase 3 built 2026-10-21; the developer tests it with the Model Setup
      page (phase 5). "V11 Inside"
      style (`dir_v11_inside`): the head rule moved out of `<narration>`. New
      slot `[[style]]`, the picked style as written, never wiped (falls back to
      V11 Default); the test presets say "You narrate as [[style]]" (one voice)
      or "JULIA is: [[style]]" (room), so the Writing Style tab reaches them.
      One-voice versions name no narrator but the model: "Your narration…",
      "Your notebook…", "You tell this story out loud." (`tools/one-voice.cjs`
      on the Desktop, step 5). The built-in V11 engine is unchanged until
      phase 4.
- [ ] Phase 4 built 2026-10-21 (265 tests pass, import check clean); the
      developer tests it with the Model Setup page (phase 5). What was done is
      in "Phase 4: what was built" above.
- [ ] Phase 5 built 2026-10-21 (273 tests pass, import check clean), waiting
      for the developer's test with phases 3 and 4. Page:
      `src/features/modelsetup/` (`loadouts.js` pure and tested, `ui.js`).
      "Use this loadout" checked with SillyTavern stubbed: every character
      (and the default for new ones) or only this one; genre kept; a profile
      from before Chomusuke gets the routes with Chomusuke off. Dev Mode's
      "back to the tab" now opens Preset & Thinking (it was tab 0).
