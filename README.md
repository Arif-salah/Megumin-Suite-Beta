# beta 02/08/26

 Side Panel Overhaul

- **Full-Detail Player Card:** your own character's World State block now fills the player card, outfit, position, condition and carried items included.
- **Compact Mode, Full Data:** Added support for compact World State version.
- **Forgiving Readers:** slightly mangled blocks from the AI, a stray space in a tag, a missing bold, a missing emoji, are read instead of ignored. Twenty-five repaired shapes across the extension. A block that arrived broken is named as such in the panel rather than showing the same empty message it shows when no block came at all, and field values have lost the stray asterisk at the front.
- **Live Story Tracker:** the story tracker now is inside side pannel.
- **Folded Dossier Cards:** several new character dossiers in one message arrive as a short list of folded cards, one line each. Click one to open it. A single dossier still opens by itself.
- **Multi-Line Thoughts:** a character's inner thought written over more than one line stays one thought under that character's name. It used to spawn a second, nameless speaker.
- **Fixed "Ghost Chat" Bug:** the panel no longer shows the previous chat for a moment after you switch chats, and closing a chat empties the panel completely instead of leaving the old chat's plan and character bank on screen.
- **Fixed "Half Dossier" Bug:** a colon inside a field value, CS: GO for example, no longer cuts the field short. Inner circle lists and long descriptions now arrive whole.

 Smart Block Hiding

- **Latest-Reply-Only Design:** only the newest AI reply has its blocks hidden. Older replies keep their blocks visible in the chat, so the history reads back complete, and when a new reply arrives the one before it gets its blocks back.
- **Parse First, Hide Second:** a block leaves the chat only when the panel has actually read it. A block the panel cannot read stays visible instead of vanishing from both the chat and the panel, and the check runs dossier by dossier on the New NPC boxes, so one broken dossier keeps all of them visible rather than dragging the readable ones out of sight with it.
- **Tracker Hidden in Chat:** the story tracker at the end of a reply is hidden in the chat once the panel has read it, including a tracker restyled into a collapsible box or drawn inside another extension's frame, which are hidden whole. A tracker the panel cannot read stays visible.
- **Hiding That Sticks:** hidden blocks go back into hiding the moment a message edit is saved or cancelled, stay hidden when another extension redraws a message, picture generation included, and take their pile of leftover blank lines at the end of a reply with them.
- **Your Own Folds Are Safe:** a fold you write yourself that merely mentions the World State will not be mistaken for a real World State block and hidden.
- **Fixed "Secret Spiller" Leak:** story tracker text, story secrets included, stays out of the AI memory, the summaries, the image prompts, and the story planning. A reply cut off partway through a block used to leak the half that arrived into those same four places; that is closed too.

 Present Characters Bar

- **Works in More Places:** the bar now handles compact World State mode, and it appears when you switch the panel on partway through a session, with no reload needed.
- **Fixed "Vanishing Name" Bug:** character names with accents, other alphabets, quotes, parentheses, or a lowercase first letter no longer vanish from the bar.
- **Portraits & Polish:** portrait uploads, renames, and deletes reach the bar right away. The glow around a card is no longer cut off square, and the strip has lost the scrollbar along its bottom edge. The cards still scroll with the wheel, by dragging, and with the arrow buttons.

 Save Safety & Global Prompts

- **Fixed "Fast Switch" Save Loss:** the last half second of typing survives a quick chat switch, and pending saves are flushed when the tab is hidden or the page closes.
- **Global Prompt Templates:** edits in the Advanced: Edit Prompts panels now apply everywhere at once rather than only to the character or chat that is open. One honest note: if you had different templates saved on different characters, "your next edit becomes the one they all share."

 Inline Images

- **Regenerate Button, Wherever the Picture Is:** the regenerate button on a generated picture appears the moment the picture arrives rather than after the chat is loaded again, and it reaches messages brought back by Show More.

 Under the Hood

