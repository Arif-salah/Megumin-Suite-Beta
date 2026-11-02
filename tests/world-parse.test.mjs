// node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWorldBlocks, PC } from "../src/state/modules/world/parse.js";
import { emptyWorld, applyWorldChanges, presentCast, findCast } from "../src/state/modules/world/model.js";

const U = body => `Prose here.\n<World_Update>\n${body}\n</World_Update>`;
const S = body => `Prose here.\n<World_State>\n${body}\n</World_State>`;
const run = (text, prev = emptyWorld(), userNames = ["Kazuma"]) =>
    applyWorldChanges(prev, parseWorldBlocks(text), { seq: 1, userNames });

// A state with Aqua present, Kazuma as PC, and a couple of threads.
function base() {
    return run(S([
        "Time: Night", "Loc: Tavern", "Wx: Rain",
        "Kazuma.Outfit: green cape",
        "+ Aqua", "Aqua.Outfit: blue dress", "Aqua.Mood: smug",
        "Thread+: Who stole the guild's coin",
        "Thread+: The unpaid debt to the landlord"
    ].join("\n"))).state;
}

// ── New line format ─────────────────────────────────────────────────────

test("no block → null", () => {
    assert.equal(parseWorldBlocks("Just prose."), null);
});

test("No changes is understood and changes nothing", () => {
    const p = parseWorldBlocks(U("No changes"));
    assert.equal(p.noChanges, true);
    assert.equal(p.changes.length, 0);
    assert.equal(p.skipped.length, 0);
});

test("bootstrap snapshot in line format", () => {
    const s = base();
    assert.equal(s.scene.location, "Tavern");
    assert.equal(s.pc.fields.outfit, "green cape");
    assert.equal(findCast(s, "aqua").fields.outfit, "blue dress");
    assert.equal(findCast(s, "Aqua").present, true);
    assert.equal(s.threads.length, 2);
});

test("field update, arrival with inline fields, departure with where", () => {
    const r = run(U([
        "Aqua.Outfit: bath towel, wet hair",
        "+ Darkness: Outfit=full plate armor; Mood=eager",
        "- Aqua: went upstairs to change"
    ].join("\n")), base());
    const s = r.state;
    assert.equal(findCast(s, "Aqua").fields.outfit, "bath towel, wet hair");
    assert.equal(findCast(s, "Aqua").present, false);
    assert.equal(findCast(s, "Aqua").offscreen, "went upstairs to change");
    assert.equal(findCast(s, "Darkness").fields.outfit, "full plate armor");
    assert.equal(findCast(s, "Darkness").fields.mood, "eager");
    assert.deepEqual(presentCast(s).map(c => c.name), ["Darkness"]);
    assert.ok(r.applied.some(a => a.label === "Aqua · Outfit" && a.before === "blue dress"));
});

test("leaving keeps fields so a returning character is remembered", () => {
    let s = run(U("- Aqua: out shopping"), base()).state;
    s = run(U("+ Aqua"), s).state;
    assert.equal(findCast(s, "Aqua").present, true);
    assert.equal(findCast(s, "Aqua").fields.outfit, "blue dress");
    assert.equal(findCast(s, "Aqua").fields.mood, "smug");
});

test("thread add/remove, removal tolerates slightly different wording", () => {
    const s = run(U([
        "Thread-: who stole the guild's coin.",
        "Thread+: A demon crest on the coin"
    ].join("\n")), base()).state;
    assert.deepEqual(s.threads, ["The unpaid debt to the landlord", "A demon crest on the coin"]);
});

test("seeds, timers and phases are applied", () => {
    const s = run(U([
        "Seed+: a strange coin",
        "Timer+: guards arrive: 2 turns",
        "Arc: Escalation",
        "Scene: Building"
    ].join("\n")), base()).state;
    assert.deepEqual(s.seeds, ["a strange coin"]);
    assert.deepEqual(s.timers, ["guards arrive: 2 turns"]);
    assert.equal(s.arcPhase, "Escalation");
    assert.equal(s.scenePhase, "Building");
    assert.equal(s.scene.time, "Night", "timers must not touch the scene time");
});

