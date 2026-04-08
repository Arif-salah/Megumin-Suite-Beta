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
* **Completely Overhauled Stage 3 (Writing Style):** Redesigned the UI from a grid into a clean, full-width list layout.
* **Added Pre-Configured Templates:** Included 11 ready-to-use style templates (inspired by authors like George R.R. Martin, Stephen King, Jane Austen, etc.). You can now generate a complex rule directly from the library with one click!
* **Added "No Style" Toggle:** Placed a convenient "Off" option at the top of the style library to easily disable extra writing directives without deleting your saved profiles.

# beta 31/03/26
* added new test cot that aim for me NPCs agency and self goals.
* added v5 Slice of Reality mode New and improved balance mode that aim to use less token, more writing Creativity, better NPCs.
* added nora because why not.
# beta 30/03/26
* now the button is Draggable WOW
# Beta 29/03/26

**✨ New Features & Enhancements**
*   **Style Profile Library:** Transitioned from a single writing style configuration to a comprehensive Library. Users can now create, save, and manage multiple style profiles for different needs.
*   **Style Management:** Added quick-action buttons (**Regenerate, Edit, Delete**) to all style cards for faster workflow.
*   **Iterative AI Refinement:** Introduced a new 7th stage (Beta) designed for AI self-correction, allowing the model to identify and rectify its own systemic writing habits.
*   **Target Word Count Macro:** Added a new `[[count]]` macro in Stage 4 (Add-ons > Extra), allowing users to set specific maximum word counts for generated responses.
*   **Advanced CoT Framework:** Completely overhauled the Chain of Thought (`<think>`) logic in Stage 6 for improved reasoning and output quality.
*   **Multilingual Support:** Added full support for Japanese (日本語) within the Chain of Thought process.
*   **Output Language Optimization:** The engine now defaults to English if the "Language Output" field is left blank, effectively preventing CoT leakage into the final response.

**🛠️ Developer Tools & Safety**
*   **Global Dev Mode Toggle:** Introduced a global override switch. When enabled, saving or restoring a prompt override applies the change across all profiles (Characters, Groups, and Defaults) simultaneously.
*   **Prompt Safety Guard:** Implemented a fail-safe for the Global Dev Mode; `[[aiprompt]]` overrides are now restricted to local application to prevent the accidental erasure of unique style profiles.

**🐛 Bug Fixes & Optimizations**
*   **Group Chat Compatibility:** Resolved issues preventing the extension from detecting group chat environments.
*   **Stability Improvements:** Fixed a crash occurring when the "Generate Insights" button was triggered within the Style Editor during group chats.
**Under-the-Hood Preset Improvements**
Updated core prompting rules within `[[prompt3]]` to include:
*   Better introduction of new NPCs
*   Anti-passive voice enforcement
*   Enhanced living world dynamics
*   NPC agency prioritization
*   Scene continuation logic

# how to install:
[You know how to do it.](https://drive.google.com/file/d/16Ps0byP9zDDLJSX5fqNbFmq-DBTjPlMT/view)