- **Build Tag:** the side panel prints one line in the browser console when it loads, "sidepanel build" plus a date tag, so you can always tell which copy of the code is running. If an update looks broken, check that line first: a normal reload can leave the browser serving its cached copy of the old code. The line sits at the console's Verbose level.
- **Quiet Diagnostics, Zero Cost:** when something cannot be read, a note is written to the browser console, so a bug report can carry something concrete. And every check this update adds skips work that is already done, so none of it costs speed you can feel.

 UI

- Some changes to the overall UI style.

# beta 01/08/26
Performance & CPU/HDD Optimizations (The Benchmark Fixes)

**Fix 1: The HDD Murderer (Master Debounce):** Strict 500ms debounce on saveProfileToMemory(). No more saveMetadata on every keystroke: 60+ hard drive rewrites down to exactly 1 after typing stops.

**Fix 2: The Infinite Scanner (Vault Retrieval Cache):** Hashing cache on the Vault Scanner, and the token counter no longer triggers vault scans at all. Token counter refresh lag: 2.3 seconds down to 0.004ms.

**Fix 3: The Query Spam (Semantic Query Debounce):** Rapid events grouped under an 800ms debounce. Exactly 1 semantic query instead of 3-10 simultaneous API calls.

**Fix 5: The No-Op Idle Save Bug:** "Dirty State" hash check aborts saves when nothing changed. No more 155MB idle writes.

**Fix 6: Archival Run Survival:** Handles 900+ message backlogs without locking the browser. If the API drops mid-run, every finished summary is kept and saved, and the error names the block that failed. A hiccup at chunk 40 no longer costs you 40 chunks.

**One Write Per Save:** Memory Core, Story Plan and NPC Bank used to hit the chat file with three separate writes per save. Now one. The silent NPC Bank loss on huge chats is dead.

**Tab-Switch Safety:** Edits still waiting in the debounce window are flushed the moment the tab hides or the app goes to the background.

RAG & Vector Database Upgrades

**Fix 4: The Vector Insert Limit & Splitter:** Long memories were being fed to the embedder whole, and both common models choke on that: MiniLM silently truncates past 512 tokens, so only the first paragraph ever got indexed, and Jina outright crashes on big chunks. Oversized text is now cut into 1,200-character pieces at word boundaries with #0, #1 hash suffixes (128 max), safe for both models. Queries get the same cap, keeping the newest end.

**Fix 4.5: Semantic Oversampling & Deduplication:** Requests the top 12 results, maps pieces back to their parent memories, dedupes, returns the top 3 distinct memories. No more one memory hogging all slots.

**Orphaned Slice Cleanup:** Deleting a parent memory deletes its hash and every piece hash with it. No database bloat.

**Honest Vector Sync:** The "Vector Database Synced!" toast now checks the server response first. Failures say so.

**Group Chat Bucket Fix:** No more megumin_group_null shared collection when ids have not settled. Each chat reads its own memories.
# beta 28/07/26
**UI & Design Overhaul**
*   **Streamlined Navigation:** Condensed the interface into 10 unified tabs. "Core Engine" and "Chain of Thought" are now merged, as well as "Global Settings" and "Response Blocks".
*   **Dock Cleanup:** Removed redundant text headers and moved the Global Settings gear icon cleanly to the absolute bottom of the floating dock.

**Dynamic Formatting & Blocks**
*   **Smart Block Headers:** The instruction `"## At the end of your response you must put these blocks:"` now intelligently injects exactly once, attaching itself only to the top-most active UI block (World State, Inner Chatter, CYOA, or Story Tracker) to prevent prompt spam.
Fix the model Dumping the lore in the response, and not outputting blocks "DS4 still may not output"
*   **Compact Mode Compatibility:** Fixed formatting conflicts so the new dynamic header works flawlessly alongside the Compact World State mode.

