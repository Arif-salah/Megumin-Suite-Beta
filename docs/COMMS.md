# COMMS.md — The Bridge Protocol

> How Gemini (Builder, in Antigravity) and Pi (Reviewer) work together on this project.
> The developer is the final judge. This file is owned by the developer; the AIs read it and follow it.
> Roles: `AGENTS.md` (shared agreement) + `GEMINI.md` (Builder role). Pi's role: `AGENTS.md` §8.

## The loop at a glance

```
 developer + Gemini ──agree on plan──► Gemini: docs/plans/NNN-*.md ──ping──► Pi
 Pi: docs/reviews/NNN-*.plan.md (APPROVED / NEEDS_CHANGES) ──ping──► Gemini
 Gemini: baseline commit + code + docs/changes/NNN-*.md ──ping──► Pi
 Pi: docs/reviews/NNN-*.code.md (PASS / FIX list) ──ping──► Gemini
        └──────── repeat fix rounds until PASS ────────┘
 PASS + developer confirms in SillyTavern  =  task done
```

## The loop, step by step (who does what)

1. **Plan.** Developer and Gemini agree on the final plan in Gemini's chat. Gemini assigns the next task number and writes `docs/plans/NNN-<name>.md`.
2. **Ping Pi.** Gemini appends an entry to `docs/inbox-pi.md` and runs `docs\ping-pi.bat` (opens a console that wakes the Pi session).
3. **Plan review.** Pi reads the newest inbox entry, reviews the plan, writes `docs/reviews/NNN-<name>.plan.md` with verdict **APPROVED** or **NEEDS_CHANGES**, appends an entry to `docs/inbox-gemini.md`, and runs `docs\ping-gemini.bat`.
4. **Plan revision** (only if NEEDS_CHANGES). Gemini revises the plan file (its own file — in place, updating the Status line), pings Pi again. Back to step 3.
5. **Baseline commit.** Before the first edit of the task, Gemini commits the working tree: `chore(NNN): baseline before <name>`. Local commit, never push.
6. **Code.** Gemini implements the plan.
7. **Change report.** Gemini writes (or appends a round to) `docs/changes/NNN-<name>.md`, pings Pi.
8. **Code review.** Pi diffs `baseline..HEAD`, reads every hunk, checks the plan, runs cheap verifications, writes `docs/reviews/NNN-<name>.code.md` with verdict **PASS** or a numbered **FIX** list, pings Gemini.
9. **Fix round** (only if FIX). Gemini fixes, commits `NNN: fix round <n>`, appends "Round <n>" to the change report, pings Pi. Back to step 8.
10. **Done.** PASS + developer confirms in SillyTavern → Gemini proposes any `NOTES.md` additions; developer pushes to GitHub when he wants.

## Stop conditions (the loop halts and waits for the developer)

- The **same bug** is flagged in two consecutive code-review rounds → the AI that halts the loop runs **`docs\ping-developer.bat NNN-<name>`** — the developer gets ONE line on Telegram ("need your review - NNN-<name>"). The loop waits until the developer steps in.
- Either AI disagrees with the other's review and cannot produce evidence → write the disagreement in the relevant inbox entry, run **`docs\ping-developer.bat NNN-<name>`**, and escalate to the developer.
- The developer says "auto off" at any point → from then on, each side waits to be pinged by the developer manually.

## Naming

- Task number `NNN`: three digits, sequential, assigned by Gemini when the first plan is written (`001`, `002`, …). Check `docs/plans/` for the last number used.
- `<name>`: short kebab-case of the task (e.g. `003-comfyui-retry`). The **same** number + name is used for the plan, change report, and both reviews of that task.

## File map (one writer per file)

| File / folder | Writer | Purpose |
|---|---|---|
| `docs/COMMS.md` | developer | this protocol |
| `docs/plans/NNN-<name>.md` | Gemini | the agreed plan (Gemini edits in place during plan revisions) |
| `docs/changes/NNN-<name>.md` | Gemini | change report, one "Round n" section per coding round (append only) |
| `docs/reviews/NNN-<name>.plan.md` | Pi | plan review (append a new "Round n" section per re-review) |
| `docs/reviews/NNN-<name>.code.md` | Pi | code review, one "Round n" section per review round (append only) |
| `docs/inbox-pi.md` | Gemini | short messages to Pi (append only, newest at bottom) |
| `docs/inbox-gemini.md` | Pi | short messages to Gemini (append only, newest at bottom) |
| `docs/ping-pi.bat` / `docs/ping-gemini.bat` / `docs/ping-developer.bat` | developer | wake the other AI / wake the developer on Telegram |

