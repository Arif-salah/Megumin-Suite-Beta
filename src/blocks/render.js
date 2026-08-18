/* eslint-disable no-undef */
/*
 * Megumin Suite — Master Block renderer
 *
 * SillyTavern's sanitizer strips unknown tags out of the rendered DOM but leaves
 * their text behind, and the raw text stays in message.mes. So there is no
 * <World_State> element to find and restyle: the blocks arrive on screen as
 * loose paragraphs at the end of the message, and the tags that named them are
 * already gone by the time anything here runs.
 *
 * This file therefore works from mes, not from the DOM. It reads the blocks out
 * of the raw text, hides the paragraphs the sanitizer left behind, and appends
 * one card built from what it parsed.
 *
 * Two rules everything here follows:
 *
 *   Never rewrite mes.       Stored text stays canonical, so swipes, edits,
 *                            regeneration and the summariser all keep seeing
 *                            exactly what the model wrote.
 *   Fail visible.            Anything unexpected and the message is left the way
 *                            SillyTavern rendered it. That is the behaviour from
 *                            before this file existed, so the worst outcome is
 *                            "no improvement" and never "lost content".
 */

const CARD_CLASS = "meg-blocks";
const HIDDEN_ATTR = "data-meg-blocks-hidden";
const STAMP_ATTR = "data-meg-blocks-stamp";

// The block that is open when a card is first drawn, and the one it falls back
// to when the reader closes whatever they opened. Everything else starts shut.
const ALWAYS_OPEN_ID = "cyoa";

// -----------------------------------------------------------------------------
// Reading the blocks out of the raw message
// -----------------------------------------------------------------------------

// Every block in the message, in the order the model wrote them — which is not
// necessarily the order of the stack, and the reader should see what arrived.
//
// The envelope is not required and is never searched inside: a reply cut off
// before </Blocks> still gives up every block it managed to write. Same rule the
// parsers follow, for the same reason.
export function extractBlocks(mes, registry) {
    const out = [];
    if (typeof mes !== "string" || !mes) return out;

    (registry || []).forEach(def => {
        if (!def.tag) return;
        const re = new RegExp(`<${def.tag}\\b([^>]*)>([\\s\\S]*?)<\\/${def.tag}\\s*>`, "gi");
        let m;
        while ((m = re.exec(mes)) !== null) {
            const body = (m[2] || "").trim();
            if (!body) continue;
            out.push({
                def,
                at: m.index,
                raw: m[0],
                name: def.repeating ? readNameAttr(m[1]) : "",
                body,
                truncated: false
            });
            if (!def.repeating) break;
        }

        // Cut off mid-block: opening tag, no closing one. Take what arrived —
        // half a World State on screen beats none of it, and the message is
        // already visibly broken to the reader.
        if (!out.some(b => b.def === def)) {
            const cut = mes.match(new RegExp(`<${def.tag}\\b([^>]*)>([\\s\\S]*)$`, "i"));
            if (cut && cut[2].trim()) {
                out.push({
                    def,
                    at: cut.index,
                    raw: cut[0],
                    name: def.repeating ? readNameAttr(cut[1]) : "",
                    body: cut[2].trim(),
                    truncated: true
                });
            }
        }
    });

    return out.sort((a, b) => a.at - b.at);
}

function readNameAttr(attrChunk) {
    const m = String(attrChunk || "").match(/name\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!m) return "";
    return (m[1] ?? m[2] ?? m[3] ?? "").replace(/\*\*/g, "").trim();
}

// The text the sanitizer will have left on screen for the block region: every
// block body, plus the envelope's own stray text, with the tags taken out.
// Used only to measure how much of the message tail to hide.
function remnantTextOf(mes, blocks) {
    if (!blocks.length) return "";
    const first = Math.min(...blocks.map(b => b.at));
    // From the envelope opener if there is one before the first block, so the
    // stray text of a <Blocks> line is measured too.
    const envAt = mes.search(/<Blocks\b[^>]*>/i);
    const from = envAt > -1 && envAt < first ? envAt : first;
    // To the end of the LAST block, never to the end of the message. CYOA is
    // excluded from the envelope and the model puts it after the blocks, so
    // measuring to the end would count the options box as block text, come up
    // short against what is actually hidden, and refuse the whole message.
    const to = Math.max(...blocks.map(b => b.at + b.raw.length));
    return mes.slice(from, to).replace(/<[^>]*>/g, " ");
}

// -----------------------------------------------------------------------------
// Building the card
// -----------------------------------------------------------------------------

