/* eslint-disable no-undef */
/*
 * Megumin Suite — Side Panel parsers
 * Pulls structured data out of the <details> blocks the AI emits in chat
 * messages, and out of localProfile for things stored outside chat.
 */

// -----------------------------------------------------------------------------
// Block extraction
// -----------------------------------------------------------------------------

// The label text is the anchor, not the emoji. `(?:[^<\p{L}]*<[a-zA-Z][^>]*>)*[^<\p{L}]*`
// is a run of OPENING tags and letterless text only, so the emoji, `<b>`/`<strong>`
// (with or without attributes) and `**` are all optional, while the run can never
// cross this block's own `</summary>`. What it will not cross is a WORD: a summary
// that opens with prose about the block — `<summary>Author's note on the World State
// system</summary>` — is not the block, and used to parse as one and then be hidden
// out of the chat. `\b` after the label keeps a renamed label out. The `u` flag is
// what makes `\p{L}` mean "any letter", so every throwaway copy of these patterns
// made further down has to carry it too.
const BLOCK_PATTERNS = {
    worldState: /<details[^>]*>\s*<summary[^>]*>(?:[^<\p{L}]*<[a-zA-Z][^>]*>)*[^<\p{L}]*World State\b[\s\S]*?<\/summary\s*>\s*([\s\S]*?)\s*<\/details\s*>/iu,
    innerChatter: /<details[^>]*>\s*<summary[^>]*>(?:[^<\p{L}]*<[a-zA-Z][^>]*>)*[^<\p{L}]*NPC Inner Chatter\b[\s\S]*?<\/summary\s*>\s*([\s\S]*?)\s*<\/details\s*>/iu,
};

// Group 1 is still the name, group 2 still the body. The name stops at the first
// `<`; a trailing `**` from a markdown-bold summary is removed by stripBoldMarkers.
const NEW_NPC_PATTERN = /<details[^>]*>\s*<summary[^>]*>(?:[^<\p{L}]*<[a-zA-Z][^>]*>)*[^<\p{L}]*New NPC:\s*([^<]+)[\s\S]*?<\/summary\s*>\s*([\s\S]*?)\s*<\/details\s*>/igu;

// -----------------------------------------------------------------------------
// Envelope format
// -----------------------------------------------------------------------------
//
// Blocks now arrive inside `<Blocks> … </Blocks>` as named children, each in its
// own tag. Everything below matches against the WHOLE message and knows nothing
// about the wrapper, and that is deliberate: a reply cut off before `</Blocks>`
// arrives still has to give up every block it did manage to write. Scoping the
// search to the envelope's interior would turn one missing closing tag into the
// loss of every block at once — World State, the chatter, the tracker the Story
// Planner feeds on — instead of the loss of the one block that broke.
//
// Both shapes stay, indefinitely. Chats written before the envelope still carry
// `<details>` blocks and are never rewritten, so a parser that only knew the new
// shape would blind the panel to every message already on disk.
const BLOCK_TAGS = {
    worldState: "World_State",
    innerChatter: "NPC_Inner_Chatter",
};

// `[^>]*` after the name lets a tag carry attributes it does not need today.
function tagBlockRe(tag, flags) {
    return new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, flags);
}

