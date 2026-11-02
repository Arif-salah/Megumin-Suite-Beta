# 022: One scene list, one name finder

Status: **planned**. Prompt texts agreed with the developer on 2026-11-02.

## Why

- **Four name finders that disagree.** World State (`world/model.js`:
  `resolveCastKey`, `matchCastPrefix`, `namedIn`, `staleStep`), Bonds
  (`stats/model.js`: `findPersonKey`, `pickBondsFor`, `findByNickname`,
  `surnameOf`, `nameCandidates`) and Image V2 (`imagegen/v2/cast.js`) each
  match names their own way. A fix in one (possessives, brackets, surnames,
  `fae1186`, `63087bb`) doesn't reach the others, and "Same person as"
  merges live only in World State.
- **Who is in the scene is guessed.** World State reads `+ <Name>` /
  `- <Name>` lines, and models forget the `-` line, so people linger (the
  plan 020 `LEAVING_UPDATE` patch, the "full scene every reply" mode). Bonds
  guesses from the last 3 messages. Each guess fails differently.
- **Off-screen fills up with people who just walked out**, since every
  `- <Name>: …` line moves someone there.

The fix: the story model lists the scene in one short block every reply,
with Chomusuke on or off, using the names we hand it. One finder matches
those names for every module.

## The prompts (agreed)

### Scene rule: `<block_rules>` (V11 cached top part)

```
## Scene
List the characters in the scene at the end of your reply, {{user}} left out.
Here: names of those physically there, separated by commas, or: nobody
Remote: names of those talking with {{user}} by phone, video or text right now, or leave it empty
Write each name as it is written in <Known_Names>, and use the same names in every other block. Someone not in <Known_Names> goes in under the name the story gives them, with + before it, e.g. +Mira. Only characters count (people, or beings who speak and act), and leave out anyone the story hasn't given an actual name yet.
```

Older presets (no `<block_rules>`): the same text in brackets above the
`<Scene>` line in the Blocks template, the way Bonds carries its rules.

### Line to fill in: first block inside `<Blocks>` in `<turn_notes>`

```
<Scene>
Here: [names, or: nobody]
Remote: [names, or leave empty]
</Scene>
```

First, so every later block (Bonds, World Update, Chatter) is written with
the names already set.

### `<Known_Names>`: in `<Current_Info>` (after the chat, no cache cost)

```
<Known_Names>
The names to use for the story's characters, one for each.
Lona, Kade, Mira, Maya, Duncan, Cathleen, Matt Reyes, Matt Cole, Dom
</Known_Names>
```

- One name per person: the shortest form the finder (phase 1) resolves to
  that person alone ("Matt" is two people, so "Matt Reyes", "Matt Cole").
- Order: last reply's Here and Remote first, then most recently seen.
- At most 30 names (about 130 tokens).
- One flat list, not split into "In the scene" / "Others": see the plan
  check below.

### World State update rules (`world/render.js`)

- Removed: the `+ <Name>` and `- <Name>: …` rule lines, `LEAVING_UPDATE`,
  `WHO_COUNTS` (moved into Scene), the `+` part of `carryOver`.
- Added where the `+` line was:
  `Who is in the scene comes from <Scene>. Someone new in <Scene> gets their Outfit, Position, Mood and Agenda lines here.`
- Off-screen rules get:
  `Offscreen is only for someone away from the scene who is doing something the story will come back to.`
- `OFFSCREEN_UPDATE`: "(with Offscreen: or "- <Name>: …")" → "(with Offscreen:)".
- Bootstrap: fields per character, without the `+` in front.
- The parser keeps reading `+` / `-` lines, so old chats replay as before.

### Chomusuke

`<Known_Names>` goes into its notes. One line in every read task (World
State, Bonds, Notebook, combined call):
`Write every name as it is written in <Known_Names>; someone new gets the name the story gives them.`
Chomusuke reads the reply's `<Scene>`; it never writes one.

## Phases

### Phase 1: One name finder

What the user sees: nothing yet; every name fix so far now works in all
modules at once.

