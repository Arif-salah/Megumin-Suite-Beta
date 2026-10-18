# 016: Tell the user when Chomusuke's answer is missing or unusable

## Why

A user could not tell whether Chomusuke was working. After a reply, some jobs
warned only when the answer was in the wrong format, some never warned, and no
warning told "nothing came back" apart from "the request failed" apart from
"it answered in the wrong format". Those need different fixes (check the
connection / Read again / a stronger model).

## What we agreed (2026-10-18)

- One shared helper, `src/engine/chomusukeNotice.js` (pure, tested), with three
  kinds of warning:
  - **failed**: the request errored. "Chomusuke couldn't get an answer for
    World State: 401 Unauthorized."
  - **empty**: it answered with nothing (or only thinking). "Chomusuke's model
    sent back nothing for World State. Check its connection in the Chomusuke
    tab, …"
  - **format**: it answered, but not in a format the job can use. "…so nothing
    changed. …, or pick a stronger model for Chomusuke."
- The worker runner (`runOnWorker`) already toasted request failures; it now
  uses the helper's wording and the job's name. A `null` answer means "already
  told", so callers stay quiet on it (no double popups).
- Covered (automatic jobs after a reply): World State read, Blocks read,
  Notebook read, automatic image prompt, combined call (ONE warning naming
  every part that failed; parts that fall back to their own read say nothing,
  the fallback read warns for itself), memory summary (empty answer), Story
  Director auto-evolve.
- Stays silent: `NONE` from the image prompt, answers dropped because the
  reply was swiped/edited meanwhile. Manual buttons keep their own messages.

## Progress

- [x] Built 2026-10-18 (231 tests pass, import check clean, toasts checked in
      the browser)
- [x] Tested by the developer 2026-10-18