function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Deliberately small: bold, italic, bullets, paragraphs. The bodies are the
// model filling in a template of `**Field:** value` lines and bullet lists, and
// a full markdown engine here would be a second renderer to keep in step with
// SillyTavern's.
function renderBody(text) {
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

function renderStatLine(line, inline) {
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

// One card for the whole set: a strip of tabs across the top, one panel below.
// Shared by the chat and by the preview in the BLOCKS tab — a preview rendered
// by different code from the chat is worse than no preview, because it is
// confidently wrong.
export function buildBlocksCard(blocks, opts = {}) {
    const doc = opts.document || document;
    // `omit` is what the side panel has taken over. A block the panel is showing
    // should not also be in the chat, and a block the panel is NOT showing has to
    // stay here or it would be nowhere at all.
    const omit = opts.omit || [];
    const shown = blocks.filter(b =>
        (b.def.visibility || "open") !== "hidden" && !omit.includes(b.def.id));

    const card = doc.createElement("div");
    card.className = CARD_CLASS;
    card.setAttribute("data-meg-blocks", "1");
    if (opts.preview) card.classList.add("meg-blocks-preview");
    if (!shown.length) {
        // Every block in this message is set to hidden. The remnants are hidden
        // from the chat too, so the reader simply sees nothing — which is what
        // "hidden" means.
        card.classList.add("meg-blocks-empty");
        return card;
    }

    // A repeating block appears once per dossier, so tab keys have to separate
    // them or two New NPCs would fight over one tab.
    const keyOf = b => b.def.repeating && b.name ? `${b.def.id}:${b.name}` : b.def.id;

    const tabs = doc.createElement("div");
    tabs.className = "meg-blocks-tabs";

    const panel = doc.createElement("div");
    panel.className = "meg-blocks-panel";

    const buttons = [];
    const panels = [];

    // The choices block is the one the reader acts on, so it is the one thing a
    // card shows without being asked. Everything else waits to be clicked.
    const resting = shown.find(b => b.def.id === ALWAYS_OPEN_ID);
    const restingKey = resting ? keyOf(resting) : null;

    // A null key means nothing is open: no tab lit, no panel drawn, just the
    // strip. That is the resting state for every card.
    let current = null;
    const select = key => {
        current = key;
        buttons.forEach(btn => btn.classList.toggle("active", key !== null && btn.dataset.key === key));
        panels.forEach(p => { p.style.display = key !== null && p.dataset.key === key ? "" : "none"; });
        card.classList.toggle("meg-blocks-shut", key === null);
    };

    shown.forEach(b => {
        const key = keyOf(b);
        const label = b.name ? `${b.def.label}: ${b.name}` : b.def.label;

        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "meg-blocks-tab";
        btn.dataset.key = key;
        btn.setAttribute("data-block-id", b.def.id);
        btn.title = label;
        btn.innerHTML = `
            <span class="meg-blocks-tab-emoji">${b.def.emoji || ""}</span>
            <span class="meg-blocks-tab-label">${esc(b.name || b.def.label)}</span>
            ${b.truncated ? `<span class="meg-block-flag" title="The reply was cut off before this block finished">cut</span>` : ""}
        `;
        // Clicking the open tab shuts it again, back to whatever the resting
        // state is — which is the CYOA block when there is one, nothing when
        // there is not.
        btn.addEventListener("click", e => {
            e.stopPropagation();
            select(current === key ? restingKey : key);
        });
        tabs.appendChild(btn);
        buttons.push(btn);

        const pane = doc.createElement("div");
        pane.className = "meg-block-body";
        pane.dataset.key = key;
        pane.setAttribute("data-block-id", b.def.id);
        if (b.truncated) pane.classList.add("meg-block-truncated");
        pane.innerHTML = renderBody(b.body);
        panel.appendChild(pane);
        panels.push(pane);
    });

    // Collapse control sits at the end of the strip, where the drawing put it.
    const chev = doc.createElement("button");
    chev.type = "button";
    chev.className = "meg-blocks-collapse";
    chev.title = "Fold";
    chev.innerHTML = `<i class="fa-solid fa-chevron-down"></i>`;
    chev.addEventListener("click", e => {
        e.stopPropagation();
        // Shuts everything, the resting block included.
        select(current === null ? restingKey : null);
    });
    tabs.appendChild(chev);

    card.appendChild(tabs);
    card.appendChild(panel);

    // The preview has no reason to start shut — a preview showing nothing is not
    // a preview — so it opens the first tab when there is no resting block.
    const initial = opts.startCollapsed
        ? null
        : (restingKey || (opts.expanded && shown.length ? keyOf(shown[0]) : null));
    select(initial);

    return card;
}

// -----------------------------------------------------------------------------
// Putting it in the message
// -----------------------------------------------------------------------------

// Letters and digits only. Markdown syntax is gone from the rendered text but
// still present in mes, so comparing anything else would never line up.
function norm(s) {
    return String(s || "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

// Nodes at the tail of a message that are not block remnants and must be stepped
// over rather than hidden: our own card, inline images, and the CYOA box, which
// is a real <div> the sanitizer keeps and which the model puts after the blocks.
function isSteppable(node) {
    if (node.nodeType === 3) return !node.textContent.trim();
    if (node.nodeType !== 1) return true;
    if (node.classList && node.classList.contains(CARD_CLASS)) return true;
    // HR is deliberately NOT here. The World State template separates its
    // sections with `---`, which renders as a rule, and skipping those left a
    // stray line floating above the card with nothing under it. They carry no
    // text, so consuming them costs the length accounting nothing.
    if (node.tagName === "IMG" || node.tagName === "BR") return true;
    if (node.querySelector && node.querySelector("img")) return true;
    if (node.classList && node.classList.contains("kazuma-img-placeholder")) return true;
    // The CYOA template's own inline style, kept verbatim in the block content.
    const style = node.getAttribute && node.getAttribute("style");
    if (style && /border:\s*1px solid #444/i.test(style)) return true;
    return false;
}

export function clearBlocksFromMessage(root) {
    if (!root) return;
    root.querySelectorAll(`.${CARD_CLASS}`).forEach(el => el.remove());
    root.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach(el => {
        el.removeAttribute(HIDDEN_ATTR);
        el.style.display = "";
    });
    root.removeAttribute(STAMP_ATTR);
}

// Hides the paragraphs the sanitizer left behind and appends the card.
// Returns true when the message was decorated, false when it was left alone.
export function applyBlocksToMessage(root, mes, registry, opts = {}) {
    if (!root || typeof mes !== "string") return false;

    const blocks = extractBlocks(mes, registry);
    if (!blocks.length) {
        clearBlocksFromMessage(root);
        return false;
    }

    // Same text AND same settings: skip the work and, more importantly, never
    // react to our own DOM writes. Something else rebuilding the body wipes the
    // stamp with it, so the next pass rebuilds rather than skipping.
    //
    // What is omitted has to be part of this. Turning the side panel on does not
    // change a single character of the message, so a stamp made of the text alone
    // still matched and every card was left exactly as it was — the blocks only
    // moved out of the chat after something else forced a re-render, which is why
    // it took a chat reload.
    const stamp = `${mes.length}:${norm(mes).length}:${blocks.length}:${(opts.omit || []).join(",")}`;
    if (root.getAttribute(STAMP_ATTR) === stamp && root.querySelector(`.${CARD_CLASS}`)) return true;

    // Start from whatever SillyTavern rendered, every time. Re-hiding on top of a
    // previous pass would creep further up the message on each call.
    clearBlocksFromMessage(root);

    const target = norm(remnantTextOf(mes, blocks));
    if (!target) return false;

    // Walk the tail backwards collecting nodes until they account for the block
    // text. The blocks are a suffix of the reply, which is what makes this
    // tractable at all — no searching, just consuming from the end.
    const consumed = [];
    let acc = 0;
    let node = root.lastChild;
    let guard = 0;

    while (node && acc < target.length && guard++ < 400) {
        if (isSteppable(node)) { node = node.previousSibling; continue; }
        const len = norm(node.textContent).length;
        if (len) { consumed.push(node); acc += len; }
        else if (node.nodeType === 1) consumed.push(node);
        node = node.previousSibling;
    }

    // Two ways the tail can turn out not to be the blocks, and both end the same
    // way: leave the message exactly as SillyTavern drew it rather than hide
    // narrative somebody wrote a scene for.
    //
    // Over-consuming is the obvious one. Under-consuming is the dangerous one and
    // it is invisible to a length check alone — a message whose body no longer
    // matches mes at all (an edit that has not been saved back, another extension
    // rewriting the body) runs out of nodes early, and every node it did take
    // gets hidden. So the consumed text is compared against the block text
    // directly: they start at the same place or this does nothing.
    const consumedNorm = consumed.slice().reverse().map(n => norm(n.textContent)).join("");
    const probe = Math.min(60, Math.max(12, Math.floor(target.length * 0.5)));
    const looksRight = consumedNorm.slice(0, probe) === target.slice(0, probe);

    if (!consumed.length || !looksRight || acc > target.length * 1.6 + 80) {
        clearBlocksFromMessage(root);
        return false;
    }

    consumed.forEach(n => {
        if (n.nodeType === 3) {
            // A bare text node cannot carry an attribute, so it gets a span that can.
            const span = (opts.document || document).createElement("span");
            span.setAttribute(HIDDEN_ATTR, "1");
            span.style.display = "none";
            n.parentNode.insertBefore(span, n);
            span.appendChild(n);
            return;
        }
        n.setAttribute(HIDDEN_ATTR, "1");
        n.style.display = "none";
    });

    root.appendChild(buildBlocksCard(blocks, opts));
    root.setAttribute(STAMP_ATTR, stamp);
    return true;
}
