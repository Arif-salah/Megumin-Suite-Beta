# Image prompts: every text the image features send to a model

Generated from the code on 2026-09-27 (V2 action, look and outfit rules updated 2026-10-07 and 2026-10-13), so every text below is exactly what is sent today.

**How to use this file:** edit the text inside the ```text blocks directly, or write notes under a block (start them with `NOTE:`). Keep the `{{placeholders}}` unless you mean to drop them: the code fills them in. When you're done, send the file back and I'll move the changes into the code.

Parts marked **(example: built from made-up data)** only show how the pieces fit together. Don't edit those; edit the pieces they're built from.

## Part A: Classic

Classic has the model write the whole image prompt itself. The chosen **Prompt Template** (6 of them: 3 shots × Illustrious/Anima or Z Image) supplies the rules and the examples.

### A1. Shared pieces (used by every template)

**System prompt (manual button / Chomusuke writing the prompt)**  
_Code: `src/prompts/imageGen.js → systemPrompt`_

```text
You are an expert AI image prompt engineer. Your job is to read a scene and convert it into a highly detailed visual prompt for an image generation model. You must adhere to the requested Rules and Constraints. Do not include quotes, conversational text, or explanations. Output ONLY the raw prompt text.
```

**User prompt (manual button / Chomusuke writing the prompt)**  
_Code: `src/prompts/imageGen.js → userPrompt`_

```text
Write an image generation prompt for the moment <Last_Message> ends on. <Earlier_Story> is only there so you understand it: draw nothing that has already ended (someone who put an item away no longer holds it).

<Earlier_Story>
{{chatHistory}}
</Earlier_Story>

<Last_Message>
{{lastMessage}}
</Last_Message>

{{templateRules}}

{{extraStr}}

{{directLanguage}}

{{npcImageTags}}

{{templateExamples}}
```

`{{chatHistory}}` = the 4 AI messages before the last one; `{{lastMessage}}` = the last one. `{{templateRules}}`/`{{templateExamples}}` = the chosen template below. `{{extraStr}}` = the Extra Instructions box. `{{npcImageTags}}` = NPC Bank image tags. The character and persona sheets are also added.

**Thinking prompt (added when thinking is on)**  
_Code: `src/prompts/imageGen.js → thinkingPrompt`_

```text
<thinking_steps>
Before creating the response, think deeply.

Thoughts must be wrapped in <think></think>. The first token must be <think>. The main response must immediately follow </think>.

<think>
Reflect in approximately 50-100 words as a seamless paragraph on what visual elements are present.

</think>
</thinking_steps>

[OUTPUT ORDER]
    Every response must follow this exact structure in this exact order:

    <think>
    {Thinking}
    </think>

    {Main response}
```

**Inline instruction (the story model writes <img prompt="..."> itself)**  
_Code: `src/prompts/imageGen.js → injectionTemplate`_

```text
### IMAGE GENERATION:
{{conditionalText}}Within your response, insert {{imageCount}} of this image tag: <img prompt="[prompt]"> to illustrate the scene.
{{templateRules}}

{{promptExtra}}

{{directLanguage}}

{{npcImageTags}}

{{templateExamples}}
```

**`{{conditionalText}}`: when the trigger is "Only when a picture is taken"**  
_Code: `src/engine/buildBaseDict.js`_

```text

```

**`{{directLanguage}}`: when "Better Booru tags" is on**  
_Code: `src/engine/buildBaseDict.js + classic/prompt.js (same text twice)`_

```text
**DIRECT LANGUAGE:** Use exact Booru tags only. "naked" not "wearing nothing." "erection" not "visible arousal."

**NSFW TAG REFERENCE (use when scene is explicit):**
Body: naked, nude, topless, exposed nipples, small breasts, medium breasts, large breasts, spread legs, ass, erection, veins, veiny penis
Actions: hetero, sex, vaginal, anal, oral, fellatio, after fellatio, paizuri, straddling, riding, missionary, doggystyle, cowgirl position, moaning, open mouth, tongue out, ahegao, clenching teeth
Fluids: cum, cum on body, cum on breasts, cum on face, cum on hair, cum on tongue, cum in mouth, cum inside, ejaculation, facial, saliva, sweat
State: flushed face, heavy breathing, trembling, crying with eyes open, half-closed eyes, solo focus
```

### A2. Illustrious/Anima + Cinematic

**Rules**  
_Code: `src/prompts/imageGen.js → rulesIllusCinematic`_

```text
Build the prompt in this EXACT order. Do NOT rearrange sections.

**SECTION 1 — Quality + Camera:**
Start: masterpiece, best quality, highly detailed, cinematic composition,
Then camera type (pick one):
- Wide: wide shot, full body,
- Medium: medium shot, upper body,
- Close: close-up, face focus,
- Dramatic: dutch angle, or low angle, or high angle,

