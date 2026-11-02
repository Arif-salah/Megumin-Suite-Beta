// node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChatter } from "../src/blocks/treatments.js";

const names = p => p.turns.map(t => t.name);

test("a five-word name gets its own bubble", () => {
    const p = parseChatter([
        "Lady Eden Ellington: And where did that creature hide a sword?",
        "Lord Vance of House Morro: Wiped her wrist on her fur, did she?",
        "Ser Garrett Morro: She's a salt-hag. We shouldn't be riding at a salt-hag."
    ].join("\n"));
    assert.deepEqual(names(p), ["Lady Eden Ellington", "Lord Vance of House Morro", "Ser Garrett Morro"]);
    assert.equal(p.turns[2].text, "She's a salt-hag. We shouldn't be riding at a salt-hag.");
});

test("a long name written mid-paragraph is still a speaker", () => {
    const p = parseChatter("Aqua: Run! Lady Eden Ellington of House Ellington: Stay where you are.");
    assert.deepEqual(names(p), ["Aqua", "Lady Eden Ellington of House Ellington"]);
});

test("a sentence ending in a colon is not a speaker", () => {
    const p = parseChatter("Aqua: Fine. She told me something strange today: the bridge is gone.\nMegumin: Explosion!");
    assert.deepEqual(names(p), ["Aqua", "Megumin"]);
    assert.match(p.turns[0].text, /something strange today: the bridge is gone/);
});
