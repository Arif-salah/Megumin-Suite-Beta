# Megumin Suite — Beta Changelog

Running notes for the **beta** branch. Newest release first.

This file is history only. For what the extension is and how to use it, see the
README on the stable branch.

**[→ Install / update](https://drive.google.com/file/d/16Ps0byP9zDDLJSX5fqNbFmq-DBTjPlMT/view)**

---

## 2026-08-26
**The new V10 Preset is out** — what shipped in this update:

**1 — New V10 Ukiyo engine + V10 CoT**
The idea behind it: The world is here with you or without you and NPCs have more depth there is no evil and no good its all in perspective *this is a test will see how it go* 

**2 — True random dice**
Not like other presets. This one doesn't ask the AI to make up a number — the extension rolls it with a real random algorithm and feeds it into the prompt for the AI to use.
Two more things that make it honest:
• the roll is written **before** the story, so the AI can't pick a result that fits a scene it already wrote
• the extension checks the math — if the numbers don't add up it won't draw it as a clean card
The roll gets its own tab on the block card, with the die spinning to its number.

**3 — Dice: Everyone**
Same system, but everyone rolls, NPCs included. Any character who tries something that can fail gets a roll, all of them listed before the reply.

**4 — Immersive HTML**
When a character reads something — a phone screen, a letter, a sign, a receipt — the AI draws the thing itself instead of describing it.
Rare on purpose: one per reply at most, and most replies have none. It will never make stat panels, status bars or menus. Only things that actually exist in the story.

## 2026-08-21

> The tracker blocks stop being paragraphs. Choices you can press, World State as
> a scene board, and Skills and Inventory drawn as chips and a pack list.

### BLOCKS — the chat card

**Choices you can click**

- **CYOA is buttons now.** Each option is a row you press instead of a numbered list you retype. A click drops the choice into the message box so you can add to it — "Follow her out" becomes "Follow her out, but hang back at the door" — and shift-click sends it as written. Whatever you had half-typed is kept; the choice is appended, not pasted over.
- **Fixed: a CYOA block at the top of the envelope stopped the whole card from drawing.** The template is a numbered list, so the numbers become list markers that are not in the text, and the card's safety check decided the tail was not the blocks and left the message alone. Every other block happens to start with prose, which is why this only ever showed when CYOA sorted first.
- **A choice starting with a slash will not send itself.** It still fills the box so you can see it — but shift is one key away from an ordinary click, and SillyTavern reads a leading slash as a command.

**New blocks UI**

- **World State is a scene board.** Time, place and weather as a strip of chips, then a card for each person with their outfit, position and agenda. Mood is a coloured pill, your own card is marked, and threads, seeds and timers sit underneath with Arc and Scene phase on a progress rail.
- **Secrets stay hidden until you ask for them.** A Secret is something your character does not know. Hover or tap to reveal it — the block used to spoil every one of them on sight.
- **NPC Inner Chatter is a whisper thread.** Two NPCs talking behind your back is drawn as the conversation it is, one colour per speaker. One NPC thinking alone gets a pull quote instead, because a private thought is not dialogue.
- **Skills are rank chips.** The rank splits off into its own badge and takes a colour by tier, instead of a wrapped line of commas.
- **Inventory is a pack list.** Equipped and worn items get their own band at the top, everything else sits below with counts on the right. What is in your hand is a different question from what is in your bag, and a fight asks the first one constantly.
- **Anything written loosely still reads.** Every one of these hands the block back to plain text the moment it stops matching the template. A confident card that quietly dropped four fields would be worse than the paragraph it replaced.

**Inventory counts**

- **The template now shows how to write a count.** It asks for `item, item xN, or "nothing"`, so a stack of arrows arrives as `Arrows x12` rather than twelve lines or no number at all.
- **No count written, no count printed.** An item with no number no longer gets a "1" the AI never wrote.

### Mobile

- **Tabs shrink to their emoji on a phone.** The strip used to be wider than the screen, and dragging it sideways to reach the last tab is the same gesture SillyTavern reads as swiping the message — so you would go to open Bonds and change the reply instead. They fit now, so there is nothing to drag. The open tab keeps its label, and so does each New NPC tab: they all share one emoji, so the name is the only thing telling two of them apart.

### Fixes

- **Real values written in square brackets were being deleted.** The AI copies the template's brackets around its own answers often enough that this took genuine moods and secrets off the card — and out of the message with them, since the original text is hidden behind the card. A bracket now only means "unfilled" when the whole block is unfilled.
- **A secret written in brackets was printed in the open.** The blur is decided by the field's label now, not by how the value happens to be punctuated.
- **An NPC with a half-filled name merged into the one above it,** wearing their outfit and their mood.
- **The Character Sheet pane drew worse markdown than the plain text it replaced** — bullet lists arrived as paragraphs with the markers still showing.
- **A rule meant to strip the sheet's own instructions was eating ordinary sentences.** "She cares about the boy" and "the plan changed" carry the same words those instructions do.
- **`Jean-Luc Aubert — waiting at the docks` filed under "Jean",** with the rest of his name in the description.
- **A cut-off reply no longer turns into clickable choices.** A truncated block takes the rest of the message as its body, and buttons are the one thing on this card you can send.

---

## 2026-08-18

> Three weeks of work in one release. NPCs that keep themselves up to date, a new
> Story Config tab, every tracker block in one card, memory retrieval rebuilt
> around what you actually asked, and a large cut to `settings.json`.
>
> Grouped by the tab it affects, most-changed first.

### NPCs Bank

The tab that changed most. An NPC used to be written once and frozen; they now
keep up with the story, and the shape of a dossier is yours to define.

**Dossiers that update themselves**

- **A dossier is no longer written once and frozen.** The AI used to write an NPC's file the moment they became significant and was explicitly told never to touch it again. That is right for most of a dossier — an appearance that drifts every scene is not a character — but wrong for the parts that are *about* change. What someone wants, what they think of you, and what they are hiding now move as the story moves.
- **Only what changed is sent.** The AI does not rewrite the whole dossier. It sends the individual change: add this secret, retire that one, replace the agenda. A secret you uncovered three scenes ago stays exactly as written while a new one is added beneath it.
- **Four fields update, the rest stay put.** Role, Read on the PC, Agenda and Secrets are updatable out of the box. Appearance, Voice, Background, Inner Circle, Personality, Where to Find Them and Canon Lock are written once and locked — Canon Lock especially, since a fact that can be revised is not a canon lock.
- **A tab in the chat card shows what changed.** When a reply updates an NPC, that message's block card gets an **NPC Update** tab: who, which field, whether it was added, removed or replaced, and the text. It is drawn from what actually applied, so an instruction the AI got wrong does not appear as though it worked.
- **Undo is on the card.** Every line has its own undo button, plus an *Undo all* for the whole reply. If undoing an older change means dropping a newer one built on top of it, you are told how many went with it rather than finding out later.
- **Rewinding puts NPCs back.** Delete messages and any dossier changes that arrived in them are reversed. If one field changed twice, rewinding past both restores the value from before the *first* change — not the one in the middle. Getting that wrong would leave an NPC remembering something that never happened.

**Build your own dossier fields**

- **A Dossier Fields section in the tab.** Collapsed by default. Rename fields, reorder them, change what the AI is told to put in each one, add your own, or remove ones you do not use.
- **It lists only the changeable part.** Read on the PC, Agenda, Secrets and Canon Lock, plus anything you add. Name, age, appearance, voice, background, inner circle and the rest are the dossier's fixed skeleton and are not offered — what a person looks like and how they speak is what a dossier *is*, and an editor offering to delete Appearance only invites you to break your own NPCs.
- **Add a field and the whole chain follows.** Adding *Fighting Style* changes the template the AI fills in, the card you read, the parser that reads dossiers back, and the text sent to the AI later. It used to take five separate code edits to add a field; it is now a setting.
- **Two switches per field.** **Lasting** means the field describes the person's ongoing life, so the AI is told to ignore the current scene when writing it. **Updatable** means an update block may change it later. They are independent, and every combination happens: Role is both, Canon Lock is Lasting but never Updatable, Agenda is Updatable but not Lasting.
- **Removing a field never deletes text.** The AI stops being asked for it and it disappears from the cards, but what your NPCs already have under it is kept — put the field back and it is all still there. There is a *Reset fields* button for when you want the defaults again.

**Force an update**

- **A refresh button on every NPC card.** The amber ↻ in the card header hands the AI that NPC's whole current record along with the story so far and asks what has changed. Useful after a long scene, or for an NPC banked early who has moved on a lot since.
- **It says so when nothing changed.** No silent no-op, and no invented change to justify the click.
- **Safe to leave running.** Switch chats while it is thinking and the result is discarded rather than applied to whichever NPC happens to be in front of it.

**Better dossiers**

- **"Where to Find Them" stops filling up with the current scene.** Dossiers are written the moment an NPC becomes significant, which is often mid-scene, so the AI would answer with wherever the scene happened to be — famously your own bed. The old fix was a rule saying never to do that, which sat forty lines below the line it governed and named the exact wrong answers, making them more likely rather than less. It now asks for somewhere they could still be found *at 2pm on an ordinary Tuesday months from now*, which makes the current scene structurally the wrong answer instead of a forbidden one.
- **The same framing covers every lasting field.** Appearance, Voice, Background, Inner Circle and Personality are all told, once and by name, to describe the person's ongoing life rather than this scene.

**Editing and housekeeping**

- **Age, sex and orientation are editable.** They render as a badge in the card header rather than as rows in the field list, so whatever the scanner guessed used to be permanent. Click the badge to edit all three.
- **Add an NPC by hand.** New button beside *Scan Story*. Names have to be unique; every field starts empty and is filled in through the normal card editor.
- **Rewind names what it removed.** A rewind that culls NPCs now lists them in a notice instead of removing them silently.

**Fixes**

- **The New NPC block never reached the AI.** The `<Blocks>` section is assembled from the dossier settings, but it was being built *before* those settings were filled in — so the slot telling the AI where to put a new dossier was empty every single time, for everyone, for as long as the feature has existed. Dossiers still appeared because the rules reach the AI by another route, but the AI was never shown where to put one.
- **Both blocks now show the real tags.** The `<Blocks>` section used to describe the New NPC block in a sentence. It now contains the literal opening and closing tags with a note inside, the same as every other block, so the AI can see the shape it is meant to produce instead of inferring it from prose.
- **Update rules were not being injected.** They were written to a new placeholder that no existing preset contains, so they went nowhere. They now ride along with the dossier rules, which every preset already carries.

### Memory Core

**Retrieval**

- **Searches your question, not the last reply.** This is the big one. When picking which old memories to pull up, the extension used to search using *your message plus the AI's previous reply mashed together*. Replies run to a couple of thousand characters and questions run to a couple of hundred, so your actual question made up only about **1 in 8** of what it searched with. The result: it fetched memories about whatever scene the AI had just written, not what you asked about. Measured on a real chat — asking who said a line from message 73 returned chunks 80–129; the same question sent on its own returned the right chunk first. It now searches with your message alone, falling back to the old behaviour only on turns that carry no question ("continue", "...").
- **Fresh matches before the prompt is built.** The lookup used to fire on a timer and race the generation, so the right memories could arrive a turn late. The prompt now waits for it, and only re-queries when the search text actually changed — swipes and regenerations cost nothing.
- **Removed archives now leave the vector database too.** Archives are named after the message range they cover, so a re-created `170-179` inherited the old entry's embedding and served stale text forever. Semantic search would miss content that was plainly sitting in the vault, while keyword search found it fine. Deleting an archive now deletes its embedding with it.
- **Vault search survives copy-paste.** The search box was an exact character match, so pasting a line out of the vault usually found nothing: AI writing is full of `…` instead of three dots, curly quotes, and long dashes, and copying across a line wrap picks up a newline. Both sides are now normalised before comparing.

**Rewind**

- **Going back rebalances itself.** Rewinding used to leave messages archived and hidden until you pressed *Apply & Extract Pending* by hand. They now come back automatically, with a note saying how many blocks were returned. Silent when there is nothing to return, and skipped entirely when Memory Core is off.
- **Fixed vault rendering with the tab closed.** With a populated vault and the Memory Core tab not on screen, a rewind threw an error instead of refreshing.
- **Fixed the vault looking empty after switching the feature on.** It only filled in after closing and reopening the tab.

### BLOCKS

**One card instead of loose fragments**

- **One envelope, named children.** The AI used to append each tracker block as its own HTML fragment, each with its own delimiters. It now emits a single `<Blocks>` envelope with a named child per block.
- **One card in chat.** Those three or four loose cards stacked at the end of a reply are now a single collapsible card with a tab per block.
- **A block is defined in one place.** It used to be six — a template, a trigger in the dict builder, a strip pattern in the cleaner, a pattern in the side panel's parser, a section in the panel, plus special cases. Six edits and six chances to miss one. Adding a block is now a registry entry.
- **New BLOCKS tab.** Pick which blocks are in the stack, what order they appear in, and whether each one is shown or hidden. Hidden blocks are still sent to the AI and still read by the side panel — they just do not take up a tab in the chat card.
- **Custom blocks.** You can add your own, with your own tag and template.

**Bonds & Character Sheet — two new blocks**

- **Bonds** tracks what each NPC feels about you: Mood, Affection, Trust, Desire, with the reason attached whenever a number moves. One line per NPC rather than a bullet list per NPC — with three NPCs in a scene that is roughly 35 tokens a turn instead of 90.
- **Character Sheet** tracks what you carry and know: HP, Stamina, Gold, Status, Skills, Inventory.
- **The fields are yours.** Add Jealousy, Mana, Reputation, anything. Four field types — meter (drawn as a bar), number, text, and list. Field packs like Romance and Rivalry merge into your current list rather than replacing it, so you can run both.
- **A block you do not use costs nothing.** These are separate blocks rather than extra World State fields precisely so a workplace comedy is not paying for Affection and Desire on every NPC every turn.
- **No double-writing.** World State never states a feeling as a number and Bonds never describes a body; Mood moves out of World State's NPC lines when Bonds is switched on.

### Story Config — replaces the Writing Style tab

- **Config Builder.** A form of standing story settings that hold for the whole story rather than a single scene: genre, tone, POV, pace, length, difficulty, friction, NPC disposition, explicitness, narrator presence, focus, culture, era, NPC speech style, and free-form notes. It compiles into a `<config>` block the AI receives. Empty fields are simply not sent, so The main preset Default will took their place.
- **Your styles are untouched.** The entire Writing Style library — Precooked, My Library, AI Generators — and the Dialogue / Narration slider carry over unchanged.
- **The standalone POV dropdown is gone**, because POV is now one of the Config Builder fields.

### Image Generation

- **The progress bar is real.** It used to be an animation — it looked identical at step 1 of 40, at step 39, and when the server had died. It now tracks genuine step counts over ComfyUI's websocket and reads *Rendering Image... 17/40 (43%)*. If the socket cannot open, it falls back to the old animated bar and generation carries on exactly as before.

### Everywhere — `settings.json` size

- **Prompt text is stored as a difference from the defaults**, not as a full copy in every profile. Editing one prompt key used to seed the whole ~17 KB block and broadcast it to every stored profile. One real install held 99 profiles carrying 1,669 KB of prompt text made up of only four distinct values. Measured on that install: **4.90 MB → 3.28 MB**. Existing installs shrink on next launch with no action needed.
- **Leftover chat data is cleared as you go.** NPCs, memory chunks and story plans moved into the chat file in an earlier release, but the old copies in `settings.json` were never removed. They are now cleaned up lazily as chats are opened — and only when the chat's own file already carries the data, because for a chat not opened since that migration the `settings.json` copy is still the only one that exists.
- **Not fixed yet:** saved ComfyUI workflow states are still duplicated per profile (~300 KB, same pattern), and a stale settings key from the pre-Beta version (~245 KB) is left alone.

### Under the Hood

- **The codebase was split into modules.** `index.js` went from **11,373 lines to about 900** — what is left is imports and SillyTavern event wiring. Everything else now lives in ~79 focused files under `src/` and `data/`: one folder per feature, prompt text in `src/prompts/`, preset and style content in `data/`.
- **Why this matters for future updates.** Editing the Story Director's prompt no longer means scrolling past 17 KB of image-gen rules, and a change to one feature can no longer quietly break another — dependencies only point one direction now. Adding a preset means editing one file in `data/modes/` instead of hunting through a 338 KB blob.
- **Nothing was rewritten.** Every moved function was compared against the previous build and verified byte-for-byte identical. The handful of deliberate exceptions are the fixes listed above.
- **Every module was checked against what it actually uses.** That check caught eight real bugs during the reorganisation, three of which failed *silently* — features that would have quietly stopped working with no error at all.

---

## Earlier releases

<details>
<summary><b>2026-08-02</b> — side panel overhaul, smart block hiding, save safety</summary>


### Side Panel Overhaul

- **Full-Detail Player Card:** your own character's World State block now fills the player card, outfit, position, condition and carried items included.
- **Compact Mode, Full Data:** Added support for compact World State version.
- **Forgiving Readers:** slightly mangled blocks from the AI, a stray space in a tag, a missing bold, a missing emoji, are read instead of ignored. Twenty-five repaired shapes across the extension. A block that arrived broken is named as such in the panel rather than showing the same empty message it shows when no block came at all, and field values have lost the stray asterisk at the front.
- **Live Story Tracker:** the story tracker now is inside side pannel.
- **Folded Dossier Cards:** several new character dossiers in one message arrive as a short list of folded cards, one line each. Click one to open it. A single dossier still opens by itself.
- **Multi-Line Thoughts:** a character's inner thought written over more than one line stays one thought under that character's name. It used to spawn a second, nameless speaker.
- **Fixed "Ghost Chat" Bug:** the panel no longer shows the previous chat for a moment after you switch chats, and closing a chat empties the panel completely instead of leaving the old chat's plan and character bank on screen.
- **Fixed "Half Dossier" Bug:** a colon inside a field value, CS: GO for example, no longer cuts the field short. Inner circle lists and long descriptions now arrive whole.

### Smart Block Hiding

- **Latest-Reply-Only Design:** only the newest AI reply has its blocks hidden. Older replies keep their blocks visible in the chat, so the history reads back complete, and when a new reply arrives the one before it gets its blocks back.
- **Parse First, Hide Second:** a block leaves the chat only when the panel has actually read it. A block the panel cannot read stays visible instead of vanishing from both the chat and the panel, and the check runs dossier by dossier on the New NPC boxes, so one broken dossier keeps all of them visible rather than dragging the readable ones out of sight with it.
- **Tracker Hidden in Chat:** the story tracker at the end of a reply is hidden in the chat once the panel has read it, including a tracker restyled into a collapsible box or drawn inside another extension's frame, which are hidden whole. A tracker the panel cannot read stays visible.
- **Hiding That Sticks:** hidden blocks go back into hiding the moment a message edit is saved or cancelled, stay hidden when another extension redraws a message, picture generation included, and take their pile of leftover blank lines at the end of a reply with them.
- **Your Own Folds Are Safe:** a fold you write yourself that merely mentions the World State will not be mistaken for a real World State block and hidden.
- **Fixed "Secret Spiller" Leak:** story tracker text, story secrets included, stays out of the AI memory, the summaries, the image prompts, and the story planning. A reply cut off partway through a block used to leak the half that arrived into those same four places; that is closed too.

### Present Characters Bar

- **Works in More Places:** the bar now handles compact World State mode, and it appears when you switch the panel on partway through a session, with no reload needed.
- **Fixed "Vanishing Name" Bug:** character names with accents, other alphabets, quotes, parentheses, or a lowercase first letter no longer vanish from the bar.
- **Portraits & Polish:** portrait uploads, renames, and deletes reach the bar right away. The glow around a card is no longer cut off square, and the strip has lost the scrollbar along its bottom edge. The cards still scroll with the wheel, by dragging, and with the arrow buttons.

### Save Safety & Global Prompts

- **Fixed "Fast Switch" Save Loss:** the last half second of typing survives a quick chat switch, and pending saves are flushed when the tab is hidden or the page closes.
- **Global Prompt Templates:** edits in the Advanced: Edit Prompts panels now apply everywhere at once rather than only to the character or chat that is open. One honest note: if you had different templates saved on different characters, "your next edit becomes the one they all share."

### Inline Images

- **Regenerate Button, Wherever the Picture Is:** the regenerate button on a generated picture appears the moment the picture arrives rather than after the chat is loaded again, and it reaches messages brought back by Show More.

### Under the Hood

- **Build Tag:** the side panel prints one line in the browser console when it loads, "sidepanel build" plus a date tag, so you can always tell which copy of the code is running. If an update looks broken, check that line first: a normal reload can leave the browser serving its cached copy of the old code. The line sits at the console's Verbose level.
- **Quiet Diagnostics, Zero Cost:** when something cannot be read, a note is written to the browser console, so a bug report can carry something concrete. And every check this update adds skips work that is already done, so none of it costs speed you can feel.

### UI

- Some changes to the overall UI style.

</details>


<details>
<summary><b>2026-08-01</b> — performance benchmarks, RAG &amp; vector database upgrades</summary>

### Performance & CPU/HDD Optimizations (The Benchmark Fixes)

- **Fix 1: The HDD Murderer (Master Debounce):** Strict 500ms debounce on saveProfileToMemory(). No more saveMetadata on every keystroke: 60+ hard drive rewrites down to exactly 1 after typing stops.
- **Fix 2: The Infinite Scanner (Vault Retrieval Cache):** Hashing cache on the Vault Scanner, and the token counter no longer triggers vault scans at all. Token counter refresh lag: 2.3 seconds down to 0.004ms.
- **Fix 3: The Query Spam (Semantic Query Debounce):** Rapid events grouped under an 800ms debounce. Exactly 1 semantic query instead of 3-10 simultaneous API calls.
- **Fix 5: The No-Op Idle Save Bug:** "Dirty State" hash check aborts saves when nothing changed. No more 155MB idle writes.
- **Fix 6: Archival Run Survival:** Handles 900+ message backlogs without locking the browser. If the API drops mid-run, every finished summary is kept and saved, and the error names the block that failed. A hiccup at chunk 40 no longer costs you 40 chunks.
- **One Write Per Save:** Memory Core, Story Plan and NPC Bank used to hit the chat file with three separate writes per save. Now one. The silent NPC Bank loss on huge chats is dead.
- **Tab-Switch Safety:** Edits still waiting in the debounce window are flushed the moment the tab hides or the app goes to the background.

### RAG & Vector Database Upgrades

- **Fix 4: The Vector Insert Limit & Splitter:** Long memories were being fed to the embedder whole, and both common models choke on that: MiniLM silently truncates past 512 tokens, so only the first paragraph ever got indexed, and Jina outright crashes on big chunks. Oversized text is now cut into 1,200-character pieces at word boundaries with #0, #1 hash suffixes (128 max), safe for both models. Queries get the same cap, keeping the newest end.
- **Fix 4.5: Semantic Oversampling & Deduplication:** Requests the top 12 results, maps pieces back to their parent memories, dedupes, returns the top 3 distinct memories. No more one memory hogging all slots.
- **Orphaned Slice Cleanup:** Deleting a parent memory deletes its hash and every piece hash with it. No database bloat.
- **Honest Vector Sync:** The "Vector Database Synced!" toast now checks the server response first. Failures say so.
- **Group Chat Bucket Fix:** No more megumin_group_null shared collection when ids have not settled. Each chat reads its own memories.

</details>

<details>
<summary><b>2026-07-28</b> — UI overhaul, dynamic formatting, save modes, NPC storage</summary>

### UI & Design Overhaul

- **Streamlined Navigation:** Condensed the interface into 10 unified tabs. "Core Engine" and "Chain of Thought" are now merged, as well as "Global Settings" and "Response Blocks".
- **Dock Cleanup:** Removed redundant text headers and moved the Global Settings gear icon cleanly to the absolute bottom of the floating dock.

### Dynamic Formatting & Blocks

- **Smart Block Headers:** The instruction `"## At the end of your response you must put these blocks:"` now intelligently injects exactly once, attaching itself only to the top-most active UI block (World State, Inner Chatter, CYOA, or Story Tracker) to prevent prompt spam.
- Fix the model Dumping the lore in the response, and not outputting blocks "DS4 still may not output"
- **Compact Mode Compatibility:** Fixed formatting conflicts so the new dynamic header works flawlessly alongside the Compact World State mode.

### Save Modes & Smart Sync

- **Profile Save Modes:** Added a new dropdown in Global Settings to toggle between "Per Character" and "Per Chat" save modes.
- **Smart Global Sync:** The "Sync Tab Globally" button has been completely rewritten. It now safely syncs *settings* (toggles, sliders, prompt templates) while strictly preserving unique profile *content* (Saved NPCs, Memory Chunks, and Story Directives) from being accidentally overwritten.

### NPC Bank & Pruner Optimizations

- **Chat Metadata Storage:** Migrated the NPC Bank out of the global `settings.json` file and directly into the `.jsonl` chat file (`chat_metadata`). This massively improves overall extension performance and allows NPCs to travel seamlessly if a chat file is exported.
- **Zero-Data-Loss "Lazy Migration":** Existing NPCs are safe. Old NPC data will silently and safely migrate to the new chat-based storage system the next time an older chat is opened, gradually cleaning up the global settings file without risking data loss.
- **Fixed "Empty Chat" Wipe Bug:** The automatic data pruner no longer accidentally deletes saved NPCs during the split-second when a chat is first loading into SillyTavern.
- **Fixed "Regenerate" Wipe Bug:** The pruner now respects SillyTavern's `is_generating` state, preventing it from accidentally culling newly introduced NPCs when a message is temporarily removed during a swipe or regeneration.

</details>

<details>
<summary><b>2026-07-24</b> — side panel master toggle, mobile fix</summary>

- side panel master toggle turn off everything Related to side panel like "Present Characters Bar".
- fixed Present Characters Bar ui for mobile users.

</details>

<details>
<summary><b>2026-07-19</b> — V9 engines</summary>

- added v9 Engines
- added V9 Dynamic Render Limits
- added Precooked Styles edit

</details>

<details>
<summary><b>2026-07-10</b> — Global Settings menu, Story Director, Compact World State</summary>

- Mobile UI fix

### ⚙️ New Global Settings Menu

- Added a dedicated Global Settings gear icon to the top action bar.
- Moved **Prompt Payload Preview** and **Disable Utility Prefills** out of individual character profiles into this global menu.

### 🎬 Story Director Enhancements

- **Context Awareness:** The Story Director now reads *both* User and AI messages, allowing it to react to your specific actions.
- **Context Limit Toggle:** Added a dropdown in Engine Settings to let the Director analyze either the "Last 100 Messages" (faster/cheaper) or the "Full Chat History".
- better story planner prompt.

### 🌍 Compact World State

- Added an inner menu to the World State add-on card to enable **Compact Mode**. so the AI only generates the massive lore block every X replies falling back to a tiny 30-token "Micro-Dash" (Time, Location, Clothes, Posture) the rest of the time.

### 🔄 Sync & Cleanup

- **Global Sync Restored:** Brought back the "Sync Tab Globally" button to the *Writing Style* and *Side Panel* tabs.
- **Sync Array Updated:** Rewrote the sync mapping so it now captures newly added settings (like the NPCs Bank, POV selection, and CoT toggles).
- **Summary Block Removed:** Completely stripped out the old Summary tracker block. in Favor for the faster memory core.

</details>

<details>
<summary><b>2026-07-03</b> — side panel, Director's Console redesign, per-chat profiles</summary>

- added side panel thanks to Luka
- added Export/inport to npc bank and memory core
- a full Redesign of story planner with a lot more options
  - Brand New Director's Console UI: A sleek, easy-to-use new interface that puts you in the director's chair.
  - Granular Story Control: Fine-tune the AI's focus with new toggles for Pacing, Content Rating, Primary Genre, and special Flavor Tags (like Love Triangle, Slow Burn, etc.).
  - Director's Notes: A dedicated space to drop specific instructions or hard rules on where you want the plot to go next.
  - Unrestricted Content Toggle: A powerful new override switch that helps the AI push past safety filters when you want the story to explore darker, unrestricted, or explicit themes.
  - High-Effort, Structured Output: The AI is now strictly instructed to act like a professional writer. It generates deep, thoughtful "Narrative Directives" rather than giving you lazy, low-effort bullet points.
  - Invisible Auto-Evolution (Story Tracker): The AI now secretly evaluates its own progress in the background. Once it realizes the current story beat has naturally concluded, it will automatically evolve the plot forward—all without cluttering your chat or requiring you to press a button!
- added edit prompt to npc bank portrait thanks to Lazerin Athania for the idea
- new memory core Optimization x100 faster
- per chat save profile
  - Automatic Memory Pruning: If you branch a chat back to an earlier point (e.g., branching from message 50 instead of 100), the memory vault automatically prunes future summaries that haven't happened yet in the new timeline.
  - NPC Bank Timeline Correction: Branching back in history will automatically remove any characters that were introduced in the deleted future timeline, keeping your NPC list synchronized with where you are in the story.
  - Automatic Story Director Replanning: Going back in time before a directive/story plan was created will cleanly reset the current plan (while keeping your selected genres and tags) so the director can auto-generate a fresh, relevant plan for your new timeline.
  - Smart Chat Branching Inheritance: When you create a branch or checkpoint from an existing chat, the new branch automatically inherits all the settings of the parent chat.
- fixed memory core saving data inside data\default-user\settings.json Which may cause lag on low-end hw
  now memory core and story planner save inside the chat file and it will clean any old stuff inside settings.json.

</details>

<details>
<summary><b>2026-06-24</b> — hotfix</summary>

- fixed memory core generator Backend not saving.

</details>

<details>
<summary><b>2026-06-24</b> — Image Gen fixes</summary>

- Positive Prefix Box: Added a special text box to insert global tags (like `score_9, masterpiece,`) right at the start of your prompt before it reaches ComfyUI.
- Smart LoRA "Trigger Words" Memory: Added text boxes for trigger words underneath each of the 4 LoRA slots. and the system will remembers your trigger words: whenever you select one of your used LoRAs from the dropdown list, it will fill the corresponding trigger words automatically!
- "Dice" Seed Button: Added a convenient dice icon next to the Seed input that sets the seed to `-1` (Random).

</details>

<details>
<summary><b>2026-06-22</b> — NPC injection thresholds, blacklist, TF-IDF scoring</summary>

- Custom Injection Thresholds: You can now manually set the maximum number of NPCs injected into a prompt using the UI.
- Dynamic Blacklist: Added a text box to blacklist specific character names (e.g., pets, crowds) so the AI won't generate dossiers for them.
- Automatic Blacklisting: In automatic mode (OOC Trigger Off), all currently saved NPCs are automatically ignored to prevent duplicate dossier generation.
- TF-IDF Keyword Scoring Redesign:
  - Exact NPC name matches receive a +50 score bonus to guarantee context injection.
  - Generic keywords found in over 50% of saved NPCs are ignored to stop irrelevant character generation.
- Better NPCs dossier for more NPC depth.

</details>

<details>
<summary><b>2026-06-13</b> — V8 Fusion, POV selection</summary>

- added v8 fusion.
- added pov selection inside writing style tab for Precooked Styles only.

</details>

<details>
<summary><b>2026-06-12</b> — CoT fixes, locks replaced with warnings</summary>

bug fixes and one change

- fixed a bug when sometimes the wrong cot get injected
- fixed a bug where image tag `<img prompt="[prompt]">` get generated inside the thinking

changes:

- removed all the locks and put a warning system Instead

</details>

<details>
<summary><b>2026-06-12</b> — V8 engines, image gen upgrades, NPC Bank overhaul</summary>

### Massive Feature Overhaul & V8 Engines

- V8 Obsidian & V8 Spark Engines: Added the absolute pinnacle of the Megumin Suite (Obsidian) for unmatched human psychology and story plotting, along with a highly efficient lite version (Spark).
- Engine Strict-Locking: The UI now actively prevents you from breaking the AI. Selecting V8 completely locks the Persona & Toggles tab. CoT models are now strictly locked to their compatible engines (V6 can only use V6 CoT, V8 can only use V8 CoT, etc.).
- Smart Block Conflicts: The Add-ons tab now auto-locks conflicting blocks. Turning on MVU locks out the World State block. Turning on Memory Core locks out the Summary block.
- Master Prompt Switches: Added a master "Enable/Disable" toggle to all Advanced Prompt Editors across every tab. Keeps the engine safe from half-edited or broken prompt fields.
- Token Counter Calibration: Calibrated the live token counter math to better match real API tokenizers.

### Image Generation Upgrades

- Prompt Templates: Replaced the old style dropdowns with 6 highly optimized templates (Illustrious + POV, SDXL + Cinematic, etc.).
- new inline Injection: send the pic in the response
- Dynamic Image Count: You can now generate 1, 2, 3, or 4 images at a time (automatically syncs with MVU output!).
- Token Saver Toggles: Added "Include Examples" and "Better Booru tags" toggles to let you customize prompt injection and save tokens.
- Inject NPC Tags: The Image Generator can now automatically scan the scene and pull exact physical Booru tags from your saved NPCs!

### NPC Bank Overhaul

- Dossier 2.0: Upgraded the NPC extraction format with strict, detailed fields (Orientation, Voice, Secrets, Canon Lock, and dedicated Image Tags).
- OOC Trigger: Save massive amounts of input tokens! The dossier template is now hidden from the AI *unless* you type "NPC" or "dossier" in your chat message.
- Image Tags Only Toggle: Every saved NPC now has a button to hide their text dossier from the AI, while still allowing the Image Generator to read their physical appearance tags.

### UI & Regex Polish

- Writing Style Redesign: Completely redesigned the Writing Style tab into a sleek "Sidebar Dashboard" with a compact masonry grid and an integrated Dialogue/Narration Ratio slider.
- Aggressive Chat Cleaner: Upgraded the internal regex cleaner to flawlessly scrub all ComfyUI wrappers, placeholders, and raw HTML from the chat history before the AI reads it.
- Fixed a bug where ComfyUI workflows wouldn't populate instantly when toggling Image Gen on.

</details>

<details>
<summary><b>2026-05-26</b> — memory core fix, V7.5, word count controls</summary>

- fixed memory core
- added scan history to NPC Bank
- you can now edit prompts in tabs
- added v7.5
- fixed token counter
- added Minimum or Maximum word count

</details>

<details>
<summary><b>2026-05-17</b> — memory manager, NPC Bank, V7 Core</summary>

- added full mamory manager change from Cohee/jina-embeddings-v2-base-en to Xenova/all-MiniLM-L6-v2 if you going to use Semantic Embeddings. i recommend only using the keywords its faster and do 90% like Semantic Embeddings.
- added NPC bank.
- added v7 core more balaned less edgy.
- some bug fixes.

</details>

<details>
<summary><b>2026-05-11</b> — CYOA cleanup</summary>

- added CYOA cleanup.

</details>

<details>
<summary><b>2026-04-30</b> — GLM and DS4 fixes</summary>

- Fixes for GLM and DS4.

note: enable prefill only for Gemini.

</details>

<details>
<summary><b>2026-04-26</b> — DeepSeek 4 support, thinking controls, dev mode</summary>

- fixed multi thinking box with models like GLM and Deepseek.
- fixed thinking for GLM and DS 4.
- DeepSeek 4 support test.
- Dialogue & Narration Format toggle for better narration style adherence in some models recommended.
- fixed color charcater in DS4 *maybe*.
- added thinking effort control.
- you can now edit every thing inside dev mode i mean every thing all.
- added export/import to banlist. and fixed banlist ui.
- added thinking v2 in cot this give more freedom to the ai thinking while following the cot. only for gemini 3.1 pro and 3 flash. put `<think>` and `</think>` inside the Reasoning Formatting.

Note: use only english COT for deepseek 4.

</details>

<details>
<summary><b>2026-04-23</b> — Dream Team V6</summary>

- added Dream team v6 and v6 lite.
- fixed some under the hood stuff.

</details>

<details>
<summary><b>2026-04-18</b> — Story Planner, token counter, precooked styles, new UI</summary>

- change COT off now will remove `<think>\n{Thinking}\n</think>` so the ai will not be forced to use thinking.
- added Dialogue / Narration Ratio slider so now you can choose how mush narration you want (i know you dont like to read you dummy)
- added new "Precooked" styles for fast style pick.
- Added a filter bar (All, Precooked, AI Generators, My Library) to organize the style tab.
- added Megumin image for manual image gen.
- added token counter.
- added Cinematic Sounds (onomatopoeia) and animation toggle.
- added cleaning Function to clean character profile if the character was deleted.
- added Story Planner.
- fixed GLM error with banlist and image_gen.
- added Disable prefill to fix opus error when generating banlist or image_gen.
- new ui more clean, more modern for mobile and disktop.
- nanogpt not working for Rules and insight generating fixed.
- added apply Specific tab to all profile.
- some under the hood fixes for better rule Generating.
- added the ability to edit Custom User Engines right from the Core Engine menu.
- added the ability to use direct api call or Specific preset for image gen and bed list.
- Dev mode fixed and added:
  - The engine renaming and "Save Engine" bar now sticks to the top of the screen when you scroll through long prompt blocks.
  - Implemented a "Dirty State" tracker. If you edit an engine and try to click "Back," "Exit Dev," or "Close" without saving, a confirmation popup will warn you.

</details>

<details>
<summary><b>2026-04-08</b> — dev mode CoT option</summary>

- added the ability to choose between no change or Default in dev mode COT.

</details>

<details>
<summary><b>2026-04-06</b> — button fix, optimization</summary>

- the button is fixed now (removed the draggable function).
- Optimized the ext.

</details>

<details>
<summary><b>2026-04-06</b> — image gen stage, new dev mode</summary>

- added new image gen stage.
- new and improved Dev mode.

</details>

<details>
<summary><b>2026-04-02</b> — Forbid Overrides fix, MVU compatibility</summary>

- fixed a Stupid error from my side i forget to enable Forbid Overrides so some cards was changing the main prompts and making the output bad. use the new json files.
- added MVU Compatibility read here https://github.com/KritBlade/MVU_Game_Maker

</details>

<details>
<summary><b>2026-04-01</b> — Writing Style overhaul, style templates</summary>

- fixed some misspelling.
- redesigned the model tab to have more language options for the new v2 COT.
- Completely Overhauled Stage 3 (Writing Style): Redesigned the UI from a grid into a clean, full-width list layout.
- Added Pre-Configured Templates: Included 11 ready-to-use style templates (inspired by authors like George R.R. Martin, Stephen King, Jane Austen, etc.). You can now generate a complex rule directly from the library with one click!
- Added "No Style" Toggle: Placed a convenient "Off" option at the top of the style library to easily disable extra writing directives without deleting your saved profiles.

</details>

<details>
<summary><b>2026-03-31</b> — V5 Slice of Reality</summary>

- added new test cot that aim for me NPCs agency and self goals.
- added v5 Slice of Reality mode New and improved balance mode that aim to use less token, more writing Creativity, better NPCs.
- added nora because why not.

</details>

<details>
<summary><b>2026-03-30</b> — draggable button</summary>

- now the button is Draggable WOW

</details>

<details>
<summary><b>2026-03-29</b> — Style Profile Library, advanced CoT, dev tools</summary>

### ✨ New Features & Enhancements

- Style Profile Library: Transitioned from a single writing style configuration to a comprehensive Library. Users can now create, save, and manage multiple style profiles for different needs.
- Style Management: Added quick-action buttons (Regenerate, Edit, Delete) to all style cards for faster workflow.
- Iterative AI Refinement: Introduced a new 7th stage (Beta) designed for AI self-correction, allowing the model to identify and rectify its own systemic writing habits.
- Target Word Count Macro: Added a new `[[count]]` macro in Stage 4 (Add-ons > Extra), allowing users to set specific maximum word counts for generated responses.
- Advanced CoT Framework: Completely overhauled the Chain of Thought (`<think>`) logic in Stage 6 for improved reasoning and output quality.
- Multilingual Support: Added full support for Japanese (日本語) within the Chain of Thought process.
- Output Language Optimization: The engine now defaults to English if the "Language Output" field is left blank, effectively preventing CoT leakage into the final response.

### 🛠️ Developer Tools & Safety

- Global Dev Mode Toggle: Introduced a global override switch. When enabled, saving or restoring a prompt override applies the change across all profiles (Characters, Groups, and Defaults) simultaneously.
- Prompt Safety Guard: Implemented a fail-safe for the Global Dev Mode; `[[aiprompt]]` overrides are now restricted to local application to prevent the accidental erasure of unique style profiles.

### 🐛 Bug Fixes & Optimizations

- Group Chat Compatibility: Resolved issues preventing the extension from detecting group chat environments.
- Stability Improvements: Fixed a crash occurring when the "Generate Insights" button was triggered within the Style Editor during group chats.

### Under-the-Hood Preset Improvements

Updated core prompting rules within `[[prompt3]]` to include:

- Better introduction of new NPCs
- Anti-passive voice enforcement
- Enhanced living world dynamics
- NPC agency prioritization
- Scene continuation logic

</details>
