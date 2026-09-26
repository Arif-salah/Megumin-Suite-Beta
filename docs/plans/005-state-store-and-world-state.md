# 005 — Extension-Owned State Store & World State Rewrite

Status: DRAFT
Date: 2026-09-26 · Author: Claude · Reviewer: developer

## Goal
Blocks stop being "text in the chat" and become an **app layer the extension owns**. The extension stores the state, injects it into the prompt, takes change instructions back from the model, and can undo them. World State is the first module on this layer. Bonds, Character Sheet and the other blocks plug into it later without new plumbing.

This replaces `src/features/worldstate/ledger.js` and `parser.js`, which have these proven problems (see "Evidence" at the end):
- World state is saved in `settings.json` under the **character** key, so all chats with a character share one state. On load, `pruneFutureData()` rolls it back against the wrong chat's length. This is the reload bug: outfits vanish from Image Gen.
- A recovery path saves a `{ rawText }`-only stub with no `pc` and no `npcOutfits`.
- The markdown text and the structured fields are two separate copies, patched by different regexes, and they drift apart.
- The parser loses or corrupts data on common model variations. Names containing "loc", "temp" or "time" are read as headers, and `Outfit: unchanged` is stored as the literal word "unchanged".
- History is keyed by message index, which shifts when an older message is deleted.
- Seeds, Timers and Arc Phase are parsed but never applied. Off-Screen and Threads updates replace the whole list.

## What the user will see / feel
- World state survives reload, chat switching, branching, hiding, summarizing and deleting old messages.
- Swiping, regenerating, editing or rewinding a reply undoes exactly that reply's changes, and swiping back restores them.
- A character who leaves and returns 90 messages later comes back with their last known outfit and details, even if the chat was summarized.
- The World State card in every AI message looks the same as today (drawn from the store). A small **"Changed"** strip shows what that message changed, e.g. `Aqua · Outfit: blue dress → bath towel`.
- If the model writes a line the extension doesn't understand, the card shows a small ⚠ chip with the skipped lines. Nothing is guessed silently.
- A **World State editor** where the user can fix any field, add or remove characters, move someone in or out of the scene, or ask the model to rewrite the full state on the next reply.
- Fewer tokens per reply: the model writes a few short change lines instead of a full markdown block.
- Image Gen reads outfits from the store, so outfits are always there after a reload.

## Architecture

### 1. Storage: `chat_metadata["megumin_state"]`
Stored in the chat file. Never written to `settings.json`.

```js
megumin_state = {
  v: 1,
  seqCounter: 57,                 // next sequence number to mint
  checkpoint: {                   // folded (settled) state — not undoable any more
    seq: 12,                      // highest seq folded into it
    modules: { world: { /* WorldState */ } }
  },
  journal: [ /* JournalEntry, ordered by seq */ ],
  pendingFullRewrite: false,      // user asked "rewrite full state next reply"
  imported: true                  // legacy import already done for this chat
}
```

### 2. Message identity
- When an AI message is received, stamp `extra.megumin_uid = "m_<random>"` and `extra.megumin_seq = <seqCounter++>`. Copy the stamp into **every** `swipe_info[i].extra` of that message.
  - Why: ST keeps a separate `extra` per swipe and clones the current `extra` into a new swipe when generating it (`script.js` ~3648, ~6734). Writing the stamp to all swipes makes it message-level and stable.
