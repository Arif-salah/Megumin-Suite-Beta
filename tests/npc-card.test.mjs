import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNewNpc, renderNewNpc } from "../src/blocks/treatments.js";

const DOSSIER = `**Name:** Yunyun | **Age:** 14 | **Sex:** Female

**Role:** Crimson Demon archwizard

**Appearance:** Black hair in two braids, red eyes.

**Personality:**
* Lonely
* Earnest

**Secrets:**
* Practises her rival speeches in the mirror

**Image Tags:** female, black hair, braids`;

test("a New NPC dossier becomes a person card", () => {
    const p = parseNewNpc(DOSSIER, { name: "Yunyun" });
    assert.equal(p.name, "Yunyun");
    assert.equal(p.role, "Crimson Demon archwizard");
    assert.deepEqual(p.vitals.map(v => v.label), ["Age", "Sex"]);
    assert.deepEqual(p.fields.find(f => f.label === "Personality").items, ["Lonely", "Earnest"]);
    const html = renderNewNpc(p);
    assert.match(html, /meg-npc-secret/);
    assert.match(html, /data-npc-name="Yunyun"/);
});

test("the name comes from the dossier when the tag has none", () => {
    assert.equal(parseNewNpc(DOSSIER, {}).name, "Yunyun");
});

test("prose, or a single field, falls back to the plain text", () => {
    assert.equal(parseNewNpc("She walked in and sat down.", { name: "X" }), null);
    assert.equal(parseNewNpc("**Name:** X", { name: "X" }), null);
});