**Save Modes & Smart Sync**
*   **Profile Save Modes:** Added a new dropdown in Global Settings to toggle between "Per Character" and "Per Chat" save modes.
*   **Smart Global Sync:** The "Sync Tab Globally" button has been completely rewritten. It now safely syncs *settings* (toggles, sliders, prompt templates) while strictly preserving unique profile *content* (Saved NPCs, Memory Chunks, and Story Directives) from being accidentally overwritten.

**NPC Bank & Pruner Optimizations**
*   **Chat Metadata Storage:** Migrated the NPC Bank out of the global `settings.json` file and directly into the `.jsonl` chat file (`chat_metadata`). This massively improves overall extension performance and allows NPCs to travel seamlessly if a chat file is exported.
*   **Zero-Data-Loss "Lazy Migration":** Existing NPCs are safe. Old NPC data will silently and safely migrate to the new chat-based storage system the next time an older chat is opened, gradually cleaning up the global settings file without risking data loss.
*   **Fixed "Empty Chat" Wipe Bug:** The automatic data pruner no longer accidentally deletes saved NPCs during the split-second when a chat is first loading into SillyTavern.
*   **Fixed "Regenerate" Wipe Bug:** The pruner now respects SillyTavern's `is_generating` state, preventing it from accidentally culling newly introduced NPCs when a message is temporarily removed during a swipe or regeneration.
# beta 24/07/26
* side panel master toggle turn off everything Related to side panel like "Present Characters Bar".
* fixed Present Characters Bar ui for mobile users.
# beta 19/07/26
* added v9 Engines
* added V9 Dynamic Render Limits
* added Precooked Styles edit
# beta 10/07/26
* Mobile UI fix
**⚙️ New Global Settings Menu**
* Added a dedicated Global Settings gear icon to the top action bar.
* Moved **Prompt Payload Preview** and **Disable Utility Prefills** out of individual character profiles into this global menu.
**🎬 Story Director Enhancements**
* **Context Awareness:** The Story Director now reads *both* User and AI messages, allowing it to react to your specific actions.
* **Context Limit Toggle:** Added a dropdown in Engine Settings to let the Director analyze either the "Last 100 Messages" (faster/cheaper) or the "Full Chat History".
* better story planner prompt.
**🌍 Compact World State**
* Added an inner menu to the World State add-on card to enable **Compact Mode**. so the AI only generates the massive lore block every X replies falling back to a tiny 30-token "Micro-Dash" (Time, Location, Clothes, Posture) the rest of the time.
**🔄 Sync & Cleanup**
* **Global Sync Restored:** Brought back the "Sync Tab Globally" button to the *Writing Style* and *Side Panel* tabs.
* **Sync Array Updated:** Rewrote the sync mapping so it now captures newly added settings (like the NPCs Bank, POV selection, and CoT toggles).
* **Summary Block Removed:** Completely stripped out the old Summary tracker block. in Favor for the faster memory core.
# beta 3/07/26
* added side panel thanks to Luka
* added Export/inport to npc bank and memory core
* a full Redesign of story planner with a lot more options
   Brand New Director's Console UI: A sleek, easy-to-use new interface that puts you in the director's chair.
   Granular Story Control: Fine-tune the AI's focus with new toggles for Pacing, Content Rating, Primary Genre, and special Flavor Tags (like Love Triangle, Slow Burn, etc.).
   Director's Notes: A dedicated space to drop specific instructions or hard rules on where you want the plot to go next.
   Unrestricted Content Toggle: A powerful new override switch that helps the AI push past safety filters when you want the story to explore darker, unrestricted, or explicit themes.
   High-Effort, Structured Output: The AI is now strictly instructed to act like a professional writer. It generates deep, thoughtful "Narrative Directives" rather than giving you lazy, low-effort bullet points.
   Invisible Auto-Evolution (Story Tracker): The AI now secretly evaluates its own progress in the background. Once it realizes the current story beat has naturally concluded, it will automatically evolve the plot forward—all without cluttering your chat or requiring you to press a button!
