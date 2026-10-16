import { test } from "node:test";
import assert from "node:assert/strict";
import { comfyBase } from "../src/features/imagegen/comfyUrl.js";

test("comfyBase drops trailing slashes and spaces", () => {
    assert.equal(comfyBase("http://192.168.2.45:8188/"), "http://192.168.2.45:8188");
    assert.equal(comfyBase("http://192.168.2.45:8188///"), "http://192.168.2.45:8188");
    assert.equal(comfyBase("  http://127.0.0.1:8188  "), "http://127.0.0.1:8188");
    assert.equal(comfyBase("http://127.0.0.1:8188"), "http://127.0.0.1:8188");
    assert.equal(comfyBase(undefined), "");
});
