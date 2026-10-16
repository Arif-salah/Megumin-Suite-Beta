# 013: Preview background prompts

## Why

Background jobs (Memory, NPC Bank, World State reads, Blocks, Notebook,
Images, Banned Phrases, Story Director, Writing Style) send their own prompts,
and there was no way to see what was sent. "Prompt Payload Preview" skips them
on purpose.

## What we agreed (2026-10-16)

- **Settings → "Preview background prompts"** (off by default). When on, a
  popup shows the exact messages before a background call is sent: which job,
  which connection, one box per message. The boxes **can be edited**; Send
  sends what is in them, Cancel stops that job only.
- **Per-job switches, all on by default:** Memory, NPC Bank, World State,
  Blocks, The Notebook, Combined call, Images, Banned Phrases, Story Director,
  Writing Style. The popup also has "Stop showing this job".
- **"Last background prompts" log:** the last **10** sent (or cancelled)
  prompts, one list across every chat, character and profile. Kept in the
  browser's database (SillyTavern's localforage), **never in the settings
  file**, so it cannot bloat it. Viewer in Settings: job, time, connection,
  size; open one to read or copy it; Clear.
- One hook: the prompt handler (`engine/injection.js`) already swaps every
  background marker for the job's messages. A wrapper runs after it, so every
  job and both routes (story model, Chomusuke) are covered without touching
  the jobs. World State / Blocks / Notebook share one marker, so their request
  carries a `job` name; the combined call and the look scan too.

## Phases

1. Build: pure core (jobs, log ring, edits) + tests, the hook + popup, the log
   store, Settings UI, job names on the shared markers.
2. The developer tests in SillyTavern.

## Progress

- [x] Phase 1 (built 2026-10-16, waiting for the developer to test)
- [ ] Phase 2
