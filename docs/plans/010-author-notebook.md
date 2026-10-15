# 010: Author's Notebook

## Why

A good long story is written by someone who knows things the reader doesn't:
decides the hidden truth early, plants clues for a long time, reveals it when it
changes the most. The story model can't do that today because it has nowhere
to keep a decision. Whatever it decides while thinking is gone next turn, so it
either forgets the truth or blurts it out early.

The notebook gives it that place. The story model decides the hidden truths,
records them, plants clues, and pays them off. The extension stores the
notebook, sends it back every turn, and shows it to the user, spoiler-blurred.

Source design: `Desktop/prompt/AUTHOR_NOTEBOOK.md` (written in the prompt
chat). The prompt texts below come from it; the extension owns the mechanics,
V11 owns the craft.

## What we agreed (2026-10-15)

- **A new state store module** (`src/state/modules/notebook/`), like World
  State and the stats modules. Every block is tied to its message uid/swipe, so
  swipes, deletes and regenerates undo what a reply did, including the setup.
- **Spoilers in the chat are accepted.** The model writes `<Notebook>` and
  `<Notebook_Update>` inside its reply, so they show while it streams. If the
  user wants to hunt for the truth, that's on them. Once the reply is drawn,
  the notebook card is **blurred**; clicking it asks "This shows what the story
  is hiding. Show it?" and only Yes unblurs it.
- **`Secret` is dropped from World State only while the notebook is on**: from
  the update/bootstrap instructions, the Chomusuke read, the notes and the card.
  With the notebook off, World State is unchanged for every engine.
- **V11 turns the notebook on automatically.** The engine has a flag
  (`notebook: true`); picking it turns the notebook on for that profile. The
  craft text reaches the prompt through a new placeholder `[[notebook]]`, which
  is filled while the notebook is on and **cleared (empty)** while it is off, so
  the engine never talks about a notebook that isn't there.
- **The code enforces the rules, not only the prompt:**
  - ids: the extension assigns them. A `new T{id}` that reuses an id gets the
    next free one; it never overwrites a truth.
  - cap: a `Truth+` past 3 live truths is ignored.
  - `Learned` names: exact name, then a unique first name (like Bonds);
    "the reader" is a special name; a name not on the list is ignored.
  - first wins: a second line for the same truth and operation in one block is
    ignored.
  - no edit operation exists: a truth gains clues and comes out, nothing else.
- **Update lines look like World Update** (decided 2026-10-15): `Clue T1:`,
  `Learned T1:`, `Truth+: T3` (new), `Truth-: T1` (came out). The model already
  writes `Thread+`/`Thread-` in the same reply, so the forms are familiar.
  `Truth-` is the direct way to say a truth is out; `Learned` stays for when
  only some people find out (the reader knows, a character still doesn't).
- **Unwritten clues are flagged**: when a `Clue` line shares no words with the
  reply's prose (names and small words don't count), the clue is kept but
  marked in the tab as "not found in the reply".
- **Turn numbers** use the message's stored `megumin_seq`, not its chat index,
  so deleting a message doesn't shift the Past timeline.
- **Pause switch** on the tab: while paused, no setup and no notebook in the
  prompt. Without it, deleting every truth would rerun setup on every reply.
- **Blocks fit the envelope**: `<Notebook>` and `<Notebook_Update>` go inside
  the `<Blocks>` envelope like the other blocks, and are added to the
  hide-blocks tag list so the model never re-reads them in the history.
- **Chomusuke route for clues**: a Chomusuke tab switch (off by default). On:
  Chomusuke reads each finished reply and writes the `Clue`, `Learned` and
  `Truth-` lines, which is more honest than the writer's own claim. The story
  model then only writes `Truth+` lines. Setup and `Truth+` always stay with the story model,
  because it needs the truths while writing. Goes into the combined call when
  "Combine calls" is on.
- **Story Director** isn't used with V11. No code change: it's a per-profile
  switch, and the Story Tracker goes off with it.

## Data model

One entry per hidden truth.

| Field | Written by | Meaning |
|---|---|---|
| id | extension (`T1`, `T2`…) | The model proposes; the extension decides. |
| Truth | model, once | What is actually true. Never changes after it's written. |
| Hidden from | model, then shrinks | Named characters, and "the reader" if the page hasn't shown it. |
| Comes out when | model, once | The story condition for the reveal. Never a turn count. |
| What it changes | model, once | Who acts differently once it's out. |
| Clue ideas | model, once | Planned clues the story can draw on. |
| Clues planted | model (or Chomusuke), appended | One line per clue written, stamped with the reply's seq. |
| Created / revealed | extension | Seq numbers, for the timeline. |

Updates: `Clue T{id}: …`, `Learned T{id}: names`, `Truth+: T{id}` + a full
entry, `Truth-: T{id}`. A truth is revealed by `Truth-`, or when `Learned`
empties its Hidden from list: it leaves the prompt and moves to Past. User edits (tab) are user entries in the store, so they can
change any field; the model can't.