test("timers: writing one again is a countdown, whatever the count format", () => {
    let s = run(U("Timer+: Guards arrive at the gate, 3 turns\nTimer+: Aqua's debt collector visits: 5 turns"), base()).state;
    s = run(U("Timer+: Guards arrive at the gate: 2 turns"), s).state;
    assert.deepEqual(s.timers, ["Guards arrive at the gate: 2 turns", "Aqua's debt collector visits: 5 turns"]);
    s = run(U("Timer+: Guards arrive at the gate (1 turn)"), s).state;
    assert.equal(s.timers[0], "Guards arrive at the gate (1 turn)");
    s = run(U("Timer+: Guards arrive at the gate in two turns"), s).state;
    assert.equal(s.timers.length, 2);
    s = run(U("Timer-: Guards arrive at the gate"), s).state;
    assert.deepEqual(s.timers, ["Aqua's debt collector visits: 5 turns"]);
});

test("timers: different subjects never merge", () => {
    let s = run(U("Timer+: Guards arrive: 2 turns\nTimer+: Guards leave: 4 turns"), base()).state;
    assert.equal(s.timers.length, 2);
    s = run(U("Timer+: Guards leave: 3 turns"), s).state;
    assert.deepEqual(s.timers, ["Guards arrive: 2 turns", "Guards leave: 3 turns"]);
});

test("removals run before additions within one reply", () => {
    let s = run(U("Timer+: Rent due: 3 turns"), base()).state;
    s = run(U("Timer+: Rent due: 1 turn\nTimer-: Rent due: 2 turns"), s).state;
    assert.deepEqual(s.timers, ["Rent due: 1 turn"]);
});

test("PC by persona name, {{user}}, PC and 's forms", () => {
    let s = run(U("Kazuma.Position: under the table"), base()).state;
    assert.equal(s.pc.fields.position, "under the table");
    s = run(U("PC.Carrying: a mug"), s).state;
    assert.equal(s.pc.fields.carrying, "a mug");
    s = run(U("{{user}}.Condition: soaked"), s).state;
    assert.equal(s.pc.fields.condition, "soaked");
    s = run(U("Kazuma's outfit: nothing but a towel"), s).state;
    assert.equal(s.pc.fields.outfit, "nothing but a towel");
    assert.equal(presentCast(s).some(c => c.name === "Kazuma"), false, "the PC is never an NPC");
});

test("field synonyms and custom fields", () => {
    const s = run(U([
        "Aqua.Clothes: pajamas",
        "Aqua.Emotion: sleepy",
        "Aqua.Hunger: starving"
    ].join("\n")), base()).state;
    const a = findCast(s, "Aqua");
    assert.equal(a.fields.outfit, "pajamas");
    assert.equal(a.fields.mood, "sleepy");
    assert.equal(a.fields.hunger, "starving");
});

test("alternate who/field separators", () => {
    let s = run(U("Aqua - Outfit: red kimono"), base()).state;
    assert.equal(findCast(s, "Aqua").fields.outfit, "red kimono");
    s = run(U("Aqua | Outfit: yukata"), s).state;
    assert.equal(findCast(s, "Aqua").fields.outfit, "yukata");
});

test("sentinel and placeholder values are ignored", () => {
    for (const v of ["unchanged", "same", "no change", "N/A", "—", "[New clothing if changed]"]) {
        const s = run(U(`Aqua.Outfit: ${v}`), base()).state;
        assert.equal(findCast(s, "Aqua").fields.outfit, "blue dress", v);
    }
});

test("markdown decoration, bullets, code fence, full-width colon", () => {
    const text = U([
        "```",
        "* **Aqua.Outfit：** swimsuit",
        "- **Time:** Dawn",
        "```"
    ].join("\n"));
    const s = run(text, base()).state;
    assert.equal(findCast(s, "Aqua").fields.outfit, "swimsuit");
    assert.equal(s.scene.time, "Dawn");
});

test("think blocks are ignored", () => {
    const p = parseWorldBlocks(`<think><World_Update>Aqua.Outfit: wrong</World_Update></think>${U("Aqua.Outfit: right")}`);
    assert.equal(p.changes[0].value, "right");
});

test("unclosed (cut-off) block drops its last line", () => {
    const p = parseWorldBlocks("Prose\n<World_Update>\nTime: Dawn\nAqua.Outfit: swim");
    assert.deepEqual(p.changes.map(c => c.type), ["scene"]);
});

test("unknown lines are reported, not guessed", () => {
    const p = parseWorldBlocks(U("Something vague happened"));
    assert.deepEqual(p.skipped, ["Something vague happened"]);
});