- A message without a stamp (old messages, greetings) gets one on first touch.
- UID and seq survive reload (they're saved in the chat file). They don't shift when other messages are deleted, and branches copy them.

### 3. Journal entries
```js
JournalEntry = {
  uid: "m_8f2a", swipe: 1, seq: 41,        // which message + which swipe produced it
  source: "reply" | "sidemodel" | "user" | "import",
  kind: "delta" | "snapshot",             // snapshot = full <World_State> rewrite
  module: "world",
  ops: [ { op: "set", path: ["cast","Aqua","outfit"], before: "blue dress", after: "bath towel" },
         { op: "leave", name: "Aqua", before: {...}, after: {...} }, ... ],
  skipped: [ "raw line that failed to parse", ... ],
  orphan: false                           // message deleted in cleanup, effects kept
}
```
- Entries with `source: "user"` (manual edits) have no `uid` and are never undone by chat events.
- **Active entries** = entries whose message exists **and** whose `swipe` is the message's current `swipe_id`, plus orphans, plus user entries.
- **Current state** = `checkpoint` + active entries applied in `seq` order. The result is memoized and recalculated only when the journal or active set changes.
- **State at message N** (for that message's card) = `checkpoint` + active entries with `seq ≤ N.seq`. Memoized per seq.

### 4. Checkpointing
When the journal holds more than **`journalDepth`** (default 200) message-backed entries, the oldest active ones are folded into `checkpoint` and removed, along with inactive swipes older than that. User entries are folded the same way.

Limitation (documented): rewinding or branching more than `journalDepth` AI messages back can't undo folded changes. The user gets a toast and can fix things in the editor.

### 5. Module interface (generic, so Bonds etc. plug in later)
```js
StateModule = {
  id: "world",
  empty(): State,
  applyOps(state, ops): State,              // pure
  parse(text, state, ctx): { ops, skipped, kind } | null,   // reply text → ops
  renderForPrompt(state, ctx): string,      // <Current_World_State> injection
  renderCard(state, entry): string,         // markdown for the in-chat card
  instructions(state, ctx): { rules, template },  // what the model is asked to write
}
```
Only `world` is implemented in this task.

### 6. World State data model
```js
WorldState = {
  scene: { time: "", location: "", weather: "" },
  pcName: "",                               // persona name at bootstrap; PC = cast[pcName]
  cast: {                                    // everyone ever seen, keyed by display name
    "Aqua": {
      present: true,                         // in the scene right now
      fields: { outfit, position, condition, carrying, mood, agenda, secret, ...custom },
      offscreen: "",                         // where they are / what they're doing when not present
      lastSeenSeq: 41                        // seq of the last message that touched them
    }
  },
  threads: [ "..." ], seeds: [ "..." ], timers: [ "..." ],
  arcPhase: "", scenePhase: ""
}
```
- Leaving the scene (`- Aqua`) sets `present: false` and fills `offscreen`. **Fields are kept**, which gives the "last known outfit when she returns" behaviour.
- Names are matched case-insensitively, after stripping markdown, emoji and wrapping quotes. Nothing fuzzier than that. The prompt always shows the model the exact stored names, so it reuses them. Near-duplicate names (e.g. "Matt" arriving while "Matthew" exists) are flagged in the skipped/⚠ list, not merged. Aliases are left to the Image Gen task (006).
- Fields are open-ended. If the user adds a "Hunger" field to the template, `Aqua.Hunger: starving` is stored and rendered generically.
- `{{user}}`, `PC`, `User` and the persona name all resolve to `pcName`.

## Every user action and what the store does

| # | User action | ST event(s) | Store behaviour |
|---|---|---|---|
| 1 | Send message | `MESSAGE_SENT` | Nothing (user messages don't carry blocks). |
| 2 | AI reply arrives | `MESSAGE_RECEIVED(id, type)` | Stamp uid/seq; parse; add entry for `(uid, swipe_id)`. |
| 3 | Swipe right → new swipe generated | `MESSAGE_SWIPED` then `MESSAGE_RECEIVED(id,'swipe')` | On SWIPED: the new swipe has no entry, so the old swipe's entry becomes inactive. The prompt for the new swipe sees the state *before* this message. On RECEIVED: add the new swipe's entry. |
| 4 | Swipe left/right to an existing swipe | `MESSAGE_SWIPED` | Switch the active entry to that swipe's entry. If the swipe has no entry yet (generated before this feature), parse its text now. |
| 5 | Delete a swipe | `MESSAGE_SWIPE_DELETED {messageId, swipeId, newSwipeId}` | Drop that swipe's entry and shift the `swipe` index of higher entries down by 1. |
| 6 | Regenerate last reply | `MESSAGE_DELETED(len)` → `MESSAGE_RECEIVED(id,'normal')` | Delete = rewind of the tail → undo. The new reply gets a new entry. |
| 7 | Continue | `MESSAGE_RECEIVED(id,'continue')` | Reparse the full message; **replace** that swipe's entry. |
| 8 | Stop generation mid-reply | `MESSAGE_RECEIVED` (partial) | Parse what exists. In an unclosed block, the last line is dropped (it may be cut off). |
| 9 | Edit an AI message | `MESSAGE_EDITED(id)` | Reparse; replace the current swipe's entry. Later entries are re-applied on top. |
| 10 | Edit a user message | `MESSAGE_EDITED(id)` | Ignored. |
| 11 | Delete last message(s) / delete-mode tail | `MESSAGE_DELETED(len)` | Diff the uids still in the chat against the journal. A missing uid with **no surviving stamped message after it** = rewind → drop the entry (undo). |
| 12 | Delete an **old** message (later messages remain) | `MESSAGE_DELETED(len)` | Missing uid **with** later survivors = cleanup → mark `orphan: true`; effects kept. Toast: "State changes from a deleted message were kept · Undo". |
| 13 | Hide / unhide messages (`/hide`) | none relevant (`is_system` flips) | Nothing. Hidden messages keep their entries. |
| 14 | Summarize (Megumin memory, Qvink, ST Summarize) | none | Nothing. State doesn't depend on message text after parsing. |
| 15 | Reload page / reopen chat | `CHAT_CHANGED` / `CHAT_LOADED` | Load from `chat_metadata`, then **reconcile**: run the rule from #11/#12 over uids missing from the chat. Catches deletions made while the extension was off. |
| 16 | Switch to another chat | `CHAT_CHANGED` | Drop the in-memory cache; load the other chat's store. Every write checks the chat identity captured when the event fired (`meguminActiveDataIdentity`) and is dropped if the chat changed. |
| 17 | Create branch / checkpoint | new chat created with copied `chat_metadata` | On open, reconcile (#15). Tail uids are missing, so those entries are undone. Limitation: changes already folded into the checkpoint (older than `journalDepth`) can't be undone; toast + editor. |
| 18 | Rename chat | `CHAT_RENAMED` | Nothing (the store lives inside the file). |
| 19 | Import a chat file | open → #15 | Works if the file has `megumin_state`; otherwise legacy import (see Migration). |
| 20 | Group chat | `MESSAGE_RECEIVED` per speaker | Same as #2. One store per group chat. The PC is the persona. |
| 21 | Greeting / alternate greetings | `MESSAGE_RECEIVED(0,'first_message')`, `MESSAGE_SWIPED(0)` | Parse the greeting like any AI message (supports cards whose greeting contains a `<World_State>`). |
| 22 | `/sendas`, `/sys`, `/comment`, `/send` | `MESSAGE_RECEIVED(id,'command')` | Parse only non-user, non-system messages. `insertAt` in the middle gets a new seq that sorts after existing ones; documented edge case. |
| 23 | Impersonate | no message until sent | Nothing. |
| 24 | Quiet prompts (image gen, story director, Chomusuke) | not in chat | Nothing. |
| 25 | Manual edit in the World State editor | UI | Add a `source:"user"` entry at the current seq. Never undone by chat events. Can be deleted from the editor's history list. |
| 26 | "Revert this message's changes" (card button) | UI | Mark that entry `disabled: true` (treated as inactive). Toggle back to re-enable. |
| 27 | "Rewrite full state next reply" | UI | Set `pendingFullRewrite`. The next prompt asks for a full `<World_State>`; the result is a `snapshot` entry; the flag clears when it lands. |
| 28 | "Reset world state" | UI | Two-step confirmation in the page (no `confirm()`). Clears checkpoint and journal; the next reply bootstraps. |
| 29 | World State block turned off in the block stack | settings | The store is kept but not injected or updated. Turning it back on resumes from the stored state. |
| 30 | Extension disabled then re-enabled | — | On the next load, reconcile (#15) catches any deletions made meanwhile. Replies received while disabled are **not** parsed retroactively. The editor has an "Import updates from messages N–M" action. |
| 31 | Profile "Sync Tab Globally" | `sync.js` | Only settings sync; the store is chat content and never syncs. |
| 32 | Two browser tabs on the same chat | — | Not supported, same as ST itself. Last write wins. |

## Model misbehaviour and what the parser does

| Model output | Handling |
|---|---|
| No block at all | Entry with `ops: []` and a `missing: true` flag (shown as a faint "no update" note on the card). The state stays as it was. |
| `No changes` / `none` / empty block | Valid, `ops: []`. |
| Full `<World_State>` when an update was asked for | Accepted as a `snapshot` entry (replaces the world module, undoable). |
| `<World_Update>` when no state exists yet | Applied to an empty state (partial bootstrap). The next prompt asks again for any missing basics (location, PC outfit). |
| Both blocks in one reply | `World_State` wins, then `World_Update` is applied on top. |
| Several `<World_Update>` blocks | Applied in order. |
| Block inside a code fence, `<details>`, bold or bullets | Fences, wrappers, bullets (`* - • >`) and bold/italic markers are stripped before parsing each line. |
| Block inside `<think>` | Ignored (think is stripped first). |
| Unclosed block (cut off) | Parsed; the last line is dropped. |
| Placeholder left in, e.g. `[New clothing if changed]` | Skipped. |
| `unchanged`, `same`, `no change`, `n/a`, `—`, `-`, `none` as a value | Skipped (the field keeps its old value). |
| Field synonyms: clothes/clothing/attire/wearing → outfit; pose/posture/location-in-scene → position; status/state/injuries → condition; items/holding/inventory → carrying; emotion/feeling → mood; goal/intent → agenda | Mapped. Unknown field names are stored as custom fields. |
| `Aqua's outfit: towel`, `Aqua - Outfit: towel`, `Aqua | Outfit: towel` | Accepted as `Aqua.Outfit`. |
| `- Aqua (storms off)`, `**- Aqua**`, `- Aqua: went upstairs` | Departure of `Aqua`. The text after it becomes her `offscreen` value. |
| `+ Darkness` then fields; or `+ Darkness: Outfit=armor; Mood=eager` | Arrival plus fields. |
| Field for someone not in the cast and without `+` | Treated as an implicit arrival (present = true) and noted in `skipped` as info, not an error. |
| Old markdown format (`**Aqua:**` / `* *Outfit:* …`, `**📅 Time:** … \| **🌤 Loc:** …`) | Handled by the rewritten **legacy parser**, which uses exact label matching (never `includes("loc")`). Needed for imports and for models that ignore the new format. |
| Name containing "Loc", "Time", "Temp", "Seed", "Thread" | Safe: section labels are matched exactly against a fixed list after stripping emoji and markdown. |
| Echoed HTML comment / instructions | Lines inside `<!-- -->` are dropped, including comments spanning several lines. |
| Full-width colon `：`, extra spaces, trailing punctuation | Normalized. |
| Anything else | Kept verbatim in `skipped` and shown in the ⚠ chip. |

## Prompts sent to the LLM

**Framing rule (applies to every prompt the storytelling model sees, now and in future modules):** the model only knows it is telling a story with {{user}}. Prompts never mention the extension, an app, a system, a database, a ledger, "the interface", or anyone keeping records for it. State is presented as *continuity notes for the story*, and updates as *recording what this reply changed*. The side-model prompt (D) is a separate task call, so it may describe its own job, but it also never mentions the extension.

All prompts use ST macros (`{{user}}` resolves to the persona name). The field list comes from the World State module config (defaults below), so a user-added field appears in every prompt automatically.

### A. Current state injection — `[[infoblockcurrent]]` (every turn once state exists)
Budget: present cast in full; off-screen as one line each; returning characters only when relevant.
```
<Current_World_State>
<!-- Continuity notes: where the story stands right now, before your reply. Keep your reply consistent with them. Never copy this block into your reply. -->
Time: Late evening, Day 3
Loc: Axel, guild hall tavern
Wx: Heavy rain, warm lamplight inside

{{user}} (PC)
  Outfit: green cape, travel leathers
  Position: seated at the corner table
  Condition: tired, rain-soaked
  Carrying: coin pouch, short sword

Present
  Aqua
    Outfit: blue dress, detached sleeves
    Position: leaning on the bar
    Mood: smug on the surface, quietly afraid of being left behind
    Agenda: win back the faith of her followers and prove she is still a real goddess
    Secret: gave the party's rent money to the Axis Cult
  Darkness
    Outfit: full plate armor
    ...

Off-screen
  Wiz: restocking her shop
  Megumin: practicing explosions outside town

Returning (not in the scene; last known, use only if they reappear)
  Sara: green sundress, straw hat; left for the market 94 messages ago

Threads
  - Who stole the guild's coin
  - The unpaid debt to the landlord
Seeds
  - A strange coin with a demon crest (hints at the Demon King's scouts)
Timers
  - Landlord comes to collect: 2 turns
Arc: Escalation | Scene: Building
</Current_World_State>
```
"Returning" includes an absent cast member whose name (case-insensitive, whole word) appears in the last user message or the last two messages. With `Injection detail = Scene only`, Threads, Seeds, Timers, Arc, Scene, Mood, Agenda and Secret are left out.

### B. Update request — goes inside the `<Blocks>` envelope when state exists
Rules go in a short section **above** `<Blocks>` (the envelope gains an optional per-block `rules` string). The block template itself stays tiny, so models don't echo instructions back.

Rules text:
```
## World Update rules
<Current_World_State> is where the story stands before your reply. In <World_Update>, record ONLY what your reply changed, one change per line, using these forms:
Time: <new time>
Loc: <new place>
Wx: <new weather>
<Name>.<Field>: <full new value>        Fields: Outfit, Position, Condition, Carrying, Mood, Agenda, Secret
+ <Name>                                someone enters the scene; follow with their Outfit, Position, Mood, Agenda, Secret lines
- <Name>: <where they went or what they are doing now>
Offscreen: <Name> = <where they are / what they are doing>
Thread+: <new tension>        Thread-: <resolved tension, copied as written>
Seed+: <foreshadowing detail>   Seed-: <paid-off seed>
Timer+: <consequence: turns left>   Timer-: <expired timer>
Arc: <Setup/Escalation/Complication/Crisis/Resolution>
Scene: <Early Simmer/Building/Midpoint Tension/Climax/Breather>
- Use names exactly as they appear in <Current_World_State>. {{user}} is written as {{user}}.
- Give the complete new value of a changed field. Never write "unchanged" or "same"; leave unchanged fields out.
- Clothing changes matter: if anyone's clothes changed at all (removed, torn, wet, swapped), write their new Outfit.
- Outfit, Position, Condition, Carrying, Time, Loc and Wx follow the scene moment to moment.
- Mood, Agenda, Secret and Threads are the story's deep currents, and they hold steady across many scenes. Mood is a character's underlying state, not a passing reaction; flickers of emotion belong in your prose. An Agenda is the big goal that drives a character through the story, and it changes only when the story truly turns it: achieved, abandoned, or overturned. A Secret changes only when it is exposed or a new one is born. A Thread closes only when the story answers it. A small moment is never a reason to rewrite them.
- If nothing changed, write exactly: No changes
```
Template inside `<Blocks>`:
```
<World_Update>
[change lines, or: No changes]
</World_Update>
```

### C. Bootstrap / full rewrite — inside `<Blocks>` when the store is empty or `pendingFullRewrite` is set
Rules above `<Blocks>`:
```
## World State rules
In <World_State>, record the scene as it stands at the END of your reply, one fact per line, in the exact forms shown. List every character physically present with a "+ <Name>" line followed by their fields. Only what a camera could see goes in Outfit, Position and Condition. Mood, Agenda, Secret and Threads are the story's deep currents: write them as things big enough to carry a character, and the story, through many scenes to come.
```
Template:
```
<World_State>
Time: [date, day, time of day]
Loc: [place, region]
Wx: [weather, temperature, lighting]
{{user}}.Outfit: [clothing, accessories, state of dress]
{{user}}.Position: [posture, where in the space]
{{user}}.Condition: [visible injuries, exhaustion, sweat]
{{user}}.Carrying: [what is in hands, pockets, bag]
+ [NPC Name]
[NPC Name].Outfit: [clothing]
[NPC Name].Position: [posture, where in the space, what they are doing]
[NPC Name].Mood: [their underlying emotional state, what sits beneath the moment, not a passing reaction]
[NPC Name].Agenda: [the big goal that drives them through the story, e.g. "earn back her family's name", never a small errand like "order a drink"]
[NPC Name].Secret: [something that would change how others see them, or shift the story, if it came out]
(repeat "+ [NPC Name]" and its fields for each character present)
Offscreen: [NPC Name] = [where they are, what they are doing]
Thread+: [a major tension or open question the story will have to answer, 3 to 5 lines total]
Seed+: [foreshadowing detail — what it hints at]
Timer+: [consequence — turns remaining]
Arc: [Setup / Escalation / Complication / Crisis / Resolution]
Scene: [Early Simmer / Building / Midpoint Tension / Climax / Breather]
</World_State>
```
This replaces the markdown template in `data/blocks.js` (`id: "info"`) for the model. The **card** keeps today's markdown look because `renderCard()` draws it from the store. The existing "compact World State" option (`compactEnabled` / `fullFreq`) is removed; its job (saving tokens) is done by delta updates plus `Injection detail`.

### D. Side-model extraction (optional mode, via Chomusuke) — replaces B in the main prompt
In this mode the main prompt gets only A (no `<World_Update>` request). After each reply, `runWithChomusuke("worldState", …)` sends:

System:
```
You are a continuity clerk for an ongoing roleplay. You read the latest story passage and record what changed in the physical world. You never write story, never explain, and never add facts the passage does not state or clearly show.
```
User:
```
<Current_World_State>
…(prompt A output)…
</Current_World_State>

<Latest_Passage>
…(the new AI reply, blocks and <think> stripped)…
</Latest_Passage>

Write a <World_Update> listing only what the passage changed, using exactly these line forms:
…(the rules list from B, verbatim)…
Output only the <World_Update> block.
```
Prefill (when prefill is allowed): `<World_Update>\n`.
The result is parsed with the same parser and stored as a `source:"sidemodel"` entry keyed to the reply's `(uid, swipe)`, so swipe and undo behave the same. If the call fails, the entry is saved with `missing: true` plus a toast offering Retry.

## Settings the user can change (World State section of the Blocks tab)
| Setting | Options | Default |
|---|---|---|
| World State block | on / off (existing block-stack toggle) | as today |
| Update mode | **Inline** (main model writes `<World_Update>`) · **Side model** (Chomusuke extracts after each reply) · **Manual** (inject only; changes come from the editor) | Inline |
| Injection detail | **Full** · **Scene only** (time, place, weather, PC + present cast outfit/position/condition) | Full |
| Show returning characters | on / off | on |
| Show "Changed" strip on cards | on / off | on |
| Undo window (journal depth) | 50–1000 AI messages | 200 |
| World State fields | the existing field editor, now feeding prompts A–D and the card | Outfit, Position, Condition, Carrying (PC) · + Mood, Agenda, Secret (NPC) |
| Custom prompts | override the rules texts for B, C and D (existing custom-prompt pattern) | off |

Editor (button on the World State card and in the Blocks tab):
- Edit any scene or character field inline.
- Add a character, remove one, toggle present/absent.
- History list: one row per journal entry (message #, source, changes), with disable/enable per entry and delete for user entries.
- "Rewrite full state next reply", "Import from messages N–M", "Reset" (two-step confirm).

## Migration
1. **Settings cleanup:** on load, `localProfile.worldState.current` / `history` in `settings.json` are **ignored and deleted**. They were per character and unreliable. `saveProfileToMemory` / `flushProfileSettingsToLoadedKey` strip `worldState` except settings keys (`updateMode`, `injectionDetail`, …).
2. **One-time chat import** (when `megumin_state` is missing and `imported` isn't set):
   - Walk the chat from the start. Take the **last** message containing `<World_State>` (legacy markdown or new format) as a `snapshot` entry with `source:"import"`, then apply each later `<World_Update>` in order as `import` entries. Each is stamped with its message uid/seq, so undo works for them too.
   - If nothing is found, leave the store empty. The next reply bootstraps.
   - Set `imported: true` and save.
3. **Card rendering for old messages** without entries: they show the state as of the nearest earlier entry, like today.

## Consumers to switch over
| Consumer | Change |
|---|---|
| `src/engine/buildBaseDict.js` (`[[infoblockcurrent]]`, compact logic) | Use `world.renderForPrompt()`; delete the compact block. |
| `src/features/blocks/registry.js` (`buildBlocksEnvelope`, `world` / `worldUpdate`) | Ask for B or C via `world.instructions()`; add per-block `rules` above `<Blocks>`; omit in Side-model / Manual mode. |
| `src/features/blocks/chat.js` (`meguminDecorateMessageBody`) | `worldStateText` from `renderCard(stateAt(seq), entry)` plus the Changed strip and ⚠ chip. |
| `src/blocks/render.js` | Unchanged interface. `World_Update` is still swapped for the full card. |
| `src/features/imagegen/index.js`, `src/features/npc/data.js` | Temporary adapter `getWorldStateCurrent()` returning the old shape (`location`, `weather`, `dateTime`, `pc{…}`, `npcOutfits` from the **present** cast) until Image Gen is redone in 006. |
| `src/core/profile.js` (`pruneFutureData`, defaults, save/strip) | Remove `worldStateRollbackHistoryFrom`; the store reconciles itself. Strip state from settings. |
| `index.js` (MESSAGE_RECEIVED / SWIPED / DELETED handlers) | Replace the inline ledger code with `stateStore.onReceived/onSwiped/onSwipeDeleted/onEdited/onDeleted/onChatLoaded`. |
| `src/features/blocks/ui.js` | Remove compact toggle; add the settings above plus the editor button. |

## In scope
1. `src/state/store.js`: generic store (load/save to `chat_metadata`, stamping, journal, active-entry resolution, memoized fold, checkpointing, reconcile, chat-identity guard, `saveMetadataDebounced`).
2. `src/state/events.js`: ST event wiring for every row of the user-action table.
3. `src/state/modules/world/`: `model.js` (empty/applyOps), `parse.js` (line-format parser + rewritten legacy markdown parser), `render.js` (prompt A, card), `instructions.js` (B, C), `sidemodel.js` (D).
4. Migration and settings cleanup.
5. Switching over every consumer in the table above.
6. Editor UI and settings.
7. Tests (see Test plan). Node-runnable, no ST needed for parser/model/store logic.

## Out of scope (explicitly NOT done)
- Bonds / Character Sheet / other modules. The interface is ready; each is its own task.
- Image Gen rework (task 006), including character aliases. The name-matcher from task 004 is **no longer used by world state**; 006 decides whether it stays.
- Folding the NPC Bank's own update history (`npc/updates.js`) into the store. Worth doing later; not now.
- Multi-tab concurrency.
- The side panel (`src/sidepanel/*`). Not updated or integrated in this task; it keeps its current behaviour.

## Test plan
**Parser** (`tests/world-parse.test.mjs`): every row of the misbehaviour table, plus the 13 cases from the evidence run below, plus:
- Names containing `Loc`, `Time`, `Temp`, `Seed`, `Thread`.
- Full-width colon, CRLF line endings, emoji labels.
- Truncated block; nested `<details>`; code fence.
- Legacy full markdown `<World_State>` (the current `data/blocks.js` template filled in), with and without 🧍 / 👥, with `**NPCs:**`, and with compact NPC lines `* **Aqua:** blue dress, by the bar`.

**Store** (`tests/store.test.mjs`) with a fake `chat` array and fake `chat_metadata`. Simulate:
- Receive → swipe new → swipe back → swipe forward; delete swipe 0 of 3.
- Regenerate; continue; edit an AI message in the middle (later entries still apply on top).
- Delete the tail (undo); delete a middle message (orphan kept); `/hide` (nothing).
- Reload (round-trip through JSON); branch (truncated copy of chat + metadata).
- Journal beyond `journalDepth` (fold + correct state); chat switch mid-event (write dropped).
- Leave + return after 90 messages (fields kept; "Returning" line appears when named).

**Manual in ST:** a fresh chat bootstrap; the reload bug scenario (outfit visible in Image Gen after F5); swipe storm; branch; old chat import.

## Risks & open questions
- *The model ignores the line format and keeps writing markdown.* The legacy parser still handles it, and the ⚠ chip makes failures visible. Side-model mode is the fallback for weak models.
- *`extra` stamping and other extensions:* we only add two keys under `extra`; ST and other extensions keep unknown keys.
- *Chat file size:* about 200 entries × ~300 bytes ≈ 60 KB worst case, which is acceptable. Depth is configurable.
- *Mid-chat inserts via `/sendas at=`* get a seq that sorts after later messages. This is rare and documented; the editor can fix the result.
- **Decided:** `Mood / Agenda / Secret` stay default NPC fields. The prompts frame them, and Threads, as slow-moving deep currents (big goals, meaningful secrets, underlying mood) so the model rarely rewrites them. No hard turn-count rule is given to the model.
- **Decided:** the `<World_Update>` block is **always required**, with `No changes` when nothing changed. A missing block is then a detectable model slip (faint "no update" note on the card) rather than silently read as "nothing happened". It costs about 5 tokens per quiet turn.

## Evidence (current parser, run 2026-09-26)
| Input | Result |
|---|---|
| NPC `Lockhart` with outfit | whole update discarded (read as Location header) |
| NPC `Templar Knight` | whole update discarded (read as Weather) |
| `**⏳ Consequence Timers:** guards arrive in 2 turns` | scene time set to "guards arrive in 2 turns" |
| `Outfit: unchanged` | outfit becomes "unchanged" |
| `**- Aqua** (storms off)` | creates character "- Aqua" |
| `- Aqua (left the tavern)` | tries to remove "Aqua (left the tavern)"; Aqua stays |
| `*Outfit:* blue dress` (no bullet space) | outfit lost |
| `**Aqua:** now wearing a towel` | outfit lost |
| Echoed `<!-- blueprint -->` comment | removes a character named `>` |
| `<World_State>` without 🧍 or with `**NPCs:**` | PC name empty; all NPC outfits lost |
| Compact NPC line `* **Aqua:** blue dress` | NPC outfit lost |
| `settings.json` | `Gin.png` holds a `{rawText}`-only stub; `Matt.png` holds state with no `npcOutfits` and no bootstrap entry, stored under the character key |

## Progress
- **Phase 1 (d950867):** store, world parser, world model, 61 node tests.
- **Phase 2:** wired into SillyTavern.
  - `src/state/index.js` bridges ST ↔ store (adapter over `chat_metadata`, events, prompt/card/compat accessors).
  - `src/state/modules/world/render.js` renders prompt A, instructions B/C and the card markdown (round-trip tested against `src/blocks/treatments.js`).
  - Envelope rules now sit above `<Blocks>`.
  - Old `features/worldstate/ledger.js` + `parser.js` removed. Profiles drop `worldState.current/history` on load.
  - The compact-mode toggle is replaced by Updates (Inline/Manual), Detail (Full/Scene only), "Rewrite next reply" and "Reset" under the World State row.
  - Side-model mode (D) is not exposed yet (phase 4).
- **Phase 3 (next):** card "Changed" strip + ⚠ chip, World State editor, history list.
