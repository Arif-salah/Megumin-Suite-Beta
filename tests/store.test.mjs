// node --test tests/
// The fake chat below copies what SillyTavern does to a message on swipe,
// delete and edit (script.js): a new swipe clones the current `extra`, swiping
// swaps `mes`/`extra` from swipe_info, deletes splice or truncate the array.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStateStore } from "../src/state/store.js";
import { worldModule } from "../src/state/modules/world/index.js";
import { findCast } from "../src/state/modules/world/model.js";

const U = body => `Prose.\n<World_Update>\n${body}\n</World_Update>`;
const S = body => `Prose.\n<World_State>\n${body}\n</World_State>`;
const BOOT = S("Time: Night\nLoc: Tavern\nKazuma.Outfit: green cape\n+ Aqua\nAqua.Outfit: blue dress\nAqua.Mood: smug");

function env({ depth = 200, chat = [], meta = {} } = {}) {
    const e = { chat, meta, saves: 0 };
    const adapter = {
        getChat: () => e.chat,
        getMeta: () => e.meta,
        saveMeta: () => { e.saves++; },
        saveChat: () => {},
        getUserNames: () => ["Kazuma"]
    };
    e.store = createStateStore({ adapter, modules: { world: worldModule }, journalDepth: depth });
    return e;
}

const ai = text => ({ is_user: false, is_system: false, mes: text, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} });
const user = text => ({ is_user: true, is_system: false, mes: text, extra: {} });

function receive(e, text) {
    e.chat.push(ai(text));
    e.store.recordMessage(e.chat.length - 1, { expect: true });
}
function send(e, text = "hi") { e.chat.push(user(text)); }

// Swipe right past the last swipe: ST clones the current extra into the new one.
function swipeNew(e, idx, text) {
    const m = e.chat[idx];
    m.swipe_info[m.swipe_id].extra = structuredClone(m.extra);
    m.swipes.push(text);
    m.swipe_info.push({ extra: structuredClone(m.extra) });
    m.swipe_id = m.swipes.length - 1;
    m.mes = text;
    m.extra = structuredClone(m.extra);
    e.store.reconcile();
    e.store.recordMessage(idx, { expect: true });
}
function swipeTo(e, idx, id) {
    const m = e.chat[idx];
    m.swipe_info[m.swipe_id].extra = structuredClone(m.extra);
    m.swipe_id = id;
    m.mes = m.swipes[id];
    m.extra = structuredClone(m.swipe_info[id].extra);
    e.store.reconcile();
}
function deleteSwipe(e, idx, id) {
    const m = e.chat[idx];
    m.swipes.splice(id, 1);
    m.swipe_info.splice(id, 1);
    if (m.swipe_id >= m.swipes.length) m.swipe_id = m.swipes.length - 1;
    else if (m.swipe_id > id) m.swipe_id--;
    m.mes = m.swipes[m.swipe_id];
    m.extra = structuredClone(m.swipe_info[m.swipe_id].extra);
    e.store.onSwipeDeleted(idx, id);
    e.store.reconcile();
}
const world = e => e.store.getState("world");
const aqua = e => findCast(world(e), "Aqua");

test("bootstrap then update", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: bath towel"));
    assert.equal(aqua(e).fields.outfit, "bath towel");
    assert.equal(world(e).pc.fields.outfit, "green cape");
});

test("stamps go into every swipe and seq follows the chat", () => {
    const e = env();
    receive(e, BOOT); send(e); receive(e, U("Time: Dawn"));
    const [a, , b] = e.chat;
    assert.ok(a.extra.megumin_uid && b.extra.megumin_uid);
    assert.ok(b.extra.megumin_seq > a.extra.megumin_seq);
    assert.equal(a.swipe_info[0].extra.megumin_uid, a.extra.megumin_uid);
});

test("swipe new, back, forward", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel"));
    swipeNew(e, 2, U("Aqua.Outfit: pajamas"));
    assert.equal(aqua(e).fields.outfit, "pajamas");
    swipeTo(e, 2, 0);
    assert.equal(aqua(e).fields.outfit, "towel");
    swipeTo(e, 2, 1);
    assert.equal(aqua(e).fields.outfit, "pajamas");
});

test("while a new swipe is generating, the prompt sees the state BEFORE that message", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel"));
    const m = e.chat[2];
    m.swipes.push(""); m.swipe_info.push({ extra: structuredClone(m.extra) });
    m.swipe_id = 1; m.mes = ""; m.extra = structuredClone(m.extra);
    e.store.reconcile();
    assert.equal(aqua(e).fields.outfit, "blue dress");
});

test("delete a swipe: later swipes shift down and stay correct", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: A"));
    swipeNew(e, 2, U("Aqua.Outfit: B"));
    swipeNew(e, 2, U("Aqua.Outfit: C"));
    deleteSwipe(e, 2, 0);                 // on C, which is now swipe 1
    assert.equal(e.chat[2].swipe_id, 1);
    assert.equal(aqua(e).fields.outfit, "C");
    swipeTo(e, 2, 0);
    assert.equal(aqua(e).fields.outfit, "B");
});

