// node --test "tests/*.test.mjs"
// Plan 018, phase 5: the Model Setup loadouts, what they write into a
// profile, and "Changed from the loadout".
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    LOADOUTS, COMING_SOON, SETTINGS, loadoutById, settingFor, applyLoadout, changedFromLoadout, pickEngine,
    LENGTH_FLEXIBLE, LENGTH_SHORT
} from "../src/features/modelsetup/loadouts.js";
import { modes } from "../data/modes/index.js";
import { modes_v11taina } from "../data/modes/v11taina.js";
import { meguminCotForMode } from "../data/cot/index.js";

// Story Config keeps the sentence; the page reads its label. A stand-in for the two.
const SENTENCE = { [LENGTH_FLEXIBLE]: "flexible — up to 700", [LENGTH_SHORT]: "usually 250–350 words, longer only while a fight or sex scene is under way" };
const ctx = {
    lengthValue: l => SENTENCE[l] || l,
    lengthLabel: v => Object.keys(SENTENCE).find(k => SENTENCE[k] === v) || (v ? "custom" : "")
};

const profile = () => ({
    mode: "v10-core", model: "cot-v10-ukiyo-english", cotEnabled: true, activeStyleId: "dir_v10_ukiyo", aiRule: "x",
    storyConfig: { genre: "horror", pov: "second person. Your narration calls {{user}} \"you\"", length: "450–550 words per response" },
    banListBuiltIn: true, banListShort: false, addons: ["html", "dice"],
    chomusuke: { enabled: true, profileId: "p1", features: { memory: true, blocks: false } }
});