// The truncated twin: opening tag, no closing one, body runs to the end of the
// text. Same shape as STORY_TRACKER_CUT_RE further down, for the same reason.
function tagBlockCutRe(tag, flags) {
    return new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)$`, flags);
}

// Is this block in this text at all, closed or cut off? Extraction and detection
// have to answer the same, or the handshake the whole inline hider is built on
// breaks: extractRawBlock recovering a truncated block that this says isn't
// there would put it in the panel AND leave it in the chat, which is the one
// outcome "parse first, hide second" exists to prevent.
function hasTagBlock(text, tag) {
    if (tagBlockRe(tag, "i").test(text)) return true;
    const cut = text.match(tagBlockCutRe(tag, "i"));
    return Boolean(cut && cut[1].trim());
}

// One dossier per match. The attributes are captured whole rather than picked
// apart in the pattern, because models quote inconsistently — `name="Gin"`,
// `name='Gin'` and `name=Gin` all turn up — and one tolerant reader beats three
// alternations. A dossier that forgot the attribute entirely still parses; the
// name is then read out of the body's own `**Name:**` field.
const NEW_NPC_TAG_PATTERN = /<New_NPC\b([^>]*)>([\s\S]*?)<\/New_NPC\s*>/ig;
const NAME_ATTR_RE = /name\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

function readNameAttr(attrChunk) {
    const m = String(attrChunk || "").match(NAME_ATTR_RE);
    if (!m) return "";
    return (m[1] ?? m[2] ?? m[3] ?? "").trim();
}

// Does this text carry the new envelope at all? Used by the renderer to decide
// whether a message is its business; never used to gate extraction.
export function hasBlockEnvelope(text) {
    return typeof text === "string" && /<Blocks\b[^>]*>/i.test(text);
}

export function findLastAssistantMessage(chat) {
    if (!Array.isArray(chat)) return null;
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (!m) continue;
        if (m.is_user) continue;
        if (m.is_system) continue;
        if (typeof m.mes !== "string" || !m.mes.trim()) continue;
        return { msg: m, index: i };
    }
    return null;
}

// Tag shape first, `<details>` shape second. A message can only really be one or
// the other, but asking in this order means the day both appear — a legacy block
// quoted inside a new reply, say — the current format wins.
export function extractRawBlock(text, kind) {
    if (!text) return null;

    const tag = BLOCK_TAGS[kind];
    if (tag) {
        const m = text.match(tagBlockRe(tag, "i"));
        if (m) return m[1].trim();
        // Truncated mid-block: take what arrived rather than nothing. The panel
        // showing half a World State beats the panel showing none of it.
        const cut = text.match(tagBlockCutRe(tag, "i"));
        if (cut && cut[1].trim()) return cut[1].trim();
    }

    if (!BLOCK_PATTERNS[kind]) return null;
    const legacy = text.match(BLOCK_PATTERNS[kind]);
    return legacy ? legacy[1].trim() : null;
}

// Which of the three tracker blocks do the patterns above actually find in this
// message? The inline hider asks this before hiding anything, so a block the
// panel can't read stays where the reader can see it.
//
// It has to be the RAW message text, not the chat DOM: the browser quietly
// repairs broken markup, so a DOM-side check would call a block fine that the
// patterns here just missed, and the block would disappear from the chat AND
// the panel. Plain string in, Set out, no DOM — testable outside the browser.
export function getParsedBlockTypes(mesText) {
    const found = new Set();
    if (typeof mesText !== "string" || !mesText) return found;
    // These two are non-global, so .test() has no position to remember. The tag
    // patterns are built fresh on every call, so they have none either.
    if (hasTagBlock(mesText, BLOCK_TAGS.worldState)
        || BLOCK_PATTERNS.worldState.test(mesText)) found.add("worldState");
    if (hasTagBlock(mesText, BLOCK_TAGS.innerChatter)
        || BLOCK_PATTERNS.innerChatter.test(mesText)) found.add("innerChatter");
    // NEW_NPC_PATTERN is /g and remembers where it stopped, so testing it
    // directly would answer differently the second time round on the same
    // text — and would shift the position parseNewNpcs starts from. Throwaway
    // non-global copy instead. Same trap, same fix, for the tag pattern.
    if (new RegExp(NEW_NPC_TAG_PATTERN.source, "i").test(mesText)
        || new RegExp(NEW_NPC_PATTERN.source, "iu").test(mesText)) found.add("newNpc");
    return found;
}

// The same question one level finer: HOW MANY of each block did the patterns
// above find? A companion to getParsedBlockTypes, not a replacement — that one
// still answers exactly what it always answered, and callers that only need
// "is this type here at all" keep using it.
//
// World State and NPC Inner Chatter are one-per-message shapes and their
// patterns are non-global, so their answer here is only ever 0 or 1 and it
// agrees with getParsedBlockTypes. New NPC dossiers are the reason this exists:
// a message can carry several, and the inline hider needs the real number so it
// can check that against how many dossiers are actually on screen.
export function getParsedBlockCounts(mesText) {
    const counts = { worldState: 0, innerChatter: 0, newNpc: 0 };
    if (typeof mesText !== "string" || !mesText) return counts;
    if (hasTagBlock(mesText, BLOCK_TAGS.worldState)
        || BLOCK_PATTERNS.worldState.test(mesText)) counts.worldState = 1;
    if (hasTagBlock(mesText, BLOCK_TAGS.innerChatter)
        || BLOCK_PATTERNS.innerChatter.test(mesText)) counts.innerChatter = 1;
    // Same statefulness guard as above, for the same reason: NEW_NPC_PATTERN is
    // /g and remembers where it stopped. Counting on a throwaway copy leaves the
    // shared pattern's position alone, so parseNewNpcs still starts from the top
    // and this function answers the same on every call. The count it returns is
    // exactly what parseNewNpcs would return the length of — same pattern, same
    // walk, and parseNewNpcs keeps every match it finds.
    // Counting through parseNewNpcs rather than a second walk of its own keeps
    // this answer and that one from ever drifting apart — it is the same walk,
    // and parseNewNpcs keeps every match it finds.
    counts.newNpc = parseNewNpcs(mesText).length;
    return counts;
}

// -----------------------------------------------------------------------------
// World State parser
// -----------------------------------------------------------------------------
//
// The block is loosely structured Markdown the AI writes free-form. We split on
// blank lines / section headings and try to identify segments (Date/Time,
// Location, Weather, PC subject, NPCs, Off-Screen, Unresolved Threads, Scene
// Phase). We never throw on missing fields — every section is best-effort.

const ICON_TO_LABEL = [
    { re: /📅|🗓/, label: "dateTime", name: "Date & Time" },
    { re: /📍|🌍/, label: "location", name: "Location" },
    { re: /☁|🌤|🌧|🌡|🌪|⛅|☀|🌫|⛈|🌩|🌨/, label: "weather", name: "Weather & Atmosphere" },
    { re: /🎭|🎬/, label: "scenePhase", name: "Scene Phase" },
    { re: /🔥|🧵/, label: "threads", name: "Unresolved Threads", multi: true },
    // 📡 is the antenna the full template's Off-Screen heading actually uses;
    // 🛰 is the satellite, a different character. Without it that heading fell
    // through to the NPC catch-all, where a heading with no name in front of it
    // is dropped — so the whole Off-Screen list vanished from the panel.
    { re: /🎤|🛰|📺|📡/, label: "offScreen", name: "Off-Screen", multi: true },
    // The last three rows of the full template's own World State block. Until now
    // no table knew them, so the segment walk found nothing to do with any of the
    // three and dropped all of them into the leftover text at the foot of the
    // panel. 🌱 and ⏳ are the characters the template writes; 🌰 and ⌛ are the
    // same two in their other spelling, which a model reaches for often enough to
    // be worth a bar. 🎯 is kept apart from the 🎬 above it: they are two
    // different rows of the block and the panel draws them as two different fields.
    { re: /🌱|🌰/, label: "plantedSeeds", name: "Planted Seeds", multi: true },
    { re: /⏳|⌛/, label: "consequenceTimers", name: "Consequence Timers", multi: true },
    { re: /🎯/, label: "arcPhase", name: "Arc Phase" },
    { re: /👥|🧑‍🤝‍🧑/, label: "npcsHeading", name: "NPCs Present", skip: true },
];

function splitBullets(text) {
    if (!text) return [];
    return text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => l.replace(/^[\-\*•]\s*/, "").trim())
        .filter(Boolean);
}

function stripBoldMarkers(s) {
    return (s || "").replace(/\*\*/g, "").replace(/<\/?b>/gi, "").trim();
}

// A field NAME is short and plain. The dossier template's longest label is
// "Secrets (never narrated unless disclosed)" at 41 characters, and no label
// carries a comma, a pipe, an em or en dash, or a spaced hyphen — those all
// belong to VALUES. So a colon sitting to the right of any of them is a colon
// inside the value, not the start of a field. Shared by the field-list reader
// and the compact NPC tail below, so both draw the line in the same place.
function fieldNameOf(rawKey) {
    const key = stripBoldMarkers(rawKey).replace(/[*_]/g, "").trim();
    if (!key || key.length > 48) return "";
    if (/[,|—–]| - /.test(key)) return "";
    return key;
}

function parseFieldList(body) {
    // Takes a block of bulleted "Field: value" lines and returns {field: value}
    const out = {};
    let lastKey = "";
    for (const raw of (body || "").split(/\r?\n/)) {
        const t = raw.trim();
        if (!t) continue;
        // Noted before the marker comes off: whether the line carried its own
        // bullet decides, further down, how it joins the field above it.
        const bulleted = /^[\-\*•]\s/.test(t);
        const line = t.replace(/^[\-\*•]\s*/, "").trim();
        if (!line) continue;
        const m = line.match(/^([^:]+):\s*(.*)$/);
        // Only a line that OPENS with a field-shaped name starts a field. An
        // Inner Circle person line — `Boyfriend — Yuki Tanaka | 26, lives next
        // door, streams CS: GO` — has a colon in the middle of its value, and
        // cutting the line at that colon made a phantom field out of the whole
        // front of it: the value ended at "CS" and the people on the lines
        // after it, carrying no colon at all, were dropped entirely. A line
        // that is not a field now attaches to the field above it instead, one
        // person per line, so multi-line values arrive whole.
        const key = m ? fieldNameOf(m[1]) : "";
        if (key) {
            // The full template writes its field names as `* *Outfit:* Grey coat`,
            // with the colon INSIDE the italics, so the closing `*` lands at the
            // front of the value and every field read `* Grey coat`. Single `*`
            // wrappers come off the value the same way they already come off the
            // key. `_` is left alone — it belongs inside words.
            out[key] = stripBoldMarkers(m[2]).replace(/^\*+\s*/, "").replace(/\s*\*+$/, "").trim();
            lastKey = key;
            continue;
        }
        const text = stripBoldMarkers(line).trim();
        // A line that carried its own bullet is one entry - one inner-circle
        // person - and stays a line of its own, so the card can draw the set
        // as a bullet list. A line with no bullet is a paragraph that wrapped,
        // so it joins the text above with a space and keeps its paragraph feel.
        if (lastKey && text) out[lastKey] = out[lastKey] ? out[lastKey] + (bulleted ? "\n" : " ") + text : text;
    }
    return out;
}