test("regenerate (delete last + receive) replaces the reply's changes", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel"));
    e.chat.length = 2; e.store.reconcile();
    assert.equal(aqua(e).fields.outfit, "blue dress");
    receive(e, U("Aqua.Mood: sleepy"));
    assert.equal(aqua(e).fields.outfit, "blue dress");
    assert.equal(aqua(e).fields.mood, "sleepy");
});

test("continue / reparse replaces the entry instead of stacking it", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel"));
    e.chat[2].mes += "\n" + U("Time: Dawn");
    e.store.recordMessage(2, { expect: true });
    const entries = e.store.activeEntries("world").filter(x => x.uid === e.chat[2].extra.megumin_uid);
    assert.equal(entries.length, 1);
    assert.equal(world(e).scene.time, "Dawn");
});

test("editing an earlier message re-applies later messages on top", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel")); send(e);
    receive(e, U("Aqua.Mood: flustered"));
    e.chat[2].mes = U("Aqua.Outfit: robe");
    e.store.recordMessage(2, { expect: true });
    assert.equal(aqua(e).fields.outfit, "robe");
    assert.equal(aqua(e).fields.mood, "flustered");
});

test("deleting the tail undoes it (rewind)", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel")); send(e);
    receive(e, U("- Aqua: upstairs"));
    e.chat.length = 3;
    const r = e.store.reconcile();
    assert.equal(r.dropped.length, 1);
    assert.equal(aqua(e).present, true);
    assert.equal(aqua(e).fields.outfit, "towel");
});

test("deleting an OLD message keeps its effects (cleanup, orphan)", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel")); send(e);
    receive(e, U("Aqua.Mood: flustered"));
    e.chat.splice(2, 1);
    const r = e.store.reconcile();
    assert.equal(r.orphaned.length, 1);
    assert.equal(aqua(e).fields.outfit, "towel");
    assert.equal(aqua(e).fields.mood, "flustered");
    // Deleting the bootstrap message too keeps everything.
    e.chat.splice(0, 1); e.store.reconcile();
    assert.equal(world(e).scene.location, "Tavern");
});

test("only the swipe that was showing survives as an orphan", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: A"));
    swipeNew(e, 2, U("Aqua.Outfit: B"));
    swipeTo(e, 2, 0);                        // A showing
    send(e); receive(e, U("Time: Dawn"));
    e.chat.splice(2, 1); e.store.reconcile();
    assert.equal(aqua(e).fields.outfit, "A");
});

test("hiding messages changes nothing", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel"));
    for (const m of e.chat) m.is_system = true;
    e.store.reconcile();
    assert.equal(aqua(e).fields.outfit, "towel");
});

test("reload: JSON round trip gives the same state", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel"));
    swipeNew(e, 2, U("Aqua.Outfit: pajamas"));
    const e2 = env({ chat: JSON.parse(JSON.stringify(e.chat)), meta: JSON.parse(JSON.stringify(e.meta)) });
    e2.store.reconcile();
    assert.deepEqual(world(e2), world(e));
});

test("branch: a truncated copy undoes what came after the branch point", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel")); send(e);
    receive(e, U("- Aqua: upstairs"));
    const b = env({ chat: JSON.parse(JSON.stringify(e.chat.slice(0, 3))), meta: JSON.parse(JSON.stringify(e.meta)) });
    b.store.reconcile();
    assert.equal(findCast(b.store.getState("world"), "Aqua").present, true);
    assert.equal(aqua(e).present, false, "the original chat is untouched");
});

test("returning after many messages remembers the character", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("- Aqua: went to the market"));
    for (let i = 0; i < 45; i++) { send(e); receive(e, U("No changes")); }
    // The user summarized and deleted the old part of the chat.
    e.chat.splice(0, 60); e.store.reconcile();
    send(e); receive(e, U("+ Aqua"));
    assert.equal(aqua(e).present, true);
    assert.equal(aqua(e).fields.outfit, "blue dress");
    assert.equal(aqua(e).fields.mood, "smug");
});

test("journal depth folds old entries into the checkpoint", () => {
    const e = env({ depth: 3 });
    receive(e, BOOT);
    for (const t of ["T1", "T2", "T3", "T4", "T5"]) { send(e); receive(e, U(`Time: ${t}`)); }
    const r = e.store.root();
    assert.ok(new Set(r.journal.map(x => x.seq)).size <= 3);
    assert.ok(r.checkpoint.seq > 0);
    assert.equal(world(e).scene.time, "T5");
    assert.equal(world(e).scene.location, "Tavern");
    // Editing a folded message is ignored rather than applied twice.
    e.chat[0].mes = S("Loc: Elsewhere");
    assert.equal(e.store.recordMessage(0, { expect: true }).folded, true);
    assert.equal(world(e).scene.location, "Tavern");
});