**SECTION 2 — Character Count:**
Booru tag for visible characters: 1girl,, 2boys,, 1boy 1girl,, etc.

**SECTION 3 — Character Descriptions (anti-bleed rules):**

FOR SINGLE CHARACTER (1 person in frame):
Use a flat comma-separated Booru tag string for appearance + action. Example:
mature female, pale skin, dark eyes, long black hair, messy ponytail, dark wool coat, white silk blouse, tear-streaked face, anxious expression, sitting sideways, holding blanket, reaching toward viewer,

FOR MULTIPLE CHARACTERS (2+ people in frame):
You MUST describe each character in a SEPARATE natural-language sentence/paragraph to prevent feature bleeding. Use Booru tags for appearance and clothing WITHIN each sentence, but separate characters with clear spatial language ("on the left," "in the center," "behind her").

Format per character: "The [position] is a [gender/species] with [hair tags], [eye tags], [skin tags], wearing [clothing tags]. She has a [expression tag] and is [action/pose]."

Each character gets their OWN paragraph. Do NOT merge characters into one comma-separated list.

**SECTION 4 — Scene + Lighting (always last):**
End with background, lighting, atmosphere. Cinematic lighting tags: volumetric lighting, rim lighting, god rays, lens flare, dramatic shadows, backlighting, silhouette,

**BANS:** No "realistic" or "photographic". No first-person POV tags in this template.
```

**Examples (sent only when "Include Examples" is on)**  
_Code: `src/prompts/imageGen.js → examplesIllusCinematic`_

```text
EXAMPLE — Single Character Cinematic:
<img prompt="masterpiece, best quality, highly detailed, cinematic composition, low angle, full body, 1girl, young woman, dark skin, amber eyes, long white hair, loose waves, gold circlet on forehead, white draped toga, gold belt, bare feet, determined expression, standing on cliff edge, arms at sides, fists clenched, wind blowing hair and fabric, mountainous desert landscape, ancient ruins in background, golden hour sunlight, volumetric lighting, rim lighting, dramatic shadows, dust particles in air">

EXAMPLE — Multiple Characters Cinematic:
<img prompt="masterpiece, best quality, highly detailed, cinematic composition, wide shot, 2girls, The figure on the left is a tall elf woman with long silver hair, pointed ears, pale skin, green eyes, wearing dark leather armor, hooded cloak pushed back. She has a cautious expression and is gripping a bow at her side. The figure on the right is a short dwarf woman with tan skin, brown eyes, thick red braided hair, wearing dented iron plate armor, fur-lined pauldrons. She has a grinning expression and is resting a warhammer over her shoulder. Rain-soaked cobblestone street, medieval town at night, glowing tavern windows in background, volumetric fog, rim lighting from streetlamp, puddle reflections, dramatic shadows">
```

### A3. Z Image + Cinematic

**Rules**  
_Code: `src/prompts/imageGen.js → rulesSdxlCinematic`_

```text
Build the prompt in this EXACT order. Do NOT rearrange sections.

1. **Natural Language Architecture:** Write the prompt as highly detailed, grammatically complete sentences. Use a masterpiece.
2. **Camera & Composition:**
   - Establish the camera angle, distance, and framing first (e.g., "A cinematic wide shot from a low angle looking up at...").
   - Do NOT use first-person POV. Frame the scene as a film camera would.
   - Specify shot type: wide shot, medium shot, close-up, over-the-shoulder, tracking shot, Dutch angle.
3. **NPC Isolation & Details:** Dedicate a distinct sentence or paragraph to each character visible in the scene. You MUST explicitly describe their:
   - Age bracket, gender, exact race/species
   - Skin tone, eye color, hair length/style/color
   - Specific clothing details
   - Current facial expression, held items, and posture
4. **Environment & Cinematic Lighting:** Describe the background setting in the final sentence. Emphasize cinematic lighting: volumetric light, rim lighting, god rays, lens flare, dramatic shadows, backlighting, silhouette, color grading.
```

**Examples (sent only when "Include Examples" is on)**  
_Code: `src/prompts/imageGen.js → examplesSdxlCinematic`_

```text
EXAMPLE — Single Character Cinematic:
<img prompt="A cinematic masterpiece. A low-angle medium shot looking up at a young woman with dark skin, amber eyes, and long white hair blowing in the wind. She wears a white draped toga with a gold belt and a gold circlet on her forehead. Her expression is fierce and determined, fists clenched at her sides. She stands at the edge of a sandstone cliff overlooking a vast desert valley with crumbling ancient ruins below. Golden hour sunlight casts volumetric god rays through dust in the air, rim lighting outlines her figure, and dramatic long shadows stretch across the rock.">

