import { test } from "node:test";
import assert from "node:assert/strict";
import { meguminSlotByTrigger, meguminSlotIsLive, setEngineClonesReader } from "../data/slots.js";

const userRule = meguminSlotByTrigger("[[user]]");

test("a copy of a Co-writer engine turns the user rule off", () => {
    setEngineClonesReader(() => [{ id: "my-ukiyo-copy", isCoWriter: true }]);
    assert.equal(meguminSlotIsLive(userRule, { mode: "my-ukiyo-copy" }), false);
    setEngineClonesReader(null);
});

test("a copy of a normal engine keeps the user rule", () => {
    setEngineClonesReader(() => [{ id: "my-v11-copy" }]);
    assert.equal(meguminSlotIsLive(userRule, { mode: "my-v11-copy" }), true);
    setEngineClonesReader(null);
});

test("no clones handed over yet: the lookup finds nothing and the rule stays", () => {
    assert.equal(meguminSlotIsLive(userRule, { mode: "my-ukiyo-copy" }), true);
});
