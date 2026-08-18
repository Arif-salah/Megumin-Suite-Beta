// Prose style tag library, grouped by category.
// Moved verbatim out of database.js. Content unchanged.

export const styles = [
    {
      category: "Genre & Tone",
      tags: [
        { id: "Dark", hint: "when you want things bleak, brutal, and hopeless" },
        { id: "Gritty", hint: "raw and rough — dirt under the fingernails, blood on the knuckles" },
        { id: "Horror", hint: "the kind of stuff that makes you check behind the door" },
        { id: "Tragic", hint: "brace yourself — nobody's getting a happy ending here" },
        { id: "Melancholic", hint: "that quiet ache, like staring out a rainy window" },
        { id: "Cinematic", hint: "think big screen energy — sweeping shots, dramatic beats" },
        { id: "Gothic", hint: "crumbling manors, buried secrets, and brooding romance" },
        { id: "Sci-Fi", hint: "spaceships, future tech, and all that good nerdy stuff" },
        { id: "Cyberpunk", hint: "neon-soaked streets, shady megacorps, and chrome everything" },
        { id: "Fantasy", hint: "swords, sorcery, and probably a dragon or two" },
        { id: "Action-Packed", hint: "explosions first, questions later" },
        { id: "Mystery", hint: "something's off and you need to figure out what" },
        { id: "Slice-of-Life", hint: "just regular days — coffee, chores, small talk" },
        { id: "Romantic", hint: "stolen glances, butterflies, and way too much tension" },
        { id: "Sweet", hint: "so soft and pure it'll rot your teeth" },
        { id: "Fluffy", hint: "warm, cozy, and guaranteed to make you go 'aww'" },
        { id: "Wholesome", hint: "good vibes only — healthy bonds and happy hearts" },
        { id: "Comedy", hint: "chaotic laughs, dumb jokes, and situations that escalate fast" },
        { id: "Surreal", hint: "dream logic — nothing makes sense and that's the point" },
        { id: "Lighthearted", hint: "nothing too serious, just a good easy time" },
        { id: "Psychological", hint: "gets in your head — paranoia, obsession, mind games" },
        { id: "Scientific", hint: "cold, precise, and clinically detailed" },
        { id: "Thriller", hint: "constant tension — you can't relax for even a second" },
        { id: "Philosophical", hint: "big questions about life, meaning, and why any of it matters" },
        { id: "Adventure", hint: "pack your bags — there's a whole world out there to explore" },
        { id: "Drama", hint: "heated arguments, hard choices, and plenty of tears" },
        { id: "Banter", hint: "fast, witty back-and-forth that just flows" }
      ]
    },
    {
      category: "Narration",
      tags: [
        { id: "Purple Prose", hint: "over-the-top poetic and dramatic — every sentence is a performance" },
        { id: "Descriptive", hint: "paints a full picture so you can really see it" },
        { id: "Sensory-Rich", hint: "you'll practically smell, hear, and feel every scene" },
        { id: "Introspective", hint: "deep inside the character's head — every thought, every doubt" },
        { id: "Objective", hint: "just the facts — like a camera recording what happens" },
        { id: "Subjective", hint: "everything's filtered through how the character feels about it" },
        { id: "Editorializing", hint: "the narrator has opinions and isn't afraid to share them" },
        { id: "Action-Driven", hint: "less thinking, more punching — keep things moving" },
        { id: "Dialogue-Heavy", hint: "let the characters talk it out themselves" },
        { id: "Simple", hint: "clean and straightforward — no frills, no fuss" },
        { id: "Minimalist", hint: "stripped down to the bare essentials, nothing wasted" },
        { id: "Show-Don't-Tell", hint: "describe the shaking hands, not 'she was nervous'" }
      ]
    },
    {
      category: "Pacing",
      tags: [
        { id: "Slow-Burn", hint: "takes its sweet time building up — and that's what makes it good" },
        { id: "Leisurely", hint: "no rush at all, just vibing along" },
        { id: "Steady", hint: "smooth and even — a nice reliable rhythm" },
        { id: "Methodical", hint: "careful and deliberate, one step at a time" },
        { id: "Episodic", hint: "each part feels like its own little episode" },
        { id: "Fast-Paced", hint: "things keep happening and they don't slow down" },
        { id: "Frenetic", hint: "absolute chaos speed — blink and you'll miss something" },
        { id: "Time-Skips", hint: "jumps past the boring stuff to get to the good parts" },
        { id: "Dynamic", hint: "speeds up and slows down depending on what's happening" }
      ]
    },
    {
      category: "POV",
      tags: [
        { id: "First-Person", hint: "'I did this, I felt that' — you are the main character" },
        { id: "Second-Person", hint: "'you walk into the room' — puts you right in the action" },
        { id: "Third-Person Limited", hint: "follows one character closely — their eyes, their thoughts" },
        { id: "Third-Person Omniscient", hint: "the narrator knows everything about everyone, no secrets" }
      ]
    }
];
