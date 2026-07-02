# beta 3/07/26
* added side panel thanks to Luka
* added Export/inport to npc bank and memory core
* a full Redesign of story planner with a lot more options
* added edit prompt to npc bank portrait thanks to Lazerin Athania for the idea
* new memory core Optimization x100 faster
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

