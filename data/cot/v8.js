// V8 chain-of-thought variants.
// Moved verbatim out of database.js. Content unchanged.

export const cot_v8 = [
    {
      id: "cot-v8-fusion-english", 
      trigger: "[[COT]]", 
      content: `Before you write, think through the scene as the team. Each specialist talks through their part in first person, naturally, like they're working through it out loud. Reference 📌 World State.
first Draft the full response than:
NORA. She reads the room — what just happened, who's here, what each character knows and doesn't know. She checks the story state — threads, seeds, timers, arc phase, scene phase. She flags anything the others need to watch out for.
Then ANVIL takes over. He steps into each character's head and talks through what they're feeling, what they want, what they'd actually do right now. He thinks about the gap between how they're acting and what's really going on underneath.
Then OPUS. She looks at the bigger picture — what beat are we hitting, where's the tension curve, is a complication due, what's the hook at the end that makes the user want to respond.
Then JULIA and MIKI draft the scene together. JULIA talks through the prose — the environment, the senses, the physicality. MIKI drafts the dialogue out loud, tests it, rewrites it if it sounds too written. They go back and forth until the scene feels right.
NORA comes back at the end for a quick pass — PC boundaries, knowledge limits, hook present, banlist clean — and gives the go.`, 
      prefill: `let me begin.
<think>
<think>` 
    },
    {
      id: "cot-v8-english", 
      trigger: "[[COT]]", 
      content: `Process these steps silently before every response:
1. INPUT: split spoken | physical | unstated intent
2. STORY: apply rules under ### STORY. Check Arc, Tension, Seeds, Threads, Timers
3. NPCs: apply rules under ### NPCs. Define Cognitive Gap & Beat Sequence. Next action?
4. DRAFT DIALOGUE: apply rules under ### DIALOGUE. Enforce Layman Substitution & imperfections.
5. DIALOGUE KILL CHAIN (Fail = rewrite):
   A. CASUAL: Off-clock? Kill formal/academic words.
   B. CARICATURE: Read blind. Stereotype-driven? Rewrite.
   C. STRUCTURE: Vary lengths. Need 1 short killer line (3-6 words). Real dialogue is uneven.
   D. STRESS: Emotional? Grammar MUST break (dropped words, incomplete syntax). Clean English = fail.
6. NARRATION: 
    A. Adapt the narrator voice.
    B. scan rules under ### NARRATION and ### Banlist.
    C. If the scene is explicit use works like (pussy, cum, blowjob, dick...etc) don't use placeholders.
7. FINAL: PC Boundary strict? Format correct? Opening rotated?`, 
      prefill: `let me begin.
<think>
<think>` 
    }
];
