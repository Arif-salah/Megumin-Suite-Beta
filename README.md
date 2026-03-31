# beta 31/03/26
* added new test cot that aim for me NPCs agency and self goals.
* added new v4.2 balence test mode that aim to use less token and work with flash better.
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

## Installation

1. Go to SillyTavern **Extensions** → **Install Extension** → Paste this repo URL.
2. Download the two JSON files from this repo: `Megumin Suite V4.2.json` and `Megumin Engine.json`.
[https://github.com/Arif-salah/Megumin-Suite/tree/main/Presets](https://github.com/Arif-salah/Megumin-Suite-Beta/tree/main/Presets)

> ⚠️ **MOBILE USERS CRITICAL STEP:** If you download these on your phone and your browser renames them to `.json.txt`, you **must** use a file manager to rename them and delete the `.txt` part. Furthermore, make sure the Engine file is named EXACTLY `Megumin Engine.json` before you import it. The Suite file's name doesn't matter, but the Engine must be exact.

3. Open SillyTavern, go to the **API Connections** tab (the plug/sliders icon).
4. Click the **Import Preset** button (the little folder with an arrow) and upload BOTH files.
5. Once imported, open your preset dropdown and **make sure "Megumin Suite V4.2" is the active preset.** The extension handles the Engine silently in the background.