// The compact World State template writes its two summary lines as
// `**Time & Loc:** [Time] at [Location]` and `**PC:** [clothing] | [posture]`:
// no emoji, no `---` rule and no colon-terminated header, so nothing in the
// segment walk below claims them and the pair lands in leftovers as one lump.
// The labels accepted here are the compact template's own wording only — a
// full-template line is claimed by its emoji heading long before it gets here.
const COMPACT_LINE_RE = /^\s*[\-\*•]?\s*[*_]{0,2}\s*(?:\p{Extended_Pictographic}\s*)?(Time\s*(?:&|and)\s*Loc(?:ation)?|PC)\s*[*_]{0,2}\s*:\s*[*_]{0,2}\s*(\S.*)$/iu;

// Only fills a field that is still empty, so a full-template block that reached
// the same field through its emoji heading can never be overwritten from here.
// Hands back what is left of the segment once the compact lines are taken out.
function takeCompactLines(seg, result) {
    const rest = [];
    for (const line of seg.split(/\n/)) {
        const m = line.match(COMPACT_LINE_RE);
        const val = m ? stripBoldMarkers(m[2]) : "";
        if (!m || !val) { rest.push(line); continue; }
        if (/^PC$/i.test(m[1])) {
            // `[clothing] | [posture]` is the compact spelling of the full
            // template's own Outfit and Position fields, so it draws as the same
            // PC card instead of as a second shape the panel has to learn.
            const parts = val.split("|").map(p => p.trim()).filter(Boolean);
            if (!result.pc && parts.length) {
                const fields = { Outfit: parts[0] };
                if (parts.length > 1) fields.Position = parts.slice(1).join(" | ");
                result.pc = { name: "", fields };
            }
            continue;
        }
        // `[Time] at [Location]`: the FIRST ` at ` separates the two, so a place
        // name carrying its own " at " keeps everything after that first one.
        const at = val.match(/^(.*?\S)\s+at\s+(\S.*)$/i);
        if (!result.dateTime) result.dateTime = at ? at[1] : val;
        if (at && !result.location) result.location = at[2];
    }
    return rest.join("\n").trim();
}

