/* eslint-disable no-undef */
/*
 * Megumin Suite — Side Panel section registry
 *
 * Every tracker section is declared once here as { id, icon, title,
 * defaultOpen, order, render(ctx), badge(ctx) }. panel.js iterates this
 * registry to build the panel — adding a new tracker section means adding
 * one entry here, nothing else.
 *
 * render(ctx) returns a DOM Node, or null when the section has no data
 * (panel.js hides null sections when cfg.autoHideEmpty is on).
 *
 * SectionCtx = { parsed, profile, cfg, openNpcBook, lookupBankedNpc }
 */

import { el, escapeHtml, isMaleSex, avatarNode } from "./dom.js";

// -----------------------------------------------------------------------------
// World State
// -----------------------------------------------------------------------------
function renderWorldState(ctx) {
    const ws = ctx.parsed?.worldState;
    if (!ws) return null;

    const kv = (label, val) => val ? el("div", { class: "meg-sp-kv" },
        el("span", { class: "meg-sp-kv-key" }, label),
        el("span", { class: "meg-sp-kv-val" }, val),
    ) : null;

    const rows = [
        kv("Date & Time", ws.dateTime),
        kv("Location", ws.location),
        kv("Weather", ws.weather),
        kv("Scene Phase", ws.scenePhase),
    ].filter(Boolean);

    const container = el("div", { class: "meg-sp-ws" });
    if (rows.length) {
        container.appendChild(el("div", { class: "meg-sp-ws-meta" }, rows));
    }

    // PC card
    if (ws.pc && (ws.pc.name || Object.keys(ws.pc.fields || {}).length)) {
        container.appendChild(el("div", { class: "meg-sp-card meg-sp-card-pc" },
            el("div", { class: "meg-sp-card-head" },
                el("i", { class: "fa-solid fa-user" }),
                " ",
                ws.pc.name || "PC"),
            el("div", { class: "meg-sp-card-fields" },
                Object.entries(ws.pc.fields || {}).map(([k, v]) =>
                    el("div", { class: "meg-sp-field" },
                        el("span", { class: "meg-sp-field-key" }, k + ":"),
                        " ",
                        el("span", { class: "meg-sp-field-val" }, v),
                    ))),
        ));
    }

    // NPCs Present renders in the Present Characters bar (bottom of chat);
    // click a portrait there for the full sheet.

    if (ws.offScreen && ws.offScreen.length) {
        container.appendChild(el("div", { class: "meg-sp-card-head meg-sp-card-head-sep" },
            el("i", { class: "fa-solid fa-satellite-dish" }), " Off-Screen"));
        container.appendChild(el("ul", { class: "meg-sp-bullets" },
            ws.offScreen.map(x => el("li", {}, x))));
    }

    if (ws.threads && ws.threads.length) {
        container.appendChild(el("div", { class: "meg-sp-card-head meg-sp-card-head-sep" },
            el("i", { class: "fa-solid fa-fire" }), " Unresolved Threads"));
        container.appendChild(el("ul", { class: "meg-sp-bullets" },
            ws.threads.map(x => el("li", {}, x))));
    }

    if (ws.leftovers && ws.leftovers.length) {
        container.appendChild(el("div", { class: "meg-sp-leftover", html:
            ws.leftovers.map(t => `<div>${escapeHtml(t)}</div>`).join("") }));
    }

    if (!container.children.length) return null;
    return container;
}

