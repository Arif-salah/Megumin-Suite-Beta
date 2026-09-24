// ────────────────────────────────────────────────────────────────────────────
// World State Ledger — Live compiled state and history management.
//
// Maintains the chat's active World State ledger on localProfile.worldState.
// Preserves the full, rich <World_State> text in memory and applies in-place
// updates from <World_Update>, ensuring zero information loss (moods, secrets,
// agendas, and off-screen characters remain intact).
// ────────────────────────────────────────────────────────────────────────────

import { localProfile } from "../../core/state.js";
import { getContext } from "../../st.js";

let _wsHistorySeq = 0;
function nextHistoryId() {
    return `wsh_${Date.now().toString(36)}_${(_wsHistorySeq++).toString(36)}`;
}

function capitalize(s) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Returns the current compiled World State object, or null if none saved.
 * @returns {object|null}
 */
export function getWorldStateCurrent() {
    return localProfile?.worldState?.current || null;
}

/**
 * Ensures the live World State has its full rawText populated.
 * If rawText is missing (e.g. chats started prior to rich preservation),
 * this scans backwards in chat history to recover the original <World_State> block.
 * @param {object} [ws]
 * @returns {string}
 */
export function ensureWorldStateRawText(ws = null) {
    let current = ws || getWorldStateCurrent();

    if (!current) {
        // Attempt recovery from chat history if current is not yet hydrated
        try {
            const ctx = typeof getContext === "function" ? getContext() : null;
            const chat = ctx && ctx.chat;
            if (Array.isArray(chat) && chat.length > 0) {
                for (let i = chat.length - 1; i >= 0; i--) {
                    const msg = chat[i];
                    if (!msg || msg.is_user || msg.is_system) continue;
                    const m = (msg.mes || "").match(/<World_State\b[^>]*>([\s\S]*?)(?:<\/World_State\s*>|$)/i);
                    if (m && m[1].trim()) {
                        const rawText = m[1].trim();
                        if (localProfile) {
                            if (!localProfile.worldState) localProfile.worldState = { current: null, history: [] };
                            current = {
                                rawText,
                                bootstrapMsgIndex: i,
                                lastUpdatedMsgIndex: i
                            };
                            localProfile.worldState.current = current;
                        }
                        return rawText;
                    }
                }
            }
        } catch (e) {
            console.debug("[Megumin-Suite] Chat recovery error:", e);
        }
        return "";
    }

    if (current.rawText && current.rawText.trim().length > 15) {
        return current.rawText.trim();
    }

    // Attempt recovery from chat history
    try {
        const ctx = typeof getContext === "function" ? getContext() : null;
        const chat = ctx && ctx.chat;
        if (Array.isArray(chat) && chat.length > 0) {
            for (let i = chat.length - 1; i >= 0; i--) {
                const msg = chat[i];
                if (!msg || msg.is_user || msg.is_system) continue;
                const m = (msg.mes || "").match(/<World_State\b[^>]*>([\s\S]*?)(?:<\/World_State\s*>|$)/i);
                if (m && m[1].trim()) {
                    let baseRaw = m[1].trim();
                    current.rawText = baseRaw;
                    return baseRaw;
                }
            }
        }
    } catch (e) {
        console.debug("[Megumin-Suite] Chat recovery error:", e);
    }

    // Reconstruct from structured fields if chat scan failed
    const lines = [];
    const timeLoc = [];
    if (current.dateTime) timeLoc.push(`**📅 Time:** ${current.dateTime}`);
    if (current.location) timeLoc.push(`**🌤 Loc:** ${current.location}`);
    if (current.weather) timeLoc.push(`**🌡 Wx:** ${current.weather}`);
    if (timeLoc.length > 0) lines.push(timeLoc.join(" | "));

    if (current.pc) {
        lines.push("\n---");
        lines.push(`\n**🧍 ${current.pc.name || "{{user}}"}:**`);
        if (current.pc.outfit) lines.push(`* *Outfit:* ${current.pc.outfit}`);
        if (current.pc.position) lines.push(`* *Position:* ${current.pc.position}`);
        if (current.pc.condition) lines.push(`* *Visible Condition:* ${current.pc.condition}`);
        if (current.pc.carrying) lines.push(`* *Carrying:* ${current.pc.carrying}`);
    }

    if (current.npcs) {
        lines.push("\n---");
        lines.push(`\n**👥 NPCs Present:**\n${current.npcs}`);
    }

    if (current.threads) {
        lines.push("\n---");
        lines.push(`\n**🔥 Unresolved Threads:**\n${current.threads}`);
    }

    const reconstructed = lines.join("\n").trim();
    if (reconstructed) {
        current.rawText = reconstructed;
    }
    return reconstructed;
}