## Phases of the prompt

- **Phase 1, setup**: notebook on, not paused, no live truth. The setup prompt
  is appended; the model writes a full `<Notebook>` after its reply.
- **Phase 2, running**: `<Author_Notebook>` goes into `<Current_Info>` (one more
  section in `buildCurrentInfo`), and the update rules go with the blocks.
- **Back to phase 1** when no truth is live (all came out, or the user deleted
  them), unless paused.

## Prompt texts (from the design; wording belongs to the prompt chat)

Setup:

```
<Notebook_Setup>
This story keeps an author's notebook, and it is empty, so you write it this turn.

Write your reply as usual. After the story, write a <Notebook> block with two or three truths, built from the character sheet, the setting, and the story so far. Write each one in this form:

T1
Truth: what is actually true, in a few plain sentences, with enough detail that every later clue and the reveal itself can be written from it.
Hidden from: who doesn't know it. Name the characters, and add "the reader" if the story hasn't shown it on the page.
Comes out when: what has to happen in the story for it to come out.
What it changes: who acts differently once it's out, and how.
Clue ideas: two or three small things the story could show that point at it and could also mean something else.

The <Notebook> block doesn't count toward the reply's length.
</Notebook_Setup>
```

Notebook (in `<Current_Info>`, no instructions in the wrapper):

```
<Author_Notebook>
T1
Truth: {truth}
Hidden from: {hidden_from}
Comes out when: {condition}
What it changes: {change}
Clue ideas: {clue_ideas}
Clues planted:
- turn {n}: {clue}

Live truths: {live} of 3. Next id: T{next}.
</Author_Notebook>
```

Update rules (the tag differs from the output block on purpose):

```
<Notebook_Update_Rules>
After the story, write a <Notebook_Update> block if the notebook changed this turn. Most turns it doesn't, and then you leave the block out. The block doesn't count toward the reply's length.

Clue T1: <the clue this turn's story showed>
Learned T1: <who on its Hidden from list found it out this turn>
Truth-: T1      it came out this turn, to everyone it was hidden from
Truth+: T3      a new truth, only while fewer than 3 are live, followed by its lines in the notebook's form

A truth never changes once written. It gains clues and comes out.

<Notebook_Update>
[change lines]
</Notebook_Update>
</Notebook_Update_Rules>
```

With the Chomusuke route on, the story model's rules keep only `Truth+`; the
`Clue`/`Learned`/`Truth-` part becomes Chomusuke's task (reworded for a reader of the
reply, like `renderWorldClerkTask`).

`[[notebook]]` carries the craft paragraph (Prompt 4 in the design) while the
notebook is on, and is empty while it's off. Its text comes from the prompt
chat; the extension only decides whether it appears.

## Phases

1. **Pure module**: `notebook/parse.js` (`<Notebook>` entries, update lines,
   `Truth+` with its entry), `model.js` (ids, cap, first wins, name match,
   reveal by `Truth-` or when the list empties, seq stamps, user edits/forget,
   the unwritten-clue check), `render.js` (the
   three prompts, the notes, the card text), tests. Parser tests use the filled
   example from the design, never put in a prompt.
2. **Bridge + prompts**: register the module in the store; phase 1/2 choice;
   `<Author_Notebook>` in Current Info; rules in the blocks envelope; hide-block
   tags; `[[notebook]]` slot (filled/cleared); `Secret` dropped while on;
   engine flag `notebook: true` turns it on; pause switch.
3. **Chat card**: the notebook part of a reply's blocks drawn blurred; click →
   confirm → shown. Revert/Read again like the other cards.
4. **Notebook tab**: Past (timeline: truth, every clue with its turn, the turn
   it came out) and Active (blurred cards with the live count, a warning before
   opening; then read, edit any field, delete, mark revealed). Clues not
   found in their reply carry a "not found in the reply" mark. Pause switch.
5. **Chomusuke route**: switch in the Chomusuke tab; separate read writes
   `Clue`/`Learned`/`Truth-`; story model's rules shrink to `Truth+`; part of the combined
   call when on.
6. **Test + docs** in SillyTavern with V11; `docs/` and CLAUDE.md updated.

V11 itself (the engine's text in `data/`) is the developer's. This plan only
adds the flag and the placeholder; the engine is added when its text is ready.

## Open questions

None yet.

## Progress

- [x] Phase 1: pure module (src/state/modules/notebook/, tests/notebook.test.mjs)
- [x] Phase 2: bridge + prompts (switches in the Blocks tab until the notebook tab exists; craft text = the design draft, src/prompts/notebook.js)
- [ ] Phase 3: chat card
- [ ] Phase 4: notebook tab
- [ ] Phase 5: Chomusuke route
- [ ] Phase 6: test + docs
