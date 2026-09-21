# ST-Native Macro Migration — Design Spec

**Date:** 2026-09-21
**Extension:** Megumin-Suite-Beta (v1.1.0, `public/scripts/extensions/third-party/Megumin-Suite-Beta`)
**Host:** SillyTavern (verified against the user's installed source at `X:/SillyTavern`)
**Status:** DRAFT — pending user review
**Author:** collaborative session (user decisions inline: **hybrid scope**, **namespaced `meg_` prefix**, **re-import migration**)

---

## 1. Summary

Migrate the extension's synchronously-computable prompt placeholders from its private `[[slot]]` dialect to SillyTavern's native `{{meg_slot}}` macro system, so that ST's own substitution pass (`PromptManager.preparePrompt` → `substituteParams`) fills them. Asynchronously-dependent slots (memory vault, blocks envelope, per-generation dice rolls) stay on the `[[slot]]` dialect and are filled by the existing `CHAT_COMPLETION_PROMPT_READY` intercept. The result: ST's prompt UI shows real content, the experimental macro engine's features (`{{if}}`, `{{pick}}`, …) become composable with Megumin slots, one value-resolver serves ST + token counter + dev mode, and the intercept shrinks to its irreducible core.

User-approved constraints:
1. **Hybrid scope** — only sync-computable slots move; async ones stay Megumin-side.
2. **Namespaced prefix** — every migrated macro is `{{meg_<name>}}`; no bare names (avoids collisions such as ST's own `summary`).
3. **Re-import migration** — bundled presets ship in the new format; users get a one-time notice (README + in-UI). No runtime rewriting of installed presets; no permanent dual-mode in the code.

## 2. Background — verified facts about the host

| # | Fact | Evidence |
|---|------|----------|
| F1 | ST substitutes `{{...}}` in every preset message *before* the extension event: `preparePrompt()` calls `substituteParams(prompt.content, {original, groupOverride})` per prompt item. | `public/scripts/PromptManager.js:1282-1283` |
| F2 | `CHAT_COMPLETION_PROMPT_READY` fires after `promptManager.render(false)` and `squashSystemMessages()`, with the fully-prepared `chat` array — i.e. ST's UI already displayed the prompt (with `[[...]]` still literal) before the intercept ran. | `public/scripts/openai.js:1606-1610` |
| F3 | Extensions can register global `{{...}}` macros: `MacrosParser.registerMacro(key, value, description)` (value may be a function, called with a per-evaluation nonce) and `MacrosParser.unregisterMacro(key)`. Both log a deprecation warning pointing at the new registry. ST's own memory extension uses this exact pattern (`MacrosParser.registerMacro('summary', …)`). | `public/scripts/macros.js:42,183,~215`; `public/scripts/extensions/memory/index.js:33,1127` |
| F4 | New (experimental) engine: `macroSystem.registry.registerMacro(name, {handler, description, category, …})` / `.unregisterMacro(name)` / `.hasMacro(name)` from `scripts/macros/macro-system.js`. Enabled by `power_user.experimental_macro_engine` (absent in the user's `settings.json` → **legacy engine is the active default**). Identifier grammar: `^[a-zA-Z][\w-_]*$` (letters, digits, `_`, `-`; no spaces, no leading digit). | `public/scripts/macros/engine/MacroRegistry.js:198,327,339`; `MacroLexer.js:17`; `public/script.js:2935-2940` |
| F5 | Legacy engine (`evaluateMacros`): sequential regex pass over `preEnvMacros → envMacros → postEnvMacros`; **unknown `{{x}}` are left untouched**; env values that are functions get called. | `public/scripts/macros.js:610-710` |
| F6 | Today Megumin already piggybacks on ST's substitution for values containing name macros: the injection loop runs `substituteParams(replacement)` on each dict value before insertion (this is how the 54 `{{char}}`/`{{user}}` occurrences inside V10 engine text resolve). | `src/engine/injection.js:319`; `data/modes/v10.js` |
| F7 | The preset's `extensions.regex_scripts` operate on *model output* only (display side). They are unaffected by prompt-side macro changes. | `Presets/*.json` |
| F8 | `data/skeleton.js` is a **generated** file (`python tools/gen-skeleton.py`, source = V10 Universal preset) — but the `tools/` directory is **not in this repo** (author-private generator). Regeneration must be handled per §6.4. | `data/skeleton.js:4-6`; repo file listing |
| F9 | The legacy `MacrosParser` path has no collision detection beyond a console warning; a second registrant with the same key silently wins last-write. Namespaced names make collisions practically impossible; the shim still guards (§4.2). | `public/scripts/macros.js:207-213` |

## 3. Goals / Non-goals

**Goals**
- G1. ST resolves all sync-computable slots natively; the preset contains no `[[...]]` for them.
- G2. One value-resolution function is the single source of truth for: macro handlers, the live token counter, and the dev-mode Document view.
- G3. Behavior parity: an inactive slot still yields an empty line that gets stripped; group-chat semantics unchanged; prompt preview popup shows the final (ST-substituted) payload.
- G4. Works identically with the legacy engine (default) and the experimental engine (flag on).
- G5. Ship: 4 regenerated presets + regenerated skeleton + one-time re-import notice + README section.

**Non-goals**
- No migration of async slots (`[[long-Memory]]`, `[[Short-memory]]`, `[[blocks]]` + block anchors, `[[dice_rolls]]`) — they stay on the intercept.
- No runtime rewriting of user-installed presets (re-import instead, per user decision).
- No changes to the blocks card renderer, side panel parsers, or regex scripts.
- No changes to how co-writer / engine *selection* works; only the *carrier* of the slot values changes.

## 4. Design

### 4.1 Slot ownership split

`data/slots.js` (`MEGUMIN_SLOT_REGISTRY`) gains a required field `owner: 'st' | 'megumin'` on every entry. Existing fields (`key`, `trigger`, `scope`, `carrier`, gates, pickers) are unchanged; for `st`-owned slots the `trigger` becomes the `{{meg_…}}` form (§4.3).

**ST-owned (migrate to `{{meg_…}}`)** — synchronously computable from `localProfile` + `hardcodedLogic` + ST globals:

| Slot key | Current trigger | New macro | Value source (unchanged logic) |
|---|---|---|---|
| p1…p6 | `[[prompt1]]`…`[[prompt6]]` | `{{meg_prompt1}}`…`{{meg_prompt6}}` | selected engine's `p1..p6` |
| main | `[[main]]` | `{{meg_main}}` | personality content (blanked on modern engines) |
| A1 / A2 | `[[AI1]]` / `[[AI2]]` | `{{meg_ai1}}` / `{{meg_ai2}}` | acknowledgements |
| cot | `[[COT]]` | `{{meg_cot}}` | selected CoT entry `content` (`''` when disabled / `cot-off`) |
| prefill | `[[prefill]]` | `{{meg_prefill}}` | selected CoT entry `prefill` |
| think | `[[THINK]]` | `{{meg_think}}` | thinking-tag rule (shared scope) |
| ooc / userControl / control | `[[OOC]]` / `[[user]]` / `[[control]]` | `{{meg_ooc}}` / `{{meg_user}}` / `{{meg_control}}` | toggle texts (modern-engine blanking, `notCoWriter` gate — logic unchanged) |
| config | `[[config]]` | `{{meg_config}}` | `buildConfigBlock(storyConfig)` (`''` when all defaults) |
| aiprompt | `[[aiprompt]]` | `{{meg_aiprompt}}` | `aiRule`, engine-wrapped (v7.5 `<Narration_style>`, v7 `<narrative_style>`) |
| dnratio / dialogueColor / direct / dn / onomato | `[[DNRATIO]]` / `[[COLOR]]` / `[[Direct]]` / `[[DN]]` / `[[onomato]]` | `{{meg_dnratio}}` / `{{meg_color}}` / `{{meg_direct}}` / `{{meg_dn}}` / `{{meg_onomato}}` | format rules |
| death / combat / html / dice / npc_events | `[[death]]` / `[[combat]]` / `[[html]]` / `[[dice]]` / `[[npc_events]]` | `{{meg_death}}` / `{{meg_combat}}` / `{{meg_html}}` / `{{meg_dice}}` / `{{meg_npc_events}}` | add-on rule texts (gate: add-on enabled) |
| language / pronouns / count | `[[Language]]` / `[[pronouns]]` / `[[count]]` | `{{meg_language}}` / `{{meg_pronouns}}` / `{{meg_count}}` | auto slots (`[[count]]` always `''`) |
| banlist | `[[banlist]]` | `{{meg_banlist}}` | user's ban-list entries |
| order | `[[order]]` | `{{meg_order}}` | generation-order text (Megumin Engine preset) |
| mvu | `[[MVU]]` | `{{meg_mvu}}` | MVU variable passthrough (existing logic) |
| img1 / img2 | `[[img1]]` / `[[img2]]` | `{{meg_img1}}` / `{{meg_img2}}` | image-gen prompt rule blocks |
| npc_dossier / npc list / npc_updates | `[[npc_dossier]]` / `[[npc list]]` / `[[npc_updates]]` | `{{meg_npc_dossier}}` / `{{meg_npc_list}}` / `{{meg_npc_updates}}` | NPC bank template / list / update rules (built from `npcFields()` — sync) |
| storyplan | `[[storyplan]]` | `{{meg_storyplan}}` | `storyPlan.currentPlan` (already-persisted text — sync read) |

**Megumin-owned (stay `[[slot]]`, filled by the intercept)** — async, per-generation, or envelope-coupled:

- `[[blocks]]` envelope + block anchors: `[[infoblock]]`, `[[cyoa]]`, `[[npc_inner_chatter]]`, `[[storytracker]]`, `[[storytracker2]]`, `[[npc_dossier2]]`, `[[summary]]` — the envelope must be assembled at intercept time with the final per-reply ordering and the panel-`omit` list.
- `[[long-Memory]]`, `[[Short-memory]]` — depend on the fresh Vectra query (`memEnsureSemanticQueryFresh()`) that runs at intercept time; the ST substitution pass is synchronous and earlier.
- `[[dice_rolls]]` — the d20 values are crypto-rolled once per generation; ST builds the prompt at least twice (dry-run token budget + real), so a macro handler would produce different rolls per pass. Stays in the envelope path.

Rationale boundary: *a slot migrates iff its value is a pure function of (current profile, current ST context) and is identical across ST's dry-run and real passes.*

### 4.2 Registration shim — new module `src/core/macros.js`

Single module, zero new ST-internals hacks:

```
import { macroSystem } from '/scripts/macros/macro-system.js'   // new-engine registry (if importable)
import { MacrosParser } from '/scripts/macros.js'               // legacy path (same import ST's memory ext uses)
```

(If `macro-system.js` cannot be imported from an extension in some ST build, the shim degrades to `MacrosParser` for both paths — the bridge inside `MacrosParser.registerMacro` handles the experimental case, at the cost of the `category:'legacy'` browser metadata. Import failure must be caught; the extension must still work with MacrosParser-only.)

API:

```
initMeguminMacros()          // idempotent; called at boot (index.js, after migrations)
uninitMeguminMacros()        // unregisters all (extension-disable safety)
isMacroEngine()              // power_user.experimental_macro_engine ?? false
registerSlotMacro(slot)      // per st-owned slot
resolveSlotValue(slotKey, scopeKey?)   // THE single value source (§4.5)
```

Registration strategy (per slot):
1. Build the macro name per §4.3.
2. **Collision guard (deterministic):** the shim keeps `REGISTERED_SET` — the names *it* registered this session. Before first registration of a name: if the experimental registry is importable and `macroSystem.registry.hasMacro(name)` is true → the name is externally owned → skip, `console.warn`, record the slot in `UNREGISTERED_SLOTS`. On the pure-legacy path there is no public query API (F9); the guard degrades to never unregistering any name outside `REGISTERED_SET` (so flag-toggle re-registrations can't clobber a foreign macro), and last-write-wins remains ST's documented behavior for a hypothetical foreign `meg_*` first-registration (practically impossible). Slots in `UNREGISTERED_SLOTS` are filled by the intercept as if `[[…]]`; the intercept cleanup also strips any surviving `{{meg_*}}` literal, so worst case = empty, never garbage.
3. **Legacy engine (default):** `MacrosParser.registerMacro(name, (nonce) => resolveSlotValue(slot, nonce), description)`. One deprecation `console.warn` per macro per boot — accepted, documented in README ("cosmetic ST deprecation notice; use the experimental macro engine to silence").
4. **Experimental engine:** `macroSystem.registry.registerMacro(name, { category: 'megumin', description, exampleUsage, handler: () => resolveSlotValue(slot) })` so the MacroBrowser shows proper docs.
5. **Flag flips at runtime:** subscribe to ST's settings-updated event; if the experimental flag changed, `uninitMeguminMacros()` + `initMeguminMacros()` (cheap idempotent upsert).

Lifecycle invariants:
- Handlers are **pure and synchronous**: no I/O, no vectordb, no dice, no writes. (Violating this breaks the dry-run double evaluation, F2/F1.)
- Handlers read `localProfile` **live** (module live-binding) — one registration at boot tracks chat switches automatically; `nonce` is used only as a memo key (§4.5), never as state.
- **Value wrap (single application point):** the *resolver* (§4.5) owns the wrap — `safeSubstitute(value)` = try ST's own `substituteParams(value)` (global-context signature, exactly today's `injection.js:319`, so `{{char}}`/`{{user}}`/`{{description}}` inside engine text still resolve, F6), catch → return `value` raw. Handlers are a thin `() => resolveSlotValue(slot)` and never wrap themselves — exactly one substitution per value per build. The wrap is mandatory on the experimental engine too: that engine does not re-parse `{{…}}` inside returned values.

### 4.3 Naming rule

`macro name = 'meg_' + lowercased(trigger text minus brackets)`, with runs of spaces/other illegal chars collapsed to a single `_`. Examples: `[[prompt4]] → meg_prompt4`; `[[DNRATIO]] → meg_dnratio`; `[[npc list]] → meg_npc_list`; `[[user]] → meg_user`. All pass the identifier grammar `^[a-zA-Z][\w-_]*$` (F4). The `meg_` namespace guarantees zero collision with ST built-ins (names like `summary` remain ST's) and with other extensions unless they deliberately namespace themselves `meg_` (collision guard §4.2.2 covers that residual case).

### 4.4 Slot registry & dict changes

- `data/slots.js`: add `owner` to every entry; `trigger` updated for st-owned slots; `meguminAllSlotTriggers()` now yields **both** dialects so the intercept's leaked-tag cleanup strips any surviving `[[…]]` *and* `{{meg_…}}` literals.
- `src/engine/buildBaseDict.js`: still builds **all** slot values (it is the value engine), but its return is now consumed by three views: the macro shim (st-owned), the intercept (megumin-owned), and the token counter (§4.5). Its internal assembly order, gates, and blanking rules are untouched. The per-value `substituteParams` step (line 319) **moves into the resolver** (§4.5) — every consumer (macro handlers, intercept, token counter, dev mode) obtains values through it, so exactly one substitution per value per build, never two.
- Shared fragments & dev overrides: resolution order unchanged (`engine override → shared fragment → built-in value`) — the fragment simply becomes the value the handler returns; the "Customised" badge logic (`engineShadowsShared`) untouched.

### 4.5 One resolver, three consumers

`resolveSlotValue(slotKey, scopeKey?)` in `src/core/macros.js`:

```
scopeKey ??= fingerprint()          // legacy macro handlers pass their per-build nonce;
                                    // experimental handlers & tokens.js pass nothing
fingerprint() = `${_loadedProfileKey}|${currentChatId}|${name1}|${name2}|${selected_group ?? -1}`
dict = getDictForBuild(scopeKey)    // memoized buildBaseDict(), bounded LRU (≤8), cleared on CHAT_CHANGED
return safeSubstitute(applyFragmentsAndOverrides(dict[slotKey]))   // §4.2 wrap, applied exactly once, here
```

Consumers:
1. **Macro handlers** (ST substitution pass, F1) — the production path.
2. **Token counter** (`src/core/tokens.js`) — replaces its private `buildBaseDict(true)` call; keeps its existing exclusion of the *dynamic/megumin-owned* set (badge stability is a UX choice; ST's own dry-run budget now additionally includes the st-owned dynamic text like NPC lists — that's a host-side accuracy gain, not a Megumin change).
3. **Dev-mode Document view** (`src/ui/devmode.js`) — renders each slot card with its **owner badge** (`ST-managed` / `Megumin-managed`) and resolves the live value through the same resolver; slot map entries gain the `{{meg_…}}` form.

Why the keying is sound: the legacy engine generates one `nonce = uuidv4()` per `evaluateMacros` call and passes it to every env-macro evaluation (F5) — so the nonce is a per-build key, and ST-owned slots cost exactly one `buildBaseDict()` per prompt build (the dry-run and the real pass each get their own nonce → identical values, no extra work). The experimental engine's handlers receive no nonce; they (and the token counter, which has no nonce in its `REFRESH`-hook context) fall back to `fingerprint()`, which changes only when the profile or the chat/name context actually changes.

### 4.6 Intercepts — what shrinks

`handlePromptInjection` keeps, unchanged: background-task prompt replacement (story plan, NPC scan/update, ban list, image gen, portrait, memory summarization), the semantic-query refresh, the `[[blocks]]` envelope build, memory/`[[dice_rolls]]`/block-anchor filling, NPC multimodal injection, and the preview popup. It **loses** the per-message substitution of every st-owned slot (ST did it in F1) and gains one small step: strip any surviving `{{meg_*}}` literals (the §4.2.2 collision-fallback path) using `meguminAllSlotTriggers()`. The existing empty-line-cleanup stays and must remain **generic** — it must delete any whitespace-only line within the injected messages, not only lines that contained a `[[…]]` tag — because ST now produces empty lines itself when it substitutes an inactive st-owned slot with `''` (ST inserts the value; it never deletes the line).

### 4.7 Presets & skeleton

- All 4 bundled presets regenerated: every st-owned `[[x]]` → `{{meg_x}}` per §4.3; megumin-owned untouched; `prompt_order`, markers, `regex_scripts` (F7) untouched. `Presets/Megumin Engine.json` and `Presets/Megumin Image.json` remain byte-identical (verified today; keep it true after regen — one script emits both).
- `data/skeleton.js` regenerated from the new V10 Universal preset. Since `tools/` is not in this repo (F8), the migration adds **`tools/gen-skeleton.mjs`** (Node, no deps; emits the existing format incl. the "GENERATED FILE" header) and commits it — restoring the generator the header already references, and making future preset edits reproducible.
- **One-time re-import notice:** on `APP_READY`, if the active preset (whatever preset ST has selected) contains `[[` triggers that are st-owned (i.e. an old-format or pre-migration preset) → show a one-time popup/toast: "Megumin Suite now uses ST-native {{meg_…}} macros. Please re-import Presets/Megumin Suite V10 Universal(.json). Your current preset keeps working but its engine slots will stay unfilled." Notice state persisted in `extension_settings[extensionName].notices.macroMigrationShown` (same pattern as existing `npcTemplateNoticeShown`). The extension degrades gracefully: unfilled old `[[…]]` slots are stripped by the cleanup (F3/F5 unknown-macro-safe — `[[…]]` was never an ST macro, so no ST-side risk).
- README: new section under the beta changelog describing the migration, the re-import step, the deprecation-warning note, and the experimental-engine recommendation.

### 4.8 Files touched

| File | Change |
|---|---|
| `src/core/macros.js` | **new** — shim (§4.2, §4.5) |
| `index.js` | boot calls `initMeguminMacros()` (+settings-updated re-register); `APP_READY` notice check; no other logic moved |
| `data/slots.js` | `owner` field; st-owned `trigger` → `{{meg_…}}`; `meguminAllSlotTriggers()` both dialects |
| `src/engine/buildBaseDict.js` | returns full dict; per-value `substituteParams` removed for st-owned slots (moved to handler); everything else untouched |
| `src/engine/injection.js` | st-owned substitution removed; surviving-`{{meg_*}}` strip added; preview popup unchanged (now shows ST-resolved text — accuracy gain) |
| `src/core/tokens.js` | resolver-based counting (§4.5) |
| `src/ui/devmode.js` | owner badges; live values via resolver |
| `src/core/profile.js` | none (profile shape unchanged — `meg_` migration touches no stored settings; sparsification of `aiRule` etc. unaffected) |
| `Presets/*.json` (×4) | regenerated (§4.7) |
| `data/skeleton.js` | regenerated via new `tools/gen-skeleton.mjs` |
| `tools/gen-skeleton.mjs` | **new** (F8) |
| `README.md` | migration section |

## 5. Behavior & edge cases

| Case | Behavior |
|---|---|
| Inactive st-owned slot (e.g. OOC off, COT off, no ban entries) | Handler returns `''` → ST inserts empty → Megumin cleanup deletes the now-empty line. Identical to today. |
| Dry-run (ST token budget) + real pass | Handlers are pure/sync; memo per nonce/fingerprint yields identical values in both passes. Dice rolls unaffected (megumin-owned). |
| Chat switch mid-generation | Handlers read live `localProfile`; the nonce-scoped memo is cleared on `CHAT_CHANGED`. Same identity-guard posture as today (handlers never write). |
| Experimental engine ON | Registration via `macroSystem.registry` (full docs in MacroBrowser); `{{if}}`/`{{pick}}`/variables now composable in preset text around slots; handler values pre-substituted (§4.2 value-wrap invariant) so nested `{{char}}` still resolves. |
| Experimental engine toggled at runtime | Re-register on settings-updated (§4.2.5). |
| Extension disabled | Macros stay registered (ST has no disable hook) but handlers return `''` when `localProfile` is null/absent → preset slots render blank, never stale. `uninitMeguminMacros()` available for future disable hooks. |
| Name collision (another ext registers `meg_*`) | Guard skips, warns, falls back to intercept fill; surviving literal stripped at intercept (§4.2.2). |
| Group chat | Handlers use the same ST-context reads as today's buildBaseDict (group names, `{{group}}` semantics via pre-substitution wrap). No new group logic. |
| Prompt preview popup | Shows the final payload *after* ST substitution — strictly more accurate than today (F2). |
| ST prompt pane / export (legacy engine) | Now shows resolved `{{meg_*}}` values instead of literal `[[…]]` — the core user-visible benefit. |
| Old-format installed preset | Works (degraded): st-owned `[[…]]` stay literal → cleanup strips them → one-time notice tells user to re-import. No auto-rewrite (user decision). |

## 6. Testing plan

1. **Unit (node, no ST):** `resolveSlotValue` pure-function tests — inactive slot `''`; engine-wrapped `aiprompt` shapes (v7.5/v7/modern); `meg_npc_list` from a fixture NPC bank; fragment-shadowing order; memo keyed by nonce (two nonces → two builds; same nonce → one build).
2. **Registration:** boot with legacy engine (flag off) → `MacrosParser` map contains all st-owned names; boot with flag on → `macroSystem.registry.hasMacro` true for all; toggle flag at runtime → re-registered; collision guard: pre-register a fake `meg_probe` → slot skipped + `UNREGISTERED_SLOTS` + intercept strips the literal.
3. **Integration (in ST, manual script):** dry-run token count before/after migration matches for the same profile (±dynamic exclusions identical); prompt preview popup content equals a reference capture with the old engine; group-chat prompt contains resolved names in both engines; V10 Ukiyo vs Shura vs co-writer produce the same final prompt bytes as the old pipeline (golden-file diff of the full `chat` array for a fixed chat fixture).
4. **Preset regen:** `tools/gen-skeleton.mjs` output identical to hand-verified skeleton format; both Engine/Image presets byte-identical after regen; regex_scripts byte-identical.
5. **Degradation:** import a pre-migration preset copy → notice shows once, prompt sends without leaked literals, cards still render.

## 7. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| ST internals drift (MacrosParser deprecation removed in a future ST) | Medium | Shim already prefers `macro-system.js`; MacrosParser fallback is the documented legacy path ST maintains for the non-experimental engine; both imports in one module = one-line future fix. |
| Experimental engine treats unregistered `{{x}}` as an error (unverified in this ST build) | Low | We only ship *registered* names; user-typed unknowns are an ST-side concern, and the legacy default remains the fallback. Verify during implementation (add to test plan item 3). |
| Handler purity violated later (someone adds an await) | Medium | Invariant documented in the module header + test plan item 3 (identical dry-run/real values) catches regressions. |
| Per-boot deprecation spam in legacy mode | Certain | ~30 `console.warn` once per boot; README note; experimental flag silences it. Accepted (user-informed). |
| `tools/gen-skeleton.mjs` diverges from author's private Python generator | Low | Committed Node script becomes the source of truth for this repo; header comment updated to reference it. |

## 8. Out of scope

- Migrating the async slots (documented rationale §4.1 — revisit only if ST gains async macro support).
- Renaming *slot keys* (only the macro *names* change; `key` stays, so dev-mode, sync, and stored settings are untouched).
- Any change to block rendering, side panel, memory, NPC bank, or ComfyUI features.
- Stable-branch backport (this repo is the beta; stable has its own README/preset pipeline).

## 9. Rollback

One revert of the change set. No stored-settings schema changes were made (slots keep their keys; only `trigger` and a display `owner` field changed), so profiles created during the migration remain valid after rollback; the only user-facing residue is the re-imported preset, which the old code also accepts (it contains st-owned `{{meg_*}}` — the old pipeline's cleanup, extended only additively, strips unknown `{{…}}`… **verification required during implementation**: if the old cleanup does not strip `{{…}}`, ship the rollback with a "re-import old preset" notice instead).

## 10. Open verification items (to close during implementation, not design)

1. Confirm the experimental-engine parse behavior for *unregistered* `{{x}}` in this ST build (leak vs error).
2. Confirm `macro-system.js` is importable by extensions (`/scripts/macros/macro-system.js` path) — otherwise take the documented MacrosParser-only degradation.
3. Confirm the exact ST event name for settings-updated used by the re-register hook.
4. Rollback-preset behavior check (§9).
5. Exact ST API for reading the *active* prompt preset's content (PromptManager storage / `localStorage` key) used by the old-format detection in §4.7.
