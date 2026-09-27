# 006 — Image Gen: Classic and V2

Status: DRAFT
Date: 2026-09-26 · Author: Claude · Reviewer: developer

## Goal
Characters look the same in every image. About 70% of each image prompt, their appearance and their outfit, stays identical between generations and changes only when the story changes it. The model writes only what is different each time: who is in the shot, what they are doing, the place, the light and the framing.

The model never retypes appearance or outfit tags. It writes `@Name`, and the extension puts in that character's stored appearance and current outfit. This replaces tasks 001–004, which asked the model to copy tags it was shown, so the tags drifted. It also had no fallback for natural-language prompt templates.

The Image Gen tab gets two pages, **Classic** and **V2**, chosen at the top of the tab. Classic is the image tab exactly as it was before task 001, for anyone who prefers it. V2 is new, with its own, simpler UI.

## What the user will see / feel
- At the top of the Image Gen tab: **Classic | V2**. Each shows its own page. Both keep their settings when you switch.
- **Classic** looks and behaves exactly like the image tab before task 001.
- **V2:**
  - One **Cast** list: each character's stored look (appearance tags), their current outfit from World State, and a lock.
  - Two simple choices: **Prompt style** (Tags / Natural language) and **Shot** (Cinematic / POV / Portrait). They replace the six combined templates.
  - Images of the same character keep the same hair, eyes, body and clothes until the story changes their clothes.
  - A new character entering the story (`+ Name` in World State) gets a look automatically.
  - Changes to an established look happen only when you click Scan. A popup then shows old vs new for each character, with Keep / Use new.
  - The image preview shows the final prompt, with the parts the extension filled in highlighted.

## Part A — Classic

Classic = the image tab at commit `df9e9db` (the baseline before task 001):
- Prompt text: `src/prompts/imageGen.js` as at `df9e9db` (user prompt, injection template, all six rules/examples).
- Prompt building: `generateImagePromptText` and the `[[img1]]` injection, using the original `getRelevantNpcImageTags()` (NPC Bank image tags, top 3 by keyword relevance, only when `injectNpcTags` is on).
- UI: `renderImageGen` as at `df9e9db`. No Character Appearance list, no sheet scanner, no aliases, no Scene Snapshot.
- The NPC Bank's Image Tags field is visible and editable again. Task 001 had hidden it; Classic reads it, and V2 imports from it.

Shared by both pages, stored once, so switching loses nothing:
- ComfyUI connection
- workflow, model, LoRAs and their triggers
- sampler, steps, CFG, denoise, clip skip, seed
- resolution, negative prompt, compression
- where images go (New Message / Inline) and images per reply
- when to make images (always / every N / only when a photo is taken)
- preview before sending

## Part B — V2

### B1. The `@Name` language
The model writes the image prompt with placeholders. The extension replaces them just before the prompt goes to ComfyUI.

| Written by the model | Replaced with |
|---|---|
| `@Aqua` | Aqua's appearance, then her current outfit |
| `@Aqua.look` | appearance only (the model describes her clothing because it is different right now: undressing, a towel, soaked…) |
| `@Aqua.outfit` | outfit only (rare) |

Rules the substitution follows:
- **Names are matched against the known cast, longest name first,** so `@Lady Darkness` works without brackets. Nicknames work too: `@Matt` finds Matthew (the World State alias support).
- **Count tags belong to the model.** It writes `1girl, 1boy`, `2girls` and so on at the front. Count tags inside a stored appearance (`1girl`, `1boy`, `2girls`, `solo`, `multiple boys`, `male focus`…) are removed when it is pasted in, so they never appear twice or mid-prompt. The extension never guesses anyone's gender.
- **Exact duplicate tags are dropped** after substitution. Tags the model wrote anyway (e.g. a second `purple eyes`) disappear.
- **An unknown name** (`@Stranger`) becomes the plain name (`Stranger`), and the preview flags it. A raw `@` never reaches ComfyUI.
- **Prompt style Tags:** appearance = stored tags; outfit = outfit tags if "Detailed outfit tags" is on (B4), else the World State outfit text (already comma phrases).
- **Prompt style Natural:** appearance = the stored natural description (B3); outfit = the World State outfit text. The result reads as, for example, "Aqua, a slender young woman with long blue hair and blue eyes, wearing a blue dress with detached sleeves, …".
- The quality prefix (`masterpiece, best quality…` or `score_9…`) is added by the extension from the existing **Prompt prefix** setting, with a default per style. The model doesn't spend words on it.
- It runs inside `igGenerateWithComfy`, the one function every path ends in: manual button, inline `<img prompt>`, new-message mode, retry. The resolved prompt is what gets stored with the image, so **Retry reproduces the same image** even if an outfit has changed since.