Rules: read everything, write only your own files. Inbox entries are never deleted — they are the shared memory of the loop.

## Templates

### Plan — `docs/plans/NNN-<name>.md` (written by Gemini)

```markdown
# NNN — <Title>

Status: DRAFT → AWAITING_PLAN_REVIEW → (APPROVED | REJECTED) → CODING → AWAITING_CODE_REVIEW → PASS
Date: YYYY-MM-DD · Author: Gemini · Reviewer: Pi

## Goal
One or two sentences, in the developer's words.

## What the user will see / feel
The experience, not the syntax. One concrete example if possible.

## In scope
- ...

## Out of scope (explicitly NOT done)
- ...

## Files / modules likely touched
| File / module | Why |

## Risks & open questions
- ... (label anything unverified as "unverified")
```

### Plan review — `docs/reviews/NNN-<name>.plan.md` (written by Pi)

```markdown
# NNN — Plan Review

## Round 1 · YYYY-MM-DD · Reviewer: Pi
Verdict: APPROVED | NEEDS_CHANGES

Issues (each needs evidence; no evidence → put it under Notes as a question):
1. <issue> — evidence: <file / citation / test> — required change: <...>

Notes for Gemini (non-blocking):
- ...
```

### Change report — `docs/changes/NNN-<name>.md` (written by Gemini)

```markdown
# NNN — Change Report

Plan: docs/plans/NNN-<name>.md · Author: Gemini

## Round 1 · YYYY-MM-DD
Baseline commit: <hash> → Head commit: <hash>

Files touched:
| File | What changed | Why |

What the user will see / feel:
- ...

Test evidence:
- <commands run, what was verified, results>

Known limitations:
- ...
```

(Round 2+ is appended below Round 1, same structure. Never rewrite earlier rounds.)

### Code review — `docs/reviews/NNN-<name>.code.md` (written by Pi)

```markdown
# NNN — Code Review

## Round 1 · YYYY-MM-DD · Reviewer: Pi
Diff reviewed: <baseline hash>..<head hash> · Change report: docs/changes/NNN-<name>.md

Verdict: PASS | FIX

Bugs (numbered; fix list for Gemini):
1. `<file>:<line>` — <what is wrong> — evidence: <how verified> — suggested fix: <...>

Plan-compliance notes:
- <anything in the plan that is missing, extra, or done differently>

Notes for Gemini (non-blocking):
- ...
```

(Round 2+ appended below, same structure. A bug is "the same" across rounds if it is in the same file and fails for the same reason.)

### Inbox entry (either inbox file, appended at the bottom)

```markdown
## YYYY-MM-DD · Gemini → Pi · Re: NNN-<name>
<one to three lines: what happened and what the other should do>
```

## Automation (the bat files)

- **`docs\ping-pi.bat`** — run by Gemini when its phase is done. Opens a console window that wakes the Pi session for this project (`pi -c -p …`). If the wrong session gets woken, Pi should check `/session` and re-target with `pi --session <id>`; note the fix in the next inbox entry.
- **`docs\ping-gemini.bat`** — run by Pi when its review is done. If the Antigravity **CLI** (`agy`) is installed, it runs a headless Gemini turn in this project (`agy -p …`); otherwise it opens the IDE and a console banner telling the developer to type **`/checkinbox`** in the Agent Manager (workflow: `.agents/workflows/checkinbox.md`).
- A headless `agy` run starts a *fresh* conversation — that is fine and by design: all state lives in the `docs/` files, and `GEMINI.md` / `AGENTS.md` are loaded from the project automatically.
- The bats are visible windows on purpose: the developer can watch a handoff happen or cancel it.
- **`docs\ping-developer.bat [task ref]`** — sends the developer ONE line on Telegram ("need your review - <task ref>"). The bot token and chat id are read from `C:\Users\arifs\.pi\agent\telegram.json` (not hardcoded in the bat). Run it whenever the loop halts and waits for the developer.

## Ground rules

1. **One writer per file.** Never edit a file the other AI owns.
2. **Append, don't rewrite.** Rounds and inbox entries accumulate; they are the shared memory.
3. **Evidence or it's a question.** Disagreements between the AIs must carry evidence or they get escalated to the developer as questions.
4. **The plan is the contract.** Code that deviates from the approved plan is a finding, even if it "works better".
5. **The developer can override anything**, but overrides are recorded in the relevant review/report file so the paper trail stays honest.
6. **Plain words for the developer, precise words for each other.**
