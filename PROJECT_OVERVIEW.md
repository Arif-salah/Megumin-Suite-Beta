# Megumin-Suite-Beta — Project Overview

> Generated 2026-09-21 by reading the full tree (4 sequential scout readers, verified against source).
> Version **1.1.0** (`manifest.json`) · author **KazumaONIISAN** · SillyTavern extension, `loading_order: 100`, no hard dependencies.

---

## 0. What this is

A **roleplay prompt-engine suite** for SillyTavern. It replaces the stock prompt preset with a versioned "engine" (V7 → V8 → V9 → V10), injects structured output "blocks" (World State, CYOA choices, NPC dossiers, stat sheets, story tracker) that render as **collapsible in-chat cards with working buttons**, and bundles seven features around that core:

| Feature | One-liner |
|---|---|
| **Engines + CoT** | Versioned prompt engines (incl. co-writer variants) + a "writer's room" chain-of-thought library (NORA/ANVIL/OPUS/JULIA/MIKI personas) |
| **Writing Styles** | Precooked style directives, 9 AI-generatable style templates, custom style library |
| **Blocks** | Structured output the model writes at reply-end; parsed and rendered as cards (dice even gets a die-face animation) |
| **Memory Core** | 3-tier memory (working / short-term chunks / long-term vault) with TF-IDF *or* ST-Vectra semantic retrieval |
| **NPC Bank** | Auto-extracted character dossiers with field-level `<NPC_Update>` ops, full undo/rollback history, ComfyUI portraits |
| **Story Director** | Auto-evolving story plan + `<Story_Tracker>` parsed from replies; custom genre + 22 flavor tags |
| **Image Gen** | Full ComfyUI integration: auto-gen from `<img prompt>` tags, inline insertion, overswipe-regenerate, quick-gen button |
| **Dynamic Ban List** | AI-maintained banned-concept list injected into the prompt |

Plus: a draggable **side panel** (can "take over" blocks from chat), a **Dev Console** (Document / Live / Log views), live **token counter**, **prompt preview popup** (send-to-AI / cancel), mobile drawer, per-profile settings with global sync, and 4 prompt presets.

---

## 1. Repository map

```
index.js                  904  ST entry point: boot, all event wiring, mobile drawer
style.css               4815  All extension CSS (see §10.6)
example.html             628  Settings-modal UI shell (vanilla HTML, injected at boot)
manifest.json               1 extension manifest
README.md               730  Beta changelog only (2026-03-29 → 2026-08-28)
Presets/                     4 prompt presets (see §10.5)
img/                           6 default avatars
data/                        23  Prompt CONTENT library ("hardcodedLogic")
  database.js              31    assembles hardcodedLogic = {modes, personalities, toggles,
                                     styles, styleTemplates, directStyles, addons, blocks, models}
  modes/                   19    engine definitions per generation (legacy/v7/v8/v9/v10 + index)
  cot/                    130+   CoT definitions per generation (legacy = multilingual v1/v2/v6)
  blocks.js                 —    legacy per-block dict template content
  styles.js / styleTemplates.js / directStyles.js
                           —     tag library / 9 AI generators / precooked rules
  skeletons+slots+personality+toggles+addons+image_data
src/
  st.js                     36  ST import shim (ALL of src/ imports ST APIs from here)
  core/                    11   state, keys, profile, sync, migrations, engines, tokens,
                               refreshHooks, sharedFragments, activeRequests, constants
  engine/                   4   buildBaseDict (dict assembly) · injection (prompt rewrite)
                               chatText (history extractors) · tasks (one-shot background gens)
  blocks/                   3   render (card builder) · text (mini-markdown/meters) · treatments
  features/                7   banlist · blocks · imagegen · memory · npc · storyconfig · storyplan
  prompts/                  8   DEFAULT_PROMPTS + per-feature prompt text + storage (sparsification)
  sidepanel/                7   panel/chrome/dom/parsers/presentBar/sections + 1752-line CSS
  ui/                      10   tabs(+5 tab renderers) · devmode · launcher · progress · promptEditor
  utils/                    4   dice (crypto-fair d20) · download · html · regex
```

**Dependency rule** (stated in `refreshHooks.js`/`state.js`): *features → core; core never imports features* — with documented exceptions (`profile.js` imports blocks/registry, npc/fields+updates, storyconfig/config, sidepanel/panel; `index.js` imports everything). `refreshHooks.js` is a named-callback registry (`REFRESH` enum) that breaks the remaining cycles: features register, `profile.js` fires by name.

---

## 2. Boot & event wiring (`index.js`)

Boot (`jQuery(async …)`): runs 3 idempotent migrations (`cleanLegacySettings`, `migrateRenamedTabs`, `migrateUtilityPrefillFlag`) → `initSidePanel({profileGetter})` → `$.get(example.html)` appends the whole settings shell → draggable launcher button, tooltips, mobile drawer, 100ms-polling retry (10 tries) to attach the quick-gen image button.

Event map:

| ST event | What happens |
|---|---|
| `APP_READY` | `cleanGhostProfiles()` (GC dead profile keys), `meguminCompactStoredPrompts()`, `discoverDefaultImages()` |
| `CHAT_COMPLETION_PROMPT_READY` | **`handlePromptInjection()`** — the single point where the outgoing prompt is built/rewritten (`src/engine/injection.js`) |
| `CHAT_CHANGED` | cancel save debounce → `flushProfileSettingsToLoadedKey()` → 200ms-deferred `initProfile()` (waits for ST context) + memory visuals + Kazuma retry sweep |
| `USER_MESSAGE_RENDERED` / `MESSAGE_EDITED` / `CHAT_CHANGED` | `memUpdateSemanticQueryDebounced` (800ms) — Vectra query for the next prompt |
| `MESSAGE_RECEIVED` | **The big lifecycle hook — 4 things**: ① Story Director auto-evolve (parse `<Story_Tracker>`; regenerate plan on completed/pivoted or `autoFreq` cadence) ② Memory Core background chunking/archival ③ NPC auto-extract (`meguminFindNpcDossiers` → records) + `<NPC_Update>` apply ④ ComfyUI auto-gen from `<img prompt="…">` tags (500/1500ms staggered) |
| `IMAGE_SWIPED` | **PRIORITY HACK** (documented, `index.js:~731`): temporarily disables ST's native overswipe settings, `unshift`s its own handler to the FRONT of `eventSource._events` (direct EventEmitter mutation), restores after ~200ms → gallery overswipe regenerates via ComfyUI |
| 7 message events | `meguminScheduleBlocksRefresh(120)` — coalesced block-card redraw |
| `visibilitychange` / `pagehide` | flush pending profile save (one-shot guard) |

