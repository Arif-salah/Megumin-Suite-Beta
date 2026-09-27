# 007: Image prompt rewrite (V2 layout, Last_Message)

## Why

A V2 Tags prompt came back as one flat comma list. Once each `@Name` was
replaced, the characters' 20-odd look tags ran into each other with nothing
between them, so the image model mixed traits between characters. The model
also drew things from earlier messages (a cake box already put in the fridge),
wrote two framings (`pov shot, cowboy shot`), and put names where the image
model can't use them ("looking at Anno", "Kazuma's bedroom").

## What we agreed (2026-09-27)

- **One line per character.** First line: count, camera, place, time, ONE
  framing, as tags. Then one line per character:
  `On the right is @Anno. She sits…`. Last line: background and lighting tags.
- **`@Name` becomes `Name, look, wearing a outfit`.** The name is kept as an
  anchor, and "wearing a" marks where the look ends and the clothes begin. The
  look stays the saved tags, word for word. Body tags only in full-body
  framings, as before.
- **Last message split.** The story reaches the model as `<Earlier_Story>`
  (context only) + `<Last_Message>` (the image shows the moment it ends on).
  V2 and Classic.
- **POV:** the player is "the viewer", never named.
- **No names outside `@Name`:** not in actions, not in places ("bedroom", not
  "Kazuma's bedroom").
- **Natural gets the same layout,** in sentences.
- The guide is written as numbered steps in output order, each with a short
  reason (the developer's style).

## Phases

1. **Prompts.** New V2 Tags and Natural guides, POV line, task lines with
   `<Last_Message>`, combined-call Task 2 line. Classic `userPrompt` default
   gets `<Earlier_Story>` / `<Last_Message>`. A saved custom prompt without
   `{{lastMessage}}` keeps getting the whole story in `{{chatHistory}}`.
2. **Resolver.** Line layout: `@Name` → `Name, look, wearing a/an outfit`
   (a trailing comma when a verb follows, like "@Mira sits"). No tag
   deduplication across the sentences. An old flat tag prompt still resolves
   the old way. Natural uses the same comma form instead of brackets.
3. **Story split.** V2 manual/auto and Classic build earlier + last message.
4. Tests, `docs/image-prompts.md` regenerated.

## Progress

- [x] Phase 1: prompts
- [x] Phase 2: resolver
- [x] Phase 3: story split
- [x] Phase 4: tests + docs