test("field for unknown character is an implicit arrival with a note", () => {
    const r = run(U("Megumin.Outfit: witch hat"), base());
    assert.equal(findCast(r.state, "Megumin").present, true);
    assert.equal(r.notes.length, 1);
});

test("snapshot marks absent anyone it does not list", () => {
    const s = run(S("Loc: Guild hall\n+ Darkness\nDarkness.Outfit: armor"), base()).state;
    assert.equal(findCast(s, "Aqua").present, false);
    assert.equal(findCast(s, "Aqua").fields.outfit, "blue dress");
    assert.equal(findCast(s, "Darkness").present, true);
});

test("both blocks: World_State first, World_Update on top", () => {
    const text = `${U("Aqua.Outfit: towel")}\n${S("Loc: Bath\n+ Aqua\nAqua.Outfit: robe")}`;
    const p = parseWorldBlocks(text);
    assert.equal(p.kind, "snapshot");
    const s = applyWorldChanges(emptyWorld(), p, {}).state;
    assert.equal(findCast(s, "Aqua").fields.outfit, "towel");
});

test("offscreen line", () => {
    const s = run(U("Wiz.Outfit: purple robe\nOffscreen: Wiz = restocking her shop"), base()).state;
    assert.equal(findCast(s, "Wiz").present, false);
    assert.equal(findCast(s, "Wiz").offscreen, "restocking her shop");
});

// Plan 022: "Old man Cairns", only mentioned, became a character this way.
test("an update's Offscreen line can't bring in someone new", () => {
    const r = run(U("Offscreen: Old man Cairns = asleep in the parlor"), base());
    assert.equal(findCast(r.state, "Old man Cairns"), null);
    assert.ok(r.notes.some(n => /skipped/.test(n)));
});

test("Offscreen-: removes the off-screen line, keeps the character", () => {
    const s = run(U("Wiz.Outfit: purple robe\nOffscreen: Wiz = restocking her shop"), base()).state;
    const r = applyWorldChanges(s, parseWorldBlocks(U("Offscreen-: Wiz")), { seq: 2 });
    assert.equal(findCast(r.state, "Wiz").offscreen, "");
    assert.equal(findCast(r.state, "Wiz").fields.outfit, "purple robe");
    assert.equal(r.notes.length, 0);
    // "Off-screen - : Wiz = gone" is read the same way
    const r2 = applyWorldChanges(s, parseWorldBlocks(U("Off-screen - : Wiz = gone for good")), { seq: 2 });
    assert.equal(findCast(r2.state, "Wiz").offscreen, "");
});

test("Offscreen-: on someone with no line is noted", () => {
    const r = run(U("Offscreen-: Nobody"), base());
    assert.equal(r.notes.length, 1);
});

test("at most 4 off-screen lines: the oldest go, the characters stay", () => {
    let s = base();
    ["Wiz", "Megumin", "Darkness", "Yunyun"].forEach((n, i) => {
        s = applyWorldChanges(s, parseWorldBlocks(U(`${n}.Mood: calm\nOffscreen: ${n} = somewhere ${i}`)), { seq: i + 2 }).state;
    });
    s = applyWorldChanges(s, parseWorldBlocks(U("- Aqua: went to the bath")), { seq: 10 }).state;
    assert.equal(findCast(s, "Wiz").offscreen, "");
    assert.ok(findCast(s, "Wiz"));
    assert.equal(findCast(s, "Megumin").offscreen, "somewhere 1");
    assert.equal(findCast(s, "Aqua").offscreen, "went to the bath");
    // two in one reply: the first written is the older
    s = applyWorldChanges(s, parseWorldBlocks(U("Chris.Mood: sly\nSena.Mood: busy\nOffscreen: Chris = a heist\nOffscreen: Sena = the guild")), { seq: 11 }).state;
    const away = Object.values(s.cast).filter(c => c.offscreen).map(c => c.name).sort();
    assert.deepEqual(away, ["Aqua", "Chris", "Sena", "Yunyun"]);
});

test("update rules carry the off-screen limit and Offscreen-:", async () => {
    const { renderWorldInstructions } = await import("../src/state/modules/world/render.js");
    const rules = renderWorldInstructions("update").rules;
    assert.match(rules, /Offscreen-: <Name>/);
    assert.match(rules, /Keep at most 4 Off-screen lines/);
});

test("the PC cannot leave", () => {
    const r = run(U("- Kazuma: walks off"), base());
    assert.equal(r.notes.length, 1);
    assert.equal(r.state.pc.fields.outfit, "green cape");
});