// The full template opens with three headings on ONE line:
//   `**📅 Time:** [Date, Day, Time] | **🌤 Loc:** [Place | Region] | **🌡 Wx:** [Weather, Temp, Lighting]`
// Each value ends where the NEXT heading starts, never at the next `|`: the
// place is written `[Place | Region]` and carries a pipe of its own, so cutting
// the line on pipes would lose half of it. A heading is an emoji, an optional
// short word, and a colon — the colon is what keeps an emoji sitting in the
// middle of a value from being read as the start of a new heading.
const META_MARKER_RE = /[*_]{0,2}\s*(\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*)\s*([^:*_\n|]{0,24}?)\s*[*_]{0,2}\s*:\s*[*_]{0,2}\s*/gu;
const META_LABELS = ["dateTime", "location", "weather"];

// The heading's WORD decides which field the part belongs to, and the emoji is
// only the fallback. The template labels the place with 🌤 and the weather with
// 🌡 — both of them weather icons — so reading the emoji alone hands the place
// to the weather field and leaves the place empty.
const META_WORDS = [
    { re: /^(?:date|time|date\s*(?:&|and)\s*time|when)$/i, label: "dateTime" },
    { re: /^(?:loc|location|place|where)$/i, label: "location" },
    { re: /^(?:wx|weather|atmos(?:phere)?|temp)$/i, label: "weather" },
];

// Fills whichever of time / place / weather the line carries, and answers
// whether it was a multi-heading row at all. One heading means an ordinary
// single-value line, which the segment walk below already handles — so this
// hands it straight back and changes nothing about it. Never overwrites a
// field that is already filled.
function takeInlineMetaRow(line, result) {
    META_MARKER_RE.lastIndex = 0;
    const marks = [];
    let m;
    while ((m = META_MARKER_RE.exec(line)) !== null) {
        const word = (m[2] || "").trim();
        const icon = ICON_TO_LABEL.find(x => x.re.test(m[1]));
        const iconLabel = icon && META_LABELS.includes(icon.label) ? icon.label : null;
        const byWord = META_WORDS.find(w => w.re.test(word));
        // A heading with neither a word we know nor a time/place/weather emoji
        // is not part of this row — its text stays inside the value before it.
        if (!byWord && !iconLabel) continue;
        marks.push({ byWord, iconLabel, from: m.index, to: m.index + m[0].length });
    }
    if (marks.length < 2) return false;

    // A row with no words in it at all is read by position, in the order the
    // template writes the three: time, then place, then weather. It has to be
    // position — two of the three icons the template uses (🌤 for the place,
    // 🌡 for the weather) are both weather icons, so the emoji cannot tell them
    // apart. Where words ARE present they decide, and a wordless heading among
    // them keeps its own emoji's field unless an earlier part already took it.
    if (marks.every(k => !k.byWord)) {
        marks.forEach((k, i) => { k.label = META_LABELS[i] || k.iconLabel; });
    } else {
        const used = new Set(marks.filter(k => k.byWord).map(k => k.byWord.label));
        for (const k of marks) {
            if (k.byWord) { k.label = k.byWord.label; continue; }
            k.label = used.has(k.iconLabel)
                ? (META_LABELS.find(l => !used.has(l)) || k.iconLabel)
                : k.iconLabel;
            used.add(k.label);
        }
    }
    for (let i = 0; i < marks.length; i++) {
        const end = i + 1 < marks.length ? marks[i + 1].from : line.length;
        const val = stripBoldMarkers(line.slice(marks[i].to, end)).replace(/[|\s]+$/, "").trim();
        if (val && !result[marks[i].label]) result[marks[i].label] = val;
    }
    return true;
}

