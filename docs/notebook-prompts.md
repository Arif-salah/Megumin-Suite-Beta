# Notebook prompts: every text the Author's Notebook sends to a model

Generated from the code on 2026-10-17, so every text below is exactly what is sent today.

**How to use this file:** edit the text inside the ```text blocks directly, or write notes under a block (start them with `NOTE:`). Keep the `{{placeholders}}` unless you mean to drop them: the code fills them in. When you're done, send the file back and I'll move the changes into the code.

Parts marked **(example: built from made-up data)** only show how the pieces fit together. Don't edit those; edit the pieces they're built from.

## When each text is sent

- **Where the rules sit:** N2, N4 and N5 go in the blocks request ABOVE the line "At the end of your response, output exactly one <Blocks> section", under "These rules say how to fill the blocks below. Follow them; never write them out." The block skeletons sit right under that line, inside `<Blocks>`. The rules are headings, never tags, so the model has nothing to copy.

- **Notebook off:** nothing. `[[notebook]]` is empty. (It is always on for a preset that keeps one, V11.)
- **Setup** (on, no live truth yet): N2 goes in the blocks request; the reply writes a `<Notebook>` block.
- **Running** (at least one live truth): N3 goes in `<Current_Info>`, N4 in the blocks request.
- **Chomusuke route on** (Chomusuke tab → The Notebook): the story model gets N5 instead of N4, and Chomusuke reads each reply with N6 (or N7 inside the combined call).
- **N1** fills `[[notebook]]` while the notebook is on, for engines that carry that placeholder. V11 has its own text and doesn't use it.

## N1. The craft text, `[[notebook]]`
_Code: `src/prompts/notebook.js → NOTEBOOK_CRAFT`_

```text
<The_Notebook>
The story keeps an author's notebook: the truths it holds back about the world, its past, or the people in it. Keep the story consistent with every entry. The notebook belongs to you, not to the reader or the characters, and a truth reaches the page only when it comes out.

A good truth comes from the setting and the sheet, and once it comes out it changes how earlier scenes read.

Plant clues before a reveal. A clue is small and could mean something else, and most turns carry none. Narration knows the truth and still gives away no more than the scene shows. Characters guard a hidden thing, avoid it, or pursue it.

When {{user}} goes where a truth is kept, they find it. Protect a truth by putting it somewhere hard or costly to reach. Refusing {{user}} an answer they're standing in front of breaks the story.

When a truth comes out, the story plays out what it changes. A revealed thing is never dropped.
</The_Notebook>
```

## N2. Setup: the reply writes the notebook
_Code: `src/state/modules/notebook/render.js → renderNotebookSetup`_

```text
## Author's Notebook rules
This story keeps an author's notebook, and it is empty, so you write it this turn.

Write your reply as usual. In <Blocks>, write the Notebook block with two or three truths, built from the character sheet, the setting, and the story so far. Write each one in this form:

T1
Truth: what is actually true, in a few plain sentences, with enough detail that every later clue and the reveal itself can be written from it.
Hidden from: who doesn't know it. Name the characters, and add "the reader" if the story hasn't shown it on the page.
Comes out when: what has to happen in the story for it to come out.
What it changes: who acts differently once it's out, and how.
Clue ideas: two or three small things the story could show that point at it and could also mean something else.

The Notebook block doesn't count toward the reply's length.
```

Template line in the blocks request:

```text
<Notebook>
[two or three truths, each in the form above]
</Notebook>
```

## N3. The notebook the story model reads every turn (example: built from made-up data)
_Code: `render.js → renderNotebookForPrompt`. Goes inside `<Current_Info>`, after the World State notes. Only live truths; "turn" numbers are the extension's own count._

```text
<Author_Notebook>
T1
Truth: The ferryman is Mira's father, who faked his death ten years ago.
Hidden from: Mira, the reader
Comes out when: Mira sees the scar on his hand.
What it changes: Mira stops trusting her mother.
Clue ideas: he refuses her money; he knows her childhood nickname.
Clues planted:
- turn 5: he refuses her coin

Live truths: 1 of 3. Next id: T2.
</Author_Notebook>
```

## N4. Update rules (the story model writes every change)
_Code: `render.js → renderNotebookUpdateRules()`_

```text
## Author's Notebook rules
In <Blocks>, write the Notebook_Update block only if the notebook changed this turn. Most turns it doesn't, and then you leave the block out. The block doesn't count toward the reply's length.

Clue T1: <the clue this turn's story showed>
Learned T1: <who on its Hidden from list found it out this turn>
Truth-: T1      it came out this turn, to everyone it was hidden from
Truth+: T3      a new truth, only while fewer than 3 are live, followed by its lines in the notebook's form