test("manual edit survives swipes; disabling an entry reverts it", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel"));
    const u = e.store.addUserEntry("world", { kind: "delta", changes: [{ type: "field", who: "Aqua", field: "outfit", value: "maid outfit" }] });
    swipeNew(e, 2, U("Aqua.Mood: angry"));
    assert.equal(aqua(e).fields.outfit, "maid outfit");
    e.store.setDisabled(u.id, true);
    assert.equal(aqua(e).fields.outfit, "blue dress");
    const step = e.store.getStep("world", e.chat[2].extra.megumin_uid);
    e.store.setDisabled(step.entry.id, true);
    assert.equal(aqua(e).fields.mood, "smug");
});

test("missing block is recorded as missing and does not count as state", () => {
    const e = env();
    receive(e, "Just prose, the model forgot the block.");
    const step = e.store.getStep("world", e.chat[0].extra.megumin_uid);
    assert.equal(step.entry.missing, true);
    assert.equal(e.store.hasState("world"), false);
    receive(e, BOOT);
    assert.equal(e.store.hasState("world"), true);
});

test("state at a message, for that message's card", () => {
    const e = env();
    receive(e, BOOT); send(e);
    receive(e, U("Aqua.Outfit: towel")); send(e);
    receive(e, U("Aqua.Outfit: robe"));
    const seqOf = i => e.chat[i].extra.megumin_seq;
    assert.equal(findCast(e.store.getStateAt("world", seqOf(0)), "Aqua").fields.outfit, "blue dress");
    assert.equal(findCast(e.store.getStateAt("world", seqOf(2)), "Aqua").fields.outfit, "towel");
    assert.equal(findCast(e.store.getStateAt("world", seqOf(4)), "Aqua").fields.outfit, "robe");
});

test("import: last full block plus every update after it", () => {
    const legacy = S("**📅 Time:** Night | **🌤 Loc:** Tavern\n**🧍 Kazuma:**\n* *Outfit:* cape\n**👥 NPCs Present:**\n**Aqua:**\n* *Outfit:* blue dress");
    const chat = [
        ai(S("Loc: Old place\n+ Wiz")),  // an older snapshot: ignored
        user("hi"), ai(legacy),
        user("hi"), ai(U("**Aqua:**\n* *Outfit:* towel")),
        user("hi"), ai("no block here")
    ];
    const e = env({ chat });
    const n = e.store.importFromChat("world");
    assert.equal(n, 2);
    assert.equal(world(e).scene.location, "Tavern");
    assert.equal(aqua(e).fields.outfit, "towel");
    assert.equal(findCast(world(e), "Wiz"), null);
    assert.equal(e.store.importFromChat("world"), 0, "import runs once");
    // Imported history is undoable like any other.
    e.chat.length = 4; e.store.reconcile();
    assert.equal(aqua(e).fields.outfit, "blue dress");
});

test("pending full rewrite clears when a snapshot lands", () => {
    const e = env();
    receive(e, BOOT); send(e);
    e.store.setPendingFullRewrite("world", true);
    receive(e, U("Time: Dawn"));
    assert.equal(e.store.isPendingFullRewrite("world"), true);
    send(e); receive(e, BOOT);
    assert.equal(e.store.isPendingFullRewrite("world"), false);
});

test("timer countdown across two swipes (reported in SillyTavern)", () => {
    const e = env();
    receive(e, S("Loc: Apartment\nKazuma.Outfit: hoodie\n+ Matt\nMatt.Outfit: tee\nTimer+: Rent split check due on the fridge counter, 3 turns"));
    send(e);
    receive(e, U([
        "Kazuma.Position: Standing inside the bedroom, near Matt",
        "Matt.Position: Standing inside Kazuma's bedroom near the foot of the bed, facing Kazuma",
        "Timer+: Rent split check due on the fridge counter: 2 turns",
        "Scene: Building"
    ].join("\n")));
    assert.deepEqual(world(e).timers, ["Rent split check due on the fridge counter: 2 turns"]);

    swipeNew(e, 2, "<Blocks>\n" + U([
        "Matt.Position: Standing inside the bedroom near the foot of the bed, held by the wrist, facing Kazuma",
        "Timer+: Rent split check due on the fridge counter: 1 turn",
        "Timer-: Rent split check due on the fridge counter: 2 turns",
        "Scene: Building"
    ].join("\n")) + "\n</Blocks>");
    assert.deepEqual(world(e).timers, ["Rent split check due on the fridge counter: 1 turn"]);

    swipeTo(e, 2, 0);
    assert.deepEqual(world(e).timers, ["Rent split check due on the fridge counter: 2 turns"]);
});

test("reset clears the module", () => {
    const e = env();
    receive(e, BOOT);
    e.store.reset("world");
    assert.equal(e.store.hasState("world"), false);
});