export function parseWorldState(raw) {
    if (!raw) return null;
    const result = {
        dateTime: null,
        location: null,
        weather: null,
        scenePhase: null,
        arcPhase: null,
        threads: [],
        plantedSeeds: [],
        consequenceTimers: [],
        offScreen: [],
        pc: null,            // { fields: {...}, name }
        npcs: [],            // [{ name, fields }]
        leftovers: [],
    };

    // Normalize line endings
    const text = raw.replace(/\r\n/g, "\n");

    // Split into top-level segments by horizontal rules, by a newline that
    // precedes a pictographic-emoji heading (excludes ASCII bullets like `*`),
    // or by a newline before an `NPCs Present` heading. That third rule is what
    // the compact template needs: it writes the heading with no emoji and no
    // `---` around it, so the first two rules never broke it out and its NPC
    // lines ended up in leftovers. The dressings allowed here (`*`/`_` wrappers,
    // an optional 👥, either case) are a subset of what classify() accepts below,
    // so a segment split off here always classifies as the NPCs heading. The `i`
    // flag is safe: nothing else in the pattern has a case to fold, and the closing
    // `(?![\p{L}\p{N}])` is a `\b` that also tolerates a trailing `__` wrapper.
    const segments = text
        .split(/\n\s*(?:---|—{2,})\s*\n|\n(?=\s*[_*]{0,2}\s*\p{Extended_Pictographic})|\n(?=\s*[_*]{0,2}\s*(?:👥\s*)?NPCs?\s+Present(?![\p{L}\p{N}]))/iu)
        .map(s => s.trim())
        .filter(Boolean);

    // Helper to classify a segment by its first non-empty line
    const classify = (seg) => {
        const head = (seg.split(/\n/)[0] || "").trim();
        for (const m of ICON_TO_LABEL) {
            if (m.re.test(head)) return m;
        }
        // NPCs before PC: an `NPCs Present` heading with no emoji and no colon
        // satisfies the PC test as well, because "NPCs" contains "PC". Left second,
        // it took the player's slot and swallowed the NPC list. Nothing a PC heading
        // looks like can start with "NPCs Present", so the reverse cannot happen.
        if (/^[\*_]*\s*[\p{Emoji}]?\s*NPCs?\s*Present/iu.test(head)) {
            return { label: "npcsHeading", name: "NPCs Present", skip: true };
        }
        // The full template heads the player's block with a standing person and
        // the character's own name: `**🧍 Adam:**`. There is no word in it to
        // match on — the emoji IS the marker — and the colon that ends the name
        // is exactly what the colon-free test below refuses. Sits AFTER the NPC
        // test above so an NPCs heading can never be taken for the player.
        // Anchored to the start of the line, unlike the icon table above: a
        // standing person in the middle of a sentence is somebody standing, not
        // a heading, and prose that happens to open a segment must stay prose.
        if (/^[*_\s]*🧍/u.test(head)) {
            return { label: "pc", name: "PC" };
        }
        if (/PC|Player|{{user}}|User:|Adam:/i.test(head) && /:/.test(head) === false) {
            return { label: "pc", name: "PC" };
        }
        return null;
    };

    // First pass: walk segments, assign labels
    let mode = null;
    let pcSeg = null;
    const npcSegments = [];

    for (const seg of segments) {
        const cls = classify(seg);
        const firstLine = seg.split(/\n/)[0].trim();
        const body = seg.replace(/^[^\n]*\n?/, "").trim();

        // The one-line time/place/weather row classifies as whichever of the
        // three its first heading is, so the split is tried for all three before
        // any of them takes the whole line as its own value.
        if (cls && (cls.label === "dateTime" || cls.label === "location" || cls.label === "weather")
            && takeInlineMetaRow(firstLine, result)) {
            mode = null;
            continue;
        }
        if (cls && cls.label === "dateTime") {
            result.dateTime = stripBoldMarkers(firstLine.replace(/^.*?:\s*/, "")) || stripBoldMarkers(body);
            mode = null;
            continue;
        }
        if (cls && cls.label === "location") {
            result.location = stripBoldMarkers(firstLine.replace(/^.*?:\s*/, "")) || stripBoldMarkers(body);
            mode = null;
            continue;
        }
        if (cls && cls.label === "weather") {
            result.weather = stripBoldMarkers(firstLine.replace(/^.*?:\s*/, "")) || stripBoldMarkers(body);
            mode = null;
            continue;
        }
        if (cls && cls.label === "scenePhase") {
            result.scenePhase = stripBoldMarkers(firstLine.replace(/^.*?:\s*/, "")) || stripBoldMarkers(body);
            mode = null;
            continue;
        }
        if (cls && cls.label === "arcPhase") {
            result.arcPhase = stripBoldMarkers(firstLine.replace(/^.*?:\s*/, "")) || stripBoldMarkers(body);
            mode = null;
            continue;
        }
        if (cls && cls.label === "threads") {
            result.threads = splitBullets(body || firstLine.replace(/^[^\n]*?:\s*/, ""));
            mode = null;
            continue;
        }
        // The template writes these two on one line each with the colon inside the
        // bold - `**🌱 Planted Seeds:** the letter under the door` - so the closing
        // `**` lands at the front of the value and has to come off, the same way the
        // Scene Phase line above already takes it off. A body under the heading wins
        // where there is one, so a model that writes either of them as a bulleted
        // list reads exactly the same.
        if (cls && (cls.label === "plantedSeeds" || cls.label === "consequenceTimers")) {
            result[cls.label] = splitBullets(stripBoldMarkers(body)
                || stripBoldMarkers(firstLine.replace(/^[^\n]*?:\s*/, "")));
            mode = null;
            continue;
        }
        if (cls && cls.label === "offScreen") {
            result.offScreen = splitBullets(body || firstLine.replace(/^[^\n]*?:\s*/, ""));
            mode = null;
            continue;
        }
        if (cls && cls.label === "npcsHeading") {
            mode = "npcs";
            // Body may already include the first NPC's sub-block; if so push it
            if (body) npcSegments.push(body);
            continue;
        }
        if (cls && cls.label === "pc") {
            pcSeg = seg;
            mode = null;
            continue;
        }

        // Mode-driven catch-all
        if (mode === "npcs") {
            npcSegments.push(seg);
            continue;
        }

        // Unrecognised — try to be smart: an "Adam:" or similar header looks like the PC,
        // and "Name:" headers under NPCs are an NPC
        const headerMatch = firstLine.match(/^\*{0,2}([A-Z][A-Za-z0-9 _.\-']{1,40}):\*{0,2}\s*$/);
        if (headerMatch && !result.pc) {
            pcSeg = seg;
            continue;
        }
        if (headerMatch) {
            npcSegments.push(seg);
            continue;
        }

        // The compact template's Time and PC lines land here. Whatever is left
        // of the segment once they are taken out still goes to leftovers.
        const remainder = takeCompactLines(seg, result);
        if (remainder !== seg) {
            if (remainder) result.leftovers.push(remainder);
            continue;
        }

        result.leftovers.push(seg);
    }

    // PC block: parse field list
    if (pcSeg) {
        const lines = pcSeg.split(/\n/);
        // `**🧍 Adam:**` has to come out as `Adam`: the bold markers go first,
        // then the leading emoji, then the colon that ended the heading — which
        // the old order missed whenever the `**` sat after it.
        const name = stripBoldMarkers(lines[0])
            .replace(/^\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*\s*/u, "")
            .replace(/\s*:\s*$/, "")
            .trim();
        const body = lines.slice(1).join("\n");
        result.pc = { name, fields: parseFieldList(body) };
    }

    // NPC blocks — may contain multiple NPCs in a single segment, separated
    // by a line that's just a `Name:` header. We split conservatively.
    // A name is any Unicode letter plus up to 59 more characters that are neither
    // `:` nor `*`, so quotes, parentheses, slashes, accents and CJK all pass and a
    // lowercase first letter is fine. `(?:\*\*)?` accepts `**Gwen:**` but rejects the
    // single-star `*Outfit:*` the full template uses for FIELD names.
    const namelineRe = /^\s*(?:\*\*)?\s*(\p{L}[^:*\n]{0,59}?)\s*:\s*(?:\*\*)?\s*$/u;
    // The compact template puts the whole NPC on one line: `* Gwen: red jacket`.
    const namelineInlineRe = /^\s*(?:\*\*)?\s*(\p{L}[^:*\n]{0,59}?)\s*:\s*(?:\*\*)?\s*(\S.*)$/u;
    for (const seg of npcSegments) {
        const lines = seg.split(/\n/);
        let current = null;
        // In the full template a `Field: value` line belongs to the NPC named above
        // it; in the compact template the same shape IS the NPC. Decide once per
        // segment, from whichever of the two shapes turns up first, and keep to it.
        let inlineMode = null;
        const flush = () => {
            if (!current) return;
            const name = stripBoldMarkers(current.name).trim();
            if (!name) return;
            const body = current.body.join("\n");
            let fields = parseFieldList(body);
            // The compact template writes the whole NPC on one line —
            // `* [Name]: [clothing] | [posture]` — and that tail carries no
            // `Field:` of its own, so the field list came back empty and the
            // clothing and the posture were thrown away. Read as the same
            // `[clothing] | [posture]` pair the compact PC line already uses, it
            // fills the same Outfit and Position the full template fills, so an
            // NPC draws the same in either mode. Fallback only: a tail that DID
            // parse as fields keeps them, and a name with lines under it is a
            // full-template NPC and never comes through here.
            if (current.inline && !/\n/.test(body.trim())) {
                const parts = stripBoldMarkers(body).split("|").map(p => p.trim()).filter(Boolean);
                // A compact tail may carry a colon inside the clothing —
                // `* Gwen: CS: GO shirt | behind the bar` — and read as a field
                // list that became a phantom "CS" field and the outfit and the
                // posture were both lost. The pipe decides: unless every
                // pipe-cut part is a whole `Field: value` of its own, the tail
                // is the template's clothing-and-posture pair.
                const allFields = parts.length > 1 && parts.every(p => {
                    const fm = p.match(/^([^:]+):/);
                    return fm && fieldNameOf(fm[1]);
                });
                if (parts.length
                    && (!Object.keys(fields).length || (parts.length > 1 && !allFields))) {
                    fields = { Outfit: parts[0] };
                    if (parts.length > 1) fields.Position = parts.slice(1).join(" | ");
                }
            }
            result.npcs.push({ name, fields });
        };
        for (const rawLine of lines) {
            // Only strip a bullet that is followed by a space, so `**Gwen:**` keeps
            // both of its stars and stays distinguishable from `*Outfit:*`.
            const line = rawLine.replace(/^\s*[\-\*•]\s+/, "");
            const m = line.match(namelineRe);
            const mi = m ? null : (inlineMode !== false ? line.match(namelineInlineRe) : null);
            if (m || mi) {
                if (inlineMode === null) inlineMode = !m;
                flush();
                current = m ? { name: m[1], body: [], inline: false }
                            : { name: mi[1], body: [mi[2]], inline: true };
            } else if (current) {
                current.body.push(rawLine);
            } else if (line.trim()) {
                // Stray content before any name header — start an unnamed NPC
                current = { name: "", body: [rawLine] };
            }
        }
        flush();
    }

    return result;
}

// -----------------------------------------------------------------------------
// NPC Inner Chatter parser
// -----------------------------------------------------------------------------
// Format: lines like `Name: "thought"` or `**Name:** "thought"`
//
// A thought that runs over more than one line carries the name on the first line
// only:
//
//     NPC1: Something something
//     Something2
//
// and Something2 belongs to NPC1. Read one line at a time, as this used to be, it
// became an entry of its own with nobody's name on it and drew as a second
// speaker behind a blank portrait. A line that is not a name line now joins the
// entry above it instead, so the count in the section badge goes on counting
// thoughts rather than lines.
//
// Only two things end an entry: a new name line, and the end of the block. A
// blank line is not one of them. A model that writes a thought as two paragraphs
//
//     NPC1: Text text.
//
//     text.
//
// means both paragraphs as NPC1's, and treating the gap as a boundary put the
// second one on screen under a blank portrait with nobody's name on it. The gap
// is kept as a gap - the entry carries a blank line at that point and draws with
// the paragraph break in it - but it does not break the attribution. A run of
// several blank lines is one break, and blank lines at the end of a block leave
// nothing behind.
//
// Two things still hold:
//
//   A line that IS a name line always starts a new speaker, blank line in front of
//   it or not. What counts as one is the same bounded name the NPC blocks use — up
//   to sixty characters, no colon of its own — so a long sentence with a colon in
//   the middle of it joins the thought above it instead of becoming a character
//   with a sentence for a name. Nothing that was read as a name before is refused
//   now; the bound only reaches past where a name can plausibly end.
//
//   A block whose first line has no name on it keeps that line with no name
//   against it, and anything under it joins that same unattributed entry. There is
//   nothing above it to belong to, and taking the name from the speaker further
//   down would be a guess.
const CHATTER_NAME_RE = /^\*{0,2}([^:*"]{1,60}?)\*{0,2}\s*:\s*(.*)$/;

// An odd number of straight quotes, or more opening curly quotes than closing
// ones, means the entry's quotation has not closed yet — the next line is the
// rest of that quoted thought, whatever punctuation it carries.
function quoteStillOpen(s) {
    if (!s) return false;
    if (((s.match(/"/g) || []).length) % 2 === 1) return true;
    return ((s.match(/“/g) || []).length) > ((s.match(/”/g) || []).length);
}

export function parseInnerChatter(raw) {
    if (!raw) return [];
    const out = [];
    // A run of blank lines is remembered rather than acted on, so a gap at the
    // end of a block adds nothing and a gap between two paragraphs of the same
    // thought becomes one break inside it.
    let gap = false;
    for (const rawLine of String(raw).split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) { gap = true; continue; }
        // Only a bullet at the very front comes off, on a name line and on a
        // continuation line alike, so a model that bullets every line of a
        // thought reads the same as one that bullets none of them.
        const cleaned = line.replace(/^[\-\*•]\s*/, "");
        const prev = out[out.length - 1];
        // While the entry above is still inside its quotation, a colon on the
        // wrapped line is part of the thought — `Rina: "He wore the` / `CS: GO
        // shirt again."` — not a new speaker called "CS". Outside a quotation
        // the name test runs exactly as it always has.
        const m = prev && quoteStillOpen(prev.quote) ? null : cleaned.match(CHATTER_NAME_RE);
        if (m) {
            out.push({
                name: stripBoldMarkers(m[1]).trim(),
                quote: stripBoldMarkers(m[2]).trim(),
            });
            gap = false;
            continue;
        }
        // Joins the entry above, whatever its name is or is not. The only entry
        // without a name is the one a block can open with, and a line under that
        // belongs to it for the same reason any other continuation belongs to the
        // line above it.
        const text = stripBoldMarkers(cleaned);
        if (prev) {
            prev.quote = prev.quote ? prev.quote + (gap ? "\n\n" : "\n") + text : text;
            gap = false;
            continue;
        }
        out.push({ name: "", quote: text });
        gap = false;
    }
    return out.filter(e => e.quote);
}

// -----------------------------------------------------------------------------
// Story Tracker
// -----------------------------------------------------------------------------
// `<Story_Tracker> ... </Story_Tracker>` is the block the Story Planner asks the
// model to append to every reply. It is not one of the folds above it, so it gets
// a pair of patterns of its own rather than a row in BLOCK_PATTERNS.
//
// Both patterns are the ones index.js already uses on this same block, character
// for character: attributes tolerated on the opening tag, whitespace tolerated
// before the `>` of the closing one. The second is the same answer the cleaner in
// index.js gives to a missing closing tag, applied to the reading side: a reply
// that stops mid-tracker has an opening tag and no closing one, and the part of
// the body that did arrive is still tracker text, so it is read to the end of the
// message rather than thrown away.
const STORY_TRACKER_RE = /<Story_Tracker[^>]*>([\s\S]*?)<\/Story_Tracker\s*>/i;
const STORY_TRACKER_CUT_RE = /<Story_Tracker[^>]*>([\s\S]*)$/i;

// A tracker line is `name: value`, and the template writes eight of them:
// arc_status, current_arc, main_event_progress, sub_event_advanced, npc_actions,
// simmering_threads, hidden_state and next_beat. The names are NOT checked against
// that list. A model drifts, the template itself is editable in the settings, and
// a field this reader has never heard of is still a field. What is checked is the
// shape of the name: it starts with a letter, carries no colon of its own, and is
// short — the same bounded-name discipline the NPC name lines use, so a sentence
// with a colon in the middle of it is not read as a field name.
//
// parseFieldList is deliberately not reused for these. That one strips every `*`
// AND every `_` out of a field name, which is right for the World State's
// `*Outfit:*` and wrong here: it would turn `arc_status` into `arcstatus` and the
// name on screen would stop matching the name in the template.
const TRACKER_FIELD_RE = /^\s*[\-\*•]?\s*[*_]{0,2}\s*([A-Za-z][^:*\n]{0,47}?)\s*[*_]{0,2}\s*:\s*(.*)$/;

// Reads the tracker out of one message's raw text. It always answers with an
// object, never null, so a caller can ask about any message with no guard around
// it. What comes back:
//
//   found      the handshake. A tracker was matched AND its body has something in
//              it. This is the question an inline hider has to ask before hiding
//              anything, the same question getParsedBlockTypes answers for the
//              three folds: if the panel could not get the block out of the
//              message, the block stays where the reader can see it.
//   truncated  the closing tag was missing and the body was read to the end.
//   raw        the whole matched span, opening tag included, exactly as it sits in
//              the message. This is what a hider needs to find the block again.
//   body       the inside of the span, trimmed.
//   fields     the `name: value` lines in the order the model wrote them, as
//              { key, value }. Repeats are kept: the model wrote them.
//   lines      every non-empty line of the body, in order, fields and free-form
//              alike — { key, value } for a field, { text } for anything else.
//              Nothing is dropped. A line the panel throws away is a line nobody
//              can ask about afterwards, and these blocks are written freely
//              enough that some of them will not be fields.
//
// Plain string in, plain object out. It reads the text it is handed and writes
// nowhere, which is what keeps it clear of the auto-evolve reader in index.js
// working on the same block of the same message.
export function parseStoryTracker(text) {
    const out = { found: false, truncated: false, raw: "", body: "", fields: [], lines: [] };
    if (typeof text !== "string" || !text) return out;
    let m = text.match(STORY_TRACKER_RE);
    if (!m) {
        m = text.match(STORY_TRACKER_CUT_RE);
        if (!m) return out;
        out.truncated = true;
    }
    out.raw = m[0];
    out.body = (m[1] || "").trim();
    // An empty tracker is a tracker nothing can be shown from, so it answers the
    // handshake with a no while still handing back the span it did find.
    if (!out.body) return out;
    out.found = true;
    for (const rawLine of out.body.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const f = line.match(TRACKER_FIELD_RE);
        // The template writes the whole pair inside the bold — `**arc_status:**
        // progressing` — so the closing stars land at the front of the value and
        // come off there, exactly as they do for a World State field.
        const key = f ? stripBoldMarkers(f[1]).trim() : "";
        if (key) {
            const value = stripBoldMarkers(f[2]).replace(/^\*+\s*/, "").replace(/\s*\*+$/, "").trim();
            out.fields.push({ key, value });
            out.lines.push({ key, value });
            continue;
        }
        out.lines.push({ text: stripBoldMarkers(line) });
    }
    return out;
}

// -----------------------------------------------------------------------------
// New NPC dossier (per-message) — only used to surface "freshly introduced" NPCs
// -----------------------------------------------------------------------------
export function parseNewNpcs(text) {
    if (!text) return [];
    const out = [];
    let m;

    // Tag shape. The name lives in an attribute now; a dossier that forgot it
    // falls back to the body's own `**Name:**` field, which every template
    // writes anyway — losing a whole dossier over a missing attribute would be
    // a poor trade.
    NEW_NPC_TAG_PATTERN.lastIndex = 0;
    while ((m = NEW_NPC_TAG_PATTERN.exec(text)) !== null) {
        const body = (m[2] || "").trim();
        const fields = parseFieldList(body);
        let name = stripBoldMarkers(readNameAttr(m[1])).trim();
        if (!name) {
            // parseFieldList answers with a plain { field: value } object, and the
            // key keeps the case the model wrote, so the lookup is case-insensitive.
            const key = Object.keys(fields).find(k => /^name$/i.test(k.trim()));
            // The template writes `**Name:** Gin | **Age:** 34`, so cut at the divider.
            if (key) name = stripBoldMarkers(String(fields[key] || "").split("|")[0]).trim();
        }
        out.push({ name, body, fields });
    }
    if (out.length) return out;

    // Legacy `<details>` shape, for every chat written before the envelope.
    NEW_NPC_PATTERN.lastIndex = 0;
    while ((m = NEW_NPC_PATTERN.exec(text)) !== null) {
        const name = stripBoldMarkers(m[1]).trim();
        const body = (m[2] || "").trim();
        out.push({ name, body, fields: parseFieldList(body) });
    }
    return out;
}

// -----------------------------------------------------------------------------
// Top-level orchestrator
// -----------------------------------------------------------------------------
export function parseMessage(text) {
    const worldRaw = extractRawBlock(text, "worldState");
    const chatterRaw = extractRawBlock(text, "innerChatter");
    return {
        rawText: text || "",
        worldRaw,
        chatterRaw,
        worldState: parseWorldState(worldRaw),
        innerChatter: parseInnerChatter(chatterRaw),
        newNpcs: parseNewNpcs(text),
        storyTracker: parseStoryTracker(text),
        // hasAny is deliberately left as it was. The panel uses it for one thing
        // only: which sentence to show when every section came back empty. A
        // tracker that arrived is never in that situation, because the Story
        // Planner section draws it and the panel then has something on screen.
        // Widening this would change a sentence in a file this change does not touch,
        // for a case that cannot happen.
        hasAny: Boolean(worldRaw || chatterRaw),
    };
}