* added edit prompt to npc bank portrait thanks to Lazerin Athania for the idea
* new memory core Optimization x100 faster
* per chat save profile
   Automatic Memory Pruning: If you branch a chat back to an earlier point (e.g., branching from message 50 instead of 100), the memory vault automatically prunes future summaries that haven't happened yet in the new timeline.
   NPC Bank Timeline Correction: Branching back in history will automatically remove any characters that were introduced in the deleted future timeline, keeping your NPC list synchronized with where you are in the story.
   Automatic Story Director Replanning: Going back in time before a directive/story plan was created will cleanly reset the current plan (while keeping your selected genres and tags) so the director can auto-generate a fresh, relevant plan for your new timeline.
   Smart Chat Branching Inheritance: When you create a branch or checkpoint from an existing chat, the new branch automatically inherits all the settings of the parent chat.
* fixed memory core saving data inside data\default-user\settings.json Which may cause lag on low-end hw 
now memory core and story planner save inside the chat file and it will clean any old stuff inside settings.json.

# beta 24/06/26
* fixed memory core generator Backend not saving.
# beta 24/06/26
ImageGen Fixes
* Positive Prefix Box: Added a special text box to insert global tags (like `score_9, masterpiece,`) right at the start of your prompt before it reaches ComfyUI.
* Smart LoRA “Trigger Words” Memory: Added text boxes for trigger words underneath each of the 4 LoRA slots. and the system will remembers your trigger words: whenever you select one of your used LoRAs from the dropdown list, it will fill the corresponding trigger words automatically!
* “Dice” Seed Button: Added a convenient dice icon next to the Seed input that sets the seed to `-1` (Random).
# beta 22/06/26
* Custom Injection Thresholds: You can now manually set the maximum number of NPCs injected into a prompt using the UI.
* Dynamic Blacklist: Added a text box to blacklist specific character names (e.g., pets, crowds) so the AI won't generate dossiers for them.
* Automatic Blacklisting: In automatic mode (OOC Trigger Off), all currently saved NPCs are automatically ignored to prevent duplicate dossier generation.
* TF-IDF Keyword Scoring Redesign:
   * Exact NPC name matches receive a +50 score bonus to guarantee context injection.
   * Generic keywords found in over 50% of saved NPCs are ignored to stop irrelevant character generation.
* Better NPCs dossier for more NPC depth.
# beta 13/06/26
* added v8 fusion.
* added pov selection inside writing style tab for Precooked Styles only.
# beta 12/06/26
bug fixes and one change
* fixed a bug when sometimes the wrong cot get injected
* fixed a bug where image tag <img prompt="[prompt]"> get generated inside the thinking
changes:
* removed all the locks and put a warning system Instead
# beta 12/06/26
 Massive Feature Overhaul & V8 Engines
* V8 Obsidian & V8 Spark Engines: Added the absolute pinnacle of the Megumin Suite (Obsidian) for unmatched human psychology and story plotting, along with a highly efficient lite version (Spark). 
* Engine Strict-Locking: The UI now actively prevents you from breaking the AI. Selecting V8 completely locks the Persona & Toggles tab. CoT models are now strictly locked to their compatible engines (V6 can only use V6 CoT, V8 can only use V8 CoT, etc.).
* Smart Block Conflicts: The Add-ons tab now auto-locks conflicting blocks. Turning on MVU locks out the World State block. Turning on Memory Core locks out the Summary block.
* Master Prompt Switches: Added a master "Enable/Disable" toggle to all Advanced Prompt Editors across every tab. Keeps the engine safe from half-edited or broken prompt fields.
* Token Counter Calibration: Calibrated the live token counter math to better match real API tokenizers. 

 Image Generation Upgrades