/**
 * Returns true if the chat currently has an active World State on file.
 * @returns {boolean}
 */
export function hasWorldState() {
    let ws = localProfile?.worldState?.current;
    if (!ws || (!ws.rawText && !ws.location && !ws.dateTime)) {
        const recovered = ensureWorldStateRawText(ws);
        if (recovered) return true;
    }
    return Boolean(ws && (ws.rawText || ws.location || ws.dateTime || ws.pc?.outfit));
}

/**
 * Initializes or resets the World State ledger from a full bootstrap <World_State> block.
 * @param {object} parsedData
 * @param {number} [msgIndex=0]
 * @returns {boolean}
 */
export function setWorldStateBootstrap(parsedData, msgIndex = 0) {
    if (!parsedData || typeof parsedData !== "object") return false;
    if (!localProfile) return false;

    if (!localProfile.worldState) {
        localProfile.worldState = { current: null, history: [] };
    }
    if (!Array.isArray(localProfile.worldState.history)) {
        localProfile.worldState.history = [];
    }

    const rawText = (parsedData.raw || "").trim();

    const state = {
        rawText,
        dateTime: parsedData.dateTime || "",
        location: parsedData.location || "",
        weather: parsedData.weather || "",
        pc: {
            name: parsedData.pc?.name || "",
            outfit: parsedData.pc?.outfit || "",
            position: parsedData.pc?.position || "",
            condition: parsedData.pc?.condition || "",
            carrying: parsedData.pc?.carrying || ""
        },
        npcOutfits: parsedData.npcOutfits ? JSON.parse(JSON.stringify(parsedData.npcOutfits)) : {},
        npcs: parsedData.npcs || "",
        threads: parsedData.threads || "",
        bootstrapMsgIndex: msgIndex,
        lastUpdatedMsgIndex: msgIndex
    };

    localProfile.worldState.current = state;

    localProfile.worldState.history.push({
        id: nextHistoryId(),
        msgIndex,
        at: Date.now(),
        isBootstrap: true,
        rawText,
        state: JSON.parse(JSON.stringify(state))
    });

    return true;
}

/**
 * Updates raw World State markdown text in-place using parsed delta updates.
 * @param {string} rawText
 * @param {object} updates
 * @returns {string} Updated markdown text
 */
