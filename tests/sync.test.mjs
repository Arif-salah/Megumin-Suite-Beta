// node --test "tests/*.test.mjs"
// Plan 020, phase 2: "This tab: This character only / Every character" is
// keyed by tab id; an old map keyed by tab title moves over once.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    TAB_SYNC_KEYS, TABS_ALREADY_GLOBAL, STORY_CONFIG_HOST_TAB,
    isSyncableTab, syncKeysFor, syncMapByTabId, sharedTabIds
} from "../src/core/syncKeys.js";
import { TAB_LIST, tabTitle, tabPath } from "../src/ui/tabList.js";

test("every tab with settings to share is a real tab, and the always-shared ones too", () => {
    const ids = TAB_LIST.map(t => t.id);
    for (const id of [...Object.keys(TAB_SYNC_KEYS), ...TABS_ALREADY_GLOBAL]) assert.ok(ids.includes(id), id);
    for (const id of TABS_ALREADY_GLOBAL) assert.equal(isSyncableTab(id), false, id);
    assert.equal(isSyncableTab("setup"), false, "Model Setup has its own choice");
    assert.equal(STORY_CONFIG_HOST_TAB, "preset");
});

test("Story Config's opt-out leaves it out of Preset & Thinking only", () => {
    assert.ok(syncKeysFor("preset", true).includes("storyConfig"));
    assert.ok(!syncKeysFor("preset", false).includes("storyConfig"));
    assert.ok(syncKeysFor("preset", false).includes("mode"));
    assert.deepEqual(syncKeysFor("images", false), ["imageGen"]);
    assert.equal(syncKeysFor("chomusuke"), null);
});

test("an old map keyed by title moves to tab ids", () => {
    const { map, changed } = syncMapByTabId({
        "Preset & Thinking": true, "Images": false, "Language & rules": true,
        "Chomusuke": true, "Model Setup": true, "Some Old Tab": true
    });
    assert.equal(changed, true);
    assert.deepEqual(map, { preset: true, images: false, addons: true });
});

test("already by id: nothing changes; an id already there wins over its title", () => {
    assert.deepEqual(syncMapByTabId({ preset: true, npc: false }), { map: { preset: true, npc: false }, changed: false });
    assert.deepEqual(syncMapByTabId({ "Blocks": true, blocks: false }).map, { blocks: false });
    assert.deepEqual(syncMapByTabId({ blocks: false, "Blocks": true }).map, { blocks: false });
    assert.deepEqual(syncMapByTabId(undefined), { map: {}, changed: false });
});

test("the tabs shared right now, in dock order", () => {
    const order = TAB_LIST.map(t => t.id);
    assert.deepEqual(sharedTabIds({ images: true, preset: true, npc: false, chomusuke: true }, order), ["preset", "images"]);
    assert.deepEqual(sharedTabIds(null, order), []);
});

test("tab names: Language & rules is a tab of its own, named alone", () => {
    assert.equal(tabTitle("addons"), "Language & rules");
    assert.equal(tabPath("addons"), "Language & rules");
    assert.equal(tabPath("images"), "Images");
    assert.equal(tabTitle("nope"), "");
});
