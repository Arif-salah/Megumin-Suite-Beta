import { test } from "node:test";
import assert from "node:assert/strict";
import { QUALITY_TAGS, prefixForStyle, styleOfTemplate } from "../src/features/imagegen/qualityPrefix.js";

test("tags style fills an empty prefix with the quality tags", () => {
    assert.equal(prefixForStyle("tags", ""), QUALITY_TAGS);
    assert.equal(prefixForStyle("tags", undefined), QUALITY_TAGS);
});

test("tags style keeps what the user added after the quality tags", () => {
    const mine = QUALITY_TAGS + ", anime screencap";
    assert.equal(prefixForStyle("tags", mine), mine);
});

test("tags style shows the quality tags over some other prefix", () => {
    assert.equal(prefixForStyle("tags", "photo, 8k"), QUALITY_TAGS);
});

test("natural style takes the quality tags out, keeping the rest", () => {
    assert.equal(prefixForStyle("natural", QUALITY_TAGS), "");
    assert.equal(prefixForStyle("natural", QUALITY_TAGS + ", anime screencap"), "anime screencap");
    assert.equal(prefixForStyle("natural", "A cosy watercolour"), "A cosy watercolour");
});

test("classic templates map to a style", () => {
    assert.equal(styleOfTemplate("illus_pov"), "tags");
    assert.equal(styleOfTemplate("sdxl_cinematic"), "natural");
});
