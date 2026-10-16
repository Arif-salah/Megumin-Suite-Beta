# 014: Preset & Thinking redesign

## Why

The tab had a left sidebar, 25 big preset cards with old presets weighted
like V11, 19 thinking frameworks where most carried "May be Incompatible", and
out-of-date text (the V9 Pro Tip, "V6 Engines are in the forge"). The tab says
"preset" but its sections said "engines".

## What we agreed (2026-10-16)

- Same style as the Images tab: a summary row (preset · thinking · Story
  Config), then pages at the top: **Preset · Thinking · Story Config**.
- **Preset:** Pro Tip updated to V11 (V11 Writers' Room + CoT V11). "Your
  preset" card was tried and dropped (not needed); only the **V7 modules**
  card stays at the top, while a V7 preset is picked. "Choose a preset":
  **Latest (V10 + V11) | All | Mine** (your own presets, with Edit); it opens
  on the list that holds your preset. Compact cards, 2-line descriptions
  (full text on hover). "Engines" is "presets" everywhere on the tab. The V6
  "in the forge" note is gone with the version filters.
- **Thinking:** "Think before writing" switch; only the frameworks made for
  the preset by default, "Show every framework" for the rest (warned "Made
  for another preset"); length 100 / 250 / 450 / Custom / No limit; language
  only when the framework has more than English; Advanced: Gemini override.
- **Story Config:** the same section as before, on its own page.
- Shared controls moved to `src/ui/controls.js` (Images uses them too).

## Progress

- [x] Built 2026-10-16, waiting for the developer to test
