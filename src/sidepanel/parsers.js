/* eslint-disable no-undef */
/*
 * Megumin Suite — Side Panel parsers
 * Pulls structured data out of the <details> blocks the AI emits in chat
 * messages, and out of localProfile for things stored outside chat.
 */

// -----------------------------------------------------------------------------
// Block extraction
// -----------------------------------------------------------------------------

const BLOCK_PATTERNS = {
    worldState: /<details[^>]*>\s*<summary[^>]*>[^<]*📌[\s\S]*?<b>\s*World State\s*<\/b>[\s\S]*?<\/summary>\s*([\s\S]*?)\s*<\/details>/i,
    innerChatter: /<details[^>]*>\s*<summary[^>]*>[^<]*💭[\s\S]*?<b>\s*NPC Inner Chatter\s*<\/b>[\s\S]*?<\/summary>\s*([\s\S]*?)\s*<\/details>/i,
};

const NEW_NPC_PATTERN = /<details[^>]*>\s*<summary[^>]*>[^<]*🆕[\s\S]*?<b>\s*New NPC:\s*([^<]+)\s*<\/b>[\s\S]*?<\/summary>\s*([\s\S]*?)\s*<\/details>/ig;

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

export function extractRawBlock(text, kind) {
    if (!text || !BLOCK_PATTERNS[kind]) return null;
    const m = text.match(BLOCK_PATTERNS[kind]);
    return m ? m[1].trim() : null;
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
    { re: /🎤|🛰|📺/, label: "offScreen", name: "Off-Screen", multi: true },
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

function parseFieldList(body) {
    // Takes a block of bulleted "Field: value" lines and returns {field: value}
    const out = {};
    for (const line of splitBullets(body)) {
        const m = line.match(/^([^:]+):\s*(.*)$/);
        if (!m) continue;
        const key = stripBoldMarkers(m[1]).replace(/[*_]/g, "").trim();
        const val = stripBoldMarkers(m[2]).trim();
        if (key) out[key] = val;
    }
    return out;
}

export function parseWorldState(raw) {
    if (!raw) return null;
    const result = {
        dateTime: null,
        location: null,
        weather: null,
        scenePhase: null,
        threads: [],
        offScreen: [],
        pc: null,            // { fields: {...}, name }
        npcs: [],            // [{ name, fields }]
        leftovers: [],
    };

    // Normalize line endings
    const text = raw.replace(/\r\n/g, "\n");

    // Split into top-level segments by horizontal rules or by a newline that
    // precedes a pictographic-emoji heading (excludes ASCII bullets like `*`).
    const segments = text
        .split(/\n\s*(?:---|—{2,})\s*\n|\n(?=\s*[_*]{0,2}\s*\p{Extended_Pictographic})/u)
        .map(s => s.trim())
        .filter(Boolean);

    // Helper to classify a segment by its first non-empty line
    const classify = (seg) => {
        const head = (seg.split(/\n/)[0] || "").trim();
        for (const m of ICON_TO_LABEL) {
            if (m.re.test(head)) return m;
        }
        if (/PC|Player|{{user}}|User:|Adam:/i.test(head) && /:/.test(head) === false) {
            return { label: "pc", name: "PC" };
        }
        if (/^[\*_]*\s*[\p{Emoji}]?\s*NPCs?\s*Present/iu.test(head)) {
            return { label: "npcsHeading", name: "NPCs Present", skip: true };
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
        if (cls && cls.label === "threads") {
            result.threads = splitBullets(body || firstLine.replace(/^[^\n]*?:\s*/, ""));
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

        result.leftovers.push(seg);
    }

    // PC block: parse field list
    if (pcSeg) {
        const lines = pcSeg.split(/\n/);
        const name = stripBoldMarkers(lines[0].replace(/:\s*$/, ""));
        const body = lines.slice(1).join("\n");
        result.pc = { name, fields: parseFieldList(body) };
    }

    // NPC blocks — may contain multiple NPCs in a single segment, separated
    // by a line that's just a `Name:` header. We split conservatively.
    const namelineRe = /^\s*\*{0,2}([A-Z][A-Za-z0-9 _.\-']{0,40})\s*:\s*\*{0,2}\s*$/;
    for (const seg of npcSegments) {
        const lines = seg.split(/\n/);
        let current = null;
        const flush = () => {
            if (!current) return;
            const name = stripBoldMarkers(current.name).trim();
            if (name) result.npcs.push({ name, fields: parseFieldList(current.body.join("\n")) });
        };
        for (const rawLine of lines) {
            const line = rawLine.replace(/^[\-\*•]\s*/, "");
            const m = line.match(namelineRe);
            if (m) {
                flush();
                current = { name: m[1], body: [] };
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
export function parseInnerChatter(raw) {
    if (!raw) return [];
    return raw
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => {
            const cleaned = l.replace(/^[\-\*•]\s*/, "");
            const m = cleaned.match(/^\*{0,2}([^:*"]+?)\*{0,2}\s*:\s*(.*)$/);
            if (m) {
                return {
                    name: stripBoldMarkers(m[1]).trim(),
                    quote: stripBoldMarkers(m[2]).trim(),
                };
            }
            return { name: "", quote: stripBoldMarkers(cleaned) };
        })
        .filter(e => e.quote);
}

// -----------------------------------------------------------------------------
// New NPC dossier (per-message) — only used to surface "freshly introduced" NPCs
// -----------------------------------------------------------------------------
export function parseNewNpcs(text) {
    if (!text) return [];
    const out = [];
    let m;
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
    const summaryRaw = extractRawBlock(text, "summary");
    return {
        rawText: text || "",
        worldRaw,
        chatterRaw,
        summaryRaw,
        worldState: parseWorldState(worldRaw),
        innerChatter: parseInnerChatter(chatterRaw),
        newNpcs: parseNewNpcs(text),
        hasAny: Boolean(worldRaw || chatterRaw || summaryRaw),
    };
}

// -----------------------------------------------------------------------------
// Combined "all blocks" regex used by the inline-hiding feature
// -----------------------------------------------------------------------------
export const ALL_TRACKER_BLOCKS_REGEX =
    /<details[^>]*>\s*<summary[^>]*>[^<]*(?:📌|💭|🆕)[\s\S]*?<\/summary>[\s\S]*?<\/details>/gi;
