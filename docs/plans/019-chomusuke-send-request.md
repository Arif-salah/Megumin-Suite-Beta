# 019: Chomusuke sends its jobs straight to its connection

## Why

Today every Chomusuke job switches SillyTavern's whole connection to the
worker profile, sends a quiet prompt, and switches back
(`applyConnectionProfileById` + `runOnWorker` in `src/engine/tasks.js`).
A user put it well: "global connection profile is quite fragile". What it
costs us:

- If switching back fails or times out, the next story reply is written by
  the worker model.
- A profile saved with Settings Preset or Regex Preset reloads the chat on
  every switch. We tell people to untick them (`CHOMUSUKE_SETUP_NOTE`), and
  many don't read it.
- Guards for the gaps: waiting while the story is generating, the session
  promise that holds back a message sent mid-switch, a 400 ms settle, the
  "Go back to after each job" setting.
- Each job waits for the connection to come up, so a slow handshake is a
  slow job, and an offline worker shows up as "timed out".

SillyTavern has a way to send a request to a connection profile without
touching the active connection: `ConnectionManagerRequestService.sendRequest`
(`public/scripts/extensions/shared.js`, in `getContext()`):

```js
const res = await ctx.ConnectionManagerRequestService.sendRequest(
    profileId, messages, maxTokens,
    { stream: false, extractData: true, includePreset: true, signal });
```

It takes the profile's API, model, key, URL, proxy and prompt
post-processing and applies the profile's preset (samplers). SillyTavern's
own connection never changes.

We only support Chat Completion, so Chomusuke only uses Chat Completion
profiles.

## Why it fits our code

Every Chomusuke job already throws away SillyTavern's prompt and builds its
own messages: the job parks a request (`core/activeRequests.js`), sends a
marker quiet prompt (`___PS_WORLD_EXTRACT___`, `___PS_IMAGE_GEN___`…), and
the prompt handler (`engine/injection.js`, `buildPromptInjection`) swaps the
whole message list for the job's. All 16 calls go through one wrapper,
`generateQuietPrompt` in `src/st.js`.

So the change is in one place: while a Chomusuke job runs on a worker
profile, the wrapper builds the same messages by calling the prompt handler
on an empty list, and sends them with `sendRequest` instead of
`generateQuietPrompt`. The jobs themselves don't change.

## What we agreed (2026-10-23)

- **The new way is the default** when SillyTavern has
  `ConnectionManagerRequestService` (every current version).
- **The old switching stays as a fallback**, with a switch in the Settings
  tab, off by default: "Switch my connection for each Chomusuke job". Its
  description says to turn it on only if Chomusuke's jobs fail the new way.
  An older SillyTavern without `sendRequest` uses it on its own.
- **Chat Completion only.** The profile list on the Chomusuke tab shows Chat
  Completion profiles only.
- **"Use my current connection" stays as it is**: a quiet prompt on the live
  connection, no profile involved (the live settings may not be saved in
  any profile).
- **Jobs still run one at a time** (the queue stays: the order matters, a
  World State read before the image that uses its outfits).
- **The waits for the story stay**, because they are about what Chomusuke
  reads, not about the connection:
  - A job waits while the story model is writing (`isGenerating`), so it
    reads the finished reply, never half of it. This matters most for the
    jobs you start by hand (image button, NPC scan…) in the middle of a reply.
  - A message you send while Chomusuke is still reading the last reply
    waits for it (the send guard, 30 s cap), so the next prompt's Current
    Info has this turn's World State, blocks and notebook. Today the guard
    only covers the switch; with the new way it covers the after-reply jobs
    (World State, Blocks, Notebook, the combined call). A job you started by
    hand doesn't hold your message.
- **What goes away on the new way** (kept for the fallback): the "uncheck
  Settings Preset and Regex Preset" note, the "Go back to after each job"
  setting (`primaryProfileId`), the connection waits and the 400 ms settle.
  The note and "Go back to" show only while the fallback is on.
- **Reply length:** `sendRequest` needs a number. Agreed: we send the response length
  of the profile's preset; a profile with no preset gets the story's. To
  check in phase 1: whether the preset's own length overrides ours anyway.

## Phases

1. **The new send path.**
   - A pure module `src/engine/workerRequest.js` (tested): which route a
     call takes (`profile` | `current` | `switch` for the fallback and
     old SillyTavern),
     the messages to send (the handler's list, or one user message for a
     plain prompt like Test's "Reply with the single word: OK"), macros
     filled in (`{{user}}`, `{{char}}`: the quiet prompt path filled some of
     them for us, so phase 1 compares what is sent old vs new in the
     background log), and the text out of the answer (`content`; reasoning
     comes back apart and is dropped, as `<think>` is today).
   - `src/st.js`: the wrapper asks a route set by `tasks.js` while a worker
     job runs; `runOnWorker` sets the route instead of switching (it still
     switches on the fallback).
   - The Settings tab switch for the fallback (global, like Chomusuke).
   - The send guard waits for the after-reply jobs instead of the switch.
   - The background prompt preview and log (plan 013) keep working: they
     hook into the prompt handler, which still builds the messages. The log
     names the worker profile, not the live connection
     (`bgPrompts.js → connectionLabel`).
   - Errors: `sendRequest` throws the API's own message (bad key, model not
     found, rate limit). `warnChomusuke("failed")` shows it, instead of
     "failed to establish connection".
2. **Clean-up and the Chomusuke tab.**
   - The switching guards run only on the fallback.
   - Chomusuke tab: "Go back to after each job" and the Settings Preset /
     Regex Preset note show only with the fallback on; the profile list
     shows Chat Completion profiles only; the setup steps get simpler (a
     profile for Chomusuke, no Story profile needed). Test says "Chomusuke
     answered" with no "your story connection is back" on the new way.
   - One line on the tab saying what changed, in the user's terms: "Chomusuke
     sends its jobs straight to its connection. Your story connection never
     changes."
3. **Stopping a job.** Each job gets an `AbortController`: a job still queued
   or running for a chat you left is stopped (today it runs and its answer is
   thrown away). Optional: a Stop button on Chomusuke's "working" notice.
4. **Docs.** CLAUDE.md (Chomusuke worker section: no switching, the
   deadlock rule still holds for the queue), README and the release post.

## What to test (developer, in SillyTavern)

Every job, the new way and then with the fallback switch on:

- After every reply: World State read, Blocks, Notebook read and setup, the
  combined call, the automatic image (V2 and Classic).
- On demand: image button, look scan, outfit tags, NPC scan, NPC update,
  NPC portrait, Memory summary, Story Director, ban list scan, Writing Style
  generator, the Test button.
- A worker profile **with** Settings Preset and Regex Preset ticked: no
  reload, the story's preset and regex stay.
- Send a message while Chomusuke is still writing the blocks of the last
  reply: it waits, and the next prompt's Current Info has them.
- Press the image button while the story is still writing: the job waits
  for the reply to finish.
- Prefill on (Settings) with a Claude worker; a reasoning worker (GLM 5.3
  Flash with thinking): only the answer comes back.
- A worker with a wrong key: the warning shows the API's message, the story
  connection is untouched.
- Connection Manager disabled: Chomusuke says it needs it, nothing breaks.

## Progress

- [ ] Phase 1: the new send path
- [ ] Phase 2: clean-up and the Chomusuke tab
- [ ] Phase 3: stopping a job
- [ ] Phase 4: docs
