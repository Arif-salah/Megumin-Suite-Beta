// node --test "tests/*.test.mjs"
// Plan 018, phase 5: the Model Setup loadouts, what they write into a
// profile, and "Changed from the loadout".
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    LOADOUTS, COMING_SOON, SETTINGS, loadoutById, settingFor, applyLoadout, changedFromLoadout, pickEngine, loadoutChanges,
    LENGTH_FLEXIBLE, LENGTH_SHORT
} from "../src/features/modelsetup/loadouts.js";
import { modes } from "../data/modes/index.js";
import { modes_v11taina } from "../data/modes/v11taina.js";
import { meguminCotForMode } from "../data/cot/index.js";
import { styleAfterPicking } from "../src/core/engines.js";

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

test("five loadouts to use, two coming soon, each on an engine that exists", () => {
    assert.deepEqual(LOADOUTS.map(l => l.id), ["gemini-pro", "gemini-flash", "claude", "big-open", "fast"]);
    assert.deepEqual(COMING_SOON.map(l => l.name), ["Overthinkers", "Local"]);
    for (const l of LOADOUTS) {
        assert.ok(modes.some(m => m.id === l.settings.mode), l.id);
        for (const key of Object.keys(l.settings)) assert.ok(settingFor(key), `${l.id}: ${key}`);
        assert.equal(l.settings.thinking, l.id === "fast" || l.id === "gemini-flash", "only DeepSeek and Gemini Flash use the Thinking prompt");
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
    assert.equal(s("big-open").chomusuke, "story");
    assert.equal(s("fast").mode, "v11-deepseek");
    assert.equal(s("fast").length, LENGTH_SHORT);
    assert.equal(s("fast").chomusuke, "chomusuke");
    assert.ok(loadoutById("fast").notes.some(n => n.tone === "red" && n.chomusuke && /image tags/.test(n.text)));
    for (const id of ["claude", "big-open"]) assert.ok(loadoutById(id).notes.some(n => /Keep the prefill off/.test(n.text)), id);
    assert.match(loadoutById("gemini-pro").notes[0].text, /Gemini 4/);
    for (const id of ["gemini-pro", "claude", "big-open"]) {
        assert.equal(loadoutById(id).settings.chomusuke, "story", id);
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
    assert.deepEqual(p.chomusuke.features, { memory: true, blocks: true, worldState: true, notebook: true, imageGen: true });
    assert.deepEqual(p.chomusuke.blockRoutes, { bonds: true, sheet: true, chatter: true, cyoa: true });
    assert.equal(p.chomusuke.profileId, "p1", "the connection stays");
    assert.equal(p.activeStyleId, "dir_v11", "another generation's style becomes V11 Default");
    assert.equal(p.loadout, "fast");
    assert.deepEqual(changedFromLoadout(p, loadoutById("fast"), ctx), []);
});

test("a loadout changed on the page before using it: its changes go in, and show as changed", () => {
    const p = profile();
    const l = loadoutById("gemini-pro");
    applyLoadout(p, l, ctx, { ...l.settings, banList: "short" });
    assert.equal(p.banListShort, true);
    assert.equal(p.cotEnabled, false);
    assert.deepEqual(changedFromLoadout(p, l, ctx), ["banList"]);
});

test("a V11 style or your own style is kept", () => {
    for (const id of ["dir_v11_inside", "my-own-style"]) {
        const p = { ...profile(), activeStyleId: id, aiRule: "mine" };
        pickEngine(p, "v11-voice");
        assert.equal(p.activeStyleId, id);
        assert.equal(p.aiRule, "mine");
    }
});

test("picking an engine: same generation keeps the style, another generation's built-in one moves over", () => {
    const pick = (m, id) => styleAfterPicking(m, id, id !== "my-own-style");
    assert.equal(pick({ id: "v11-writers-room" }, "dir_v11_inside"), null);
    assert.equal(pick({ id: "v11-voice" }, "dir_v11"), null);
    assert.equal(pick({ id: "v11-voice" }, "dir_v10_ukiyo"), "dir_v11");
    assert.equal(pick({ id: "v10-ukiyo" }, "dir_v11_inside"), "dir_v10_ukiyo");
    assert.equal(pick({ id: "v11-voice" }, ""), "dir_v11");
    assert.equal(pick({ id: "v11-voice" }, "my-own-style"), null);
    const p = { ...profile(), activeStyleId: "dir_v10_ukiyo", aiRule: "old" };
    pickEngine(p, "v11-deepseek");
    assert.equal(p.activeStyleId, "dir_v11");
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

test("the other characters get the loadout without Chomusuke, which is one setup for all", () => {
    const p = profile();
    delete p.chomusuke;
    delete p.storyConfig;
    applyLoadout(p, loadoutById("fast"), ctx, undefined, { skipGlobal: true });
    assert.equal(p.chomusuke, undefined);
    assert.equal(p.mode, "v11-deepseek");
    assert.deepEqual(p.storyConfig, { length: SENTENCE[LENGTH_SHORT] });
});

test("the Chomusuke row: on, off, or split in the Chomusuke tab", () => {
    const c = settingFor("chomusuke");
    const p = profile();
    assert.equal(c.read(p, ctx), "mixed", "memory's route doesn't count, the image route is on unless switched off");
    c.write(p, "chomusuke", ctx);
    assert.equal(c.read(p, ctx), "chomusuke");
    p.chomusuke.blockRoutes.cyoa = false;
    assert.equal(c.read(p, ctx), "mixed");
    c.write(p, "story", ctx);
    assert.equal(c.read(p, ctx), "story");
    assert.equal(p.chomusuke.features.memory, true, "the occasional jobs stay");
    assert.equal(p.chomusuke.profileId, "p1");
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

test("what Use this loadout would change: listed before, profile untouched (plan 020)", () => {
    const p = profile();
    const before = JSON.stringify(p);
    const changes = loadoutChanges(p, loadoutById("fast"), ctx);
    assert.equal(JSON.stringify(p), before, "the profile is not touched");
    const keys = changes.map(c => c.key);
    assert.deepEqual(keys, ["mode", "length", "banList", "html", "chomusuke", "style"]);
    assert.deepEqual(changes[0], { key: "mode", label: "Preset", from: "v10-core", to: "v11-deepseek" });
    assert.deepEqual(changes.find(c => c.key === "style"), { key: "style", label: "Writing style", from: "dir_v10_ukiyo", to: "dir_v11" });
    assert.ok(!keys.includes("thinking"), "custom thinking is already on: not listed");

    applyLoadout(p, loadoutById("fast"), ctx);
    assert.deepEqual(loadoutChanges(p, loadoutById("fast"), ctx), [], "nothing left to change");
    const l = loadoutById("gemini-pro");
    assert.deepEqual(loadoutChanges(p, l, ctx, { ...l.settings, banList: "short" }).map(c => c.key),
        ["mode", "thinking", "length", "geminiJB", "chomusuke"], "the page's changes count");
});

test("Gemini Flash is Gemini Pro with custom thinking on", () => {
    const pro = loadoutById("gemini-pro").settings, flash = loadoutById("gemini-flash").settings;
    assert.deepEqual({ ...flash, thinking: false, thinkingCap: undefined }, { ...pro, thinkingCap: undefined });
    assert.equal(flash.thinking, true);
    assert.equal(flash.thinkingCap, false);
});

test("only the Gemini loadouts have Gemini JB; using another one turns it off", () => {
    for (const l of LOADOUTS) assert.equal(l.settings.geminiJB, l.id.startsWith("gemini-") ? true : undefined, l.id);
    const p = profile();
    applyLoadout(p, loadoutById("gemini-flash"), ctx);
    assert.ok(p.addons.includes("gemini_jb") && p.addons.includes("html"), "other add-ons kept");
    assert.deepEqual(loadoutChanges(p, loadoutById("claude"), ctx).find(c => c.key === "geminiJB"),
        { key: "geminiJB", label: "Gemini JB", from: true, to: false }, "listed before Use this loadout");
    applyLoadout(p, loadoutById("claude"), ctx);
    assert.ok(!p.addons.includes("gemini_jb"));
    assert.ok(p.addons.includes("html"), "other add-ons kept");
});