// ── Evidence cases: the old parser failed every one of these ─────────────

test("E1: NPC named Lockhart is not a Location header", () => {
    const s = run(U("**Lockhart:**\n* *Outfit:* steel armor"), base()).state;
    assert.equal(findCast(s, "Lockhart").fields.outfit, "steel armor");
    assert.equal(s.scene.location, "Tavern");
});

test("E2: NPC named Templar Knight is not Weather", () => {
    const s = run(U("**Templar Knight:**\n* *Mood:* angry"), base()).state;
    assert.equal(findCast(s, "Templar Knight").fields.mood, "angry");
    assert.equal(s.scene.weather, "Rain");
});

test("E3: 'unchanged' is not stored as an outfit", () => {
    const s = run(U("**Aqua:**\n* *Outfit:* unchanged\n* *Mood:* smug"), base()).state;
    assert.equal(findCast(s, "Aqua").fields.outfit, "blue dress");
});

test("E4: **- Aqua** (storms off) is a departure", () => {
    const s = run(U("**- Aqua** (storms off)"), base()).state;
    assert.equal(findCast(s, "Aqua").present, false);
    assert.equal(findCast(s, "Aqua").offscreen, "storms off");
    assert.deepEqual(Object.values(s.cast).map(c => c.name).filter(n => n.includes("-")), [], "no character named \"- Aqua\"");
});

test("E5: - Aqua (left the tavern) removes Aqua", () => {
    const s = run(U("- Aqua (left the tavern)"), base()).state;
    assert.equal(findCast(s, "Aqua").present, false);
    assert.equal(findCast(s, "Aqua").offscreen, "left the tavern");
});

test("E6: dash bullet with bold field", () => {
    const s = run(U("**Aqua:**\n- **Outfit:** blue dress, torn"), base()).state;
    assert.equal(findCast(s, "Aqua").fields.outfit, "blue dress, torn");
    assert.equal(findCast(s, "Aqua").present, true);
});

test("E7: *Outfit:* without a bullet space", () => {
    const s = run(U("**Aqua:**\n*Outfit:* green dress"), base()).state;
    assert.equal(findCast(s, "Aqua").fields.outfit, "green dress");
});

test("E8: 'Aqua: now wearing a towel' is reported, not misfiled", () => {
    const p = parseWorldBlocks(U("**Aqua:** now wearing a towel"));
    assert.equal(p.skipped.length, 1);
});

test("E9: echoed HTML comment blueprint is ignored", () => {
    const p = parseWorldBlocks(U("<!-- EDIT BLUEPRINT:\n**Aqua:**\n* *Outfit:* [New clothing if changed]\n-->\n**Darkness:**\n* *Outfit:* armor"));
    const s = applyWorldChanges(base(), p, {}).state;
    assert.equal(findCast(s, "Darkness").fields.outfit, "armor");
    assert.equal(findCast(s, "Aqua").fields.outfit, "blue dress");
    assert.equal(findCast(s, ">"), null);
});

test("E10: Consequence Timers line does not overwrite the time", () => {
    const s = run(U("**🌱 Planted Seeds:** a strange coin\n**⏳ Consequence Timers:** guards arrive in 2 turns"), base()).state;
    assert.equal(s.scene.time, "Night");
    assert.deepEqual(s.seeds, ["a strange coin"]);
    assert.deepEqual(s.timers, ["guards arrive in 2 turns"]);
});

// ── Legacy full markdown <World_State> ───────────────────────────────────

const LEGACY_FULL = `**📅 Time:** Night, Day 3 | **🌤 Loc:** Axel, tavern | **🌡 Wx:** Rain, warm lamplight

---

**🧍 Kazuma:**
* *Outfit:* green cape, travel leathers
* *Position:* corner table
* *Visible Condition:* soaked
* *Carrying:* coin pouch

---

**👥 NPCs Present:**
**Aqua:**
* *Outfit:* blue dress
* *Position:* at the bar
* *Mood:* smug
* *Agenda:* win back her followers
* *Secret:* spent the rent

**Darkness:**
* *Outfit:* plate armor
* *Position:* by the door

*[Repeat for each NPC currently in the scene]*
 ---
**📡 Off-Screen:**
* Wiz restocking her shop
* Megumin: practicing explosions outside town

---
**🔥 Unresolved Threads:**
* Who stole the guild's coin
* The unpaid debt
**🌱 Planted Seeds:** a demon crest on the coin
**⏳ Consequence Timers:** landlord collects in 2 turns
**🎯 Arc Phase:** Escalation
**🎬 Scene Phase:** Building`;

