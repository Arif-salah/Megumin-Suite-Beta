# Megumin Suite — Beta Changelog

Running notes for the **beta** branch. Newest release first.

This file is history only. For what the extension is and how to use it, see the
README on the stable branch.

**[→ Install / update](https://drive.google.com/file/d/16Ps0byP9zDDLJSX5fqNbFmq-DBTjPlMT/view)**

---

## 2026-10-24

> A Model Setup tab that sets everything up for your model, three new V11 Тайна
> presets, and a Chomusuke that leaves your story connection alone.

### Model Setup: the settings tested for your model

- **A new first tab, Model Setup.** Pick your model and you get the settings tested for it: the preset, custom thinking, the length, the ban list, Immersive HTML and Chomusuke. Press **Use this loadout** and they're set.
- **Four loadouts so far:** Gemini Pro (Gemini 3.1 Pro, 2.5 Pro, Gemini 4), Claude (Opus 5.5), Big open models (GLM 5.3, GLM 5.3 Flash) and Fast models (DeepSeek). Gemini Flash, Overthinkers (Kimi K3, Xiaomi MiMo V2.6) and Local (Gemma 4 31B, Qwen 3.8 27B) are coming later.
- **Each loadout tells you what to watch for.** On Gemini 4, keep custom thinking off; on Gemini 3.1 Pro and 2.5 Pro, turn it on. Claude and GLM want the prefill off. DeepSeek needs Chomusuke, because it leaves out the blocks, World State, the notebook and the image tags.
- **Change a setting before you use it.** The page lists what the loadout will set. Changing one there only changes what **Use this loadout** writes.
- **Every character, or only this one.** A loadout goes to all your characters unless you tick **Only this character**. A tab set to Global still reaches every character either way.
- **One Chomusuke row** (Off or On) sends every block and job to Chomusuke at once.
- **The Model guide button** on Preset & Thinking opens this tab now.

### V11 Тайна: three versions and a new style

- **New in the preset list:** V11 Тайна (one voice), V11 Тайна · Writers' Room, and V11 Тайна DeepSeek, which has one more line so DeepSeek stops treating the character as the player. The first V11 is now called V11 Тайна Preview.
- **A new writing style, V11 Inside.** Switching between V11 presets keeps V11 Inside, or your own style if you wrote one.
- **The rules go once, at the top.** Blocks, Bonds, characters, dice, images and add-ons each have their own section at the top of the prompt. The end carries only what's new this turn (the dice numbers, the image ask, the blocks to fill in), so the top stays the same from turn to turn and caches.
- **The V11 preset is all slots.** Turn a section off and its heading goes with it. The character sheet, persona and history tags and the closing fiction lines sit in the preset as plain text, so you can edit them there.
- **A short ban list.** Banned Phrases offers Full or Short, and you can switch off or edit the built-in list.
- **A new length: 250 to 350 words, longer for fights and sex.** The Big open models and Fast models loadouts use it.
- **The point-of-view setting** only tells the model what your character is called.

### The Notebook

- **Its truths are about the world and the other characters.** Your own character's past and reasons stay yours, on every preset.
- **Chomusuke writes the first truths** when a reply leaves them out (with the Notebook route on).
- **The truths stay out of the image prompt.**

### Chomusuke sends its jobs straight to its connection

- **Your story connection never changes.** Chomusuke used to switch SillyTavern over to its profile for each job and back afterwards. Now each job goes straight to Chomusuke's own profile. Nothing switches, the chat never reloads, and you don't need a Story profile.
- **Setup takes one profile.** Connect the model Chomusuke should use, save a connection profile named **Chomusuke**, and connect your story model again. Then pick the profile in the Chomusuke tab and press **Test**. You can stop unchecking Settings Preset and Regex Preset.
- **Or use the story's model.** Pick **Use my current connection** and Chomusuke needs no profile at all.
- **One setup for every character.** Chomusuke's connection and jobs are the same whichever character you're on.
- **Its reply length comes from its profile's preset**, or from your story's when the profile has none.
- **It still waits for the story.** Chomusuke reads a reply once the reply is finished. If you send a message while it's still reading World State, Blocks or the Notebook, your message waits up to 30 seconds so the next reply sees them.
- **Errors show the API's own message:** a wrong key, a model that doesn't exist, a rate limit.
- **Chat Completion only.** The list shows only Chat Completion profiles, and a Text Completion profile you picked earlier gets a red note.
- **The old switching is still there** as **Switch my connection for each Chomusuke job** in Settings. Turn it on and the Story profile steps and the presets note come back with it.

### See what Chomusuke is doing, and stop it

- **A cat on the blocks bar.** While Chomusuke has a job running or waiting, a pulsing cat and a **Stop** button sit on the last message's blocks bar. Hover the cat to see the job, for example "Chomusuke: World State… (1 more waiting)".
- **Stop** cancels the running job and the ones waiting, with no warning popup.
- **Leaving a chat stops the jobs queued for it.**

### Pick a model that won't refuse

- **Chomusuke has no jailbreak.** The Chomusuke tab says so: a censored model like Gemini can refuse an NSFW story and send back nothing. Use an uncensored or less censored model, like **GLM 5.3 Flash** ★ (recommended) or **DeepSeek 4.1 Flash**.
- **An empty answer comes with a hint.** The popup says a censored model may have refused and suggests a less censored one.
- **Chomusuke skips empty replies.** A reply with nothing in it gets no read, no blocks and no image.
- **Image prompts and tags are always in English**, whatever language the story is in.

### Fixes

- Buttons in the chat card no longer stack their label one letter per line.
- The ban list row on Model Setup reads **Full list**, **Short list** or **Only your phrases**.
- Dev Mode shows V11 Тайна's own tags.

---

## 2026-10-18

> Chomusuke tells you when something goes wrong, and World State stops
> splitting one character into two.

### Chomusuke tells you when something goes wrong

- **A popup when Chomusuke's answer is no good.** After a reply, if Chomusuke's model fails, sends back nothing, or answers in the wrong format, you're told which one and what to do: check its connection in the Chomusuke tab, use **Read again** on the card, or pick a stronger model.
- **Covers every job that runs on its own:** World State, Blocks, The Notebook, automatic images, the memory summary and the Story Director.
- **One popup per reply with Combine calls on**, naming everything that failed, instead of three.

### World State keeps one character as one

- **A short name finds the full one.** The story says "Resha Helios", Chomusuke later writes just "Resha": it's still one character, and "Resha" is kept as her nickname. It only does this when exactly one character fits, so "Lady Mira" and "Lady Resha", or "Anna" and "Annabelle", stay apart.
- **"Same person as…" on the card.** When a reply brings in a character it never introduced (like "Emma" when the story already has "Uncle Emma"), the World State card asks if they're someone already in the story. Pick the name and press **Same person** to merge them, or **New character** to keep them apart. Undo it from the editor's History.

### Fixes

- **Opening a new chat no longer makes Chomusuke write blocks for the greeting.** It only runs after real replies.

---

## 2026-10-17 — V11 Тайна

> A worker of your own called Chomusuke, a World State that remembers properly,
> image generation that keeps every character looking the same, bonds the
> AI actually reads right instead of digging through a hundred old blocks, a new
> V11 engine, an Author's Notebook so the story can keep a secret and pay it off,
> and a cleaner window that's easier to find your way around.

### A cleaner window

- **The tab list is shorter and grouped.** The main tabs are always there: **Preset & Thinking, Blocks, The Notebook, NPC Bank, Images, Chomusuke**. The rest fold into two groups: **Story Setup** (Writing Style, Language & Add-ons) and **More Tools** (Story Director, Memory, Banned Phrases, Side Panel, Persona). **Settings** stays at the bottom.
- **Clearer names.** Presets & CoT → **Preset & Thinking**, Global Toggles & Add Ons → **Language & Add-ons**, NPCs Bank → **NPC Bank**, Image Generation → **Images**, Memory Core → **Memory**, Dynamic Ban List → **Banned Phrases**, Global Settings → **Settings**. A tab you had set to Global stays Global.
- **Persona only shows when your preset uses it.** Every V8-and-later preset brings its own, so the tab is out of the way.
- **On a phone**, the bottom bar shows the main tabs and two group buttons; tap a group and its tabs open in a small sheet above the bar. The group you're in lights up and names the tab ("More Tools · Memory").

### Preset & Thinking — rebuilt

- **Three pages at the top: Preset · Thinking · Story Config**, with a summary of what's picked (preset, thinking, how many Story Config settings are set).
- **Latest presets first.** Choose a preset from **Latest** (V10 and V11), **All**, or **Mine** (your own presets from Dev Mode, with Edit). Compact cards; the full description shows on hover.
- **Only the thinking made for your preset.** The Thinking page shows the frameworks that fit your preset (CoT V11 and its Thinking Cap on V11) as cards that show their whole description, with a switch to show every framework. Thinking length is one row of buttons (100 / 250 / 450 / Custom / No limit), the language only shows where there's more than English, and the Gemini override sits under Advanced.
- **V7 modules** sit at the top of the Preset page while a V7 preset is picked.
- **Model guide** (button at the top of the tab): which settings fit your model. Gemini runs CoT V11 with the Gemini thinking override and the preset's prefill on; Chinese models (Kimi, DeepSeek, GLM, Qwen) get the Thinking Cap and a 0.7–0.8 temperature, with a button that picks the cap for you; DeepSeek likes to ignore the blocks, so Chomusuke writes them and the World State updates in a call after the reply (it can use the same connection), and local models do the same so they focus on the story. Plus the good habits: turn on only what your story needs, keep old blocks hidden from the AI, and combine Chomusuke's calls.

### V11 Тайна — a new engine

- **A new preset in Preset & Thinking, under Latest.** The model works as a writers' room of five: a director who keeps continuity and checks every draft, a psychologist for what each character wants, a story architect who keeps the hidden truths, a storyteller for the narration and a dialogue writer for the voices. You read one voice; the team only talks in the thinking.
- **Its own CoT and writing style.** Picking V11 picks **CoT V11** (the room works the turn in order) and the **V11 Default** style: an overt narrator with a voice and opinions, never a camera.
- **CoT V11 — Thinking Cap**, for models that over-think (DeepSeek, Kimi, GLM, Qwen). The same five steps, but each one is a short line of notes, no draft (not even "in its head"), no going through the rules or the banlist, and the reply is written only once, in the reply. Its rules are repeated as the last thing the model reads, where these models actually follow them. No word count: a Thinking Cap sets its own length, and the Thinking page shows a tip for Kimi and DeepSeek instead. CoT V11 stays the default; pick the Thinking Cap on the Thinking page when your model thinks too long.
- **V11 keeps an Author's Notebook by itself** (see below). Nothing to switch on.

### Author's Notebook — the story keeps secrets and pays them off

- **The story decides two or three hidden truths early**, keeps them, plants small clues, and reveals each one when the story earns it. Before, whatever the model decided while thinking was gone the next turn, so it either forgot the secret or blurted it out.
- **On by itself with V11.** For any other engine, switch it on in the new **The Notebook** tab.
- **The extension keeps the notebook**, not the chat. The model gets the live truths every turn, and the old notebook blocks are hidden from it like the other blocks.
- **The rules are kept by the extension, not just asked for:** at most three live truths, a truth can't be quietly rewritten by the model, and a clue the model claims to have planted but never actually wrote in the story is marked **"not found in the reply"**.
- **No spoilers unless you want them.** A reply that touched the notebook gets a 📓 **Notebook** tab on its card, blurred; it asks before showing you. Inside, a new truth is its own card (the truth, who it's hidden from, when it comes out, what it changes), and each change is one line with an icon: **Clue planted**, **Found out**, **Came out**. **Revert** / **Restore** undo or bring back what that reply did.
- **The Notebook tab** reads as one page: the live truths behind a spoiler warning (open one to edit any field, remove a clue, **Mark revealed** or **Delete**), and **Past**, a timeline of every truth that came out, with each clue and the message it was planted in (`#15`). **Activate again** puts a past truth back into the story.
- **Always on with V11** ("Forced on for V11"): V11's own text speaks of its notebook, so it can't be switched off there.
- **Swipes, edits and deletes undo exactly what that reply did**, the same as World State. Swipe away the reply that wrote the truths and the story writes new ones.
- **Chomusuke can note the clues for you** (Chomusuke tab, **The Notebook**, off by default, though I recommend leaving it to the story model). The story model only writes new truths; Chomusuke reads each reply and notes the clues, who found out, and what came out. **Read again** redoes it.
- **World State drops the NPC Secret field while the notebook is on**, so hidden things live in one place.

### One switch for the whole suite

- **On / Off, right in the top bar** of the window (and in Settings). Turn it off and the suite steps aside: your prompt goes out exactly as SillyTavern builds it, and nothing runs in the background after a reply — no World State or block reads, no automatic images, no Story Director, Memory or NPC Bank.
- **Nothing breaks while it's off.** Cards and images already in your chat still show, and swipes, edits and deletes are still followed, so World State and your bonds are right when you turn it back on.
- **The floating button fades while it's off**, so you can tell at a glance without opening anything.
- Handy for a quick chat with a different preset, or to check whether something odd is the suite's doing.

### Chomusuke — a second model for the background work

- **A new tab: Chomusuke.** Pick a connection profile and the background jobs run on it instead of your story model: Memory, Story Director, NPC Bank, Banned Phrases, Images, World State, Blocks, The Notebook and the Writing Style generator. Each one has its own switch, so you choose what goes to the worker and what stays.
- **Grouped by what they cost.** **After every reply** (Blocks with World State, The Notebook, Images) costs a call on every reply; **When the job runs** (Memory, NPC Bank, Story Director, Banned Phrases, Writing Style) only when that job fires. A line tells you how many Chomusuke calls each reply costs, and what it would be with Combine calls on.
- **A job that's off in its own tab says so** ("The Notebook is off →") and takes you there.
- **Use a cheap or fast model for the chores** and keep your good one for the story. The extension switches the connection over for the job and back afterwards.
- **Jobs wait their turn.** Chomusuke does one job at a time, so two features never fight over the connection.
- **Your reply can't go to the wrong model.** If you hit send while Chomusuke is still switching in or out, your message waits a moment and then goes to the story model where it belongs.

### World State — rebuilt from the ground up

- **It's saved in the chat now, not on the character.** Every chat has its own world state, and it survives reloads, switching chats, branches, `/hide`, summaries and deleting old messages. Outfits no longer vanish from Image Gen after a reload.
- **Swipes, edits and regenerates undo exactly what that reply changed.** Swipe back and the changes come back too. Deleting an old message keeps what it changed, so the story doesn't lose its place.
- **Characters come back as they left.** Someone who walks out and returns ninety messages later still has their last outfit and details, even if the chat was summarized in between.
- **The model writes a few short change lines instead of a full block every reply.** Fewer tokens, and nothing gets mangled. The extension keeps the full state and gives the model the true version each turn.
- **"Changed in this reply."** A small strip on the card shows what that message changed, e.g. `Aqua · Outfit: blue dress → bath towel`. It's folded by default. Next to it: **Revert** (turn off that reply's changes), **Restore**, **Read again** and **Edit**.
- **A World State editor.** Fix any field, add or remove characters, move someone in or out of the scene, see the history of changes, or ask for a full rewrite on the next reply.
- **Mood, Agenda, Secret and Threads hold steady.** They're the story's deep currents now: a character's Agenda is the big goal that drives them, not "wants to make coffee", and it only changes when the story really turns it. Same for secrets and open threads.
- **Nicknames work.** `Matthew "Matt"` is one character, and either name finds him.
- **Three ways to keep it updated** (World State section of the Blocks tab): the story model writes the changes (**Inline**), Chomusuke reads each reply and writes them (**Side model**, chosen in the Chomusuke tab), or you do it by hand in the editor (**Manual**).
- **Old chats carry over.** The first time you open one, the last World State in it is read in, along with every update after it.

### Bonds, Character Sheet, Inner Chatter and Story Tracker — the AI reads the true values

- **No more reading a hundred old Bonds blocks.** Before, the model had to find its last Bonds block in the chat and carry the numbers forward — so it was reading 20, 35, 65, 42 affection all the way down. Now the extension keeps the values and gives the model one clean **Current Info** section with the real numbers.
- **Bonds are only sent for who matters right now:** characters in the scene, anyone named in the last few messages, and anyone in the latest Bonds block. Everyone else stays on file and comes back when they do.
- **The Character Sheet is always sent** while its block is on. **Inner Chatter** and the **Story Tracker** send their last one.
- **Swipes and edits undo them properly**, the same way as World State.
- **Old chats work from day one.** The first time a chat opens, every block already in it is read, so old characters' bonds are there straight away.
- **"All characters" on the Bonds card.** A popup with every character's bonds, the ones in the story right now first.
- **Edit bonds and the sheet yourself.** **Edit** on the Bonds card and **Edit sheet** on the Sheet card open an editor: change any value, add a character, forget one. Clear a box to remove that value.

### Lorebooks reach the background jobs

- **On by default** (Settings). Background jobs build their own prompt, so your lorebook never reached them. Now image looks, NPC portraits and NPC refreshes get the entries that name that character, and the Story Director and NPC scans get the entries your story has active.

### See what background jobs send

- **Preview background prompts** (Settings, off by default). Before a background job sends its prompt — Memory, NPC Bank, World State, Blocks, the Notebook, Images, Banned Phrases, Story Director, Writing Style — a popup shows the exact messages and where they're going. **You can change the text before sending**, or cancel just that job; the story carries on. Pick which jobs to watch, all of them by default.
- **Last background prompts.** The last 10 prompts that were sent, for every chat and character, with Copy. Kept in your browser, never in the settings file, so it can't bloat it.
- The old preview is now called **Preview story prompts**.

### New NPCs get a proper card

- **A new NPC's dossier is a card**, the same look as the World State cast: name, role, age and sex, then one tidy row per field. Personality shows as chips when it's a few words, secrets stay blurred until you hover or tap, and **Open in NPC Bank** takes you to their record.

### Hide old blocks from the AI

- **On by default, marked Recommended** (Blocks tab). The extension removes the old blocks from the chat history the story model reads. You still see them in the chat, but the AI only gets what it's fed in Current Info — no pile of old blocks to wade through, and no tokens spent on them. No preset regex needed. Chat Completion only.

### Chomusuke can write your blocks

- **Blocks in the Chomusuke tab**, with a switch for each: **World State, Bonds, Character Sheet, NPC Inner Chatter and CYOA choices.** A block you send to Chomusuke is no longer asked of the story model; Chomusuke writes it after each reply. The story model spends its words on the story.
- **The cards look the same.** Tabs, CYOA buttons and Bonds buttons all work as before, and **Read again** asks Chomusuke to redo that reply's blocks.
- **The Story Tracker and Dice stay with the story model.** The tracker is the story model's own plan, and dice are rolled before the reply is written.

### Combine calls — one Chomusuke call per reply

- **One switch, in the Chomusuke tab.** When it's on, everything Chomusuke does for a reply — World State, your routed blocks, the notebook and the image when one is due — goes out as one call instead of several. It's off by default, and has a fallback to separate calls if the combined answer comes back incomplete.

### Images — Classic and Version 2

- **Two versions at the top of the tab: Classic | Version 2 · Consistent characters.** Classic is the image tab you know, with its own prompts. Version 2 is new. Both keep their settings when you switch, and they share the ComfyUI generator settings.
- **A tab that doesn't scare you off.** Three pages: **Characters** (Version 2), **When & how** and **Generator**. The everyday choices are big buttons (when images come, where they go, the shot, the prompt style); the rest waits under Advanced, and sampler, steps, seed, LoRAs and the rest under **Expert settings**.
- **ComfyUI status at the top.** It says whether ComfyUI is connected; when it isn't, a note says so and every setting stays where it is.
- **Characters as cards.** One small card per character (where they are, their look, what they're wearing); click one to edit its look in a popup. Everyone away is folded under one line.
- **V2: characters look the same in every image.** Most of every image prompt — each character's look and clothes — now stays the same from one picture to the next, and only changes when the story changes it. The model doesn't retype anyone's looks any more. It writes `@Aqua` and the extension puts in Aqua's saved look and her current outfit from World State. Retry gives you the same picture, even if her outfit has changed since.
- **One line per character.** Each character gets their own line in the prompt, so traits stop bleeding from one character into another.
- **The image shows the last message.** The model gets the earlier story only as background, and draws the moment the latest message ends on.
- **Looks come from the NPC Bank, the character card, the chat, or you.** A scan finds the characters and their looks. An established look only changes when you click Scan, and a popup shows old vs new for each one: Keep or Use new. A new character arriving in the story gets a look automatically. Lock a look and nothing replaces it.
- **Outfits come from World State**, so they're always the current ones. Optional **Detailed outfit tags** turn an outfit into precise tags once, when it changes, and reuse them for every image after.
- **Chomusuke can make the images for you.** Automatic images are written by Chomusuke instead of the story model, and placed at the end of the reply or in a random paragraph.
- **V2 needs World State on.** If it's off, the tab tells you and falls back to Classic.
- **Classic: the manual image prompt knows what characters look like.** It used to see only the last five messages. Now it also gets the character sheets (every member in a group chat), your persona, and the NPC Bank image tags.
- **Picking a tag style fills in the quality tags** in the prompt prefix for you.
- **Choose how many characters an image focuses on** (V2): 2, 3, 4 or all, 3 by default.
- **Better looks.** Every look starts with the sex and a real age tag (`young adult`, `old man`…), 8 to 12 tags you'd recognise the character by. A feminine-looking man or a masculine-looking woman gets the tags that make the image model draw the right sex. Outfits are a few plain tags, one per garment.
- **Plainer image prompts.** A few plain words per character for the pose, action and expression, a few objects and one main light.
- **A character with no look is left out of the image**, and you're told who, instead of the model guessing.

### Fixes

- **One image per image.** While ComfyUI was busy, the extension could post the same finished picture over and over — one report had seventeen copies. It checks one at a time now, and only posts once.
- **Cancelling an automatic image no longer leaves `[Generating Image...]` in the reply.**
- **Cancelling a regenerate puts the old image back** instead of leaving the message without one.
- **New chats no longer start with another story's characters** in Image Gen V2.
- **A look saved under a first name finds the full name** ("Anno" finds "Anno Ryo"), and POV images no longer ask for the player's outfit.
- **An empty image prompt answer stops with an error** instead of sending the prefix alone.
- **The NPC Bank no longer runs code hidden in an imported or AI-written NPC.**
- **Opening the Images tab no longer knocks SillyTavern offline** when ComfyUI isn't running. Its checks give up after a few seconds instead of tying up the connection for two minutes.
- **A ComfyUI address ending in `/` works.** The LoRA list, images and NPC portraits no longer break on `http://…:8188/`.
- **The rule about the player is clearer.** The default line now says the response doesn't speak, think, feel or act for you, and shows everything you reached for. Your own version from Dev Mode still wins.

---

## 2026-08-28

> Blocks stop disappearing when you run other extensions, Memory Core stops
> fighting `/hide`, and V10 gets a switch for models that mumble their dialogue.

**Re-import the preset for this one.** It ships a new regex the blocks needs.

### V10

- **Enhanced Dialogue.** A switch on each V10 engine card. The engines describe what good dialogue sounds like and trust the model to follow; some models read that as a suggestion. This swaps it for a strict version — spelled-out rules, stammering and shouting written into the text, and a list of things characters may never say.

### Story Config

- **The genres you asked for.** Slice of Life, Romance, Fantasy, Action, Sci-Fi, Drama, Horror, Comedy, Thriller, Anime, Adventure and Tabletop RPG now sit at the front of the Genre field, in the order they came up in the survey. The old list is still underneath — noir, mystery, survival, dark fantasy and the rest are more specific than anything a survey answer tends to be, and worth keeping.
- **Lighthearted is a Narration Tone now.** The most-requested tag, and the one thing the tone list had no word for — warm and playful were close but neither was it.

### Story Director

- **More genres.** Anime / Light Novel, Tabletop RPG, Psychological and Free-form join the list. Free-form is for when you don't want a genre imposed at all, which wasn't possible before — you had to pick something.
- **Type your own genre.** Pick **Custom…** at the bottom of the dropdown and a box appears. Write whatever you want — "cosmic horror western", "courtroom drama" — and it goes to the Director exactly as you wrote it. Switching back to a built-in genre keeps what you typed, so you can flip between them.
- **Twenty-two new Flavor Tags.** Lighthearted, Cozy, Grimdark, Whimsical, Enemies to Lovers, Unrequited Love, Second Chance, Mentor & Student, Conspiracy, Rescue, Escape, Space Opera, Wuxia / Xianxia, Academy, Military, Small Town, Obsession, Grief, Betrayal, Vampire, Ghost Story and Oblique Horror.

### Image Generation

- **There's a setup guide.** Getting ComfyUI talking to SillyTavern is the hard part and none of the settings matter until it works, so the tab now links straight to a walkthrough that covers the install, the connection and the first working image.

### Fixes

- **Blocks now render when MVU is on.** Any extension that redraws the message could stop the block card appearing — the raw text just sat at the bottom of the reply instead. The card finds its place a different way now, and other extensions can't push it out.
- **Memory Core works with `/hide` again.** If anything hid messages — MemoryBooks, another extension, or you typing `/hide` yourself — Memory Core stopped sending the live chat entirely. The AI got the vault and the summaries and not one line of the actual scene, which is why replies suddenly went vague and stopped remembering what just happened.

  It was a counting mistake, not a disagreement between the two. Memory Core remembers which messages it has archived by their position in the chat. Hiding a message doesn't delete it, but SillyTavern leaves it out of the list it hands to extensions — so every message after it shifted up, and Memory Core blanked the wrong ones. Hide enough and *everything* left lands inside the archived range, so all of it gets blanked. That's the total blackout. It bit hardest with extensions that hide from the very start of the chat, which is the common case.

  It now works out each message's real position before deciding anything, so hidden messages shift nothing. Your archives were never wrong and nothing needs re-archiving — turn Memory Core on and it picks up where it was.
- **Bonds and Character Sheet bars were missing on some models.** When the AI wrote the change note as `[(-4 she heard pity)]` instead of `(-4 she heard pity)`, the meters gave up and you got the raw line back. Both forms draw properly now.
- **The Character Sheet's Status line was being chopped into tags.** A status with a comma in it — "cleansed, still starving" — came out as two separate chips instead of one sentence. The card now reads the field types you set in the tab instead of guessing from the punctuation, so a one-item Skills list also stays a proper list.

---

## 2026-08-28

> A second engine for V10, a preset that stops your provider re-reading the whole
> chat every turn, and the lag is gone — a long reply used to cost half a second
> of processing on every single generation.

### Presets

- **The lag is fixed.** One of the cleanup rules shipped inside the preset was doing an enormous amount of pointless work on every message in the chat, every time you hit send. On a long reply it cost around **600 ms on its own** — and it got worse the longer your replies were. It now costs under a millisecond. Nothing about what it cleans has changed; it just stopped doing it the slow way.
- **A second preset: Cache Friendly.** Same engine, same everything — the pieces are just ordered so your provider can re-use most of the prompt instead of re-reading it from scratch each turn. If your API charges for cached input at a lower rate (Claude, Gemini, DeepSeek and others do), this is the one to load. If you don't know or don't care, the standard preset is Better order.
- **Both presets ship together.** Pick one, load it, done — nothing else to configure.

### V10 — there are two engines now

**V10 Shura** joins V10 Ukiyo. Neither is the flagship and neither is a lite version of the other:

- **Ukiyo is the storyteller.** The looser of the two — a teller with a temperament, spinning the world and its history, following whatever in the scene is most alive. It trades a little polish for invention.
- **Shura is the writer.** The stricter of the two — no slop, no AI tells, no line that exists to manage the scene. Every character is the protagonist of their own story, acting from their own values, and none of them is a villain in their own eyes. There is no objective right or wrong for the narration to take sides on.

Run a few scenes on each and keep the one that sounds like the story you want to read.

- **Co-writer versions of both.** Same engines, except the AI plays your character too — reading how *you* write and matching your voice. Anything you write yourself stays canon and is never overwritten. It won't invent your backstory; only the acting is shared.
- **Four V10 reasoning sets.** One for each engine, plus a **Thinking Cap** version of each for models that over-think — same reasoning, with a hard ceiling on how long it deliberates before writing.
- **V10 writing styles** are in Precooked Styles, and each engine loads its own when you switch to it.

### Story Config

- **Moved to the Presets & CoT tab,** where it sits beside the engine it modifies.
- **It's always on.** No master switch — a field left on *Preset default* still sends nothing, so "off" is per setting instead of all-or-nothing.
- **Every option sends a real instruction now.** Picking *steady* used to send the word "steady". It now sends what steady actually means, written out for the AI. Same for POV, length, explicitness, difficulty, friction, disposition and narrator presence.
- **Point of View, Length and Pace always send.** They ship set — third person limited, flexible, steady — because every story has all three whether you've thought about them or not.

### Dev Mode

- **Rebuilt as two doors.** **Add-ons** are the shared pieces every engine uses — thinking steps, MVU, the ban list, death, combat, dice, the output blocks — edited on their own page. **Engines** shows the actual prompt as the document it is, in the real order it gets sent, with your add-ons marked where they land. Click one to edit it and come back.
- **It tells you when a setting is switched off.** Editing something that isn't going to be sent now says so, instead of quietly accepting the change.
- **Edit once, applies everywhere.** Changing an add-on no longer means cloning an entire engine and getting stranded on a stale copy of it.

### Mobile

- **The hamburger menu is gone.** Tabs live in a floating bar at the bottom of the screen — one tap to switch, swipe along it to reach the rest.
- **The glass is back.** The panel floats over your chat with rounded corners and the blur the desktop version has, instead of a flat sheet covering the screen.

### Blocks

- **Compact World State draws the scene board.** It was falling back to plain paragraphs while the full version got the card — so turning Compact on quietly cost you the nice one. Both draw the same now.
- **Blocks explain themselves.** Hover any block, in the list or in the picker, for a line on what it actually does.

### Settings

- **Rebuilt** — grouped into Behaviour, Data and About, with the donation and GitHub links readable instead of squeezed into one line.
- **Send me a card.** I've been running out of things to roleplay, so there's a form for recommending a character card or a scenario. Completely anonymous — no sign-in, no name, nothing tying it back to you.
- **Utility Prefills is now opt-in and off by default.** It's the setting that breaks Image Gen, the Ban List and the Story Director on Claude and several other APIs. It used to be on until you found the switch; now you only turn it on if your API wants it.

### Notes you'll see around the tabs

- **Add-ons:** pick the three or four you want, not all of them. Past a handful, the prose thins out as the AI spends its attention on bookkeeping instead of writing.
- **Story Director:** V10 doesn't really need it — the engine drives the plot on its own. Switch it on when you want a hand on the wheel.
- **Side Panel is discontinued.** Blocks do it better and keep up with new blocks as they land. It still works for what it already knew about, and everything it shows is drawn in the chat card anyway.
- **Memory Core:** it isn't cache friendly, and it wants Semantic Embeddings rather than TF-IDF matching.
- **Direct Language and Dialogue & Narration** are marked as not needed on V10 — that engine already does both.

### Fixes

- **The Persona tab said "V9" while you were running V10.** So did the render-limit settings, which V10 doesn't even use — they now stay hidden unless you're actually on V9.
- **A cleanup rule was only removing the first colour tag in a reply** and leaving the rest behind.

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
