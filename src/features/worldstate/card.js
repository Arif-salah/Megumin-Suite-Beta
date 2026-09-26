// ────────────────────────────────────────────────────────────────────────────
// World State card: the "what changed" strip.
//
// The card treatment draws the scene board for a message (the state right
// after it). This adds, at the top of that pane, what THIS reply changed, the
// lines it wrote that were not understood, and a switch to turn the reply's
// changes off or back on. The board below is redrawn from the store, so turning
// a reply off is visible immediately.
// ────────────────────────────────────────────────────────────────────────────

import { worldCardInfo, worldSetEntryDisabled, worldSettings } from "../../state/index.js";

const esc = v => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SHOW_AT_MOST = 12;

function changeRow(a) {
    const [who, field] = a.label.includes(" · ") ? a.label.split(" · ") : ["", a.label];
    const before = a.before && a.after ? `<span class="meg-wsdiff-before">${esc(a.before)}</span><i class="fa-solid fa-arrow-right meg-wsdiff-arrow"></i>` : "";
    const after = a.after
        ? `<span class="meg-wsdiff-after">${esc(a.after)}</span>`
        : `<span class="meg-wsdiff-before">${esc(a.before)}</span>`;
    return `
        <div class="meg-wsdiff-row">
            ${who ? `<b>${esc(who)}</b>` : ""}
            <span class="meg-wsdiff-field">${esc(field)}</span>
            ${before}${after}
        </div>`;
}

/**
 * @param {HTMLElement} paneEl  the World State pane of one message's card
 * @param {number} msgIndex
 * @param {{ onEdit?: () => void, onChanged?: () => void, onReread?: () => void }} [hooks]
 */
export function worldDecoratePane(paneEl, msgIndex, hooks = {}) {
    if (!paneEl || typeof msgIndex !== "number") return;
    paneEl.querySelector(".meg-wsdiff")?.remove();
    if (!worldSettings().showChanges) return;

    const info = worldCardInfo(msgIndex);
    if (!info) return;

    const { applied, skipped, notes, missing, disabled, noChanges, pending, unread, sideModel } = info;
    let body = "";
    let title;
    if (pending) {
        title = `<i class="fa-solid fa-spinner fa-spin"></i> Reading this reply for World State changes…`;
    } else if (unread) {
        title = `<i class="fa-regular fa-eye-slash"></i> Not read for World State changes yet`;
    } else if (disabled) {
        title = `<i class="fa-solid fa-power-off"></i> This reply's World State changes are switched off`;
    } else if (missing) {
        title = sideModel
            ? `<i class="fa-regular fa-circle-question"></i> Chomusuke gave no update for this reply; the scene carried over unchanged`
            : `<i class="fa-regular fa-circle-question"></i> No World Update in this reply; the scene carried over unchanged`;
    } else if (!applied.length) {
        title = `<i class="fa-solid fa-equals"></i> ${noChanges ? "No changes in this reply" : "Nothing in this reply changed the scene"}`;
    } else {
        title = `<i class="fa-solid fa-code-compare"></i> Changed in this reply <span class="meg-wsdiff-count">${applied.length}</span>`;
        body = applied.slice(0, SHOW_AT_MOST).map(changeRow).join("");
        if (applied.length > SHOW_AT_MOST) {
            body += `<div class="meg-wsdiff-more">+${applied.length - SHOW_AT_MOST} more (see the editor's History)</div>`;
        }
    }

    const issues = [...skipped.map(t => ({ t, kind: "skip" })), ...notes.map(t => ({ t, kind: "note" }))];
    const warn = issues.length ? `
        <details class="meg-wsdiff-warn">
            <summary><i class="fa-solid fa-triangle-exclamation"></i> ${skipped.length ? `${skipped.length} line${skipped.length === 1 ? "" : "s"} not understood` : ""}${skipped.length && notes.length ? " · " : ""}${notes.length ? `${notes.length} note${notes.length === 1 ? "" : "s"}` : ""}</summary>
            ${issues.map(i => `<div class="meg-wsdiff-issue ${i.kind}">${i.kind === "skip" ? `<code>${esc(i.t)}</code>` : esc(i.t)}</div>`).join("")}
        </details>` : "";

    const canToggle = !pending && !unread && !missing && (disabled || applied.length > 0);
    // Side model: read a reply that was never read, or read one again (after an
    // edit, or when the first answer was poor).
    const canRead = sideModel && !pending && hooks.onReread && (unread || missing || info.entry?.source === "sidemodel");
    const strip = document.createElement("div");
    strip.className = `meg-wsdiff${disabled ? " is-off" : ""}${pending || unread || missing || (!applied.length && !disabled) ? " is-quiet" : ""}`;
    strip.innerHTML = `
        <div class="meg-wsdiff-head">
            <span class="meg-wsdiff-title">${title}</span>
            <span class="meg-wsdiff-actions">
                ${canToggle ? `<button type="button" class="meg-wsdiff-btn meg-wsdiff-toggle" title="${disabled ? "Count this reply's changes again" : "Stop counting this reply's changes; the scene goes back to how it was before it"}">
                    <i class="fa-solid ${disabled ? "fa-rotate-right" : "fa-rotate-left"}"></i> ${disabled ? "Restore" : "Revert"}</button>` : ""}
                ${canRead ? `<button type="button" class="meg-wsdiff-btn meg-wsdiff-read" title="Have Chomusuke read this reply for World State changes"><i class="fa-solid fa-book-open-reader"></i> ${unread ? "Read now" : "Read again"}</button>` : ""}
                ${hooks.onEdit ? `<button type="button" class="meg-wsdiff-btn meg-wsdiff-edit" title="Open the World State editor"><i class="fa-solid fa-pen"></i> Edit</button>` : ""}
            </span>
        </div>
        ${body}
        ${warn}
    `;

    strip.querySelector(".meg-wsdiff-toggle")?.addEventListener("click", e => {
        e.stopPropagation();
        if (worldSetEntryDisabled(info.entry.id, !disabled) && hooks.onChanged) hooks.onChanged();
    });
    strip.querySelector(".meg-wsdiff-read")?.addEventListener("click", e => {
        e.stopPropagation();
        hooks.onReread();
    });
    strip.querySelector(".meg-wsdiff-edit")?.addEventListener("click", e => {
        e.stopPropagation();
        hooks.onEdit();
    });
    // Clicks inside the strip must not fold the card it sits in.
    strip.addEventListener("click", e => e.stopPropagation());

    paneEl.prepend(strip);
}