* Prompt Templates: Replaced the old style dropdowns with 6 highly optimized templates (Illustrious + POV, SDXL + Cinematic, etc.).
* new inline Injection: send the pic in the response
* Dynamic Image Count: You can now generate 1, 2, 3, or 4 images at a time (automatically syncs with MVU output!).
* Token Saver Toggles: Added "Include Examples" and "Better Booru tags" toggles to let you customize prompt injection and save tokens.
* Inject NPC Tags: The Image Generator can now automatically scan the scene and pull exact physical Booru tags from your saved NPCs!

 NPC Bank Overhaul
* Dossier 2.0: Upgraded the NPC extraction format with strict, detailed fields (Orientation, Voice, Secrets, Canon Lock, and dedicated Image Tags).
* OOC Trigger: Save massive amounts of input tokens! The dossier template is now hidden from the AI *unless* you type "NPC" or "dossier" in your chat message.
* Image Tags Only Toggle: Every saved NPC now has a button to hide their text dossier from the AI, while still allowing the Image Generator to read their physical appearance tags.

 UI & Regex Polish
* Writing Style Redesign: Completely redesigned the Writing Style tab into a sleek "Sidebar Dashboard" with a compact masonry grid and an integrated Dialogue/Narration Ratio slider.
* Aggressive Chat Cleaner: Upgraded the internal regex cleaner to flawlessly scrub all ComfyUI wrappers, placeholders, and raw HTML from the chat history before the AI reads it.
* Fixed a bug where ComfyUI workflows wouldn't populate instantly when toggling Image Gen on.
# beta 26/05/26
* fixed memory core
* added scan history to NPC Bank
* you can now edit prompts in tabs
* added v7.5
* fixed token counter
* added Minimum or Maximum word count
# beta 17/05/26
* added full mamory manager change from Cohee/jina-embeddings-v2-base-en to Xenova/all-MiniLM-L6-v2 if you going to use Semantic Embeddings. i recommend only using the keywords its faster and do 90% like Semantic Embeddings.
* added NPC bank.
* added v7 core more balaned less edgy.
* some bug fixes.
# beta 11/05/26
* added CYOA cleanup.
# beta 30/04/26
* Fixes for GLM and DS4.
note: enable prefill only for Gemini.
# beta 26/04/26
* fixed multi thinking box with models like GLM and Deepseek.
* fixed thinking for GLM and DS 4.
* DeepSeek 4 support test.
* Dialogue & Narration Format toggle for better narration style adherence in some models recommended.
* fixed color charcater in DS4 *maybe*.
* added thinking effort control.
* you can now edit every thing inside dev mode i mean every thing all.
* added export/import to banlist. and fixed banlist ui.
* added thinking v2 in cot this give more freedom to the ai thinking while following the cot. only for gemini 3.1 pro and 3 flash. put <think> and </think> inside the Reasoning Formatting.
Note: use only english COT for deepseek 4.
# beta 23/04/26
* added Dream team v6 and v6 lite.
* fixed some under the hood stuff.
# beta 18/04/26
* change COT off now will remove <think>\n{Thinking}\n</think> so the ai will not be forced to use thinking.
* added Dialogue / Narration Ratio slider so now you can choose how mush narration you want (i know you dont like to read you dummy)
* added new "Precooked" styles for fast style pick.
* Added a filter bar (All, Precooked, AI Generators, My Library) to organize the style tab.
* added Megumin image for manual image gen.
* added token counter.
* added Cinematic Sounds (onomatopoeia) and animation toggle.
* added cleaning Function to clean character profile if the character was deleted.
* added Story Planner.
* fixed GLM error with banlist and image_gen.
* added Disable prefill to fix opus error when generating banlist or image_gen.
* new ui more clean, more modern for mobile and disktop.
* nanogpt not working for Rules and insight generating fixed.
* added apply Specific tab to all profile.
* some under the hood fixes for better rule Generating.
* added the ability to edit Custom User Engines right from the Core Engine menu.
* added the ability to use direct api call or Specific preset for image gen and bed list.
* Dev mode fixed and added:
  - The engine renaming and "Save Engine" bar now sticks to the top of the screen when you scroll through long prompt blocks.
  - Implemented a "Dirty State" tracker. If you edit an engine and try to click "Back," "Exit Dev," or "Close" without saving, a confirmation popup will warn you.