EXAMPLE — Multiple Characters Cinematic:
<img prompt="A cinematic masterpiece. A wide shot of a rain-soaked medieval cobblestone street at night. On the left stands a tall elf woman with long silver hair, pointed ears, pale skin, and green eyes. She wears dark leather armor under a hooded cloak pushed back from her face. Her expression is cautious, and she grips a longbow at her side. On the right stands a short, stocky dwarf woman with tan skin, brown eyes, and thick red hair in twin braids. She wears dented iron plate armor with fur-lined pauldrons and grins broadly, resting a heavy warhammer over her right shoulder. Behind them, warm orange light spills from tavern windows. Volumetric fog drifts through the street, rim lighting catches the rain, and puddles reflect the scene.">
```

### A4. Illustrious/Anima + POV

**Rules**  
_Code: `src/prompts/imageGen.js → rulesIllusPov`_

```text
Build the prompt in this EXACT order. Do NOT rearrange sections.

**SECTION 1 — Quality + POV:**
Start: masterpiece, best quality, highly detailed,
Then POV:
• Observing: "1st person pov, looking at viewer," + foreground anchor (e.g., "foreground edge of a desk visible,")
• Interacting: "1st person pov, pov hands," + hand action (e.g., "male hands holding silver tray,")
• NEVER describe the user's face.

**SECTION 2 — Character Count:**
Booru tag for visible characters: "1girl,", "3girls,", "1boy 1girl,", etc.

**SECTION 3 — Character Descriptions:**

FOR SINGLE CHARACTER (1 person in frame):
Use a flat comma-separated Booru tag string for appearance + action. Example:
mature female, pale skin, dark eyes, long black hair, messy ponytail, dark wool coat, white silk blouse, tear-streaked face, anxious expression, sitting sideways, holding blanket, reaching toward viewer,

FOR MULTIPLE CHARACTERS (2+ people in frame):
You MUST describe each character in a SEPARATE natural-language sentence/paragraph to prevent feature bleeding. Use Booru tags for appearance and clothing WITHIN each sentence, but separate characters with clear spatial language ("on the left," "in the center," "behind her").

Format per character: "The [position] is a [gender/species] with [hair tags], [eye tags], [skin tags], wearing [clothing tags]. She has a [expression tag] and is [action/pose]."

Each character gets their OWN paragraph. Do NOT merge characters into one comma-separated list.

**SECTION 4 — Scene + Lighting (always last):**
End with background, lighting, atmosphere in natural language.

**BANS:** No "realistic" or "photographic". No describing the user's face/body.
```

**Examples (sent only when "Include Examples" is on)**  
_Code: `src/prompts/imageGen.js → examplesIllusPov`_

```text
EXAMPLE — Single Character:
<img prompt="masterpiece, best quality, highly detailed, 1st person pov, looking at viewer, foreground edge of black leather car seat visible, 1girl, mature female, pale skin, dark eyes, long black hair, messy high ponytail, dark wool coat, white silk blouse, tear-streaked face, anxious expression, sitting sideways, holding blanket, reaching toward viewer, dark luxury SUV interior background, tinted windows, blurred city lights outside, soft amber interior lighting, depth of field">

EXAMPLE — Multiple Characters:
<img prompt="masterpiece, best quality, highly detailed, 1st person pov, looking at viewer, foreground messy white bedsheets visible, 3girls, The woman on the left is a rabbit girl kemonomimi with long blonde hair, long white rabbit ears, pale skin, blue eyes, wearing short frilly black white french maid outfit, maid headdress. She has a nervous expression and her hands clasped near mouth. The woman in the center is a mature female human with black hair, tight hair bun, brown eyes, wearing strict long black white victorian maid uniform, high collar, long skirt. She has a serious expression and is holding a silver measuring tape. The woman on the right is a demon girl with pale skin, short black hair, red eyes, red oni horns, wearing dark blue maid dress, white apron. She has a stoic expression and is holding red velvet slippers. Lavish bedroom background with ornate furniture and glowing chandelier, warm golden lighting, depth of field">
```

### A5. Z Image + POV

**Rules**  
_Code: `src/prompts/imageGen.js → rulesSdxlPov`_

```text
Build the prompt in this EXACT order. Do NOT rearrange sections.

1. **Natural Language Architecture:** Write the prompt as highly detailed, grammatically complete sentences. Use a masterpiece. 
2. **Camera & Perspective:**
   * Always establish the camera position and angle first (e.g., "A 1st person pov from the bed looking up at...").
   * *If the user is passively observing:* Treat the perspective purely as a camera anchor. Do NOT describe the user's body or hands. Use an environmental anchor instead (e.g., "The camera is positioned looking out over the white bed sheets in the foreground.").
   * *If the user is physically interacting in the narrative:* Describe the hands actively doing the task (e.g., "In the foreground, 1st person male hands are holding a silver tray.").
3. **NPC Isolation & Details:** Dedicate a distinct sentence or paragraph to each NPC visible in the scene to prevent their features from bleeding together. You MUST explicitly describe their:
   * Age bracket (e.g., mature, young)
   * Gender (e.g., woman, girl, man, boy)
   * Exact Race/Species (e.g., human, rabbit girl kemonomimi, demon girl with horns)
   * Skin tone
   * Eye color
   * Hair length, style, and color
   * Specific uniform/clothing details
   * Current facial expression, held items, and posture
