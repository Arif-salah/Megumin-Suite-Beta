// ─────────────────────────────────────────────────────────────────────────────
// Megumin Suite — block text primitives
//
// The small markdown renderer the block card has always used, plus the stat-line
// parser that draws meters. Lifted out of render.js unchanged when the per-block
// treatments arrived: those need `esc` and `renderBody` too, and importing them
// back out of render.js would have made a cycle (render → treatments → render).
//
// This file is the bottom of the blocks layer. It imports nothing, and nothing
// here knows which block it is drawing — that is the whole reason it can be
// shared.
// ─────────────────────────────────────────────────────────────────────────────

export function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Deliberately small: bold, italic, bullets, paragraphs. The bodies are the
// model filling in a template of `**Field:** value` lines and bullet lists, and
// a full markdown engine here would be a second renderer to keep in step with
// SillyTavern's.
export function renderBody(text) {
    const inline = t => esc(t)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)!?]|$)/g, "$1<em>$2</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");

    const html = [];
    let list = null;

    const closeList = () => { if (list) { html.push(`<ul>${list.join("")}</ul>`); list = null; } };

    String(text).split(/\r?\n/).forEach(rawLine => {
        const line = rawLine.trim();
        if (!line) { closeList(); return; }

        const bullet = line.match(/^[*\-•]\s+(.*)$/);
        if (bullet) {
            if (!list) list = [];
            list.push(`<li>${inline(bullet[1])}</li>`);
            return;
        }
        closeList();

        if (/^---+$/.test(line)) { html.push(`<hr>`); return; }

        const stats = renderStatLine(line, inline);
        if (stats) { html.push(stats); return; }

        html.push(`<p>${inline(line)}</p>`);
    });
    closeList();

    return html.join("");
}

// A stat line: `Gin: Mood: tense | Affection: 34/100 (-6 she heard pity) | Trust: 12/100 (=)`
// or, with no subject, `HP: 78/100 (-12 fell) | Gold: 240 (=)`.
//
// Anything that does not look like one falls through to ordinary text, which is
// the correct failure: a block the model wrote loosely still reads, it just does
// not get bars.
const STAT_CELL = /^\s*([^:|]{1,32}?)\s*:\s*(.+?)\s*$/;
const METER_VALUE = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:\((.*)\))?$/;
const PLAIN_VALUE = /^(-?\d+(?:\.\d+)?)\s*(?:\((.*)\))?$/;

export function renderStatLine(line, inline) {
    if (!line.includes(":")) return null;

    // A leading `Name:` before the first field turns the line into someone's row.
    let subject = "";
    let rest = line;
    const parts = line.split("|");
    const firstColon = parts[0].indexOf(":");
    if (parts[0].slice(firstColon + 1).includes(":")) {
        subject = parts[0].slice(0, firstColon).trim();
        rest = line.slice(firstColon + 1);
    }

    const cells = rest.split("|").map(c => c.trim()).filter(Boolean);
    if (!cells.length) return null;

    const rendered = [];
    let meters = 0;

    for (const cell of cells) {
        const m = cell.match(STAT_CELL);
        if (!m) return null;
        const label = m[1].trim();
        const value = m[2].trim();

        const meter = value.match(METER_VALUE);
        if (meter) {
            meters++;
            const cur = parseFloat(meter[1]);
            const max = parseFloat(meter[2]) || 100;
            const pct = Math.max(0, Math.min(100, (cur / max) * 100));
            const note = (meter[3] || "").trim();
            const dir = /^[-−]/.test(note) ? "down" : /^\+/.test(note) ? "up" : "flat";
            rendered.push(`
                <div class="meg-stat">
                    <div class="meg-stat-top">
                        <span class="meg-stat-label">${esc(label)}</span>
                        <span class="meg-stat-value">${esc(meter[1])}<span class="meg-stat-max">/${esc(meter[2])}</span></span>
                    </div>
                    <div class="meg-stat-bar"><div class="meg-stat-fill" style="width:${pct.toFixed(1)}%"></div></div>
                    ${note && note !== "=" ? `<div class="meg-stat-note meg-stat-${dir}">${inline(note)}</div>` : ""}
                </div>`);
            continue;
        }

        const plain = value.match(PLAIN_VALUE);
        const note = plain ? (plain[2] || "").trim() : "";
        rendered.push(`
            <div class="meg-stat meg-stat-plain">
                <div class="meg-stat-top">
                    <span class="meg-stat-label">${esc(label)}</span>
                    <span class="meg-stat-value">${inline(plain ? plain[1] : value)}</span>
                </div>
                ${note && note !== "=" ? `<div class="meg-stat-note">${inline(note)}</div>` : ""}
            </div>`);
    }

    // No bars and no subject means this was ordinary prose with a colon in it.
    if (!meters && !subject) return null;

    return `<div class="meg-stat-row">
        ${subject ? `<div class="meg-stat-subject">${esc(subject)}</div>` : ""}
        <div class="meg-stat-grid">${rendered.join("")}</div>
    </div>`;
}
