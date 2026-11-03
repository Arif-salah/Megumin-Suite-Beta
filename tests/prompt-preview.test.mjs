// Dev Mode's full prompt preview (plan 025): fill a preset message, keep where each piece came from.
import { test } from "node:test";
import assert from "node:assert/strict";

import { fillPreview, parseTraced, previewText } from "../src/engine/promptPreview.js";
import { TRACE, traced, setPromptTrace, editable, setPromptEditReader } from "../src/prompts/edits.js";

const mark = (key, text) => `${TRACE.open}${key}${TRACE.mid}${text}${TRACE.close}`;

test("traced text: marks only while the preview builds", () => {
    assert.equal(traced("a", "x"), "x");
    setPromptTrace(true);
    try {
        assert.equal(traced("a", "x"), mark("a", "x"));
        assert.equal(traced("a", ""), "");
        assert.equal(editable("k", "built-in"), mark("k", "built-in"));
    } finally { setPromptTrace(false); }
    assert.equal(editable("k", "built-in"), "built-in");
    setPromptEditReader(null);
});

test("parseTraced: nested marks become nested edit nodes", () => {
    const nodes = parseTraced(`a ${mark("outer", `b ${mark("inner", "c")} d`)} e`);
    assert.deepEqual(nodes, [
        { type: "text", text: "a " },
        { type: "edit", key: "outer", children: [
            { type: "text", text: "b " },
            { type: "edit", key: "inner", children: [{ type: "text", text: "c" }] },
            { type: "text", text: " d" },
        ] },
        { type: "text", text: " e" },
    ]);
});

test("fillPreview: fills like the injector, nested tags included, empty tags take their line", () => {
    const dict = {
        "[[a]]": `A(${"[[b]]"})`,
        "[[b]]": mark("bKey", "B"),
        "[[empty]]": "  ",
    };
    const nodes = fillPreview("Top\n[[empty]]\n[[a]] and [[missing]]\nEnd", dict);
    assert.equal(previewText(nodes), "Top\nA(B) and \nEnd");
    const a = nodes.find(n => n.type === "tag");
    assert.equal(a.trigger, "[[a]]");
    const b = a.children.find(n => n.type === "tag");
    assert.equal(b.trigger, "[[b]]");
    assert.deepEqual(b.children, [{ type: "edit", key: "bKey", children: [{ type: "text", text: "B" }] }]);
});

test("fillPreview: a tag inside an edited text is filled too", () => {
    const nodes = fillPreview("[[x]]", { "[[x]]": mark("k", "has [[y]]"), "[[y]]": "Y" });
    assert.equal(previewText(nodes), "has Y");
    assert.equal(nodes[0].children[0].type, "edit");
    assert.equal(nodes[0].children[0].children[1].trigger, "[[y]]");
});