- New pure `src/state/names.js` (tested):
  - `whoIs(people, name)` → key or null. Order: exact name, saved nickname
    or merge, name in brackets ("Dominic" for "Dom (Dominic Morin)"), the
    one first name, the one surname, the one whole-word prefix ("Resha" ↔
    "Resha Helios"), possessives dropped ("Chloe's"). Two matches → null,
    never a pick.
  - `namedIn(text, people)` → keys named in a text, same rules.
  - `shortName(people, key)` → the shortest form `whoIs` gives back as that
    person alone (for `<Known_Names>`).
- World State, Bonds and Image V2 call it instead of their own matchers.
- Tests: every existing name test passes unchanged, plus a table of cases
  (Matt/Matt Reyes/Matt Cole, Cairns shared, Bathory alone, Cat → Cathleen
  only in the scene, brackets, possessives).

### Phase 2: One list of people per chat

What the user sees: "Same person as" on the World State card also fixes
Bonds and image looks.

- The people in a chat = World State cast + Bonds people + image looks,
  joined by `whoIs`, with merges and nicknames kept once (the merge stays a
  World State user entry, read by every module).
- Old chats: built on load from what is on file; nothing is rewritten.

### Phase 3: The `<Scene>` block

What the user sees: World State's "Present" follows the scene list; people
who walked out no longer pile up in Off-screen.

- `parseScene` (pure): `Here:` / `Remote:` lines, `+Name`, `nobody`, an
  empty `Remote`. Recorded with the reply like any block (store entry on the
  reply's uid/swipe), so Revert, swipes and reloads work.
- Asked for only when a module that needs names is on: World State, Bonds,
  Inner Chatter or Image V2 (rule 2). With only Image V2 on, `<Blocks>`
  holds just `<Scene>`. Not routable to Chomusuke: the story model always
  writes it. Hidden from the AI like every other block.
- Who uses what:
  - World State "Present" = Here. A name gone from Here leaves the scene
    without moving to Off-screen. Remote keeps their own place.
  - Bonds handed = Here + Remote + the latest Bonds block's moved names
    (`movedBondNames`). The last-3-messages guess stays only as the fallback.
  - Image V2 draws Here only.
  - `+Name` on a saved name is matched as usual; no `+` and no match → the
    old guessing.
- No `<Scene>` in a reply (model skipped it, older chat): the old guessing,
  exactly as today (`staleStep`, `pickBondsFor` text scan).
- A user can edit the scene list from the World State editor (user entry).

### Phase 4: World State rules

- The rule changes listed above, in `world/render.js`; `withoutSecret` and
  `withoutLimits` checked against the new text.
- "Full scene every reply" mode: presence comes from `<Scene>`, so "leaving
  someone out is how they leave" stops applying to the cast (still applies
  to Threads, Seeds, Timers).
- `world` module `version` stays: the parser change only adds `<Scene>`.

### Phase 5: `<Known_Names>`

- Built in `buildCurrentInfo` when the Scene block is asked for; same text
  in Chomusuke's notes, plus the task line.
- `docs/notebook-prompts.md` / `docs/image-prompts.md` regenerated.

## Plan check: what the model can't see

- **Story model, someone past the 30-name cap comes back.** It writes them
  as `+Name` or plain. `whoIs` finds the saved person either way, so no
  duplicate. Their bonds weren't handed, so `facts.unsent` (`eaa4f96`) skips
  the made-up numbers; next turn they're in Here and their bonds go in.
- **Story model, the list keeping itself alive.** If `<Known_Names>` said
  "In the scene: Lona, Kade", a model could copy that line into `Here`
  every reply, and nobody would ever leave. So the list is flat (scene
  first, no label): the model has to read its own reply to fill `Here`.
- **Story model skips `<Scene>`.** Old guessing, as today. A skipped Scene
  must never empty the scene.
- **Chomusuke route.** Chomusuke reads the reply and its `<Scene>`; it
  can't add or drop people from the scene, only fill their fields. A name
  it writes that matches nobody stays a new "unannounced" person (card asks
  "Same person as").
- **Manual World State.** The scene list is still read from the reply; the
  user's edits win (user entries).

## Open questions

- Remote and World State: show Remote characters on the card ("On a call:
  Mira")? Leaning yes, one line.
- Inner Chatter: Remote characters' thoughts too? Leaning yes, they speak.

## Progress

- [ ] Phase 1: one name finder
- [ ] Phase 2: one list of people per chat
- [ ] Phase 3: the `<Scene>` block
- [ ] Phase 4: World State rules
- [ ] Phase 5: `<Known_Names>`