// -----------------------------------------------------------------------------
// NPC Inner Chatter
// -----------------------------------------------------------------------------
function renderInnerChatter(ctx) {
    const entries = ctx.parsed?.innerChatter;
    if (!entries || !entries.length) return null;

    // Group consecutive lines by the same NPC so multiple thoughts share one avatar
    const groups = [];
    for (const e of entries) {
        const last = groups[groups.length - 1];
        if (last && last.name === e.name) last.quotes.push(e.quote);
        else groups.push({ name: e.name, quotes: [e.quote] });
    }
    const wrap = el("div", { class: "meg-sp-chatter" });
    for (const g of groups) {
        const banked = ctx.lookupBankedNpc(g.name);
        wrap.appendChild(el("div", { class: "meg-sp-thought" },
            el("div", { class: "meg-sp-thought-avatar" },
                avatarNode(banked, g.name),
                el("div", { class: "meg-sp-thought-bubbles" },
                    el("div", { class: "meg-sp-bubble meg-sp-bubble-2" }),
                    el("div", { class: "meg-sp-bubble meg-sp-bubble-1" }),
                ),
            ),
            el("div", { class: "meg-sp-thought-content" },
                g.name ? el("div", { class: "meg-sp-thought-name" }, g.name) : null,
                el("div", { class: "meg-sp-thought-quotes" },
                    g.quotes.map(q => el("div", { class: "meg-sp-thought-text" }, q))),
            ),
        ));
    }
    return wrap;
}

// -----------------------------------------------------------------------------
// New NPC Dossiers
// -----------------------------------------------------------------------------
function renderNewNpcs(ctx) {
    const list = ctx.parsed?.newNpcs;
    if (!list || !list.length) return null;
    const wrap = el("div", { class: "meg-sp-newnpcs" });
    for (const n of list) {
        // Each dossier is its own collapsible so long ones can be tucked away
        const d = el("details", { class: "meg-sp-card meg-sp-card-newnpc meg-sp-newnpc" });
        d.open = true;
        d.appendChild(el("summary", { class: "meg-sp-newnpc-head" },
            el("i", { class: "fa-solid fa-user-plus" }), " ",
            el("span", { class: "meg-sp-newnpc-name" }, n.name || "Unnamed NPC"),
            el("i", { class: "fa-solid fa-chevron-down meg-sp-chevron" }),
        ));
        d.appendChild(Object.keys(n.fields || {}).length
            ? el("div", { class: "meg-sp-card-fields" },
                Object.entries(n.fields).map(([k, v]) =>
                    el("div", { class: "meg-sp-field" },
                        el("span", { class: "meg-sp-field-key" }, k + ":"),
                        " ",
                        el("span", { class: "meg-sp-field-val" }, v))))
            : el("div", { class: "meg-sp-muted" }, "(no parsed fields)"));
        wrap.appendChild(d);
    }
    return wrap;
}

// -----------------------------------------------------------------------------
// Story Planner
// -----------------------------------------------------------------------------
function renderStoryPlan(ctx) {
    const sp = ctx.profile?.storyPlan || {};
    const plan = sp.currentPlan;
    if (!(sp.enabled || (plan && plan.trim()))) return null;
    if (!plan || !plan.trim()) return el("div", { class: "meg-sp-muted" }, "Story Planner is empty.");
    const lines = plan.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const list = el("ol", { class: "meg-sp-plan" });
    let added = 0;
    for (const ln of lines) {
        const clean = ln.replace(/^[\-\*•]\s*/, "").replace(/^\d+[\.\)]\s*/, "");
        if (!clean) continue;
        list.appendChild(el("li", {}, clean));
        added++;
    }
    if (!added) return el("div", { class: "meg-sp-summary-text" }, plan.trim());
    return list;
}

