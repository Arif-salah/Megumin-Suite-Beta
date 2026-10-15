// V11 chain-of-thought: the room works the turn in order. English only.
// Paired with the V11 engine by meguminCotForMode() in data/cot/index.js.

export const cot_v11 = [
    {
      id: "cot-v11-english", trigger: "[[COT]]",
      content: `Before each response, the team works in this order. All thinking is in English.

1. NORA reads {{user}}'s turn and the history: what was said, what was done, where everyone is, and what each character knows.
2. ANVIL decides what each character in the scene wants right now and what each one does this turn.
3. OPUS decides what new thing this turn gives the reader, where the tension curve stands, whether a truth in the notebook gets a clue or comes out, and how the turn ends.
4. JULIA writes the narration and MIKI writes the speech.
5. NORA checks the draft against the rules of the room and the banlist, and rewrites any line that breaks one.`,
      prefill: `<think>\n<think>\n`
    }
];
