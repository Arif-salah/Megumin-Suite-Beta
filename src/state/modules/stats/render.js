// ────────────────────────────────────────────────────────────────────────────
// Stat blocks: what the story model reads in Current Info (plan 008).
// In-story wording only. Pure.
// ────────────────────────────────────────────────────────────────────────────

const line = fields => Object.values(fields || {})
    .filter(f => f && String(f.text || "").trim())
    .map(f => `${f.label}: ${f.text}`)
    .join(" | ");

/** "Anno: Mood: smug | Affection: 45/100", one line per chosen person. */
export function renderBondsNotes(state, keys) {
    const people = (state && state.people) || {};
    return (keys || [])
        .map(k => people[k])
        .filter(Boolean)
        .map(p => { const l = line(p.fields); return l ? `${p.name}: ${l}` : ""; })
        .filter(Boolean)
        .join("\n");
}

// One field of a history line: "Affection 45/100 (+5 gift)", "Mood cleared".
function changeText(f) {
    if (f.remove) return `${f.label} cleared`;
    const v = f.text || (f.delta !== undefined ? (f.delta > 0 ? `+${f.delta}` : String(f.delta)) : "");
    const why = f.delta !== undefined && f.text ? ` (${f.delta > 0 ? "+" : ""}${f.delta}${f.reason ? " " + f.reason : ""})` : f.reason && !f.text ? ` ${f.reason}` : "";
    return `${f.label} ${v}${why}`.trim();
}

/** A journal entry as readable lines, for the editor's History. */
export function describeStatsEntry(moduleId, parsed) {
    if (!parsed) return [];
    if (moduleId === "bonds") {
        return [
            ...(parsed.forget || []).map(n => `Forgot ${n}`),
            ...(parsed.people || []).map(p => `${p.name}: ${p.fields.map(changeText).join(" · ")}`)
        ];
    }
    if (moduleId === "sheet") return (parsed.fields || []).map(changeText);
    return parsed.text ? [parsed.text.split("\n")[0]] : [];
}

/** The player's sheet: short fields on one line, lists and sentences on their own. */
export function renderSheetNotes(state) {
    const fields = Object.values((state && state.fields) || {}).filter(f => f && String(f.text || "").trim());
    const short = fields.filter(f => f.value !== undefined);
    const long = fields.filter(f => f.value === undefined);
    return [
        short.map(f => `${f.label}: ${f.text}`).join(" | "),
        ...long.map(f => `${f.label}: ${f.text}`)
    ].filter(Boolean).join("\n");
}