test("four loadouts to use, three coming soon, each on an engine that exists", () => {
    assert.deepEqual(LOADOUTS.map(l => l.id), ["gemini-pro", "claude", "big-open", "fast"]);
    assert.deepEqual(COMING_SOON.map(l => l.name), ["Gemini Flash", "Overthinkers", "Local"]);
    for (const l of LOADOUTS) {
        assert.ok(modes.some(m => m.id === l.settings.mode), l.id);
        for (const key of Object.keys(l.settings)) assert.ok(settingFor(key), `${l.id}: ${key}`);
        assert.equal(l.settings.thinking, l.id === "fast", "only DeepSeek uses the Thinking prompt");
        assert.doesNotMatch(l.why + l.notes.map(n => n.text).join(""), /\{\{|\[\[/, "no macros in what the user reads");
    }
});

test("the loadouts set what loadouts.md says", () => {
    const s = id => loadoutById(id).settings;
    assert.equal(s("gemini-pro").length, LENGTH_FLEXIBLE);
    assert.equal(s("gemini-pro").banList, "full");
    assert.equal(s("gemini-pro").html, undefined, "HTML left as it is");
    assert.equal(s("big-open").banList, "short");
    assert.equal(s("big-open").html, false);
    assert.equal(s("big-open").blocks, "story");
    assert.equal(s("fast").mode, "v11-deepseek");
    assert.equal(s("fast").length, LENGTH_SHORT);
    for (const f of ["blocks", "worldState", "notebook"]) assert.equal(s("fast")[f], "chomusuke");
    assert.ok(loadoutById("fast").notes.some(n => n.tone === "red" && n.chomusuke));
    assert.match(loadoutById("gemini-pro").notes[0].text, /Gemini 4/);
    for (const id of ["gemini-pro", "claude", "big-open"]) {
        assert.equal(loadoutById(id).settings.blocks, "story", id);
        assert.ok(loadoutById(id).notes.some(n => n.chomusuke && /off here/.test(n.text)), id);
    }
    assert.doesNotMatch(loadoutById("fast").notes.map(n => n.text).join(""), /NIM/);
});

test("using a loadout writes only its own settings", () => {
    const p = profile();
    applyLoadout(p, loadoutById("fast"), ctx);
    assert.equal(p.mode, "v11-deepseek");
    assert.equal(p.model, meguminCotForMode("v11-deepseek"));
    assert.equal(p.cotEnabled, true);
    assert.equal(p.storyConfig.length, SENTENCE[LENGTH_SHORT]);
    assert.equal(p.storyConfig.genre, "horror", "the story's own settings stay");
    assert.match(p.storyConfig.pov, /^second person/);
    assert.equal(p.banListShort, true);
    assert.deepEqual(p.addons, ["dice"]);
    assert.deepEqual(p.chomusuke.features, { memory: true, blocks: true, worldState: true, notebook: true });
    assert.equal(p.chomusuke.profileId, "p1", "the connection stays");
    assert.equal(p.activeStyleId, "dir_v11", "another generation's style becomes V11 Default");
    assert.equal(p.loadout, "fast");
    assert.deepEqual(changedFromLoadout(p, loadoutById("fast"), ctx), []);
});

test("a V11 style or your own style is kept", () => {
    for (const id of ["dir_v11_inside", "my-own-style"]) {
        const p = { ...profile(), activeStyleId: id, aiRule: "mine" };
        pickEngine(p, "v11-voice");
        assert.equal(p.activeStyleId, id);
        assert.equal(p.aiRule, "mine");
    }
});

test("Changed from the loadout: only the rows that differ, only for the loadout in use", () => {
    const p = profile();
    const l = loadoutById("big-open");
    assert.deepEqual(changedFromLoadout(p, l, ctx), [], "no loadout used yet");
    applyLoadout(p, l, ctx);
    settingFor("banList").write(p, "full", ctx);
    settingFor("thinking").write(p, true, ctx);
    assert.deepEqual(changedFromLoadout(p, l, ctx).sort(), ["banList", "thinking"]);
    assert.deepEqual(changedFromLoadout(p, loadoutById("claude"), ctx), [], "another loadout");
});

test("a profile saved before Chomusuke gets the template, switched off", () => {
    const p = profile();
    delete p.chomusuke;
    delete p.storyConfig;
    applyLoadout(p, loadoutById("fast"), { ...ctx, chomusukeTemplate: { enabled: false, profileId: "", features: { memory: true } } });
    assert.equal(p.chomusuke.enabled, false);
    assert.equal(p.chomusuke.features.blocks, true);
    assert.deepEqual(p.storyConfig, { length: SENTENCE[LENGTH_SHORT] });
});

test("the ban list row: full, short, off", () => {
    const b = settingFor("banList");
    const p = profile();
    b.write(p, "off", ctx);
    assert.equal(b.read(p, ctx), "off");
    b.write(p, "short", ctx);
    assert.deepEqual([p.banListBuiltIn, p.banListShort, b.read(p, ctx)], [true, true, "short"]);
    b.write(p, "full", ctx);
    assert.equal(b.read(p, ctx), "full");
    assert.equal(SETTINGS.length, 8);
});

test("V11 Тайна DeepSeek: V11 Тайна with one line back in <reader>, and its thinking", () => {
    const voice = modes_v11taina.find(m => m.id === "v11-voice");
    const ds = modes_v11taina.find(m => m.id === "v11-deepseek");
    assert.equal(ds.label, "V11 Тайна DeepSeek");
    assert.equal(ds.turnFrame, "v11");
    assert.equal(ds.recommended, undefined);
    const added = ds.p1.split("\n").filter(l => !voice.p1.split("\n").includes(l));
    assert.deepEqual(added, ["The reader plays {{user}}. {{char}} and every other person, place, and event in the story are yours to write and to move. If the story writes {{user}}'s words or choices, the reader has nothing left to play."]);
    assert.match(ds.p1, /^<role>\nYou are the narrator of an ongoing story\./, "the new opening stays");
    assert.equal(ds.contentRules, voice.contentRules);
    assert.equal(ds.repetition, voice.repetition);
    assert.equal(meguminCotForMode("v11-deepseek"), "cot-v11-voice-english");
});
