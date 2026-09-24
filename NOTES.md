# NOTES.md — Workshop Notebook

> The lessons, decisions, and reminders we accumulate working on this project.
> **Important stuff only.** Each entry: one to two lines, dated, with the *reason* — not just the rule.
> The assistant proposes additions **at the end of a task**, only for things it would want to know next time.
> When this file grows long, we prune it together: distill into fewer lines, delete what's stale. It's a notebook, not an archive.

*Entry format: `YYYY-MM-DD — statement (reason)*`*

---

## Gotchas

*(things that broke, or trap us)*

- 2026-09-22 — On this machine (Windows), verifying that a file exists with a plain multi-arg `ls ... 2>&1` gave a misleading "it exists" reading; an explicit existence test (`[ -f file ]`) said it was missing and was right. (Bit us while setting up the global AGENTS.md. Use explicit tests here.)
- 2026-09-23 — When switching SillyTavern connection profiles in code, `CONNECTION_PROFILE_LOADED` emits before the backend network handshake finishes. Callers must also await `waitUntilCondition(() => online_status !== 'no_connection')` plus a brief settle buffer, otherwise `Generate('quiet')` sees `no_connection` and exits immediately without error. (Bit us during Chomusuke worker connection switching.)


## Decisions

*(we chose this over that, because — never re-debate without new evidence)*

- 2026-09-24 — **Handoffs: herdr direct prompt replaces the bat files as the primary wake** (developer's instruction to Pi; Pi updated `AGENTS.md` §9, `GEMINI.md`, `docs/COMMS.md` under explicit override). Both AIs run as panes in the herdr workspace on this project, so the finishing AI now runs `herdr agent list` (resolve the other agent's pane id — ids are not stable, never hardcode) and `herdr agent prompt <pane_id> "<ping message>"` — the text lands in the other agent's terminal like a typed line. Amends the 2026-09-24 dual-agent entry's "neither AI can call the other directly" — that was true before both got herdr panes; now they can. The bats (`ping-pi` / `ping-gemini`) stay as explicit fallback for when the herdr server is down or the pane has no live agent (the ping-pi bat keeps its env fixes for fresh `pi` runs); `ping-developer` (Telegram) is unchanged. Bonus: pings now land in each agent's *existing* conversation instead of a fresh headless run, so both keep project context across turns.

- 2026-09-24 — **Dual-agent loop**: Gemini (Antigravity) = Builder (plans + all project code), Pi = Reviewer (verdicts only, never writes project code in loop mode). They communicate through a file bridge in `docs/` — protocol `docs/COMMS.md`, auto-pings `docs\ping-*.bat`. The project `AGENTS.md` is now a shared agreement read by both; Gemini's role file is `GEMINI.md` (renamed from `Gemini.md`). Same bug twice → loop halts, the developer gets a one-line Telegram ("need your review - <task>") via `docs\ping-developer.bat`, and we wait for him. (Developer's request: keep Gemini as his conversation partner while a second pair of eyes reviews everything; file-based bridge because neither AI can call the other directly.)*

- 2026-09-22 — We work **chat-first**: talk it out, write a plain-language spec, code only after the developer's explicit "I like it". The standing rules live in `AGENTS.md`; this notebook is its memory. (Developer's core request — the whole working agreement rests on it.)
- 2026-09-22 — One small notebook, not a formal per-decision "decision log". (Built for big teams; the ceremony would bury a solo dev. Revisit only if the notebook stops fitting.)
- 2026-09-23 — **Chomusuke Worker**: Background tasks switch models via SillyTavern Connection Profiles instead of OpenAI Chat Completion Presets, eliminating multi-second freezes and chat reloads. **Option 2 (two-pass main story generation across two LLMs)** is queued for a future release. (Chat-first design decision.)

## Reminders

*(standing rules of this project we agreed on as we go — most important first)*

- 2026-09-24 — **Developer chat overrides to Pi**: When Pi raises concerns or edge-cases that Kazuma already dismissed in chat (e.g. backward compatibility for presets missing `[[infoblockcurrent]]`), Gemini explicitly cites Kazuma's ruling to Pi in plans, reports, or inboxes so settled decisions are not re-debated. (Kazuma is the final judge; users always import the newest preset on update.)
- 2026-09-22 — **Core vs Modules** (top priority): the heart of the extension is the placeholder swapper — engines + injection must ALWAYS work, bug-free, every send. Every other feature is an independent module with its own master switch; any on/off combination is valid. Never let a module change touch core, and never assume a module is on. (Reflected in `PROJECT_OVERVIEW.md` §0.1.)
- 2026-09-22 — **Division of labour**: the prompt *content* design (engines, CoT / "writer's room" texts — what the AI is actually told) is the developer's job, to be designed by him later. The assistant builds the machinery around it and does not redesign prompt content unless explicitly asked. (CoT in particular: treat as inert for feature work.)
- 2026-09-22 — Most "what the AI writes" changes live in `data/` (the prompt content library), not in code. Check there before assuming a code change is needed.
- 2026-09-22 — **Luka** is the contributor who PR'd the side panel into this project. `window.LukaSuite` (panel.js:1481) is a console-only debug handle named in his honour — a tribute, **not** a stale leftover. Never rename or "clean up" it without asking.
- 2026-09-22 — **Open issue, deferred by the developer (2026-09-22): settings bloat remainder.** The big one (prompt-text sparsification, 4.90 → 3.28 MB) is fixed. The rest — ComfyUI workflow states duplicated per profile (~300 KB × N profiles, `imagegen/index.js:471`) + one stale pre-Beta key (~245 KB) — is still unfixed in code. Fix idea on file: move workflow states to one install-wide store (pattern: `core/sharedFragments.js`) and drop the stale key.
