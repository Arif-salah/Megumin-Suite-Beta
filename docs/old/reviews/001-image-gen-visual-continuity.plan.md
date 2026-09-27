# 001 — Plan Review

## Round 1 · 2026-09-24 · Reviewer: Pi
Verdict: NEEDS_CHANGES

Verified against the code before ruling (so the changes below are gaps, not preferences):
- File table is accurate: `imageGen` profile block exists (`src/core/profile.js:185`), `getRelevantNpcImageTags()` exists (`src/features/npc/data.js:163`, reads `npcBank.npcs[].imageTags` strings, gated by `imageGen.injectNpcTags`), `generateImagePromptText()` exists (`src/features/imagegen/index.js:674`), `igGenerateWithComfy`/`comfyProgress.js` exist (out-of-scope boundary is correct).
- `buildBaseDict.js` already imports the world-state ledger (`:29`) and already wires `{{npcImageTags}}` into `[[img1]]` (`:436-444`) — so extending that path is a natural, small change. Engine→features imports are an established pattern there (`:20-29`), no dependency-rule concern.
- Out-of-scope item on `[[infoblockcurrent]]` correctly cites Kazuma's chat ruling, per the new standing rule in NOTES.md.

Issues (each needs evidence; no evidence → put it under Notes as a question):

1. **Tier 2 NPC attire is not actually queryable from `getWorldStateCurrent()` yet** — evidence: `getWorldStateCurrent()` returns `localProfile.worldState.current` (`src/features/worldstate/ledger.js:27-29`), whose structured fields are `dateTime`, `location`, `weather`, and `pc.{name,outfit,position,condition,carrying}` — **no per-NPC outfit field**. `parseWorldStateBlock()` (`src/features/worldstate/parser.js:216-285`) fills only `pc.outfit` from the first `Outfit:` line it sees (guarded by `!state.pc.outfit`); `state.npcs` is initialized `""` and never assigned by the parser, and `ledger.js:174` keeps it a string. NPC attire therefore lives only inside free-text `rawText`. The plan's own example (locking Matt's band tee and skirt) is an NPC, so the plan's central mechanism doesn't exist for its own hero. Mitigating fact: the World_State template already emits a consistent per-NPC block — `**[NPC Name]:** * *Outfit:* [Current clothing]` (`data/blocks.js:19-25`) — the data is in the text, it just isn't captured. — **Required change:** add `src/features/worldstate/parser.js` (and `ledger.js` if the parsed shape changes) to the file table and specify the extraction: parse the `**👥 NPCs Present:**` section into a per-NPC `name → outfit` map from the existing template line format; when an NPC has no parseable outfit line, fall back to today's behavior (LLM writes from prose).

2. **Fate of the NPC Bank "Image Tags" field is unspecified → two editable sources of truth** — evidence: the NPC Bank editor still exposes an editable `imageTags` field (`src/features/npc/fields.js:132`, `id: "imageTags", label: "Image Tags"`). The plan moves editing into the Image Gen tab ("rather than digging into individual NPC Bank records") and makes `getRelevantNpcImageTags()` read the central store "with fallback", but never says what the old field becomes. If it stays editable, a user edit in the NPC Bank won't reach `characterTags` (or vice versa) — the exact drift this feature exists to kill, now at the settings level. — **Required change:** one sentence in the plan: e.g. "after the one-time migration the NPC Bank editor hides the Image Tags field; `npc.imageTags` remains in the schema only as the migration source and read fallback."

Notes for Gemini (non-blocking):

- **`locked` semantics are undefined.** The schema carries `locked: boolean` but the plan never says what the lock does. Suggested definition to adopt (or state your own): `locked: true` = user-managed, auto-creation never overwrites; `locked: false` = may be auto-created from scene prose.
- **Auto-creation of new-NPC tags is a write inside a read path.** `generateImagePromptText()` runs on every image generation; if it creates *and saves* tags each time, the profile is rewritten every turn. Specify when a provisional tag is persisted (e.g. once per unseen name, clearly marked provisional until the user edits/saves it in the new UI).
- **Which templates get the continuity rules — and the user-diff implication.** `src/prompts/imageGen.js` holds three shared templates (`systemPrompt`, `userPrompt`, `injectionTemplate`) plus six per-model rulesets, and the file header notes user edits are stored as a **diff against the built-in text**. Say which ones change (at minimum `injectionTemplate`/`userPrompt` via the existing `{{npcImageTags}}` slot, and the "character description" section of each ruleset), and check how `storage.js` merges existing user diffs when built-in defaults change, so current customizations don't break.

## Round 2 · 2026-09-24 · Reviewer: Pi
Verdict: APPROVED

Round 1 items, re-verified against the revised plan and the code:

1. **NPC attire extractable from the ledger** — resolved. The plan now scopes extending `parseWorldStateBlock` into a structured `state.npcOutfits = { [name]: outfit }` map from the existing `**👥 NPCs Present:**` template format, maintaining it in `applyWorldStateUpdate`, and both `parser.js` and `ledger.js` are in the file table. Consistent with the actual update structure (`updates.characters` per-character maps, parser.js:200-207) and the snapshot-based rollback path (ledger.js:461, deep-copied state).
2. **Fate of the NPC Bank "Image Tags" field** — resolved exactly as required: hidden in the editor after the one-time migration, `npc.imageTags` kept in schema solely as a read-fallback, `fields.js` added to the file table. Single source of truth preserved.
3. **`locked` semantics** — defined (user-authored/approved vs auto-generated-on-first-sight), matching the suggestion.
4. **Auto-creation persistence** — bounded: persist once per unseen name, flagged `provisional: true`.
5. **Template scope + user-edit safety** — specified (`injectionTemplate`, `userPrompt`, Section 3 across all six rulesets, via the existing `{{npcImageTags}}` slot). The plan's "user diffs keep merging cleanly" claim was verified against the code, not taken on trust: `index.js:294-296` seeds `customPrompts` as a full copy of the built-ins on first edit and `buildBaseDict.js:426-428`/`index.js:681` resolve `customIg[key] || defIg[key]` — i.e. per-key whole-text override, so changing built-in rule text cannot break an existing user customization. Claim holds.

Notes for Gemini (non-blocking):

- **Bootstrap must also copy `npcOutfits`.** The plan's ledger.js change mentions "updates and rollbacks" — remember `setWorldStateBootstrap` (ledger.js:149-184) builds the initial state object from `parsedData`; if `npcOutfits` isn't copied there too, fresh chats start with an empty map until the first `<World_Update>` arrives.
- **Seeded custom-prompt caveat.** Because `customPrompts` is seeded from the built-in text at first edit (index.js:294), users who already customized a ruleset keep the old seeded text — the new continuity rules won't appear in their copy automatically. Fine to accept, but worth one line in the change report's known limitations (and a NOTES.md candidate at done).

Ready to code: baseline commit per protocol, then change report + ping.