test("legacy full markdown World_State parses completely", () => {
    const r = applyWorldChanges(emptyWorld(), parseWorldBlocks(S(LEGACY_FULL)), { seq: 1, userNames: [] });
    const s = r.state;
    assert.equal(s.scene.time, "Night, Day 3");
    assert.equal(s.scene.location, "Axel, tavern");
    assert.equal(s.scene.weather, "Rain, warm lamplight");
    assert.equal(s.pc.name, "Kazuma");
    assert.equal(s.pc.fields.outfit, "green cape, travel leathers");
    assert.equal(s.pc.fields.condition, "soaked");
    assert.equal(findCast(s, "Aqua").fields.agenda, "win back her followers");
    assert.equal(findCast(s, "Darkness").fields.outfit, "plate armor");
    assert.deepEqual(presentCast(s).map(c => c.name), ["Aqua", "Darkness"]);
    assert.equal(findCast(s, "Wiz").offscreen, "restocking her shop");
    assert.equal(findCast(s, "Megumin").offscreen, "practicing explosions outside town");
    assert.deepEqual(s.threads, ["Who stole the guild's coin", "The unpaid debt"]);
    assert.deepEqual(s.seeds, ["a demon crest on the coin"]);
    assert.deepEqual(s.timers, ["landlord collects in 2 turns"]);
    assert.equal(s.arcPhase, "Escalation");
    assert.equal(s.scenePhase, "Building");
    assert.equal(findCast(s, "Kazuma"), null, "PC is not in the cast");
});

test("E11: legacy World_State without 🧍 and with **NPCs:** header", () => {
    const text = S("**📅 Time:** Night | **🌤 Loc:** Tavern | **🌡 Wx:** rain\n---\n**Kazuma:**\n* *Outfit:* green cape\n---\n**NPCs:**\n**Aqua:**\n* *Outfit:* blue dress\n**Darkness:**\n* *Outfit:* armor");
    const s = applyWorldChanges(emptyWorld(), parseWorldBlocks(text), { userNames: ["Kazuma"] }).state;
    assert.equal(s.pc.fields.outfit, "green cape");
    assert.equal(findCast(s, "Aqua").fields.outfit, "blue dress");
    assert.equal(findCast(s, "Darkness").fields.outfit, "armor");
});

test("E12: compact NPC lines", () => {
    const text = S("**📅 Time:** Night | **🌤 Loc:** Tavern\n---\n**🧍 Kazuma:**\n* *Outfit:* green cape\n---\n**👥 NPCs Present:**\n* **Aqua:** blue dress | standing by bar");
    const s = applyWorldChanges(emptyWorld(), parseWorldBlocks(text), {}).state;
    assert.equal(findCast(s, "Aqua").fields.outfit, "blue dress");
    assert.equal(findCast(s, "Aqua").fields.position, "standing by bar");
});

test("compact World_State template (Time & Loc / PC line)", () => {
    const text = S("**Time & Loc:** Dusk at the harbor\n**PC:** raincoat | leaning on a post\n**NPCs Present:**\n* Aqua: swimsuit | in the water");
    const s = applyWorldChanges(emptyWorld(), parseWorldBlocks(text), {}).state;
    assert.equal(s.scene.time, "Dusk");
    assert.equal(s.scene.location, "the harbor");
    assert.equal(s.pc.fields.outfit, "raincoat");
    assert.equal(s.pc.fields.position, "leaning on a post");
    assert.equal(findCast(s, "Aqua").fields.outfit, "swimsuit");
});

test("legacy update block: header, char section, arrival, departure", () => {
    const text = U("**📅 Time:** Midnight | **🌤 Loc:** Alley\n\n**Aqua:**\n* *Outfit:* muddy dress\n\n**+ Wiz:**\n* *Outfit:* purple robe\n\n**- Darkness**");
    let s = run(S(LEGACY_FULL)).state;
    s = run(text, s).state;
    assert.equal(s.scene.time, "Midnight");
    assert.equal(s.scene.location, "Alley");
    assert.equal(s.scene.weather, "Rain, warm lamplight");
    assert.equal(findCast(s, "Aqua").fields.outfit, "muddy dress");
    assert.equal(findCast(s, "Wiz").present, true);
    assert.equal(findCast(s, "Wiz").fields.outfit, "purple robe");
    assert.equal(findCast(s, "Darkness").present, false);
});