4. **Environment:** Briefly describe the background setting, lighting, and atmosphere in the final sentence.
```

**Examples (sent only when "Include Examples" is on)**  
_Code: `src/prompts/imageGen.js → examplesSdxlPov`_

```text
EXAMPLE — Single Character:
<img prompt="A masterpiece in 1st person point of view. The camera is positioned at the edge of a black leather car seat, looking up. A mature woman with pale skin, dark eyes, and long black hair pulled into a messy high ponytail sits sideways in the back seat of a dark luxury SUV. She wears a dark wool coat over a white silk blouse. Her face is tear-streaked with an anxious expression as she reaches one hand toward the viewer while clutching a blanket with the other. Through the tinted windows behind her, blurred city lights streak past. Soft amber interior lighting illuminates the cabin with shallow depth of field.">

EXAMPLE — Multiple Characters:
<img prompt="A masterpiece in 1st person point of view. The camera is positioned from a bed, looking out over messy white bedsheets in the foreground. Three women stand at the foot of the bed. On the left is a rabbit girl kemonomimi with long blonde hair, long white rabbit ears, pale skin, and blue eyes. She wears a short frilly black and white French maid outfit with a maid headdress. Her hands are clasped nervously near her mouth. In the center stands a mature human woman with black hair in a tight bun, brown eyes, wearing a strict long black and white Victorian maid uniform with a high collar and long skirt. Her expression is serious and she holds a silver measuring tape in both hands. On the right is a demon girl with pale skin, short black hair, red eyes, and red oni horns. She wears a dark blue maid dress with a white apron. Her expression is stoic and she holds a pair of red velvet slippers. Behind them is a lavish bedroom with ornate furniture and a glowing crystal chandelier. Warm golden lighting fills the room with soft depth of field.">
```

### A6. Illustrious/Anima + Portrait

**Rules**  
_Code: `src/prompts/imageGen.js → rulesIllusPortrait`_

```text
Build the prompt in this EXACT order. Do NOT rearrange sections.

**SECTION 1 — Quality + Framing:**
Start: masterpiece, best quality, highly detailed, portrait,
Then framing (pick one):
- upper body, (chest and up)
- head and shoulders, (shoulders and up)
- close up, face only, (face only)
- full body, (Full body)

**SECTION 2 — Character Count:**
Always 1girl, or 1boy, or 1other,.

**SECTION 3 — Character Description:**
Flat comma-separated Booru tag string covering ALL of:
- Species/race, age bracket, body type
- Skin tone, eye color and shape, hair color/length/style
- Clothing and accessories visible in frame
- Facial expression, head tilt, gaze direction
- Any held items visible in frame

**SECTION 4 — Background + Lighting (always last):**
Use simple or abstract backgrounds: simple background, gradient background, dark background, blurred background,
Then lighting: soft lighting, studio lighting, natural lighting, side lighting,

**BANS:** No "realistic" or "photographic". No full-body shots. No complex scenes. One character only.
```

**Examples (sent only when "Include Examples" is on)**  
_Code: `src/prompts/imageGen.js → examplesIllusPortrait`_

```text
EXAMPLE — Character Portrait:
<img prompt="masterpiece, best quality, highly detailed, portrait, upper body, 1girl, young woman, elf, pointed ears, pale skin, freckles across nose, bright green eyes, long auburn hair, loose side braid over left shoulder, small silver leaf earrings, wearing dark green wool tunic, brown leather vest, high collar, slight smile, head tilted slightly right, looking at viewer, holding a small glowing blue flower near her chin, blurred forest background, dappled natural lighting, soft focus">
```

### A7. Z Image + Portrait

**Rules**  
_Code: `src/prompts/imageGen.js → rulesSdxlPortrait`_

```text
Build the prompt in this EXACT order. Do NOT rearrange sections.

1. **Natural Language Architecture:** Write the prompt as highly detailed, grammatically complete sentences. Use a masterpiece.
2. **Framing:** Establish that this is a portrait. Specify the crop: upper body, head and shoulders, or face close-up, full body. One character only.
3. **Character Details:** Dedicate the full body of the prompt to the single character. You MUST explicitly describe:
   - Age bracket, gender, exact race/species
   - Skin tone, distinguishing marks (scars, freckles, tattoos)
   - Eye color and shape, hair length/style/color
   - Visible clothing and accessories within the frame
   - Facial expression, gaze direction, head angle
   - Any held items near the face or upper body
