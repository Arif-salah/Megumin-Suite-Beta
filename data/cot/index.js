// The chain-of-thought library, in display order.
//
// Exported as `models` because that is the key it occupies in hardcodedLogic and
// the name every reader downstream already uses. The folder is named cot/ because
// that is what these actually are — none of them describe an LLM model.

import { cot_v9 } from "./v9.js";
import { cot_v8 } from "./v8.js";
import { cot_v7 } from "./v7.js";
import { cot_legacy } from "./legacy.js";

export const models = [
    ...cot_v9,
    ...cot_v8,
    ...cot_v7,
    ...cot_legacy,
];