# beta 08/04/26
* added the ability to choose between no change or Default in dev mode COT.
# beta 06/04/26
* the button is fixed now (removed the draggable function).
* Optimized the ext.
# beta 06/04/26
* added new image gen stage.
* new and improved Dev mode.
# beta 02/04/26
* fixed a Stupid error from my side i forget to enable Forbid Overrides so some cards was changing the main prompts and making the output bad. use the new json files.
* added MVU Compatibility read here https://github.com/KritBlade/MVU_Game_Maker
# beta 01/04/26
* fixed some misspelling.
* redesigned the model tab to have more language options for the new v2 COT.
* Completely Overhauled Stage 3 (Writing Style): Redesigned the UI from a grid into a clean, full-width list layout.
* Added Pre-Configured Templates: Included 11 ready-to-use style templates (inspired by authors like George R.R. Martin, Stephen King, Jane Austen, etc.). You can now generate a complex rule directly from the library with one click!
* Added "No Style" Toggle: Placed a convenient "Off" option at the top of the style library to easily disable extra writing directives without deleting your saved profiles.

# beta 31/03/26
* added new test cot that aim for me NPCs agency and self goals.
* added v5 Slice of Reality mode New and improved balance mode that aim to use less token, more writing Creativity, better NPCs.
* added nora because why not.
# beta 30/03/26
* now the button is Draggable WOW
# Beta 29/03/26

✨ New Features & Enhancements
*   Style Profile Library: Transitioned from a single writing style configuration to a comprehensive Library. Users can now create, save, and manage multiple style profiles for different needs.
*   Style Management: Added quick-action buttons (Regenerate, Edit, Delete) to all style cards for faster workflow.
*   Iterative AI Refinement: Introduced a new 7th stage (Beta) designed for AI self-correction, allowing the model to identify and rectify its own systemic writing habits.
*   Target Word Count Macro: Added a new `[[count]]` macro in Stage 4 (Add-ons > Extra), allowing users to set specific maximum word counts for generated responses.
*   Advanced CoT Framework: Completely overhauled the Chain of Thought (`<think>`) logic in Stage 6 for improved reasoning and output quality.
*   Multilingual Support: Added full support for Japanese (日本語) within the Chain of Thought process.
*   Output Language Optimization: The engine now defaults to English if the "Language Output" field is left blank, effectively preventing CoT leakage into the final response.

🛠️ Developer Tools & Safety
*   Global Dev Mode Toggle: Introduced a global override switch. When enabled, saving or restoring a prompt override applies the change across all profiles (Characters, Groups, and Defaults) simultaneously.
*   Prompt Safety Guard: Implemented a fail-safe for the Global Dev Mode; `[[aiprompt]]` overrides are now restricted to local application to prevent the accidental erasure of unique style profiles.

🐛 Bug Fixes & Optimizations
*   Group Chat Compatibility: Resolved issues preventing the extension from detecting group chat environments.
*   Stability Improvements: Fixed a crash occurring when the "Generate Insights" button was triggered within the Style Editor during group chats.
Under-the-Hood Preset Improvements
Updated core prompting rules within `[[prompt3]]` to include:
*   Better introduction of new NPCs
*   Anti-passive voice enforcement
*   Enhanced living world dynamics
*   NPC agency prioritization
*   Scene continuation logic

# how to install:
[You know how to do it.](https://drive.google.com/file/d/16Ps0byP9zDDLJSX5fqNbFmq-DBTjPlMT/view)