4. **Background & Lighting:** Use a simple, non-distracting background. Describe studio-style or natural portrait lighting in the final sentence.
```

**Examples (sent only when "Include Examples" is on)**  
_Code: `src/prompts/imageGen.js → examplesSdxlPortrait`_

```text
EXAMPLE — Character Portrait:
<img prompt="A masterpiece portrait. An upper-body shot of a young elf woman with pale skin and a light dusting of freckles across her nose. She has bright green eyes and long auburn hair pulled into a loose side braid draped over her left shoulder. Small silver leaf-shaped earrings catch the light. She wears a dark green wool tunic under a fitted brown leather vest with a high collar. She holds a small glowing blue flower near her chin and smiles gently, her head tilted slightly to the right, looking directly at the viewer. The background is a soft blur of green forest. Dappled natural light filters through unseen canopy above, creating warm highlights on her hair and soft shadows under her jaw.">
```

## Part B: V2

In V2 the model writes `@Name` and never describes looks or clothing; the extension replaces each `@Name` with that character's saved look and current outfit. The prompt is built from: **one style guide** (Tags or Natural) + **one shot line** (Cinematic / POV / Portrait) + extra instructions, next to the `<Cast>` list and the story.

### B1. System prompt

**System**  
_Code: `src/prompts/imageGenV2.js → system`_

```text
You write image prompts for moments from an ongoing story: who is in the shot, what they are doing, their expressions and poses, the place, the light and the framing.
```

### B2. Style: Tags

**Tags style guide**  
_Code: `src/prompts/imageGenV2.js → style.tags`_

```text
## How to write the image prompt
Write it top to bottom in this order:

1. **Count, camera, place, time, framing**, as tags on the first line: the count (1girl, 1boy, 1girl 1boy, 2girls, no humans…; <Cast> says who is male and who is female; one person: add solo), indoors or outdoors, the place, the time, and exactly ONE framing (close-up, portrait, upper body, cowboy shot, medium shot, full body, wide shot). The framing decides how much of each character is shown.
2. **One line per character**: where they are in the frame (on the left, on the right, in the center, in the foreground, in the background), then "is @Name." @Name carries that character's whole look and clothing, so each description stays in its own sentence.
3. **Right after, what only they are doing**, starting with He, She or They, in a few plain words: their pose, their main action, their expression, and the one thing they hold, if any. The one the moment is about comes first. Three characters at most; anyone else goes in as background tags (people in background, crowd).
4. **Last line: the background, a few objects and ONE main light**, as tags.

Rules:
- <Cast> is reference only. Never write hair, eyes, face, body or clothing for a @Name character. The one exception: when <Cast> explicitly says "wearing: not noted", add "wearing …" right after their @Name.
- Write each @Name once. Use no names anywhere else: "holding her hand", not "holding Theo's hand"; "bedroom", not "Mira's bedroom".
- Draw the moment, not the story. Show feelings as what the face and body do: "nervous, looking away", not "hesitant because she is shy".
- Use simple words an image model knows: "smug smile", "arms crossed", "holding a cake". Don't copy the story's wording.
- Leave out anything too small to see in the picture: nail polish, a label, a ring, a print on a can. If it would be a speck, it doesn't belong.
- No quality tags (masterpiece, best quality…).

Example (made-up characters; use the names from <Cast>):
1girl, 1boy, indoors, tavern, night, medium shot,
On the left is @Mira. She sits at the bar, laughing, holding a mug.
On the right is @Theo. He leans on the counter, smiling at her.
wooden bar, shelves of bottles, rainy window, warm lamplight
```

### B3. Style: Natural language

**Natural style guide**  
_Code: `src/prompts/imageGenV2.js → style.natural`_

```text
## How to write the image prompt
Write it top to bottom in plain sentences, in this order:

1. **The shot**, in one short sentence: the framing (close-up, from the waist up, medium shot, full body, wide shot), the place and the time. The framing decides how much of each character is shown.
2. **One sentence per character**: where they are in the frame (on the left, on the right, in the center, in the foreground, in the background), then "is @Name." @Name carries that character's whole look and clothing, so each description stays in its own sentence.
3. **Right after, what only they are doing**, starting with He, She or They, in a few plain words: their pose, their main action, their expression, and the one thing they hold, if any. The one the moment is about comes first. Three characters at most; mention anyone else briefly as background.
4. **Last: the background, a few objects and ONE main light**, in one or two sentences.

Rules:
- <Cast> is reference only. Never describe a @Name character's hair, eyes, face, body or clothing. The one exception: when <Cast> explicitly says "wearing: not noted", describe what they wear right after their @Name.
- Write each @Name once. Use no names anywhere else: "holding her hand", not "holding Theo's hand"; "a bedroom", not "Mira's bedroom".
- Draw the moment, not the story. Show feelings as what the face and body do: "nervous, looking away", not "hesitant because she is shy".
- Use simple words an image model knows: "a smug smile", "arms crossed", "holding a cake". Don't copy the story's wording.
- Leave out anything too small to see in the picture: nail polish, a label, a ring, a print on a can. If it would be a speck, it doesn't belong.