test("names with Loc/Time/Temp/Seed/Thread inside are safe", () => {
    const s = run(U("+ Locke\nLocke.Outfit: coat\n+ Timothy\nTimothy.Outfit: tunic\n+ Seedra\nSeedra.Mood: calm\n+ Threadbare Tom\nThreadbare Tom.Outfit: rags"), base()).state;
    assert.equal(findCast(s, "Locke").fields.outfit, "coat");
    assert.equal(findCast(s, "Timothy").fields.outfit, "tunic");
    assert.equal(findCast(s, "Seedra").fields.mood, "calm");
    assert.equal(findCast(s, "Threadbare Tom").fields.outfit, "rags");
    assert.equal(s.scene.location, "Tavern");
    assert.equal(s.scene.time, "Night");
});

test("a pipe inside a location is kept, in both formats", () => {
    let s = run(U("Loc: Axel | guild tavern"), base()).state;
    assert.equal(s.scene.location, "Axel | guild tavern");
    s = run(U("**📅 Time:** Dusk | **🌤 Loc:** Axel | back alley | **🌡 Wx:** fog"), base()).state;
    assert.equal(s.scene.time, "Dusk");
    assert.equal(s.scene.location, "Axel | back alley");
    assert.equal(s.scene.weather, "fog");
});

test("CRLF line endings", () => {
    const s = run(U("Aqua.Outfit: robe\r\nTime: Dawn"), base()).state;
    assert.equal(findCast(s, "Aqua").fields.outfit, "robe");
    assert.equal(s.scene.time, "Dawn");
});

test("replay is deterministic", () => {
    const p = parseWorldBlocks(U("Aqua.Outfit: towel\n- Aqua: upstairs"));
    const a = applyWorldChanges(base(), p, { seq: 2 }).state;
    const b = applyWorldChanges(base(), p, { seq: 2 }).state;
    assert.deepEqual(a, b);
});

test("PC token is exported for callers", () => {
    assert.equal(typeof PC, "string");
});

// ── Written twice in one update (reported with a local model) ────────────

test("a field written twice in one update: the first one counts", () => {
    const text = U([
        "Matt.Position: Standing inside Kazuma's bedroom, just past the threshold",
        "Matt.Mood: Expectant, slightly nervous",
        "Matt.Position: Planted on the rug, chin tilted up",
        "Time: Night",
        "Time: Later that night"
    ].join("\n"));
    const r = applyWorldChanges(base(), parseWorldBlocks(text), { userNames: ["Kazuma"] });
    assert.equal(findCast(r.state, "Matt").fields.position, "Standing inside Kazuma's bedroom, just past the threshold");
    assert.equal(r.state.scene.time, "Night");
    assert.equal(r.notes.filter(n => /written twice; the first one was used/.test(n)).length, 2);
});

test("twice under different spellings of the same name still counts as twice", () => {
    let s = run(S('Loc: Bedroom\n+ Matthew "Matt"\nMatthew.Outfit: tee')).state;
    s = applyWorldChanges(s, parseWorldBlocks(U("Matt.Position: at the door\nMatthew.Position: on the bed")), {}).state;
    assert.equal(findCast(s, "Matthew").fields.position, "at the door");
});

test("Condition is only for the player; an NPC's is ignored with a note", () => {
    const r = applyWorldChanges(base(), parseWorldBlocks(U("Aqua.Condition: soaked\nKazuma.Condition: tired")), { userNames: ["Kazuma"] });
    assert.equal(findCast(r.state, "Aqua").fields.condition, undefined);
    assert.equal(r.state.pc.fields.condition, "tired");
    assert.ok(r.notes.some(n => /Aqua\.Condition was ignored/.test(n)));
});

test("the update rules list fields per role and ask for each once", async () => {
    const { renderWorldInstructions } = await import("../src/state/modules/world/render.js");
    const rules = renderWorldInstructions("update").rules;
    assert.match(rules, /Fields for \{\{user\}\}: Outfit, Position, Condition, Carrying\n  Fields for everyone else: Outfit, Position, Mood, Agenda, Secret/);
    assert.match(rules, /Write each field at most once per character\./);
});
