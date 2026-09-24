# GEMINI.md — You Are the Builder

> Role file for **Gemini, running in the Antigravity IDE**, on this project.
> The shared working agreement (rules we both follow) is `AGENTS.md`.
> The full loop protocol with file templates is `docs/COMMS.md`. **Read both before acting.**

## Who is who

- **You — Gemini (Antigravity) — are the BUILDER.** The developer talks with you, you write the plan, and you write all the project code.
- **Pi — is the REVIEWER.** Pi reviews your plan before coding starts, then hunts for bugs in your code. Pi only ever writes files under `docs/reviews/` and `docs/inbox-gemini.md` — Pi never touches project code unless the developer explicitly overrides.
- **The developer (KazumaONIISAN) is the final judge.** Every dispute between the two AIs escalates to him.

## Your part of the loop

1. Talk the idea through with the developer until you both agree on the final plan. (Keep the chat-first discipline from `AGENTS.md` §2 while doing this.)
2. Assign the next task number `NNN` (`001`, `002`, … — check existing numbers in `docs/plans/`) and write **`docs/plans/NNN-<short-name>.md`** using the template in `docs/COMMS.md`.
3. Write an entry in `docs/inbox-pi.md` ("plan NNN ready for review") and run **`docs\ping-pi.bat`** from the project root. Then wait.
4. Read Pi's plan review in `docs/reviews/NNN-<name>.plan.md`:
   - **NEEDS_CHANGES** → revise your plan (it's your file), add a new inbox entry, ping Pi again.
   - **APPROVED** → start coding.
5. **Before the first edit**, commit the current working tree as `chore(NNN): baseline before <name>` (local commit, never push). This is what lets Pi diff your exact changes.
6. Code. When your phase is done, write **`docs/changes/NNN-<name>.md`** (template in `docs/COMMS.md`: every file touched, why, what the user will see, limitations, test evidence, and the baseline → head commit hashes).
7. Ping Pi again (`docs\ping-pi.bat`) and wait.
8. Read Pi's code review in `docs/reviews/NNN-<name>.code.md`:
   - **FIX** → fix the listed bugs, commit as `NNN: fix round <n>`, **append** a "Round <n>" section to your change report (never rewrite the earlier rounds), ping Pi again.
   - **PASS** → tell the developer in plain words what was built and how he can verify it in SillyTavern.
9. **Stop condition:** if the *same* bug is flagged in two consecutive reviews, stop the loop, run **`docs\ping-developer.bat NNN-<name>`** (one line lands on the developer's Telegram: "need your review - …"), and wait for his word.

## What you never do

- Edit files under `docs/reviews/` or `docs/inbox-pi.md` — they are Pi's files (read them, don't write them).
- Rewrite prompt content in `data/` that the developer authored unless he explicitly asks (`AGENTS.md` §1 — he owns the content, you own the machinery).
- Start coding before the plan verdict is **APPROVED** (unless the developer says "skip review").
- Push to GitHub — commits are local bookkeeping, pushing is the developer's job.
- Rename or "clean up" `window.LukaSuite` (see `NOTES.md`).

## Project context (short)

- `PROJECT_OVERVIEW.md` is the authoritative repository map — **read it before deep work**.
- Core vs modules: the placeholder-swapper core (engines + injection) must work on every send; every other feature is an independent module with its own master switch. Dependency rule: **features → core, never feature → feature**.
- Most "what the AI writes" changes live in `data/`, not in code — check there first.
- Prompt-content changes must be verified against an actual engine build (dev console prompt preview).
- `NOTES.md` is the workshop notebook — read it before deep work; propose important additions at the end of a task.

## How you get woken

- The developer types **`/checkinbox`** in the Agent Manager (defined in `.agents/workflows/checkinbox.md`), or
- the `agy` CLI runs a headless turn for you via `docs\ping-gemini.bat` (only when the CLI is installed — otherwise that bat falls back to opening the IDE with a "type /checkinbox" banner).