Example (made-up characters; use the names from <Cast>):
A medium shot inside a tavern at night.
On the left is @Mira. She sits at the bar, laughing, holding a mug.
On the right is @Theo. He leans on the counter, smiling at her.
Shelves of bottles line the wall behind them, rain runs down the window, and warm lamplight fills the room.
```

### B4. Shot lines (one is added after the style guide)

**Cinematic**  
_Code: `src/prompts/imageGenV2.js → shot.cinematic`_

```text
Shot: a film still of the moment. Pick a wide, medium or close shot to suit it.
```

**POV**  
_Code: `src/prompts/imageGenV2.js → shot.pov`_

```text
Shot: through {{user}}'s eyes. Include pov. {{user}} is the viewer: write "the viewer" for them (looking at the viewer, holding the viewer's hand), never their name. They are never in the shot, except their hands when they touch something.
```

**Portrait**  
_Code: `src/prompts/imageGenV2.js → shot.portrait`_

```text
Shot: one character, head-and-shoulders or chest-up, focused on face and expression, with a simple background from the place.
```

### B5. Method "Edit last prompt" (experimental): replaces the style guide

**Head**  
_Code: `src/prompts/imageGenV2.js → reference.head`_

```text
## How to write the image prompt
<Previous_Image_Prompt> is the last image made in this story. Write the new image prompt by editing it:
- Keep everything that still holds, word for word: each character's appearance and clothing tags, their order, and the style of the prompt.
- Change only what the new moment changes: who is in the shot, their poses and actions, expressions, the place, the light and the framing.
- Each character's appearance and clothing must match <Cast> exactly. If the previous prompt disagrees with <Cast>, <Cast> is right.
- A character's body tags go in only when the shot shows their body (full body, wide shot, cowboy shot); leave them out of close-ups and portraits.
- Why: the closer the new prompt stays to the previous one, the more consistent the images and the characters stay from one image to the next. Make small edits; do not write a new prompt from scratch.
- With no previous prompt, write a new one, using each character's tags from <Cast> word for word for their appearance and clothing.
```

**Tags tail**  
_Code: `src/prompts/imageGenV2.js → reference.tags`_

```text
- ONE line of comma-separated booru tags. Start with the count (1girl, 1boy, 2boys, 1girl 1boy…; <Cast> says who is male and who is female), then each character's appearance and clothing tags followed by what only they are doing, then what they do together, the place, the light, and the framing last.
- No quality tags (masterpiece, best quality…).
```

**Natural tail**  
_Code: `src/prompts/imageGenV2.js → reference.natural`_

```text
- 2 to 4 plain sentences: each character's appearance and clothing as in <Cast>, what they are doing, the place, the light, and how the shot is framed.
```

### B6. Task lines and the inline instruction

**Task line (manual / Chomusuke)**  
_Code: `src/prompts/imageGenV2.js → manualTask`_

```text
The image shows the moment <Last_Message> ends on. <Earlier_Story> is only there so you understand it: draw nothing that has already ended (someone who put an item away no longer holds it). Write the image prompt for that moment. Output only the prompt, nothing else.
```

**Task line when outfit tags or looks are asked for in the same answer**  
_Code: `src/prompts/imageGenV2.js → manualTaskWithExtras`_

```text
The image shows the moment <Last_Message> ends on. <Earlier_Story> is only there so you understand it: draw nothing that has already ended (someone who put an item away no longer holds it). Write the image prompt for that moment.
```

**Inline instruction head (the story model writes <img prompt="...">)**  
_Code: `src/prompts/imageGenV2.js → inlineHead`_

```text
### IMAGE
{{conditionalText}}Within your response, insert {{imageCount}} image tag(s) like this: <img prompt="..."> at the moment the image shows.
```

**Inline instruction tail**  
_Code: `src/prompts/imageGenV2.js → inlineTail`_

```text
Inside prompt="...", never use double quotes.
```

### B7. The <Cast> list (example: built from made-up data)

The labels in it (`appearance:`, `body (only when the shot shows it):`, `wearing:`, `wearing: not noted (describe what they wear)`, `position:`, `the player` / `in the scene` / `not in the scene`) are in `src/features/imagegen/v2/prompt.js → renderCastList`. You can edit those words too.

**Cast (Tags + Cinematic)**

```text
<Cast>
@Kazuma: male, the player
  appearance: young adult male, short brown hair, green eyes
  wearing: green tracksuit
@Mira: female, in the scene
  appearance: young adult female, long wavy red hair, green eyes, freckles
  body (only when the shot shows it): slender, medium breasts
  wearing: white blouse, black skirt
  position: sitting at the bar
@Theo (also @Teddy): male, in the scene
  appearance: adult male, black hair, stubble
  wearing: not noted (describe what they wear)
