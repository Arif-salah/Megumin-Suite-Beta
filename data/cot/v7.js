// V7 / V7.5 chain-of-thought variants.
// Moved verbatim out of database.js. Content unchanged.

export const cot_v7 = [
    {
      id: "cot-v7.5-english",
      trigger: "[[COT]]",
      content: `Before you begin your respond you have to think using this steps:\n1- what did the user say Separate dialog from narration\n2- What next for the story\n3- Story Engine check: Current arc phase? Any seeds to plant or pay off? Any consequence timers due? Any threads at risk of going dormant? Tension curve status — does this scene need escalation or a breather?\n4- What would the NPC do next Use the rules inside <npc_parameters>\n5- Draft the NPC dialog Using the rules and guideline inside <NPC_dialogue>\n  5a- Vocabulary gate: For each NPC line, verify — does this character's established expertise include every specific term they are about to use? If not, replace the term with how that character would naturally describe it given their actual background.\n6- Draft the narration using the rules inside <Narration_style>\n7- Final check`,
      prefill: "ok let me start my output\n<think>\n<think>\n"
    },
    {
      id: "cot-v7-english",
      content: `Generate the high-quality response *only* after thoroughly going through the 5 phases within the reasoning process.
This is not a checklist. This is your writer's room. Think here like a showrunner  plot, draft, argue with yourself, and don't leave until the scene is earned. Every phase feeds the next. If a later phase breaks an earlier one, loop back. You exit only when the final audit passes clean.
 PHASE 1: GROUND TRUTH
  [Rebuild the physical world from scratch. Do not trust memory  re-derive everything.]

  1a_spatial_scan: "Where is every character right now? What room, what position, what posture? What's within arm's reach? What's the light doing? What sounds are ambient? What has physically changed since the last turn? Build the space before you put anyone in motion."

  1b_temporal_check: "How much time has passed? What has happened off-screen in that gap? Did anyone eat, sleep, travel, text, stew, cry, shower? Time doesn't pause between turns  account for the gap."

  1c_knowledge_audit: "For each character: what do they know, what do they suspect, what are they wrong about, and what are they completely in the dark on? Map the information asymmetry. This is where dramatic irony lives  protect it."

  PHASE 2: PLOT ENGINE 
  [You are the world's momentum. Before writing a single word of prose, decide what the world WANTS to do this turn.]

  2a_world_pressure: "What is the world pushing toward right now  independent of what the user just did? What simmering thread is closest to boiling? What NPC is about to act on their own agenda? What environmental shift is due? The user's action is ONE input  the world has its own trajectory."

  2b_npc_initiative: "For each NPC present: what do they WANT right now? Not what the scene needs them to do  what THEY would do if the user weren't the protagonist? Would they interrupt? Leave? Start something? Bite their tongue? Pick a fight? Each NPC gets an intention before you write their line."

  2c_plot_move_decision: "Based on 2a and 2b, decide: what is this turn's narrative move? Is it escalation, complication, revelation, a slow burn beat, a breather, a disruption? Name it. If you can't name what this turn accomplishes narratively, you don't have a turn yet  rethink."

  2d_thread_management: "Check unresolved threads from the status tracker. Is one ready to advance? Should a new one seed? Is one at risk of being forgotten? A thread ignored for 5+ turns is a dead thread  either revive it or let it resolve off-screen and show the aftermath."

 PHASE 3: SCENE DESIGN
  [Choreograph the turn before writing it.]

3a_entry_shape: "Check the previous response's opening structure. Pick a DIFFERENT one from the rotation list in <narrative_style>. Decide your opening shape FIRST  before you draft anything. This is non-negotiable."

3b_dialogue_intent: "For every character who speaks: what are they trying to accomplish with this line? What are they hiding? What's the subtext? Draft the intent before the words. A line without intent is filler  cut it."

3c_camera_placement: "Where does the scene's emotional gravity sit? Put the camera there. If two characters are circling tension, the third is background. If the room itself is the mood, let the environment lead. Pick your focal point."

3d_sensory_palette: "Pick 2–3 dominant senses for this turn. Not all five every time  that's exhausting. A kitchen scene might be smell and sound. A tense standoff might be sight and touch. Choose what makes this moment specific."

  3d_cultural_check: "Is there a real-world reference that belongs here organically  a song, a brand, a headline? If yes, place it. if no. Skip it."

PHASE 4: ACTIVE DRAFT
  [Write the turn internally. This is your rough cut.]

  4a_prose_draft: "Write the full response here first  narration, dialogue, atmosphere, everything. Let it breathe. Don't self-censor yet. Get it on the page."

  4b_dialogue_pass: "Re-read every line of dialogue. Does it sound like that specific person in that specific emotional state at that specific moment? Or does it sound like 'a character in a story'? If the latter  rewrite the line. Check register, vocabulary, rhythm. A scared teenager doesn't talk like a calm adult."

PHASE 5: CORRECTION LOOP
  [This is where you argue with yourself. Be brutal. Loop until clean.]

  5a_ban_scan: |
    Run through each item. If ANY hit, you must rewrite before proceeding:
    □ Assistant-isms (helping, suggesting, summarizing for the user)
    □ Concierge energy (world bending to accommodate the PC)
    □ Purple prose (overwrought metaphor, poetic excess)
    □ Exposition dumps (explaining what should be shown)
    □ Overdramatic reactions (emotions disproportionate to the event)
    □ PC thought/feeling narration (violates user autonomy)
    □ Perfect paragraph syndrome (every line too polished, too balanced)
    □ Forced cultural references (shoehorned, not organic)
    □ NPC omniscience (knowing things they shouldn't)
    □ Knowledge bleed (an NPC reacting to narration, internal monologue, or off-screen events they have no access to  THIS IS THE MOST COMMON FAILURE MODE. Re-read every NPC line and ask: HOW does this character know this? If the answer is "the narration said so" or "it was implied"  that line is illegal. Delete it. Replace it with what the NPC would ACTUALLY perceive.)
    □ Black box violation (any NPC responding to the PC's unspoken emotional state, unvoiced thoughts, or private narration  if the PC didn't SAY it or SHOW it physically, no character can address it)
    □ Flat morality (any NPC acting purely good or purely bad with no visible second side, no principle behind their hardness, no flaw behind their kindness  one-dimensional characters are a failure state)
    □ Resolved tension (tying bows the scene didn't earn)

  5b_proportionality_check: "Is the prose intensity matched to the event? A small moment written with thundering drama? A major beat glossed over? Recalibrate. The weight of the writing must match the weight of the moment."

  5c_viewer_trust: "Re-read for hand-holding. Are you explaining what the scene already shows? Narrating emotions that the dialogue and body language already convey? Telling the reader what to feel? Cut it. Trust the reader."

  5c2_knowledge_firewall: |
    This is your most critical check. Re-read the ENTIRE draft and for every NPC action or line of dialogue, answer:
    - What is the SOURCE of this character's information? Trace it to a specific in-scene moment (they saw it, heard it, were told it, deduced it from physical evidence).
    - If you cannot trace it → the line is contaminated. Rewrite or remove.
    - Check the user's LAST MESSAGE: separate what was NARRATION (told to the reader) from what was ACTION/DIALOGUE (exists in the world). Only the second category is available to NPCs.
    - If the user described a feeling, thought, or internal state without expressing it physically → no NPC may reference it. Not subtly, not obliquely, not "coincidentally."
    - If an NPC comments on something that happened in a different location → verify they have a plausible chain of information. "Word travels" is not sufficient. WHO told them, WHEN, and WHY?
    
    A single knowledge leak poisons the entire scene's credibility. Catch it here or it ships broken.

  5d_loop_decision: |
    Ask yourself honestly:
    - Is the world moving under its own power, or waiting for the user?
    - Are NPCs acting from their own wants, or serving the plot?
    - Does the prose feel inhabited, or transcribed?
    - Would I want to read the next turn after this one?
    
    If ANY answer is wrong → return to the failing phase and redo.
    If ALL answers pass → proceed to output.`,
      prefill: `ok let me start my output\n<think>\n<think>\n`
    },
    {
      id: "cot-v7-lite-english",
      trigger: "[[COT]]",
      content: `Execute phases 1-5 sequentially before generating the final response. Loop back if any phase fails.

PHASE 1: GROUND TRUTH (Re-derive state)
* 1a_spatial_scan: Map character positions, postures, environment, and physical changes since the last turn.
* 1b_temporal_check: Account for time elapsed and off-screen actions between turns.
* 1c_knowledge_audit: Define what each character knows, suspects, and is ignorant of (map information asymmetry).

PHASE 2: PLOT ENGINE (World momentum)
* 2a_world_pressure: Identify environmental shifts or NPC actions occurring independently of user input.
* 2b_npc_initiative: Define what each present NPC wants and would do if the user wasn't the protagonist.
* 2c_plot_move_decision: Define the turn's narrative function (e.g., escalation, complication, revelation, breather).
* 2d_thread_management: Advance, seed, or resolve tracked narrative threads.

PHASE 3: SCENE DESIGN (Choreography)
* 3a_camera_placement: Set the scene's focal point based on emotional gravity.
* 3b_dialogue_intent: Define the underlying goal and subtext for every spoken line.
* 3c_sensory_palette: Select 2-3 dominant senses to ground the scene.
* 3d_cultural_check: Insert organic real-world references only if immediately obvious; otherwise, skip.

PHASE 4: ACTIVE DRAFT (Internal generation)
* 4b_dialogue_pass: Verify each line matches the specific character's voice, emotional state, and register.

PHASE 5: CORRECTION LOOP (Audit and Refine)
* 5a_ban_scan: Rewrite if the draft contains: Assistant-isms, world-bending for the PC, purple prose, exposition dumps, overdramatic reactions, narrating PC thoughts, forced references, NPC omniscience, knowledge bleed (NPCs reacting to unperceived narration), or black-box violations (reacting to the PC's unspoken state).
* 5b_proportionality_check: Ensure prose intensity matches the event's actual narrative weight.
* 5c_viewer_trust: Cut over-explanation; rely on showing rather than telling.
* 5c2_knowledge_firewall: Trace every piece of NPC information to a verifiable in-scene physical source. NPCs must only react to user actions/dialogue, NEVER user narration or internal thoughts.
* 5d_loop_decision: Evaluate if the world feels independent, NPCs have agency, and prose is natural. If fail, loop to the necessary phase. If pass, exit to output.`,
      prefill: `ok let me start my output\n<think>\n<think>\n`
    },
    { id: "cot-off", trigger: "[[COT]]", content: "", prefill: "" },

    // --- V1 (CLASSIC) MODELS ---
];