The substitution is a pure function (`src/features/imagegen/v2/resolve.js`), tested under node.

### B2. What the model receives (prompts)
Two choices replace the six templates. Each prompt is one short base plus one style block plus one shot block. Framing rule (plan 005): nothing mentions an extension or anything being "filled in by" something; `@Name` simply *stands for* a character.

**Cast list** (built from World State + stored looks):
```
<Cast>
@Kazuma (the player)
@Matthew (also @Matt): in the scene
@Aqua: in the scene
@Sara: not in the scene
</Cast>
```
Only characters with a stored look, or who are present, are listed. At most the present cast plus absent characters named in the recent text ("returning", as in World State).

**Base rules (both modes):**
```
## Image prompt rules
@Name stands for that character's full appearance and current clothing, exactly as they look in the story.
- Put each character who is in the shot in the prompt as @Name, using the names in <Cast>.
- Never describe a @Name character's hair, eyes, face, skin, body or clothes; @Name already carries them.
- If someone's clothing is not what they normally wear at this moment (undressing, soaked, torn, a towel), write @Name.look and then describe the clothing as it is right now.
- Only put in characters who are actually in this shot. Two at most works best.
{style block}
{shot block}
{Extra instructions, if set}
```

**Style block, Tags:**
```
- Write comma-separated booru tags on one line.
- Start with who is in the shot: 1girl, 1boy, 2girls, 1girl 1boy, no humans… then the @Name of each character.
- Then pose and action, expression, how they interact; then the place, time of day and lighting; then camera and framing tags.
- No quality tags (masterpiece, best quality…); leave them out.
```

**Style block, Natural language:**
```
- Write 2 to 4 plain sentences describing the image.
- Name each character as @Name where they appear in the sentence.
- Describe the action, expressions, the place, the light and the camera angle.
```

**Shot blocks:**
```
Cinematic: Frame it like a film still. Choose a wide, medium or close shot to suit the moment, with a composition that tells what is happening.
POV:       The camera is {{user}}'s eyes. {{user}} is never written as @Name and never seen, except their hands or body from first person when they touch something. Include pov and what {{user}} is looking at.
Portrait:  One character, head-and-shoulders or chest-up, focused on face and expression, with a simple background from the place.
```

**Manual button / separate generation**, user message:
```
<Cast>…</Cast>
<Scene>
Time: … | Loc: … | Wx: …        (from World State, when on)
</Scene>
<Recent_Story>
…last 5 AI messages, cleaned…
</Recent_Story>
{base rules + style + shot}
Write the image prompt for the latest moment. Output only the prompt, nothing else.
```
System:
```
You write image prompts for moments from an ongoing story: who is in the shot, what they are doing, their expressions and poses, the place, the light and the framing.
```

**Inline (the story model writes the image into its reply)**, `[[img1]]`:
```
### IMAGE
{conditional text, as today}Within your response, insert {{imageCount}} image tag(s) like this: <img prompt="..."> at the moment the image shows.
<Cast>…</Cast>
{base rules + style + shot}
Inside prompt="...", never use double quotes.
```

### B3. Where a look comes from
A **look** = one character's appearance, stored per chat in `chat_metadata.megumin_character_tags` (task 003's key, so existing tags carry over):
```js
looks[name] = {
  tags: "long blue hair, blue eyes, slender, pale skin",   // appearance only, no outfit, no count tags
  natural: "a slender young woman with long blue hair…",   // for Natural style; made once, editable
  aliases: ["Aqua-sama"],
  locked: false,                                           // locked = never replaced, even by Scan
  source: "npc" | "sheet" | "chat" | "manual",
  updatedAt: 1695740000000
}
```
Sources, in order:
1. **NPC Bank:** a character with a dossier and Image Tags gets those as their look when the look is first created.
2. **Character sheet scan** (button): reads the card description (and the persona description for the player). It finds every character described there. The task 002 scanner is reused, rewritten cleanly.
3. **Chat scan** (button): reads the recent chat for characters who have no look, or for the ones you pick.
4. **Manual:** type or edit the tags. Manual edits always win.