// -----------------------------------------------------------------------------
// NPC Bank
// -----------------------------------------------------------------------------
function renderNpcBank(ctx) {
    const bank = ctx.profile?.npcBank;
    if (!bank) return null;
    const npcs = bank.npcs || [];
    const wrap = el("div", { class: "meg-sp-bank" });

    const openBookBtn = el("button", {
        class: "meg-sp-book-btn",
        title: "Open the full NPC Book (browse, edit, upload, generate portraits)",
        onclick: () => ctx.openNpcBook(),
    },
        el("i", { class: "fa-solid fa-book-open" }),
        " Open NPC Book",
        npcs.length ? el("span", { class: "meg-sp-book-count" }, String(npcs.length)) : null,
    );
    wrap.appendChild(openBookBtn);

    if (!npcs.length) {
        wrap.appendChild(el("div", { class: "meg-sp-muted", style: { marginTop: "8px" } },
            "No NPCs banked yet. They get added automatically as the AI introduces them."));
        return wrap;
    }

    const grid = el("div", { class: "meg-sp-bank-grid" });
    // Newest first (matches the NPC Book's reverse-iteration pattern)
    [...npcs].reverse().forEach((n, revIdx) => {
        const idx = npcs.length - 1 - revIdx;
        const male = isMaleSex(n.sex);
        const accentVar = male ? "var(--meg-sp-npc-male, #3b82f6)" : "var(--meg-sp-npc-female, #f43f5e)";
        const portrait = n.pfp
            ? el("img", { class: "meg-sp-npc-pfp", src: n.pfp, alt: n.name || "NPC" })
            : el("div", { class: "meg-sp-npc-pfp meg-sp-npc-pfp-empty" },
                el("i", { class: "fa-solid fa-user-secret" }));

        const ageSex = [n.age, n.sex].filter(Boolean).join(" · ");

        grid.appendChild(el("div", {
            class: "meg-sp-bank-mini",
            style: { "--accent": accentVar },
            title: "Click to open in NPC Book",
            onclick: () => ctx.openNpcBook(idx),
        },
            portrait,
            el("div", { class: "meg-sp-bank-mini-info" },
                el("div", { class: "meg-sp-bank-mini-name" }, n.name || "Unnamed"),
                ageSex ? el("div", { class: "meg-sp-bank-mini-meta" }, ageSex) : null,
                (n.role || n.occupation)
                    ? el("div", { class: "meg-sp-bank-mini-occ" }, n.role || n.occupation)
                    : null,
            ),
        ));
    });
    wrap.appendChild(grid);
    return wrap;
}

// -----------------------------------------------------------------------------
// Ban List
// -----------------------------------------------------------------------------
function renderBanList(ctx) {
    const items = ctx.profile?.banList;
    if (!items || !items.length) return null;
    return el("ul", { class: "meg-sp-banlist" },
        items.map(p => el("li", {}, typeof p === "string" ? p : (p.phrase || p.text || JSON.stringify(p)))));
}

// -----------------------------------------------------------------------------
// Registry — panel.js iterates this; settings tab reads id/icon/title/order
// -----------------------------------------------------------------------------
export const SECTION_REGISTRY = [
    {
        id: "worldState", icon: "fa-thumbtack", title: "World State",
        defaultOpen: true, order: 0, render: renderWorldState, badge: null,
    },
    {
        id: "innerChatter", icon: "fa-comment-dots", title: "NPC Inner Chatter",
        defaultOpen: true, order: 1, render: renderInnerChatter,
        badge: (ctx) => ctx.parsed?.innerChatter?.length || null,
    },
    {
        id: "newNpcs", icon: "fa-user-plus", title: "New NPC Dossiers",
        defaultOpen: true, order: 2, render: renderNewNpcs,
        badge: (ctx) => ctx.parsed?.newNpcs?.length || null,
    },
    {
        id: "storyPlan", icon: "fa-map", title: "Story Planner",
        defaultOpen: false, order: 3, render: renderStoryPlan, badge: null,
    },
    {
        id: "npcBank", icon: "fa-address-book", title: "NPC Bank",
        defaultOpen: false, order: 4, render: renderNpcBank,
        badge: (ctx) => ctx.profile?.npcBank?.npcs?.length || null,
    },
    {
        id: "banList", icon: "fa-ban", title: "Ban List",
        defaultOpen: false, order: 5, render: renderBanList,
        badge: (ctx) => ctx.profile?.banList?.length || null,
    },
];