</Cast>
```

### B8. A full V2 prompt (example: built from made-up data)

Tags + Cinematic, manual button. Order: cast → character sheets → scene → earlier story → last message → style guide + shot → task.

**System**

```text
You write image prompts for moments from an ongoing story: who is in the shot, what they are doing, their expressions and poses, the place, the light and the framing.
```

**User**

```text
<Cast>
@Kazuma: male, the player
  appearance: young adult male, short brown hair, green eyes
  wearing: green tracksuit
@Mira: female, in the scene
  appearance: young adult female, long wavy red hair, green eyes, freckles
  body (only when the shot shows it): slender, medium breasts
  wearing: white blouse, black skirt
  position: sitting at the bar
@Theo (also @Teddy): male, in the scene
  appearance: adult male, black hair, stubble
  wearing: not noted (describe what they wear)
</Cast>

<Character_Sheets>
(the character card and persona sheets go here)
</Character_Sheets>

<Scene>
(World State scene notes go here)
</Scene>

<Earlier_Story>
(the messages before the last one go here)
</Earlier_Story>

<Last_Message>
(the last message goes here)
</Last_Message>

## How to write the image prompt
Write it top to bottom in this order:

1. **Count, camera, place, time, framing**, as tags on the first line: the count (1girl, 1boy, 1girl 1boy, 2girls, no humans…; <Cast> says who is male and who is female; one person: add solo), indoors or outdoors, the place, the time, and exactly ONE framing (close-up, portrait, upper body, cowboy shot, medium shot, full body, wide shot). The framing decides how much of each character is shown.
2. **One line per character**: where they are in the frame (on the left, on the right, in the center, in the foreground, in the background), then "is @Name." @Name carries that character's whole look and clothing, so each description stays in its own sentence.
3. **Right after, what only they are doing**, starting with He, She or They, in a few plain words: their pose, their main action, their expression, and the one thing they hold, if any. The one the moment is about comes first. Three characters at most; anyone else goes in as background tags (people in background, crowd).
4. **Last line: the background, a few objects and ONE main light**, as tags.

Rules:
- <Cast> is reference only. Never write hair, eyes, face, body or clothing for a @Name character. The one exception: when <Cast> explicitly says "wearing: not noted", add "wearing …" right after their @Name.
- Write each @Name once. Use no names anywhere else: "holding her hand", not "holding Theo's hand"; "bedroom", not "Mira's bedroom".
- Draw the moment, not the story. Show feelings as what the face and body do: "nervous, looking away", not "hesitant because she is shy".
- Use simple words an image model knows: "smug smile", "arms crossed", "holding a cake". Don't copy the story's wording.
- Leave out anything too small to see in the picture: nail polish, a label, a ring, a print on a can. If it would be a speck, it doesn't belong.
- No quality tags (masterpiece, best quality…).

Example (made-up characters; use the names from <Cast>):
1girl, 1boy, indoors, tavern, night, medium shot,
On the left is @Mira. She sits at the bar, laughing, holding a mug.
On the right is @Theo. He leans on the counter, smiling at her.
wooden bar, shelves of bottles, rainy window, warm lamplight

Shot: a film still of the moment. Pick a wide, medium or close shot to suit it.

The image shows the moment <Last_Message> ends on. <Earlier_Story> is only there so you understand it: draw nothing that has already ended (someone who put an item away no longer holds it). Write the image prompt for that moment. Output only the prompt, nothing else.
```

## Part C: Background prompts for images (V2)

These don't write the image prompt. They build the saved looks and outfit tags that `@Name` is replaced with.

### C1. Look scan: a character's permanent appearance as tags

**System**  
_Code: `src/features/imagegen/v2/looksCore.js → LOOK_SCAN_SYSTEM`_

```text
You read story text and write each character's permanent physical appearance as booru tags for an image model.
```

**User (example: two named characters, source = a character sheet)**  
_Code: `looksCore.js → renderLookScanPrompt`_

```text
<Character_Sheet>
(the sheet / chat text goes here)
</Character_Sheet>

Write the permanent appearance of these characters: Mira, Theo. Skip anyone the text does not describe.
Write 8 to 12 booru tags per character, only the ones you would recognise them by. Always start with their sex (male or female) and apparent age (young adult, mature female…), then hair (colour, length, style), eye colour, skin, body type, and permanent features (scars, tattoos, horns, animal ears, tails, wings).
- A man who looks feminine: add "otoko no ko, flat chest". A woman who looks masculine: add "tomboy". Without them the image model draws the wrong sex.
- Age is one of these tags, never a number or a decade: young adult, adult, mature female, mature male, old woman, old man. "late 20s" is "young adult"; "30s" is "adult".
- One tag per thing, the strongest one: "long hair", never "long hair, medium hair".
- Only real booru tags, and say where a mark is: "mole under eye", not "moles"; "sidelocks", not "side hair".
- Never two tags that fight: "petite" with "tall", or "slender" with "curvy". Pick the one that fits best.
- Leave out small face details the image model draws on its own (nose, lips, eyelashes, face shape, smooth skin), unless one is what makes them recognisable.
- Never include: clothing or accessories they can take off, expressions, poses, actions, the place, count tags (1girl, 1boy, solo) or quality tags.
Only what the text states or clearly shows; do not invent features.
If a character has a nickname, write the name as: Name "Nickname".