A deferred profile loader polls `ctx.chatId` (500ms × 30) to catch late ST context.

---

## 3. State & storage model

- **`localProfile`** (module singleton in `core/state.js`; ~490 read sites rely on live ES-module bindings; reassignment only via `setLocalProfile`). One per chat/character; **the ONLY builder/writer is `core/profile.js` (955 lines)**.
- **Profile keys** (`core/keys.js`): group chat → `group_<id>`; else if `globalSettings.saveMode === "chat"` → `chat::<chatId>`; else character avatar name; `null` → `default`. `getParentChatKey()` detects branches (`chatMetadata.main_chat` or `_hexsuffix` regex).
- **Storage split**:
  - *Settings* → SillyTavern `settings.json` under `extension_settings["Megumin-Suite-Beta"]`: `profiles{}`, `customModes[]`, `configPresets[]`, `globalSettings{promptPreview, enableUtilityPrefill, saveMode}`, `globalSyncTabs{}`, `storyConfigGlobalSync`, `sharedFragments{}`, `npcTemplateNoticeShown`.
  - *Chat-scoped data* → **chat file's `chat_metadata`**: `megumin_memory_core` (vault + chunks), `megumin_story_plan`, `megumin_npc_bank`. (This migration out of settings.json is what keeps settings.json small — sparsified prompt text brings a 99-profile install from 4.90 → 3.28 MB per README.)
- **`initProfile()`**: loads by key chain (activeKey → parent-chat → avatar → `default`), then **patches ~60 missing fields inline** — an *implicit* migration layer (no schema version number exists). Also: sparsify/rehydrate prompt text (`prompts/storage.js`), lazy-migrate settings-side chat data into `chat_metadata`, seed `blockStack` from legacy `blocks[]`, fire refresh hooks, stamp `_loadedProfileKey`.
- **`saveProfileToMemory()`**: refuses if live key ≠ `_loadedProfileKey` (chat-switch race guard). `saveProfileDebounced` = 500ms. `pruneFutureData()` handles rewinds (drop out-of-range chunks/NPCs/plan, `npcRollbackHistoryFrom`, memory window rebalance via `MEMORY_SCRUB_OVERLAPS` hook).
- **`sync.js`** — "Global" tab broadcast: `TAB_SYNC_KEYS` maps tab titles → profile keys; `applyTabKeysToAllProfiles` copies settings into every stored profile but **preserves per-profile content** (npcs, vault, plan) — "settings travel, content stays". `TABS_ALREADY_GLOBAL` = Side Panel, Global Settings; Story Config has its own opt-out flag.

---

## 4. Engines & CoT (`data/modes/`, `data/cot/`, `core/engines.js`)

`core/engines.js` (60 lines, zero imports by design) holds pure predicates: `isV7/8/9/10Engine`, `isCoWriterEngine` (flag or id ends `-cw`), **`isModernEngine`** (V8+ — carries its own persona/narrative rules, so `[[main]]`/`[[OOC]]`/`[[control]]` + acknowledgements are blanked), **`engineLocksStyle`** (V7+ requires a style directive), **`engineUsesRenderLimits`** (**V9 only** — Lean/Full word counts; V10 deliberately does NOT inherit — the V10-once-flagged-`isV9` bug that made every screen say "V9"), and `lockedStyleIdFor(m)` (engine id → precooked style id, e.g. `v10-shura*→dir_v10_shura`, other V10 → `dir_v10_ukiyo`).

Engine catalogue (ids in `data/modes/*.js`; preset skeleton maps `p1..p6` → `[[prompt1..6]]` slots):