A truth never changes once written. It gains clues and comes out.
```

Template line in the blocks request:

```text
<Notebook_Update>
[change lines; leave this block out when nothing changed]
</Notebook_Update>
```

## N5. Update rules with the Chomusuke route on (the story model only writes new truths)
_Code: `render.js → renderNotebookUpdateRules({ newOnly: true })`_

```text
## Author's Notebook rules
In <Blocks>, write the Notebook_Update block only if the notebook changed this turn. Most turns it doesn't, and then you leave the block out. The block doesn't count toward the reply's length.

Truth+: T3      a new truth, only while fewer than 3 are live, followed by its lines in the notebook's form

A truth never changes once written. It gains clues and comes out.
```

Template line in the blocks request:

```text
<Notebook_Update>
[a new truth with its lines; leave this block out when there is none]
</Notebook_Update>
```

## N6. Chomusuke's read, on its own call
_Code: `src/state/modules/notebook/worker.js → NOTEBOOK_WORKER_SYSTEM, renderNotebookClerkTask, renderNotebookWorkerPrompt`_

**System**

```text
You keep the author's notebook of an ongoing story: the truths it is hiding, the clues it plants, and who finds what out. You never continue the story and never explain. You note only what the exchange shows on the page.
```

**User (example: built from made-up data)**

```text
<Author_Notebook>
T1
Truth: The ferryman is Mira's father, who faked his death ten years ago.
Hidden from: Mira, the reader
Comes out when: Mira sees the scar on his hand.
What it changes: Mira stops trusting her mother.
Clue ideas: he refuses her money; he knows her childhood nickname.
Clues planted:
- turn 5: he refuses her coin

Live truths: 1 of 3. Next id: T2.
</Author_Notebook>

<Earlier_Story>
{{earlier messages}}
</Earlier_Story>

<Latest_Exchange>
{{the latest exchange}}
</Latest_Exchange>

# Task
<Notebook_Update_Rules>
<Author_Notebook> holds the truths the story is hiding, as they stood before the latest exchange. Read the latest exchange and write a <Notebook_Update> block with what it did to them. Most exchanges do nothing to them; then the block holds the single line No changes.

Clue T1: <the clue the latest exchange showed>
Learned T1: <who on its Hidden from list found it out in the latest exchange>
Truth-: T1      it came out in the latest exchange, to everyone it was hidden from

A clue counts only when the exchange shows it on the page. Use the truths' own ids. A truth never changes once written: you don't write new truths or rewrite them.
</Notebook_Update_Rules>

# Answer with this block and nothing else
<Notebook_Update>
[change lines, or No changes]
</Notebook_Update>
```

Chomusuke's `Truth+` lines, if it writes any, are dropped: only Clue, Learned and Truth- are kept.

## N7. Chomusuke's read inside the combined call (example: notebook task only)
_Code: `src/features/imagegen/v2/prompt.js → renderCombinedPrompt` with `notebook`. With World State, the blocks or an image in the same call, their tasks come first and the notebook is the last task._

**System**

```text
You follow an ongoing roleplay. You read the latest exchange and keep the author's notebook (the clues it shows, who finds out a hidden truth, what comes out). You never continue the story, never explain, and never add facts the exchange does not state or clearly show.
```

**User**

```text
<Author_Notebook>
T1
Truth: The ferryman is Mira's father, who faked his death ten years ago.
Hidden from: Mira, the reader
Comes out when: Mira sees the scar on his hand.
What it changes: Mira stops trusting her mother.
Clue ideas: he refuses her money; he knows her childhood nickname.
Clues planted:
- turn 5: he refuses her coin

Live truths: 1 of 3. Next id: T2.
</Author_Notebook>

<Latest_Exchange>
{{the latest exchange}}
</Latest_Exchange>

# Task 1: The author's notebook
<Notebook_Update_Rules>
<Author_Notebook> holds the truths the story is hiding, as they stood before the latest exchange. Read the latest exchange and write a <Notebook_Update> block with what it did to them. Most exchanges do nothing to them; then the block holds the single line No changes.

Clue T1: <the clue the latest exchange showed>
Learned T1: <who on its Hidden from list found it out in the latest exchange>
Truth-: T1      it came out in the latest exchange, to everyone it was hidden from

A clue counts only when the exchange shows it on the page. Use the truths' own ids. A truth never changes once written: you don't write new truths or rewrite them.
</Notebook_Update_Rules>

# Answer in this shape and nothing else
<Notebook_Update>
[change lines, or No changes]
</Notebook_Update>
```