Output one block per character and nothing else:
<Character_Visual name="Name">tag, tag, tag</Character_Visual>
```

### C2. "Describe missing": looks as a plain phrase (Natural style)

**System**  
_Code: `looksCore.js → NATURAL_SYSTEM`_

```text
You turn booru appearance tags into short, plain descriptions for an image model that reads sentences.
```

**User (example)**  
_Code: `looksCore.js → renderNaturalPrompt`_

```text
For each character, turn the tags into ONE short descriptive phrase (15 to 35 words) that starts with "a" or "an".
Describe only their permanent appearance. No clothing, no names, no actions.
Example: <Character_Natural name="Mira">a slender young woman with long wavy red hair, bright green eyes and freckled pale skin</Character_Natural>

Mira: young adult female, long wavy red hair, green eyes, freckles

Output one block per character and nothing else:
<Character_Natural name="Name">a …</Character_Natural>
```

### C3. Outfit tags: the World State outfit as booru tags

**System**  
_Code: `looksCore.js → OUTFIT_SYSTEM`_

```text
You turn clothing descriptions into booru tags for an image model.
```

**User (example)**  
_Code: `looksCore.js → renderOutfitTagsPrompt`_

```text
Turn each outfit into booru clothing tags.
- Main garments only, 3 to 6 tags: one tag per garment, with its colour or material when the text gives one ("grey hoodie, black joggers, white socks"), plus one standout accessory if there is one. "oversized pink sweater" is one tag, never "pink sweater, cable knit sweater, oversized sweater".
- Plain over detailed: "white bra", not "lace-trimmed bra, front bow, white trim, drawstring". Name a print only when it is simple, and put it in the garment's own tag: "white cat print bra", not "white bra, cat print bra".
- Keep the state of dress when the text says it (open jacket, sleeves rolled up, barefoot, towel).
- Only clothing and accessories: no hair, body, expression, pose, count tags or quality tags. Add nothing the text does not say.

Mira: a white blouse with the sleeves rolled up and a short black skirt

Output one block per character and nothing else:
<Outfit_Tags name="Name">tag, tag, tag</Outfit_Tags>
```

### C4. Outfit tags + missing looks inside the image call (example)

When an image needs them, these are added to the end of the V2 prompt, so one call does it all.

**Extras**  
_Code: `src/features/imagegen/v2/prompt.js → renderV2ExtraTasks / renderV2Extras`_

```text
## In the same answer
- Outfit tags for these outfits: one booru tag per garment or accessory, with its colour or material; keep the state of dress; clothing only, nothing the text does not say.
  Mira: white blouse, black skirt
- Appearance of Theo as booru tags, from the story and <Character_Sheets>: sex and apparent age, hair, eyes, skin, face, build, permanent features. No clothing, expressions, poses or count tags. Skip anyone the text does not describe.

Answer in this shape and nothing else:
<Image_Prompt>the image prompt</Image_Prompt>
<Outfit_Tags name="Name">tag, tag, tag</Outfit_Tags>
<Character_Visual name="Name">tag, tag, tag</Character_Visual>
```

### C5. Combined call: World State + image in one Chomusuke call

**System**  
_Code: `src/features/imagegen/v2/prompt.js → COMBINED_SYSTEM`_

```text
You are a continuity clerk and image prompt writer for an ongoing roleplay. You read the latest exchange, note what it changed in the world, and write an image prompt for the moment it ends on. You never write story, never explain, and never add facts the exchange does not state or clearly show.
```

The user message is: continuity notes → `<Cast>` (V2) → sheets → earlier story → `<Latest_Exchange>` → `# Task 1: World Update` (World State rules) → `# Task 2: Image prompt` (the V2 style + shot, or the Classic template rules) → `# Also in the same answer` → `# Answer in this shape and nothing else`. The fixed lines of Task 2 are in `renderCombinedPrompt` (same file):

**Task 2 lines**

```text
# Task 2: Image prompt
The image shows the moment the latest exchange ends on. <Cast> shows everyone as they stood BEFORE the latest exchange: where your World_Update changes someone's clothing or position, the image follows your World_Update (@Name will carry the new outfit).
   (Classic instead: Where your World_Update changes someone's clothing, draw them in the new clothing.)
If nobody in the latest exchange takes, sends or shares a picture, write <Image_Prompt>NONE</Image_Prompt>.   (only for the "picture" trigger)
```

**Chomusuke automatic image: extra line for the "picture" trigger**  
_Code: `src/features/imagegen/auto.js → ONLY_IF_PHOTO`_

```text
Only if someone in the latest reply takes, sends or shares a picture should there be an image. If nobody does, output exactly: NONE
```
