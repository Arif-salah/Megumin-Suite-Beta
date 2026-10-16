# 012: Images tab redesign

## Why

The Image V2 page put about 40 controls on one long page before a first image,
and every character was a block of 5–7 text boxes. New users were scared off.
The order didn't follow what a user does: connect ComfyUI, choose when images
come, check the characters.

Mockup (agreed): https://claude.ai/artifact/XWHeNL8RxW7txC7JQKEZrx

## What we agreed (2026-10-16)

- **Top:** title + Images on/off switch. A version bar: **Classic | Version 2 ·
  Consistent characters** ("Version 2" stays the name), one line on what the
  picked version does, status chips: ComfyUI connected / not connected (checked
  quietly each time the tab opens) and who writes the image prompts
  (Chomusuke or the story model). Version 2 without World State keeps its red
  banner + "Turn on World State".
- **Not connected never hides anything.** A yellow note says so and links to
  the Generator page; every setting stays visible and saves.
- **Three pages** (sub-tabs): **Characters** (Version 2 only) · **When & how** ·
  **Generator**. Classic opens on When & how.
- **Characters:** one small card per character (name, where they are, look,
  what they're wearing). Away characters fold under "Show N who are away".
  A click opens a **popup editor**: nicknames, look, body, description (plain
  sentences style), wearing now (from World State), outfit tags + lock, lock
  look, read look again, delete look. Toolbar: read looks from the card, read
  looks from the chat, describe missing (plain sentences), add character.
- **When & how** (both versions): when (4 tiles), where (2 tiles; placement
  for Chomusuke's images when inside the reply), images each time, then the
  look of the image:
  - **Version 2:** Shot tiles + Prompt style tiles + its extra instructions.
  - **Classic keeps its own prompts:** its template list and its own extra
    instructions. It never uses the V2 shot/style.
  - Preview before sending. Then **Advanced** (folded): V2 = characters in
    focus, how the prompt is written, detailed outfit tags, automatic looks,
    NPC Bank priority. Classic = examples, better booru tags, NPC Bank tags,
    Edit the image prompts.
- **Generator** (both): ComfyUI address + Test, setup guide, workflow
  (new/edit/delete), model, size. **Expert settings** switch: sampler, steps,
  CFG, denoise, CLIP skip, seed, quality tags, negative prompt, LoRAs.
- Removed: the "Prompt Generator Backend" panel (it only pointed at the
  Chomusuke tab; the status chip says the same).
- Same stored settings and the same element ids comfy.js fills (`#ig_model`,
  `#ig_sampler`, `#ig_lora_N`, `#ig_workflow_list`, `#ig_prefix`), so nothing
  outside the tab changes.

## Phases

1. Build: shared controls, page shell, Characters + popup, When & how,
   Generator; remove the old pages; CSS.
2. The developer tests in SillyTavern; fixes.

## Progress

- [x] Phase 1 (built 2026-10-16, waiting for the developer to test)
- [ ] Phase 2
