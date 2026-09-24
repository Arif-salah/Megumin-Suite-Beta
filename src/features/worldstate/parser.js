// ────────────────────────────────────────────────────────────────────────────
// World State & World Update parsers.
//
// Self-contained parser for:
// 1. <World_State>: Full baseline block emitted on turn 1 / bootstrap.
// 2. <World_Update>: Delta updates emitted when scene details change.
// ────────────────────────────────────────────────────────────────────────────

function stripFormatting(str) {
    if (!str || typeof str !== "string") return "";
    return str
        .replace(/[*_~`]/g, "")
        .replace(/<\/?(?:b|strong|i|em)[^>]*>/gi, "")
        .trim();
}

/**
 * Extracts and parses a <World_Update> block from message text.
 * Supports:
 * - Header changes (**Loc:**, **Time:**, **Wx:**)
 * - Structured character changes (**Name:** followed by * *Field:* Value)
 * - New character arrivals (+ Name or Name not yet in scene)
 * - Character departures (- Name)
 * - Section updates (**Off-Screen:**, **Threads:**, etc.)
 * @param {string} text
 * @returns {object|null}
 */
export function parseWorldUpdateBlock(text) {
    if (!text || typeof text !== "string") return null;

    const match = text.match(/<World_Update\b[^>]*>([\s\S]*?)(?:<\/World_Update\s*>|$)/i);
    if (!match) return null;

    const raw = match[1].trim();
    if (!raw) return null;

    const updates = {
        raw,
        header: {},
        characters: {}, // { [name]: { [field]: value } }
        addedCharacters: [], // [ { name, fields: { [field]: value } } ]
        removedCharacters: [], // [ name ]
        sections: {} // { offscreen: [...], threads: [...], seeds: "", timers: "", arcPhase: "", scenePhase: "" }
    };

    const lines = raw.split(/\r?\n/);
    let currentCharacter = null;
    let isCurrentCharNew = false;
    let currentSection = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("<!--") || line.startsWith("//") || /^---*$/.test(line)) continue;

        // Header cells inline with | separator (e.g. **Time:** ... | **Loc:** ...)
        if ((line.includes("Time:") || line.includes("Loc:") || line.includes("Wx:")) && line.includes("|")) {
            const locM = line.match(/(?:Loc|Location)\s*:\s*\*?\*?([^|*\n]+)/i);
            if (locM) {
                const val = stripFormatting(locM[1]);
                if (val && !/^\[.*\]$/.test(val)) updates.header.location = val;
            }

            const timeM = line.match(/Time\s*:\s*\*?\*?([^|*\n]+)/i);
            if (timeM) {
                const val = stripFormatting(timeM[1]);
                if (val && !/^\[.*\]$/.test(val)) updates.header.dateTime = val;
            }

            const wxM = line.match(/(?:Wx|Weather)\s*:\s*\*?\*?([^|*\n]+)/i);
            if (wxM) {
                const val = stripFormatting(wxM[1]);
                if (val && !/^\[.*\]$/.test(val)) updates.header.weather = val;
            }
            
            continue;
        }

        // Departure: "- Name" or "**- Name**"
        const departMatch = line.match(/^[\*\-•_\s]*-\s*[*_]{0,2}\s*([^:*_\n]{1,32}?)\s*[*_]{0,2}\s*:?$/);
        if (departMatch && !line.includes(":*") && !line.includes(":**")) {
            const name = stripFormatting(departMatch[1]);
            if (name) {
                updates.removedCharacters.push(name);
                currentCharacter = null;
                continue;
            }
        }

        // Arrival with explicit + sign: "+ Name" or "**+ Name:**"
        const arriveMatch = line.match(/^[\*\-•_\s]*\+\s*[*_]{0,2}\s*([^:*_\n]{1,32}?)\s*[*_]{0,2}\s*:?$/);
        if (arriveMatch) {
            const name = stripFormatting(arriveMatch[1]);
            if (name) {
                currentCharacter = name;
                isCurrentCharNew = true;
                if (!updates.characters[name]) updates.characters[name] = {};
                continue;
            }
        }

        // Character bullet field: "* *Field:* Value" or "- **Field:** Value"
        const bulletMatch = line.match(/^[*\-•][ 	]+[*_]{1,2}\s*([^:*_]{1,28}?)\s*:?\s*[*_]{1,2}\s*:?\s*(.*)$/);
        if (bulletMatch && currentCharacter) {
            const field = stripFormatting(bulletMatch[1]);
            const val = stripFormatting(bulletMatch[2]);
            if (field && val && !/^\[.*\]$/.test(val)) {
                if (!updates.characters[currentCharacter]) updates.characters[currentCharacter] = {};
                updates.characters[currentCharacter][field.toLowerCase()] = val;
            }
            continue;
        }

        // Off-screen or thread bullet: "* Name [activity]"
        if (bulletMatch && currentSection) {
            const val = stripFormatting(bulletMatch[0].replace(/^[*\-•]\s*/, ""));
            if (val && !/^\[.*\]$/.test(val)) {
                if (!updates.sections[currentSection]) updates.sections[currentSection] = [];
                updates.sections[currentSection].push(val);
            }
            continue;
        }

        // Section or Person Header: "**Name:**" or "**Section:**"
        const headerMatch = line.match(/^[*_]{2}\s*([^:*_\n]{1,32}?)\s*:?\s*[*_]{2}\s*:?\s*(.*)$/);
        if (headerMatch) {
            const rawLabel = stripFormatting(headerMatch[1]);
            const trailing = stripFormatting(headerMatch[2]);
            const lk = rawLabel.toLowerCase();

            if (lk.includes("off-screen") || lk.includes("offscreen")) {
                currentSection = "offscreen";
                currentCharacter = null;
                if (trailing) {
                    if (!updates.sections.offscreen) updates.sections.offscreen = [];
                    updates.sections.offscreen.push(trailing);
                }
                continue;
            }
            if (lk.includes("unresolved") || lk.includes("thread")) {
                currentSection = "threads";
                currentCharacter = null;
                if (trailing) {
                    if (!updates.sections.threads) updates.sections.threads = [];
                    updates.sections.threads.push(trailing);
                }
                continue;
            }
            if (lk.includes("loc") || lk.includes("location") || lk.includes("place")) {
                if (trailing && !/^\[.*\]$/.test(trailing)) updates.header.location = trailing;
                continue;
            }
            if (lk.includes("time") || lk.includes("date")) {
                if (trailing && !/^\[.*\]$/.test(trailing)) updates.header.dateTime = trailing;
                continue;
            }
            if (lk.includes("wx") || lk.includes("weather") || lk.includes("temp")) {
                if (trailing && !/^\[.*\]$/.test(trailing)) updates.header.weather = trailing;
                continue;
            }
            if (lk.includes("scene phase")) {
                if (trailing && !/^\[.*\]$/.test(trailing)) updates.sections.scenePhase = trailing;
                continue;
            }
            if (lk.includes("arc phase")) {
                if (trailing && !/^\[.*\]$/.test(trailing)) updates.sections.arcPhase = trailing;
                continue;
            }
            if (lk.includes("seed")) {
                if (trailing && !/^\[.*\]$/.test(trailing)) updates.sections.seeds = trailing;
                continue;
            }
            if (lk.includes("timer")) {
                if (trailing && !/^\[.*\]$/.test(trailing)) updates.sections.timers = trailing;
                continue;
            }

            // It's a character header: "**Name:**"
            currentCharacter = rawLabel.replace(/^🧍\s*/, "").replace(/^👥\s*/, "").replace(/^\+\s*/, "").trim();
            isCurrentCharNew = rawLabel.startsWith("+");
            currentSection = null;
            if (!updates.characters[currentCharacter]) updates.characters[currentCharacter] = {};
            continue;
        }

        // Standard single-line key-value fallback: "**Key:** Value"
        const kvMatch = line.match(/^[*\-•_\s]*([a-zA-Z\s&/]+?)[\*_\s]*:\s*(.+)$/);
        if (kvMatch) {
            const rawKey = kvMatch[1].trim().toLowerCase();
            const val = stripFormatting(kvMatch[2]);
            if (val && !/^\[.*\]$/.test(val)) {
                if (rawKey === "loc" || rawKey === "location" || rawKey === "place") updates.header.location = val;
                else if (rawKey === "time" || rawKey === "date") updates.header.dateTime = val;
                else if (rawKey === "wx" || rawKey === "weather" || rawKey === "temp") updates.header.weather = val;
                else if (rawKey.startsWith("pc ")) {
                    const pcSub = rawKey.slice(3).trim();
                    if (!updates.characters["{{user}}"]) updates.characters["{{user}}"] = {};
                    updates.characters["{{user}}"][pcSub] = val;
                }
            }
        }
    }

    const hasAny = Object.keys(updates.header).length > 0 ||
        Object.keys(updates.characters).length > 0 ||
        updates.removedCharacters.length > 0 ||
        Object.keys(updates.sections).length > 0;

    return hasAny ? updates : null;
}

/**
 * Extracts and parses a full <World_State> baseline block.
 * @param {string} text
 * @returns {object|null}
 */
export function parseWorldStateBlock(text) {
    if (!text || typeof text !== "string") return null;

    const match = text.match(/<World_State\b[^>]*>([\s\S]*?)(?:<\/World_State\s*>|$)/i);
    if (!match) return null;

    const raw = match[1].trim();
    if (!raw) return null;

    const state = {
        raw,
        dateTime: "",
        location: "",
        weather: "",
        pc: {
            name: "",
            outfit: "",
            position: "",
            condition: "",
            carrying: ""
        },
        npcOutfits: {},
        npcs: "",
        threads: ""
    };

    const lines = raw.split(/\r?\n/);
    let inNpcSection = false;
    let currentNpc = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Header cells
        if (line.includes("Time:") || line.includes("Loc:") || line.includes("Wx:")) {
            const locM = line.match(/(?:Loc|Location)\s*:\s*\*?\*?([^|*\n]+)/i);
            if (locM) state.location = stripFormatting(locM[1]);

            const timeM = line.match(/Time\s*:\s*\*?\*?([^|*\n]+)/i);
            if (timeM) state.dateTime = stripFormatting(timeM[1]);

            const wxM = line.match(/(?:Wx|Weather)\s*:\s*\*?\*?([^|*\n]+)/i);
            if (wxM) state.weather = stripFormatting(wxM[1]);
        }

        // Section boundary tracking
        if (line.includes("👥 NPCs Present") || line.includes("NPCs Present")) {
            inNpcSection = true;
            currentNpc = null;
            continue;
        }
        if (inNpcSection && (line.includes("📡") || line.includes("🔥") || /^---*$/.test(line))) {
            inNpcSection = false;
            currentNpc = null;
        }

        // PC name from header line (e.g. **🧍 Kazuma:** or **🧍 Adam:**)
        if (line.includes("🧍") && !state.pc.name) {
            const pcNameM = line.match(/^[*\-•_\s]*\*\*🧍\s*([^*:\n]+)\s*:?\*\*/);
            if (pcNameM) state.pc.name = stripFormatting(pcNameM[1]);
        }

        // NPC header inside NPCs Present section
        if (inNpcSection) {
            const npcHeaderM = line.match(/^[*\-•_\s]*\*\*([^*:\n]+)\s*:?\*\*/);
            if (npcHeaderM && !npcHeaderM[1].includes("NPCs Present")) {
                currentNpc = stripFormatting(npcHeaderM[1]);
                continue;
            }
        }

        // Outfit & posture matching
        if (/Outfit\s*:/i.test(line)) {
            const m = line.match(/Outfit\s*:\s*\*?\*?([^*\n]+)/i);
            if (m) {
                const val = stripFormatting(m[1]);
                if (inNpcSection && currentNpc) {
                    state.npcOutfits[currentNpc] = val;
                } else if (!state.pc.outfit) {
                    state.pc.outfit = val;
                }
            }
        }
        if (/Position\s*:/i.test(line) && !state.pc.position && !inNpcSection) {
            const m = line.match(/Position\s*:\s*\*?\*?([^*\n]+)/i);
            if (m) state.pc.position = stripFormatting(m[1]);
        }
    }

    return state;
}