export function updateRawWorldStateText(rawText, updates) {
    let text = rawText || ensureWorldStateRawText();
    if (!text || typeof text !== "string") return "";
    if (!updates || typeof updates !== "object") return text;

    // 1. Update Header fields (Loc, Time, Wx)
    if (updates.header) {
        if (updates.header.location) {
            const reLoc = /(\*\*[🌤📍\s]*(?:Loc|Location)\s*:\s*\*?\*?)[^|*\n]+/i;
            if (reLoc.test(text)) {
                text = text.replace(reLoc, `$1 ${updates.header.location} `);
            }
        }
        if (updates.header.dateTime) {
            const reTime = /(\*\*[📅⏰\s]*(?:Time|Date)\s*:\s*\*?\*?)[^|*\n]+/i;
            if (reTime.test(text)) {
                text = text.replace(reTime, `$1 ${updates.header.dateTime} `);
            }
        }
        if (updates.header.weather) {
            const reWx = /(\*\*[🌡🌤\s]*(?:Wx|Weather)\s*:\s*\*?\*?)[^|*\n]+/i;
            if (reWx.test(text)) {
                text = text.replace(reWx, `$1 ${updates.header.weather} `);
            }
        }
    }

    // 2. Update Character fields
    if (updates.characters) {
        for (const [rawCharName, fields] of Object.entries(updates.characters)) {
            const charName = rawCharName.trim();
            if (!charName || !fields || Object.keys(fields).length === 0) continue;

            const currentPcName = (localProfile?.worldState?.current?.pc?.name || "").toLowerCase();
            const isPc = charName.toLowerCase() === "{{user}}" ||
                         charName.toLowerCase() === "user" ||
                         (currentPcName && charName.toLowerCase() === currentPcName) ||
                         rawCharName.includes("🧍");

            let charHeaderRegex;
            if (isPc && /(?<=^|\n)\s*(\*\*🧍[^\n*]*\*\*\s*:?)/i.test(text)) {
                charHeaderRegex = /(?<=^|\n)\s*(\*\*🧍[^\n*]*\*\*\s*:?)/i;
            } else {
                const escapedName = charName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                charHeaderRegex = new RegExp(`(?<=^|\\n)\\s*(\\*\\*[^\\n*]*(?<=^|\\W)${escapedName}(?=\\W|$)[^\\n*]*\\*\\*\\s*:?)`, "i");
            }

            if (charHeaderRegex.test(text)) {
                // Character exists: update individual bullet fields
                for (const [rawField, newVal] of Object.entries(fields)) {
                    const fieldName = capitalize(rawField);
                    const bulletRegex = new RegExp(`([*\\-•][ 	]+[*_]{1,2}\\s*${fieldName}\\s*:?[*_]{1,2}\\s*:?)[^\\n]*`, "i");

                    const charStartIdx = text.search(charHeaderRegex);
                    if (charStartIdx !== -1) {
                        const afterChar = text.slice(charStartIdx);
                        // Boundary: Character section ends at the next divider OR next bold header line
                        const nextDividerMatch = afterChar.slice(1).search(/\n\s*---|\n\s*\*\*/);
                        const sectionLength = nextDividerMatch !== -1 ? nextDividerMatch + 1 : afterChar.length;
                        const charSection = afterChar.slice(0, sectionLength);

                        if (bulletRegex.test(charSection)) {
                            const updatedSection = charSection.replace(bulletRegex, `$1 ${newVal}`);
                            text = text.slice(0, charStartIdx) + updatedSection + text.slice(charStartIdx + sectionLength);
                        } else {
                            const lines = charSection.split(/\r?\n/);
                            lines.splice(1, 0, `* *${fieldName}:* ${newVal}`);
                            text = text.slice(0, charStartIdx) + lines.join("\n") + text.slice(charStartIdx + sectionLength);
                        }
                    }
                }
            } else {
                // Character does NOT exist in text -> Add as new character under NPCs Present
                const newCharLines = [`\n**${charName}:**`];
                for (const [rawField, newVal] of Object.entries(fields)) {
                    newCharLines.push(`* *${capitalize(rawField)}:* ${newVal}`);
                }
                const newCharBlock = newCharLines.join("\n");

                if (text.includes("**👥 NPCs Present:**")) {
                    text = text.replace("**👥 NPCs Present:**", `**👥 NPCs Present:**\n${newCharBlock}`);
                } else if (text.includes("---")) {
                    text = text.replace("---", `---\n${newCharBlock}`);
                } else {
                    text += `\n\n---\n**👥 NPCs Present:**\n${newCharBlock}`;
                }
            }
        }
    }

    // 3. Departures (Remove character)
    if (Array.isArray(updates.removedCharacters) && updates.removedCharacters.length > 0) {
        for (const rawName of updates.removedCharacters) {
            const escapedName = rawName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const charSectionRegex = new RegExp(`(?:^|\\n)\\s*\\*\\*[^\\n*]*(?<=^|\\W)${escapedName}(?=\\W|$)[^\\n*]*\\*\\*[\\s\\S]*?(?=\\n\\s*---|\\n\\s*\\*\\*|$)`, "i");
            text = text.replace(charSectionRegex, "");
        }
    }

    // 4. Update Sections (Off-Screen, Threads, Seeds, Timers, Phases)
    if (updates.sections) {
        if (Array.isArray(updates.sections.offscreen) && updates.sections.offscreen.length > 0) {
            const offscreenBullets = updates.sections.offscreen.map(e => `* ${e}`).join("\n");
            const offscreenBulletPattern = /(\*\*(?:📡\s*)?Off-Screen:\*\*\s*\n?)(?:[ \t]*[*\-•][ \t]+(?!\*\*)[^\n]*(?:\r?\n|$))*/i;
            if (text.includes("**📡 Off-Screen:**") || text.includes("**Off-Screen:**")) {
                text = text.replace(offscreenBulletPattern, `$1${offscreenBullets}\n`);
            } else {
                const offscreenBlock = `\n---\n**📡 Off-Screen:**\n${offscreenBullets}\n`;
                if (text.includes("**🔥 Unresolved Threads:**")) {
                    text = text.replace("**🔥 Unresolved Threads:**", `${offscreenBlock}\n**🔥 Unresolved Threads:**`);
                } else {
                    text += `\n${offscreenBlock}`;
                }
            }
        }

        if (Array.isArray(updates.sections.threads) && updates.sections.threads.length > 0) {
            const threadBullets = updates.sections.threads.map(e => `* ${e}`).join("\n");
            const threadBulletPattern = /(\*\*(?:🔥\s*)?Unresolved Threads:\*\*\s*\n?)(?:[ \t]*[*\-•][ \t]+(?!\*\*)[^\n]*(?:\r?\n|$))*/i;
            if (text.includes("**🔥 Unresolved Threads:**") || text.includes("**Unresolved Threads:**")) {
                text = text.replace(threadBulletPattern, `$1${threadBullets}\n`);
            }
        }

        if (updates.sections.scenePhase) {
            const rePhase = /(\*\*[🎬\s]*(?:Scene Phase)\s*:\s*\*?\*?)[^\n]+/i;
            if (rePhase.test(text)) {
                text = text.replace(rePhase, `$1 ${updates.sections.scenePhase}`);
            } else {
                text += `\n**🎬 Scene Phase:** ${updates.sections.scenePhase}`;
            }
        }
    }

    return text.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Trims history array to maximum allowed size while safeguarding the latest bootstrap entry.
 * @param {Array} history
 * @param {number} [maxEntries=50]
 * @returns {Array}
 */
export function trimWorldStateHistory(history, maxEntries = 50) {
    if (!Array.isArray(history) || history.length <= maxEntries) return history;
    const latestBootstrap = history.slice().reverse().find(h => h && h.isBootstrap);
    const tail = history.slice(-maxEntries);
    if (latestBootstrap && !tail.some(h => h && h.id === latestBootstrap.id)) {
        return [latestBootstrap, ...tail];
    }
    return tail;
}

/**
 * Applies delta changes from a <World_Update> block into the live ledger.
 * @param {object} updates Map of changed fields
 * @param {number} [msgIndex=0]
 * @returns {{ applied: Array<{field: string, before: string, after: string}> }}
 */
export function applyWorldStateUpdate(updates, msgIndex = 0) {
    const applied = [];
    if (!updates || typeof updates !== "object") return { applied };
    if (!localProfile) return { applied };

    if (!localProfile.worldState) {
        localProfile.worldState = { current: null, history: [] };
    }
    if (!localProfile.worldState.current) {
        localProfile.worldState.current = {
            rawText: "",
            dateTime: "",
            location: "",
            weather: "",
            pc: { outfit: "", position: "", condition: "", carrying: "" },
            npcs: "",
            threads: "",
            bootstrapMsgIndex: msgIndex,
            lastUpdatedMsgIndex: msgIndex
        };
    }
    if (!Array.isArray(localProfile.worldState.history)) {
        localProfile.worldState.history = [];
    }

    const current = localProfile.worldState.current;
    const changes = [];

    const applyField = (fieldKey, newValue) => {
        if (!newValue) return;
        const before = current[fieldKey] || "";
        if (before === newValue) return;
        current[fieldKey] = newValue;
        changes.push({ field: fieldKey, before, after: newValue });
        applied.push({ field: fieldKey, before, after: newValue });
    };

    const applyPcField = (pcKey, newValue) => {
        if (!newValue) return;
        if (!current.pc) current.pc = {};
        const before = current.pc[pcKey] || "";
        if (before === newValue) return;
        current.pc[pcKey] = newValue;
        changes.push({ field: `pc.${pcKey}`, before, after: newValue });
        applied.push({ field: `pc.${pcKey}`, before, after: newValue });
    };

    if (updates.header) {
        if (updates.header.location) applyField("location", updates.header.location);
        if (updates.header.dateTime) applyField("dateTime", updates.header.dateTime);
        if (updates.header.weather) applyField("weather", updates.header.weather);
    }

    if (updates.characters) {
        for (const [charName, fields] of Object.entries(updates.characters)) {
            const currentPcName = (current.pc?.name || "").toLowerCase();
            const isPc = charName.toLowerCase() === "{{user}}" ||
                         charName.toLowerCase() === "user" ||
                         (currentPcName && charName.toLowerCase() === currentPcName) ||
                         charName.includes("🧍");

            if (isPc) {
                if (fields.outfit) applyPcField("outfit", fields.outfit);
                if (fields.position) applyPcField("position", fields.position);
                if (fields.condition) applyPcField("condition", fields.condition);
                if (fields.carrying) applyPcField("carrying", fields.carrying);
            } else {
                if (fields.outfit) {
                    if (!current.npcOutfits) current.npcOutfits = {};
                    current.npcOutfits[charName] = fields.outfit;
                }
                for (const [fName, fVal] of Object.entries(fields)) {
                    changes.push({ field: `${charName}.${fName}`, before: "", after: fVal });
                    applied.push({ field: `${charName}.${fName}`, before: "", after: fVal });
                }
            }
        }
    }

    if (Array.isArray(updates.removedCharacters) && updates.removedCharacters.length > 0) {
        if (current.npcOutfits) {
            for (const rName of updates.removedCharacters) {
                delete current.npcOutfits[rName];
            }
        }
    }

    // Update raw markdown text in-place (with self-healing recovery if raw was empty)
    const oldRaw = current.rawText || ensureWorldStateRawText(current);
    current.rawText = updateRawWorldStateText(oldRaw, updates);

    current.lastUpdatedMsgIndex = msgIndex;
    localProfile.worldState.history.push({
        id: nextHistoryId(),
        msgIndex,
        at: Date.now(),
        isBootstrap: false,
        rawText: current.rawText,
        state: JSON.parse(JSON.stringify(current)),
        changes
    });

    // Guard against memory bloat by capping history at 50, safeguarding newest bootstrap
    localProfile.worldState.history = trimWorldStateHistory(localProfile.worldState.history, 50);

    return { applied };
}

/**
 * Rolls back World State changes for messages at or past `chatLength`.
 * Called during chat rewinds or message deletions.
 * @param {number} chatLength
 * @returns {boolean} True if any changes were rolled back
 */
export function worldStateRollbackHistoryFrom(chatLength) {
    const ws = localProfile && localProfile.worldState;
    if (!ws || !Array.isArray(ws.history) || ws.history.length === 0) return false;

    const doomed = ws.history.filter(h => h && h.msgIndex >= chatLength);
    if (doomed.length === 0) return false;

    const bootstrapDoomed = doomed.some(h => h.isBootstrap);
    if (bootstrapDoomed || ws.history.every(h => h.msgIndex >= chatLength)) {
        ws.current = null;
        ws.history = ws.history.filter(h => h && h.msgIndex < chatLength);
        return true;
    }

    ws.history = ws.history.filter(h => h && h.msgIndex < chatLength);

    const surviving = ws.history[ws.history.length - 1];
    if (surviving && surviving.state) {
        ws.current = JSON.parse(JSON.stringify(surviving.state));
        ws.current.rawText = surviving.rawText || "";
        ws.current.lastUpdatedMsgIndex = surviving.msgIndex;
    }

    return true;
}

/**
 * Formats the compiled World State into the complete <World_State> block for [[infoblockcurrent]] injection.
 * @param {object} [current]
 * @returns {string}
 */
export function formatWorldStateForPrompt(current = null) {
    const raw = ensureWorldStateRawText(current);
    if (!raw) return "";

    const clean = raw.replace(/<\/?World_State\b[^>]*>/gi, "").trim();
    return `<World_State>\n${clean}\n</World_State>`;
}

/**
 * Returns the World State raw markdown text active at a given message index.
 * Used by the in-chat block card renderer to display the accurate scene board per message.
 * @param {number} [msgIndex]
 * @returns {string}
 */
export function getWorldStateTextAt(msgIndex = null) {
    const ws = localProfile && localProfile.worldState;
    if (!ws) {
        return ensureWorldStateRawText();
    }

    if (typeof msgIndex !== "number" || !Array.isArray(ws.history) || ws.history.length === 0) {
        return ws.current?.rawText || ensureWorldStateRawText(ws.current);
    }

    const applicable = ws.history.filter(h => h && h.msgIndex <= msgIndex);
    if (applicable.length > 0) {
        const latest = applicable[applicable.length - 1];
        return latest.rawText || (latest.state?.rawText) || ws.current?.rawText || ensureWorldStateRawText(ws.current);
    }

    return ws.current?.rawText || ensureWorldStateRawText(ws.current);
}