When they update:
- **Automatic, new characters only:** when World State records `+ Name` for someone with no look (and no NPC Bank tags), a scan for just that character runs in the background (Chomusuke's Image Gen route when on). The result is added directly. There is nothing to compare against, so no popup.
- **Established looks change only when you click Scan** (sheet, chat, or the per-character rescan). A **popup** lists every character whose tags would change, old vs new, each with **Keep** / **Use new**, plus Keep all / Use all. Locked characters are listed as locked and not offered.
- **Natural description:** a "Describe" button makes it once from the tags (one short call) and stores it. If it's empty in Natural style, the tags are joined into a phrase as a fallback, and the preview shows that.

### B4. Outfits
- **Default: World State.** A character's outfit is their World State `Outfit` field, which is already short comma phrases. Absent characters keep their last known outfit.
  - The World State update rules (plan 005) are sharpened so every outfit is image-ready: `Outfit: the complete visible outfit, top to bottom, with colours and materials`. "Casual loungewear" gives a different outfit in every image; "grey hoodie, black joggers, white socks" doesn't.
- **Optional: Detailed outfit tags** (V2 setting). When a character's World State outfit **changes**, one short call turns it into precise booru tags. The result is stored as `looks[name].outfitTags = { from: <hash of the outfit text>, tags, locked }` and reused for every image until the outfit text changes again. That's one call per outfit change, not per image. The tags can be edited; **locking** them keeps them even when the text changes. Uses Chomusuke's Image Gen route when on.

### B5. The V2 page
Top to bottom:
1. **Classic | V2** switch (shared header).
2. **Images:** on/off, when (always / every N / only photos), where (new message / inline), how many, preview before sending, **Generate now**.
3. **Prompt:** Style (Tags / Natural), Shot (Cinematic / POV / Portrait), Prompt prefix, Extra instructions, Detailed outfit tags on/off.
4. **Cast:** one card per character:
   - name + nicknames, source badge, lock
   - appearance tags (textarea) and natural description (folded, with Describe)
   - current outfit (from World State, read-only here, "edit in World State") and outfit tags when detailed mode is on (editable, lockable)
   - rescan
   - Buttons at the top of the list: **Scan character sheet**, **Scan chat**, **Add character**.
5. **Generator** (folded): ComfyUI connection, workflow, model, LoRAs, sampler… The same settings as Classic, in one place.

## Files / modules
| File | What |
|---|---|
| `src/features/imagegen/index.js` | Becomes the tab shell: Classic/V2 switch + exports kept stable for `index.js`, `buildBaseDict.js`, `tabs.js`. |
| `src/features/imagegen/comfy.js` | Shared generator code moved out unchanged: connection, workflows, `igGenerateWithComfy`, progress, retry buttons. V2 substitution hook at its entry. |
| `src/features/imagegen/classic/ui.js`, `classic/prompt.js` | Restored from `df9e9db`. |
| `src/prompts/imageGen.js` | Restored to `df9e9db` text (Classic). |
| `src/prompts/imageGenV2.js` | B2 prompts. |
| `src/features/imagegen/v2/resolve.js` | Pure `@Name` substitution (tested). |
| `src/features/imagegen/v2/looks.js` | Look storage, sources, scans, review popup, `+ Name` auto-scan. |
| `src/features/imagegen/v2/outfits.js` | Outfit text/tags per character, detailed-tag cache. |
| `src/features/imagegen/v2/prompt.js` | Cast list, prompt assembly for manual and inline. |
| `src/features/imagegen/v2/ui.js` | The V2 page. |
| `src/engine/buildBaseDict.js`, `src/engine/injection.js` | `[[img1]]` and the quiet prompt dispatch by engine. |
| `src/features/npc/data.js`, `npc/fields.js` | `getRelevantNpcImageTags` restored for Classic; Image Tags field visible again. |
| `src/utils/nameMatcher.js` | Removed (V2 resolves names through the World State cast and look aliases). |
| `src/state/modules/world/render.js` | Outfit rule sharpened (B4). |

## Phases (a local commit after each)
1. **Split + Classic.** Move the shared generator code to `comfy.js`, restore Classic, add the Classic/V2 switch (V2 page shows "coming next"). Check: Classic's prompts match `df9e9db` text exactly (scripted diff).
2. **V2 core.** `resolve.js` with tests, look storage, prompts, generation paths (manual, inline, retry) through the substitution. Minimal V2 page.
3. **V2 looks.** NPC import, sheet scan, chat scan, `+ Name` auto-scan, review popup, natural descriptions.
4. **Outfits.** World State outfit rule, detailed outfit tags + cache.
5. **V2 page polish.**

## Out of scope
- Regional prompting / attention couple for multi-character bleed (a ComfyUI workflow feature; the prompt only advises two characters at most).
- Side panel.
- Bonds and the other blocks as state modules (next, per the reminder).

## Test plan
- `tests/imagegen-resolve.test.mjs`:
  - `@Name`, `.look` and `.outfit`
  - longest-name and alias matching
  - count-tag stripping
  - duplicate removal
  - unknown names
  - Tags vs Natural output
  - quotes inside inline prompts
  - idempotence (a resolved prompt passes through unchanged, for Retry)
- Classic: scripted comparison of the restored prompt text with `df9e9db`.
- In SillyTavern:
  - the Classic page and prompts behave as before 001
  - V2 manual image, inline image and retry
  - a new `+ Name` gets a look
  - Scan with a changed look shows the popup
  - a locked look is untouched
  - the Natural style uses descriptions
  - with detailed outfit tags on, an outfit change regenerates the tags once

## Open questions
- **Default page:** Classic for existing profiles (nothing changes until you switch), V2 for new profiles?
- **Existing task 003/004 tags:** they become V2 looks as they are, including `provisional` → `source: "chat"` and the aliases. OK?

## Progress
- **Decided (defaults, user said start):** Classic for existing profiles, V2 for new installs; task 003/004 tags become V2 looks as they are.
- **Phase 1:** `imagegen/` split into `index.js` (tab shell with the Classic | V2 switch and the generation dispatch), `comfy.js` (shared generator) and `classic/ui.js` + `classic/prompt.js`, all cut from the pre-001 file by line range. A scripted check shows every function is byte-identical to `df9e9db` except the two renames and one self-redraw call pointed at the Classic page. `prompts/imageGen.js`, `npc/fields.js` and `npc/data.js` were restored to `df9e9db` (zero diff). `utils/nameMatcher.js` was removed. The V2 page is a placeholder and V2 generation uses the Classic prompt until phase 2.
- **Fixes after phase 1:** one post per image (the ComfyUI poll ran checks in parallel and each posted the image); the Classic manual prompt now gets the character and persona sheets and the relevant NPC tags.
- **Phase 2:** `v2/resolve.js` (@Name substitution: longest name and alias matching, count-tag stripping, duplicate removal, unknown → plain name, Natural style in parentheses, finished prompts pass through unchanged), `v2/cast.js` (player + World State cast + looks + NPC Bank fallback + mentioned), `v2/prompt.js` + `prompts/imageGenV2.js` (B2 prompts), `v2/index.js` (bridge; task 003/004 tags upgraded to looks in place), `v2/ui.js` (Style/Shot/Extra + read-only cast). Every image goes through the resolver in `igGenerateWithComfy`; V2 writes its own `[[img1]]` and manual request. Also fixed: Retry no longer re-adds the prefix and LoRA triggers (a pre-existing bug). 17 new tests, 115 total.
- **Decided (after testing):** `@Name` is the ONLY placeholder. `.look` let the model describe clothing from the chat, which changed from image to image; the outfit now always comes from World State. `.look` / `.outfit` written anyway are read as plain `@Name`. The prompts use a fill-in structure plus a worked example (neutral names), each `@Name` once. The model describes clothing only for a character the cast list marks “clothing not noted”. The resolver puts each character in once, handles `@Name’s`, and drops clothing stuck onto `@Name(…)`.
- **Phase 3 (looks):** `v2/looksCore.js` (pure: scan and description prompts, parsing with nicknames and count-tag stripping, matching results to the characters asked for, planning add / change / locked / same), `v2/looks.js` (sheet scan of card + persona, chat scan, per-character rescan, review popup for established looks, natural descriptions, automatic look for arrivals). Everything runs through Chomusuke’s Image Generation route. `v2/ui.js`: editable cast cards (nicknames, look, description, lock, rescan, delete, add). V2 needs World State: picking V2 with it off asks to enable it; otherwise V2 is inactive (red banner, page greyed, Classic prompt). The dead task-002 sheet-scan prompt is removed.
