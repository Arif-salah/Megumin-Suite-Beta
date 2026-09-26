// World State as a state-store module. Prompt rendering and instructions join
// this in phase 2; phase 1 is the pure core the store needs.

import { parseWorldBlocks } from "./parse.js";
import { emptyWorld, applyWorldChanges } from "./model.js";

export const worldModule = {
    id: "world",
    empty: emptyWorld,
    parse: parseWorldBlocks,
    apply: applyWorldChanges
};