- **legacy**: `balance` (default, "V4.2"), `cinematic`, `dark`, `v6-dream-team(-lite)`, `v6-anime-director` (locked)
- **V7**: `v7.5` ("Kismet" — the only engine with a dedicated `<Narration_style>` narrator-persona slot), `v7-core`, `v7-reality`, `v7-gentle`
- **V8**: `v8-fusion`, `v8-m` (Obsidian), `v8-lite` (Spark)
- **V9**: `v9-core` (Mirage), `v9-lite` (Xin), `v9-director` (Kuromaku), `v9-immersion` (Cui)
- **V10**: `v10-core` (**Ukiyo**), `v10-shura`, plus **co-writer variants derived, not copied**: `coWriter(base, id, label, color, patchTable)` applies patch tables at module load so the diff IS the code. Co-writers additionally *author* `{{user}}` (body in-world; interiority/volition/speech stay the reader's). V10 carries no `[[tags]]` except `[[aiprompt]]`. Also exports `ENHANCED_DIALOGUE` + `applyEnhancedDialogue(text)` — a per-engine V10 switch (`localProfile.enhancedDialogue`) that swaps the `<dialogue>` rule inside the engine text.

**CoT library** (`hardcodedLogic.models` — historical name; `localProfile.model` is a CoT id, NOT an LLM model). Entry shape `{id, trigger:"[[COT]]", content, prefill}`:

- **legacy**: `cot-v1-*` / `cot-v2-*` / `cot-v6(-lite)-*` in 8 languages each (v6 = 4-phase team: NORA story state → ANVIL NPC psych → OPUS plot → JULIA+MIKI prose)
- **v7**: `cot-v7.5-english` (7 steps incl. vocabulary gate), **`cot-v7-english`** (the "writer's room": GROUND TRUTH → PLOT ENGINE → SCENE DESIGN → ACTIVE DRAFT → CORRECTION LOOP with knowledge firewall, ban-scan, proportionality; *the only entry missing `trigger` — harmless one-off quirk*), `cot-v7-lite-english`, `cot-off`
- **v8**: `cot-v8-fusion-english` (team in first person), `cot-v8-english` (7 silent steps incl. DIALOGUE KILL CHAIN — "clean English under stress = fail")
- **v9**: 5 entries (`english`, `lite`, `director`, `immersion`, `hybrid`); `hybrid` = writers' room with NORA selecting Scene Mode from {Comedy, Action-Tension, Harsh Reality, Romance-Intimacy, Atmospheric-Mundane}, Off-Screen tracker ("None currently relevant" is BANNED)
- **v10**: `ukiyo` ("# Writer's Mind" prose-style deliberation), `ukiyo-cap` (same body + shared THINKING_CAP const: <~150 words, one pass, no re-audit), `shura` ("## THINKING: a last breath", 7 rules: show state never label it, emotion breaks speech, end unresolved), `shura-cap`

`meguminCotForMode(modeId, lang)` picks the default CoT per engine.

---

## 5. Style system (three data files, one live value)

- **`data/styles.js`** — tag *library* (Genre & Tone ~26, Narration 12, Pacing, POV…). Building blocks only; **never injected directly**.
- **`data/styleTemplates.js`** — 9 prebuilt tag bundles ("The Opinionated Storyteller" (Snicket/Pratchett), "Deep Introspection" (Dostoevsky), "The Snarky Observer" (GLaDOS), "Grimdark Epic" (GRRM), "Psychological Horror" (King), "Sweet Like Sugar", "Action Thriller", "The Unreliable Memoirist" (Ishiguro), "The Southern Gothic Teller"). These are **AI generators**: the Writing Style tab runs `runMeguminTask("Inspired by <notes>. Write a writing style rule based on <tags>…")` and saves the answer as a custom style.
- **`data/directStyles.js`** — precooked rule texts: `dir_v7`, `dir_v7_core`, `dir_v7_gentle`, `dir_v7.5`, `dir_v8`, `dir_v9`, `dir_v9lite`, `dir_v10_ukiyo`, `dir_v10_shura`, `dir_simple`.
- **The live value** = `localProfile.aiRule` (selected by `activeStyleId`, or hand-edited). It lands as `dict["[[aiprompt]]"]`, wrapped per engine (V7.5 → `<Narration_style>` with narrator persona + quarantine rule; V7 non-default → `<narrative_style>` with pacing/length directive; others raw). **Engine lock**: on V7+/modern engines, the "No Style (Off)" button gets a red lock; switching engines auto-assigns `lockedStyleIdFor()` if none is set (enforced in `storyconfig/ui.js` + `ui/tabs/coreAndCot.js`).

---

## 6. Toggles & add-ons (`data/toggles.js`, `data/addons.js`)

**Toggles** (exactly two, both blanked on modern engines — `notCoWriter` gate keeps the PC-boundary rule out of co-writer engines):
- `ooc` — "you have the ability to talk to the user directly…"
- `control` — "Never write dialogue, actions, or decisions for {{user}…"` (recommendedOff)

**Add-ons** (9, each `{id, label, trigger, content}`; profile keeps the id list):
1. `dice` — `<dice_rules>`: rolls are **pre-rolled by the extension** (`meguminRollD20s`, crypto.getRandomValues + rejection sampling — the model only interprets, never invents); DC scale 5/10/15/20/25/30, modifier -3..+3 from on-page competence; reading: ≥DC success, DC-1/-2 success at cost, ≤DC-3 fail ("the world moves"), nat20/nat1 specials; the roll line must be FIRST in the reply: `<Dice>🎲 attempt — d20+N vs DC → roll+N = total · verdict</Dice>`.
2. `dice_all` — same trigger, 6 rolls, any character named.
3. `html` — in-world HTML (screens, letters, signs): inline style only, `<details>`, <25 lines, one deliberate wrong detail, max one per response.
4. `death` — death narrated, scene ends, exactly two options (Narrative Survival / Character Transfer), outcome final.
5. `combat` — no plot armor, turn-by-turn, weight/risk.
6. `direct` — anatomical terms, no euphemisms.
7. `color` (recommended) — locked hex per character via `<font color>`.
8. `npc_events` — "Rule 8: Organic Narrative Introduction (Managed by OPUS)" — no spontaneous NPC/event appearances.
9. `dn` — `<narration>` / `<dialogue>` tag wrapping.

---

## 7. The prompt pipeline (end to end)

```
localProfile + hardcodedLogic + feature data
        │
        ▼
buildBaseDict(isTokenCount)   src/engine/buildBaseDict.js:30  (~737 lines)
   → dict { "[[trigger]]": text }:  [[Language]] [[pronouns]] [[config]]
     [[main]] [[AI1]] [[AI2]] [[OOC]] [[control]] [[aiprompt]] (style rule,
     engine-wrapped) [[COT]] [[prefill]] [[DNRATIO]] [[dice_rolls]]
     [[v9_*]] (V9 only) [[long-Memory]] [[Short-memory]] [[npc_dossier]]
     [[npc list]] [[npc_updates]] [[storyplan]] [[storytracker]] … [[order]]
        │
        ▼
handlePromptInjection(data, type)   src/engine/injection.js:32  (CHAT_COMPLETION_PROMPT_READY)
   1. background-request markers (activeRequests.js) → REPLACE the whole payload
      with a dedicated one-shot task prompt (Story Planner / NPC Scan / NPC Update /
      Ban List / Image Gen / NPC Portrait / Memory Summarization — each with a
      think-prefill, gated behind globalSettings.enableUtilityPrefill, default OFF)
   2. else: memEnsureSemanticQueryFresh() → dict = buildBaseDict() → apply devOverrides
      (shared fragments) → blank inactive per-block anchors → substitute every
      trigger (empty = delete tag AND its line) → strip ALL leftover [[slot]] triggers
      (meguminAllSlotTriggers — leaked tags are the worst failure) → collapse newlines
      → if activeNpcImages: [RELEVANT NPCs] message becomes multimodal (base64 parts)
   3. optional prompt-preview popup (exact payload, Send-to-AI / Cancel; cancel calls
      window.stopGeneration() with a click-stop fallback to break auto-retry loops)
        │
        ▼
ST preset template (e.g. "Megumin Suite V10 Universal.json") + [[blocks]] envelope
   (buildBlocksEnvelope: "<Blocks> <World_State>…</World_State> … </Blocks>" skeleton
    with per-block templates; returns "" when nothing is active)
        │
        ▼
ST display regex_scripts (preset `extensions.regex_scripts`, 10 rules):
   kazuma-inline comments → <img prompt>, thinking blocks → styled <details> card,
   raw <Blocks> hidden & re-wrapped as <details class="meg-blocks-src" open>  ← marker
        │
        ▼
src/blocks/render.js decorates the rendered message (see §8); side panel may "take over" blocks
```

**Tasks** (`src/engine/tasks.js`): `useMeguminEngine(task, targetPreset)` temporarily repoints ST's active preset at a Megumin engine preset for ONE background generation, then restores; `runMeguminTask(orderText)` fires that one-shot and returns the text; `analyzeSlopDirectly/WithPreset` = quality ("slop") analysis.

---

## 8. Blocks: the keystone system

**Defined exactly once** in `MEGUMIN_BLOCK_REGISTRY` (`src/features/blocks/registry.js`, 494 lines). The dict builder, cleaner, side panel, envelope and card all derive from it.

| id | tag | kind | notes |
|---|---|---|---|
| `dice` | `Dice` | **lead**, repeating, system | written BEFORE prose; gated on `addons ⊇ dice`; not in the envelope |
| `cyoa` | `CYOA` | builtin, preferFirst | resting-open tab; choices become **real buttons** (click = fill input, shift-click = send; `/`-command lines refuse auto-send) |
| `world` | `World_State` | builtin | per-block: compact mode + full-every-N-replies (`worldState.{compactEnabled, fullFreq:5}`) |
| `chatter` | `NPC_Inner_Chatter` | builtin | 1 filled speaker → "Interior" (private thought); ≥2 → "Whisper Thread" (colored bubbles, "not heard by you") |
| `bonds` | `Bonds` | builtin, build | template generated from `statBlocks.bonds.fields` (mood, affection 20, trust 30, desire 0) |
| `sheet` | `Character_Sheet` | builtin, build | generated from `statBlocks.sheet.fields` (hp, stamina, gold, status, skills, inventory); fields carry `type: meter\|number\|text\|list` |
| `newNpc` | `New_NPC` | slot, repeating, system | requires npcBank.enabled + non-empty `[[npc_dossier2]]` |
| `npcUpdate` | `NPC_Update` | slot, repeating, system | requires npcBank + `npcs.length>0` + `[[npc_updates]]` |
| `tracker` | `Story_Tracker` | system | requires storyPlan.enabled; self-wrapping template |

**Rendering pipeline** (`src/blocks/render.js`, 747 lines) — operates **from `mes`, never from the DOM; never rewrites `mes`** (stored text stays canonical for swipes/edits/summariser). Failure rule: anything unexpected → leave ST's rendering alone ("no improvement", never "lost content").

1. `extractBlocks(mes, registry)` — per-tag regex; repeating tags carry `name=` (one tab per NPC); unclosed block → `truncated:true`.
2. `applyBlocksToMessage` — stamps `data-meg-blocks-stamp` (rebuild only when text/settings change); three paths: **marker fast path** (the preset's `<details class="meg-blocks-src">` wraps the envelope — hidden outright, no walking), **lead blocks** (forward walk ≤12 nodes, strict start-match, multiple `<Dice>` merge), **tail blocks** (backward walk with normalized-length accounting — letters+digits, list markers stripped — plus under-consume/over-consume guards; failure → untouched message).
3. `buildBlocksCard` — one card, tab strip (emoji+label; repeating keyed `id:name`), CYOA resting open; pane content most-specific-first: CYOA buttons → matching treatment → plain mini-markdown.

**Treatments** (`treatments.js`, 1201 lines; the "CYOA contract": *parse returns null the moment the body stops looking right → fall back to prose*):
- **World State → Scene Board**: line state machine (order is the only reliable structure); header chips (Time/Loc — split at label boundaries, never at `|`, because the template's own Loc is `[Place | Region]`); person cards (avatar initial, mood pill, "You" pill for the PC identified by 🧍, **Secret fields blurred until click/focus**); Off-screen + Unresolved threads panels; phase rails (Arc: setup→…→resolution; Scene: simmer→…→breather); **compact variant checked first** (recognized by an inline `**PC:**` line the full template never produces — the full parser would *mis*-parse it).
- **Chatter → Whisper Thread / Interior**: speaker markers = short caps/title-case name + colon (blacklist of non-name colons; ≤4 words); fully-bracketed template body is declined everywhere ("whisper-threading the example would show the reader a card built out of the prompt").
- **Character Sheet**: stat fields + list fields, one renderer; list-ness from **declared field type** (fallback: comma-count); `PACK_LABEL` regex → pack list (19-entry glyph map, "In hand & worn" band); other lists → tier chips (novice/adept/expert/master, tier-colored).
- **Dice**: the only treatment that **checks its own arithmetic** (`total !== roll+mod` → null — "a total the model made up falls back to prose where the reader can see the numbers disagree"); bounds-checked; every non-empty line must parse; >8 rolls = model looping → null; renders a die face (CSS reel animation with *deterministic* decoy numbers: +7 mod 20 — "the motion is the decoration; the correct value is the default").

`src/features/blocks/chat.js` wires it to ST (coalesced `meguminScheduleBlocksRefresh`, refresh on all 7 message events) and hands the `npcUpdate` pane to `npcDecorateUpdatePane` (the only directed blocks→npc edge). `blocks/ui.js` = the Blocks settings tab (reorder/visibility/custom blocks + stat-field editor + live preview built from templates, never stale reply content).

---

## 9. Features

### 9.1 Memory Core (`src/features/memory/`, 1605+314+82 lines)

Three tiers: **working** (last `workingLimit` 30 messages, raw) → **short-term** (`shortTermChunks`, up to 70 summaries) → **long-term vault** (`longTermVault` archived chunks, retrieved per prompt and the archived raw messages stripped out).

- **`vectordb.js`** — ST-native Vectra `/api/vector/*` only, **no client-side embeddings**: collection `megumin_<charId>` / `megumin_group_<groupId>`; 1200-char windowing with `#n` piece hashes (512-token MiniLM / 6k-jina limits); insert in batches of 50; delete sweeps the bare hash + all 128 windows (always identity-checked — irreversible); **query = newest user message ALONE** (measured: mixing the prior AI reply pulled the wrong scene's chunks); <16-char messages fall back to last-2; topK 12 @ 0.2 → 3 matches (score 99, "Semantic Embedding Match (Vectra)"); `memEnsureSemanticQueryFresh()` is awaited by the prompt builder (closes the race where generation beats the 800ms debounce).
- **`keywords.js`** — per-prompt-build cached keywords (`Intl.Segmenter` + stopword list that includes the extension's own block vocabulary) shared by vault TF-IDF, NPC dossier injection, NPC image-tag injection.
- **`index.js`** (one file by deliberate choice — vault↔ui↔visuals are mutual cycles): dashboard/accordion/vault UI (20/page), `memProcessPendingChunks` (chunkSize 10, summaries via direct API or Megumin-engine preset), `memScrubOverlappingArchives`, `memSyncLimits`, `memCalculateTokensSaved`, archived-message badges in chat, `/hide` handling (2026-08-28 position-counting fix).

### 9.2 NPC Bank (`src/features/npc/`)

- **`fields.js`** (442) — single source of truth for dossier shape. `NPC_FIELD_TYPES` = text|longtext|list (no meters — meter movement is Bonds' job). System roles `name` (identity key) / `vitals` (age/sex/orientation, badge) / `imageTags` (**withheld from the model's text**, routed to ComfyUI). Default fields: name/age/sex/orientation (fixed), role, whereToFind, appearance, imageTags, voice, background, innerCircle, personality, readOnPc, agenda, secrets (list), canonLock (list, never updatable). Flags independent: fixed / persistent ("2pm on an ordinary Tuesday" rule) / updatable. `npcBuildDossierPrompt` / `npcBuildUpdateRules` generate all prompt text **from the field list** so it can't drift.
- **`data.js`** — `meguminFindNpcDossiers` (tag shape first, `**Name:**` fallback, plus legacy `<details><summary>` shape), `npcParseBlock` (strict→loose label pass; legacy labels absorbed), `getRelevantNpcImageTags()` (TF-IDF top-3 → image-gen prompt).
- **`updates.js`** — `<NPC_Update>` parsing (`~` replace / `+` add / `-` remove); name match exact → prefix/suffix word; every applied op records a **history entry with the `before` value** — that single fact powers the per-row Undo buttons AND rewind rollback (`npcRollbackHistoryFrom` restores the OLDEST doomed entry's `before`; restoring newest would keep an intermediate change alive in a chat that never reaches that message).
- **`updateCard.js`** (separate file on purpose — the only part that saves, keeping the profile→updates edge one-way) — decorates the card pane from the actual changelog with Undo / Undo-all.
- **`pfp.js`** — ComfyUI portrait per NPC (imageTags as prompt), guarded by `activeNpcPfpRequest`.
- **Auto-extract** (index.js `MESSAGE_RECEIVED`): find dossiers → dedupe by name → create records; parse/apply updates; toast per change; save once. Identity-guarded (`_loadedProfileKey` must match live chat key).
- **`ui.js`** (808) — enable, OOC trigger, `sendPortraitsToAi`, scan depth, ignored names, injection limit (3), Scan Story button, field editor (system roles protected), per-NPC dossier cards + history log.

### 9.3 Story Director / Story Plan (`src/features/storyplan/`, 491 lines + registry `tracker` block)

- **Auto-evolve**: after each assistant reply → parse `<Story_Tracker>` → store `lastTrackerState`; on status ∈ {completed, pivoted} (non-manual mode) or `autoFreq:10` safety net → 2s later regenerate the directive (identity-checked before AND after the await) → store `currentPlan`.
- `renderStoryPlanner` — backend (direct API / Megumin-engine preset), trigger mode (auto/frequency/manual), content rating, pacing, **primary genre + 22 flavor tags** (2026-08-28: custom genre added), director's note, unrestricted-content flag, plan preview.
- `handleDirectiveGeneration` returns text containing `<directive>` or `<plot>`; `[[storyplan]]` dict fragment carries the current plan into the prompt.

### 9.4 Story Config / Writing Style (`src/features/storyconfig/`)

- **`config.js`** (330) — `STORY_CONFIG_DEFAULTS` (length, difficulty, friction, npcDisposition, explicitness, narratorPresence, focus, culture, era, npcSpeechStyle, notes), `buildConfigBlock(cfg)` → the `[[config]]` block ("standing settings" preamble, outranks everything else; empty when all defaults), built-in config presets, `normalizeStoryConfig`.
- **`ui.js`** (794) — the Story tab: style library (precooked / my library / AI generators + edit-as-custom + regen), DnR ratio sliders, onomatopoeia (incl. HTML-styled), V9 Lean/Full limits, world-state settings, personal prompt editor, per-engine V10 Enhanced Dialogue switch.

### 9.5 Image Gen / ComfyUI (`src/features/imagegen/`, 1142+75 lines)

- **`comfyProgress.js`** — unique `client_id` per generation (ComfyUI only reports progress to the queuing client; the id goes to both the websocket and the `/prompt` body) → drives the "Kazuma is thinking…" overlay (`ui/progress.js`).
- **`igGenerateWithComfy(positivePrompt, target)`** (line 845) — the core: captures chat/group ids at call time, **re-resolves target before EVERY write** (object identity → indexOf → placeholderId in message text → send_date+name+is_user stamp); on chat switch it **declines the write** (never writes into another chat). Loads workflow JSON (ST's `/api/sd/comfy/workflow`), substitutes `%prompt% %negative_prompt% %seed% %sampler% %model% %steps% %scale% %denoise% %clip_skip% %lora1..4% %lorawt1..4% %width% %height%` (+KSampler fallback seed), queues with client_id, polls `/history` 1s, downloads (`/view`), optional JPEG 0.9 canvas compression → attachment `{source:"generated", title: finalPrompt, generation_type:"free"}`.
- **Three insert modes**: inline-auto (replaces `[Generating Image…]` placeholder inside `<!-- kazuma-inline-start:ID -->…<!-- kazuma-inline-end:ID -->` comment delimiters — the preset's regex script turns those back into `<img prompt=…>` on display), gallery (pushes to `message.extra.media`), free-standing (new system message "Image Gen Kazuma").
- **Auto-trigger** (index.js MESSAGE_RECEIVED): regex-extracts `<img … prompt="…">` from the newest assistant message (filtered out of `</think>` blocks), swaps placeholders, staggered 500/1500ms gens. **Retry buttons** re-run the exact image (150/600/1500/3000ms sweep for DOM races). **Overswipe** → regenerate (the PRIORITY HACK, §2). Quick-gen button (polled into existence next to `#send_but_sheld`).
- Settings: backend (direct/preset), workflow picker + editor + save/load/delete, model/sampler/4 LORAs+weights, negative, seed, steps/cfg/denoise/clipSkip, size, compress, prompt template (KAZUMA placeholders from `data/image_data.js`), NPC tag injection, trigger mode always/frequency/manual, per-profile saved workflow states (the documented ~300KB-per-profile bloat — "not fixed yet", README).

### 9.6 Dynamic Ban List (`src/features/banlist/ui.js`, 184 + `prompts/banList.js`)

AI-maintained list of banned concepts/phrases; backend direct API or Megumin-engine preset; scan/add/remove UI; injected as `[[banItems]]`/`<banlist>` into the preset (Main 2 message); the CoT correction loops (V7+) explicitly scan the draft against it (incl. knowledge bleed + "black box" violations). `banListCustomPrompts` for per-profile overrides.

### 9.7 Prompts module (`src/prompts/`)

`defaults.js` = `DEFAULT_PROMPTS` (the one-shot task prompt texts: memory summarization, NPC scan/update rules, story plan/directive, image gen, ban list); `storage.js` = **sparsification/rehydration** of stored prompt text (identical-to-default → not stored; this is the settings.json size win); each per-feature file holds the authorable rule text the feature prompts are built from.

---

## 10. UI layer

### 10.1 Settings modal (`example.html`, 628 lines — vanilla, no framework)

`#megumin_settings_modal` → `.ps-modern-modal.app-container`: header (title + **`#ps_live_token_count`** live token counter with `data-breakdown` tooltip) · actions (Global sync switch `#global_sync_toggle`, Reset Profile, Save Profile) · **bottom dock** (`.dock-icon[data-tab]`: Story / Side Panel / Bonds / V10 / Image / Settings / Dev) · `#tab_*` wrappers (filled by the 5 tab renderers) · `#global-sync-modal` ("Apply All Tabs to Global"). The **mobile drawer/hamburger is NOT in example.html** — injected at runtime by `index.js initMobileDrawer()` (which references a `.top-app-bar` class that doesn't exist in the HTML — graceful no-op branch).

### 10.2 Tabs (`src/ui/tabs.js` + 5 renderers)

| Tab | Renderer | Contents |
|---|---|---|
| Story | `personality.js` (192) | Writing Style Library (precooked/my library/AI-gen cards), Dialogue/Narration (DnR) sliders, Personal Prompt editor + master switch |
| Side Panel | `sidePanelTab.js` (317) | scale slider (`--meg-sp-scale`), token-counter mode, chat-visibility toggles, section order (drag), auto-collapse, per-section enable (worldState/innerChatter/newNpcs/storyPlan/npcBank/banList), debug + Wipe (mentions `window.LukaSuite`) |
| Bonds | `globalAndBlocks.js` (88-117) | stat-field packs (Romance/Rivalry/Social; RPG/Survival) |
| V10 | `globalAndBlocks.js` (44-83) | engine card grid + custom engine card + per-engine Enhanced Dialogue switches + Ban List panel |
| Image | `globalAndBlocks.js` (186-226) + `imagegen/index.js renderImageGen` | full ComfyUI settings |
| Settings | `globalSettings.js` (238) + `globalAndBlocks.js renderSettingsTab` | profile management (list, name, Sync Global, Apply All, Save/Reset, About), Memory Core, Story Plan, Story Director, Bonds, Ban List, Image Gen, Side Panel |
| Dev | `tabs.js` → `DevMode.init()` | Dev Console (below) |

Every tab footer has its own per-tab "Global" switch (`megumin_<name>_global` keys → `core/sync.js`). `coreAndCot.js` (357) hosts the four prompt editors (Main / Core Config / CoT / persona, each with a master enable switch) and the Official Megumin Engines section.

### 10.3 Dev Console (`src/ui/devmode.js`, 1126 — rebuilt into Add-ons + Engines per 2026-08-28)

Full-screen modal, three views:
- **Document** — "the real shape of the outgoing prompt": rendered from **`data/skeleton.js`** (a *generated* file — `tools/gen-skeleton.py`, source = "Megumin Suite V10 Universal.json"; the 19 cards in TRUE send order, ST markers greyed) + a **Slot Map** (from `data/slots.js`: per-slot scope ENGINE/SHARED/AUTO, gates mirroring `buildBaseDict` 1:1, CoT pickers) + Module cards with per-slot override inputs → these become **shared fragments** (`core/sharedFragments.js`, stored install-wide in `sharedFragments{}`, NOT per-profile; `resolveSlot(slot, engine)` = engine override → shared → built-in; "Customised" badges).
- **Live** — token bars per message of the current build.
- **Log** — feature-module log lines.

`data/slots.js` is the slot registry: `[[prompt1..6]]` (engine-scoped, structural), `[[main]]` (hidden/auto, blanked on V6+…), plus every dynamic slot; `meguminAllSlotTriggers()` feeds injection's leaked-tag cleanup so a new slot can never leak a literal `[[…]]` into the prompt.

### 10.4 Small UI pieces

- **`launcher.js`** (127) — draggable floating `.meg-launcher` button (position persisted) opens the settings modal.
- **`progress.js`** (111) — `KazumaProgress` full-screen "Kazuma is thinking…" overlay with progress bar (ComfyUI websocket steps).
- **`promptEditor.js`** (105) — the shared modal textarea editor used by every "Advanced/edit" button.

### 10.5 Side panel (`src/sidepanel/`)

Standalone fixed in-chat panel with its own 1752-line CSS (`.meg-sp-*`). `chrome.js` builds `#meg-sp-panel` (header w/ title+collapse, body, 4 resize handles) + floating `#meg-sp-toggle`. `sections.js` = `Section` base → `<details class="meg-sp-section">` (drag handle, badge, chevron). **`parsers.js` (898) registers 6 sections**: `worldState`, `innerChatter`, `newNpcs`, `storyPlan`, `npcBank`, `banList` — each with a *lenient* `parse()` ("forgiving readers"), card `render()`, `onMessage()` lifecycle. `panel.js` (1538, `SidePanel` class): open/close, rebuild from registry + settings order, scale (CSS `zoom: var(--meg-sp-scale)` — non-standard property), resize handles, token counter + details popup, **`_handleHide` — "Parse First, Hide Second"**: a block is hidden from the chat ONLY when the panel successfully parsed it (per-block; drives `body.meg-sp-hide-inline` and the blocks renderer's `omit` list — a block is never shown in two places), swipe handling, badges, and **`window.LukaSuite`** (line 1481 — a frozen debug handle over panel internals under a *legacy project name*; the side panel tab documents it). `presentBar.js` — compact "present bar" strip of character cards near the chat input. `dom.js` — tiny utils.

### 10.6 CSS families (`style.css`, 4815 lines)

`wstyle-` (103 — writing-style cards, DnR panel, tag grid, AI-gen cards) · `mtab-` (98 — tab chrome) · `ps-` (90 — modern buttons/inputs/tags/switches/tooltips/prompt-editor/modal) · `meg-` (81 — chat block cards + side panel + launcher) · `dev-` (64 — dev console) · `dock`/`hero` (27/13) · `ecard-` (10 — engine cards) · `gs-` (5 — global sync) · `ws-` (31 — panel world-state) · `mobile-drawer` (27) · `#kazuma_progress_overlay` · theme-override block ~2993-3080 (glass modal, live-color switches).

---

## 11. Presets (`Presets/`, ST preset export format)

### Megumin Suite V10 Universal.json (687 lines) — the main preset

19 messages in `prompt_order` (single-char `100001` order = the canonical send order; `data/skeleton.js` documents it):

| # | id/name | role | content (slots) |
|---|---|---|---|
| 1 | `main` | system | `[[prompt1]] [[main]] [[prompt2]] / [[pronouns]] / [[control]] [[OOC]] / [[prompt3]]` |
| 2 | "Main 2" | system | `[[prompt4]] [[prompt5]] [[death]] [[combat]] [[npc_events]] [[prompt6]] [[aiprompt]] [[onomato]] [[img1]] [[npc_dossier]] [[html]] [[dice]]` + inline `<banlist>…[[banlist]]…</banlist>` |
| 3 | "Add Your Custom prompt here" | system | (disabled, empty) |
| 4 | "<lore>" | system | `<character_sheet> … {{char}}:` |
| 5-10 | ST markers | — | worldInfoBefore / charDescription / charPersonality / dialogueExamples / scenario / worldInfoAfter |
| 11 | "</lore><user_persona>" | system | `[[storyplan]] [[npc list]] </character_sheet> <user_persona> … {{user}}:` |
| 12-13 | personaDescription + closer | — | markers |
| 14 | "<history>" | system | `<history> / [[long-Memory]] / [[Short-memory]]` |
| 15 | `chatHistory` | — | marker |
| 16 | "USER Consent" | user | (disabled) |
| 17 | `jailbreak` "Output RULES" | system | **the post-history master message**: `## your thinking steps: [[THINK]]` → FORMATTING RULES (`[[DNRATIO]] [[COLOR]]`, response-shape rule, `[[Direct]] [[DN]] [[config]]`) → **`[[blocks]]`** → final-reminder rules → `[[user]] [[Language]] [[MVU]]` |
| 18 | `nsfw` "</history>" | system | `</history> …fictional world…` |
| 19 | `enhanceDefinitions` "Prefill only and only for gemini" | assistant | (disabled) `[[prefill]]` |

Defined but **disabled extras**: "Continue" (```\n</think>\n`` prefill), "AI 1" (`[[AI1]]`), "Main 3 DS4 + GLM" (DeepSeek/GLM variant carrying `[[COT]] [[cyoa]] [[infoblock]] [[npc_inner_chatter]] [[summary]] [[storytracker]]`), "user input" (`{{lastMessage}}`), "Memory management" (`[[long-Memory]] [[Short-memory]]`).

**10 `extensions.regex_scripts`** (display-side): kazuma-inline comments → `<img prompt=…>`; placeholder/img stripping; narration/dialogue tag stripping; `<ksc>/` thinking → styled `<details>` "Thinking Process" card; `<disclaimer>/<guifan>/<danmu>/<options>` + fences folded into details; **raw `<Blocks>` hidden & re-wrapped as `<details class="meg-blocks-src" open>`** (the marker the block renderer fast-paths); stray `<font>` cleanup. → *2026-08-28 mandates re-import of the preset because of the new `<Blocks>` regex.*

### Megumin Suite V10 Universal **Cache Friendly**.json (691)

Same 19 ids/names/roles. Deltas: dynamic slots (`[[storyplan]] [[npc_dossier]] [[npc list]] [[dice]] [[img1]]`) **moved out of the pre-history messages into Output RULES immediately before `[[blocks]]`** — keeping the pre-history prefix byte-stable across turns so providers hit the KV cache (devmode.js ~242 documents the intent); `dialogueExamples` disabled; USER Consent + enhanceDefinitions removed from the order. → *Anything inspecting "which message owns a slot" must handle both variants (skeleton is standard-only).*

### Megumin Engine.json ≡ Megumin Image.json (213 each — **byte-identical**, verified)

Two names for the same minimal **injection target** preset: `constants.js: TARGET_PRESET_NAME = "Megumin Engine"`; banlist/memory/storyplan offer the "Megumin Engine Preset" backend, imagegen the "Megumin Image Preset" (`useMeguminEngine` temporarily switches ST's active preset for one background generation, then restores). 13 messages: main (p1-p6 inline), ST markers, gemini prefill assistant, a disabled `user` message carrying **`[[order]]`** (the only place `[[order]]` appears — V10 Universal has none), a `thinking_steps` jailbreak (100-150 words, numbered), disabled "Continue". No regex scripts. *Any fix to one file should be mirrored to the other (or dedupe).*

---

## 12. Cross-cutting invariants (respect these when changing anything)

1. **Identity guards everywhere.** Anything that can outlive a chat switch (image gen, story auto-evolve, vector insert/delete, NPC auto-extract, profile save) stamps the active data identity / `_loadedProfileKey` at start and **re-checks before every write; mismatch = decline the write**, never write into the new chat.
2. **Blocks are defined exactly once** in `MEGUMIN_BLOCK_REGISTRY`; dict builder, cleaner, side panel, envelope and card all derive from it. Adding a block = one registry entry (+ `legacyIds` → `meguminSyncLegacyBlockIds`). Never hand-write a second template copy.
3. **Field lists generate their own prompts** (Bonds, Character Sheet, NPC dossiers, NPC updates). The reader edits fields in the UI; templates/rules are built from the list at prompt-build time. Don't hardcode field names in prompt text.
4. **Prompt assembly is two-layered**: `buildBaseDict` fills `[[tags]]`; `buildBlocksEnvelope` appends the `<Blocks>` skeleton. Conditional dict tags are blanked in injection.js; Dev Mode shared fragments shadow dict tags (Blocks tab shows an "edited" flag when that happens).
5. **Fail-visible principle**: every DOM decoration path falls back to the raw text on error; the model never needs to know the UI exists. "A block that renders as prose has lost a nicety. A block that renders as a confident, incomplete card has lost the reader's data."
6. **ST DOM re-render is the enemy**: every path that rebuilds `.mes_text` ends in `meguminScheduleBlocksRefresh` (coalesced 60-120ms); image code re-resolves targets by placeholder id / send_date, never a captured index.
7. **Profile save discipline**: `saveProfileToMemory()` (immediate, structural) vs `saveProfileDebounced()` (500ms, typing); cancel-debounce + `flushProfileSettingsToLoadedKey()` on chat switch/reset/hide; visibility/pagehide one-shot flush.
8. **Vector DB = ST Vectra only**: server-side embeddings, numeric hashes, 1200-char `#n` windowing, delete sweeps all windows, deletes always identity-checked.
9. **NPC history stores `before` values** — that single fact powers undo buttons and rewind rollback; any new mutation path must write a history entry.
10. **Event-driven triggers live in root `index.js`** (MESSAGE_RECEIVED does 4 things). Feature modules export pure functions; the root file owns the wiring.
11. **Dice are rolled by the extension** (crypto-fair, rejection sampling); the model only interprets, in order, never inventing/reusing.

---

## 13. Known issues, quirks & risks

- **README "Not fixed yet" (2026-08-18)**: settings.json bloat — ComfyUI workflow states still duplicated **per profile** (~300 KB each) + a stale pre-Beta settings key (~245 KB) left behind. (Block-rendering-under-MVU was *fixed* 2026-08-28: "Blocks now render when MVU is on… raw text just sat at the bottom of the reply instead.")
- **PRIORITY HACK** (`index.js:~731`): direct `eventSource._events` unshift + temporarily stomping ST's `power_user.image_overswipe` / `extension_settings.image_generation.overswipe`, restored after 200 ms — racy, documented as a hack.
- **Timing coupling**: 200 ms deferred `initProfile`, 500 ms × 30 chatId polling, 150/600/1500/3000 ms retry sweeps — all fighting ST's DOM render races.
- **`profile.js` is a 955-line god-module** of *implicit* inline migrations (patch-missing-keys) rather than versioned schema migrations; `migrations.js` header notes two further migrations still living in `index.js`; `activeRequests.isBackgroundGenerationActive()` deliberately omits `activeNpcScanRequest` (known one-line quirk, "fix separately").
- **`cot-v7-english`** is the only CoT entry missing `trigger:"[[COT]]"` (harmless today — injection only reads `content`/`prefill`).
- **V10 co-writers are derived by patch tables** at module load — any code matching engine ids by exact string must account for `v10-core-cw` / `v10-shura-cw`.
- **`window.LukaSuite`** — debug handle under a legacy project name (side panel tab documents it).
- **Block rendering depends on `mes` being canonical** — display-side regex scripts or other extensions rewriting DOM text break the tail walk (hence the preset `<details class="meg-blocks-src">` fast path).
- **Cache Friendly variant** breaks any "skeleton is the only shape" assumption (different slot ownership).
- **No version constant in code** — version 1.1.0 exists only in `manifest.json`; README is changelog-only (beta branch defers to stable's README; install = a Google Drive file).
- TODO/FIXME density is essentially **zero** — the codebase communicates through dense rationale comments instead (a distinctive, good trait).

---

## 14. Where to start

| If you want to understand… | Open |
|---|---|
| The single function where everything meets | `src/engine/buildBaseDict.js` |
| The outgoing prompt's true shape | `data/skeleton.js` + `Presets/Megumin Suite V10 Universal.json` |
| The keystone of blocks | `src/features/blocks/registry.js` |
| The prompt flow | `src/engine/injection.js` |
| State | `src/core/profile.js` (+ `keys.js`, `sync.js`) |
| Event wiring | `index.js` |
| The UI spine | `example.html` (every id the features key off) |
| The side panel | `src/sidepanel/panel.js` → `parsers.js` |

*End of overview.*
