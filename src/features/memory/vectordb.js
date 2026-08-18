// ────────────────────────────────────────────────────────────────────────────
// The vector store — SillyTavern's native /api/vector/* (Vectra) backend.
//
// Insert, delete and semantic query. Depends only on keywords.js, so it sits one
// level above the leaf and below everything that reads results out of it.
// ────────────────────────────────────────────────────────────────────────────

import { getContext, getRequestHeaders, debounce } from "../../st.js";
import { localProfile, _loadedProfileKey } from "../../core/state.js";
import { getCharacterKey, meguminActiveDataIdentity } from "../../core/keys.js";
import { showKazumaProgress } from "../../ui/progress.js";
import { meguminCleanChatHistoryText } from "../../engine/chatText.js";
import { memGetCachedKeywords, memStringHash } from "./keywords.js";

// NOTE: memGetEmbedding / memUpdateCurrentQueryVector / memUpdateVaultEmbeddings removed.
// ST's native /api/vector/* API does NOT expose raw embeddings. Embedding is done server-side
// during insert and query. We use the proper insert+query flow instead of client-side cosine math.

// --- SEMANTIC EMBEDDING HELPERS (NATIVE ST VECTRA) ---

export let currentSemanticMatches = [];

// Creates a unique database collection name for this specific character/group
export function memGetCollectionId() {
    const context = typeof getContext === "function" ? getContext() : null;
    if (!context) return null;
    const hasChar = context.characterId !== undefined && context.characterId !== null && context.characterId !== "";
    const hasGroup = context.groupId !== undefined && context.groupId !== null && context.groupId !== "";
    // CHAT_CHANGED fires before either has settled. That window is where megumin_group_null came from.
    if (!hasChar && !hasGroup) return null;
    const charId = hasChar ? String(context.characterId) : "group_" + context.groupId;
    return ("megumin_" + charId).replace(/[^a-zA-Z0-9_]/g, "_");
}

// Fix 8: one window size that is correct on both embedders. MiniLM silently truncates at
// 512 tokens; jina crashes past ~6,000. Worst measured density on real chunks is 2.54
// chars per token, so 1200 chars is 470 tokens worst case, 8% under MiniLM's wall.
// Windows take a "#n" suffix; anything already under the window keeps its bare id, so
// rows stored before this change still match.
export const MAX_EMBED_CHARS = 1200;
export const MAX_EMBED_PIECES = 128;

export function memEmbedPieces(chunk) {
    const text = (chunk?.text || chunk?.summary || "");
    if (text.length <= MAX_EMBED_CHARS) return [{ id: chunk.id, text }];
    const pieces = [];
    let pos = 0;
    while (pos < text.length && pieces.length < MAX_EMBED_PIECES) {
        let end = Math.min(pos + MAX_EMBED_CHARS, text.length);
        if (end < text.length) {
            // Back off to the last space so a word is not cut in half. Text with no space
            // in that window, which prose never produces, falls through to a hard cut.
            const sp = text.lastIndexOf(" ", end);
            if (sp > pos && end - sp <= 200) end = sp;
        }
        pieces.push({ id: chunk.id + "#" + pieces.length, text: text.slice(pos, end) });
        pos = end;
        while (text[pos] === " ") pos++;
    }
    return pieces;
}

// Inserts vault chunks into ST's native vector database
export async function memInsertToVectorDB(chunks, expectIdentity) {
    if (!chunks || chunks.length === 0) return true;
    const collectionId = memGetCollectionId();
    if (!collectionId) { console.warn("Megumin Suite: no character or group yet, skipping vector insert."); return false; }
    // Callers that can run for minutes (chunk processing, vault migration) hand over the
    // identity their run started on. collectionId above is computed live, so without this
    // the rows of a run that started on one character would be filed under whichever
    // character is loaded now. Call sites that pass nothing are immediate UI actions and
    // keep their old behaviour.
    if (expectIdentity !== undefined && meguminActiveDataIdentity() !== expectIdentity) {
        console.debug(`[Megumin-Suite] Vector insert declined: these ${chunks.length} chunk(s) belong to "${expectIdentity}" but "${meguminActiveDataIdentity()}" is active now. Nothing was sent to the vector database.`);
        return false;
    }
    // ST's /api/vector/insert requires items with { hash: Number, text: String, index: Number }
    // One chunk now produces several items, so index runs across the flattened list.
    const items = [];
    for (const c of chunks) {
        for (const p of memEmbedPieces(c)) {
            items.push({ hash: memStringHash(p.id), text: p.text, index: items.length });
        }
    }
    
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(items.length / BATCH_SIZE);
    
    // Show progress overlay if there are many items to sync
    const showProgress = totalBatches > 1;
    
    let ok = true;
    try {
        for (let i = 0; i < totalBatches; i++) {
            if (expectIdentity !== undefined && meguminActiveDataIdentity() !== expectIdentity) {
                console.debug(`[Megumin-Suite] Vector insert stopped at batch ${i + 1}/${totalBatches}: it started on "${expectIdentity}" but "${meguminActiveDataIdentity()}" is active now.`);
                ok = false;
                break;
            }

            if (showProgress) {
                if (typeof showKazumaProgress === 'function') {
                    showKazumaProgress(`Syncing Vector DB... (${i + 1}/${totalBatches})`);
                }
            }

            const batch = items.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
            const res = await fetch('/api/vector/insert', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ collectionId, items: batch, source: 'transformers' })
            });
            // A 500 from the blown embedder resolves the promise, so `catch` never sees it.
            if (!res.ok) {
                const detail = await res.text().catch(() => "");
                console.error(`Megumin Suite: vector insert HTTP ${res.status} on batch ${i + 1}/${totalBatches}.`, detail.slice(0, 500));
                ok = false;
                break;
            }

            if (i < totalBatches - 1) {
                await new Promise(r => setTimeout(r, 200));
            }
        }
    } catch (e) {
        console.warn("Megumin Suite: Vector Insert failed.", e);
        ok = false;
    } finally {
        if (showProgress && typeof showKazumaProgress === 'function') {
            $("#kazuma_progress_overlay").hide();
        }
    }
    return ok;
}

// Deletes vault chunks from ST's native vector database
export async function memDeleteFromVectorDB(ids, expectIdentity) {
    if (!ids || ids.length === 0) return;
    const collectionId = memGetCollectionId();
    if (!collectionId) return;
    // Deletes cannot be undone, so this declines on any doubt, not only when a caller
    // supplied an identity to check against. The ids always come out of localProfile's
    // vault, so if that profile is not the active chat's the hashes belong to a different
    // character than the collection they would be removed from.
    if (_loadedProfileKey && (getCharacterKey() || "default") !== _loadedProfileKey) {
        console.debug(`[Megumin-Suite] Vector delete declined: the vault entries come from the profile for "${_loadedProfileKey}" but the active chat is now "${getCharacterKey() || "default"}". No rows were deleted.`);
        return;
    }
    if (expectIdentity !== undefined && meguminActiveDataIdentity() !== expectIdentity) {
        console.debug(`[Megumin-Suite] Vector delete declined: these ${ids.length} id(s) belong to "${expectIdentity}" but "${meguminActiveDataIdentity()}" is active now. No rows were deleted.`);
        return;
    }
    // ST's /api/vector/delete requires { hashes: Number[] }, not string ids
    // ST's /api/vector/delete requires { hashes: Number[] }, not string ids.
    // Fix 8: a windowed chunk is stored as several "#n" rows and the vault entry may
    // already be gone, so sweep the bare id plus every window id insert could have
    // produced. Deleting a hash that was never stored is a no-op.
    const hashes = [];
    for (const id of ids) {
        hashes.push(memStringHash(id));
        for (let n = 0; n < MAX_EMBED_PIECES; n++) hashes.push(memStringHash(id + "#" + n));
    }
    try {
        await fetch('/api/vector/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ collectionId, hashes, source: 'transformers' })
        });
    } catch (e) { console.warn("Megumin Suite: Vector Delete failed.", e); }
}

// Background task: Queries the DB silently while you chat so the AI's prompt is always ready
// The text the matches currently in hand were retrieved for. Used to tell a fresh
// result from a stale one without re-running the query to find out.
let _matchesQueryText = null;

// Builds the search text for the current turn, or "" when there is nothing to
// search on. Separated from the query itself so the freshness check below can ask
// "what would we search for now?" without performing a lookup.
export function memBuildQueryText() {
    // The query vector has to describe what the USER just asked about, not what the
    // model last wrote.
    //
    // This used to join the last two messages and cut to 1200 chars. Replies run to
    // several thousand characters and questions run to a couple of hundred, so a
    // real question ended up as ~12% of the text and the previous reply as the rest.
    // The embedding averaged to "whatever the last scene was", and retrieval returned
    // that scene's chunks whatever was asked. Measured: asking who said a line from
    // message 73 returned chunks 80-129 — the scene the model had just written —
    // while the same question sent on its own returned the right chunk at rank 0.
    //
    // So query with the newest user message ALONE. That is not a guess: sending the
    // question on its own put the right chunk at rank 0, and mixing any amount of the
    // previous reply back in is what pulled the wrong scene up. Padding it with
    // surrounding prose would re-create the failure in smaller measure.
    //
    // The exception is a turn that carries no question at all ("continue", "...").
    // There the user's words have nothing to retrieve on, and describing the scene
    // being continued is exactly right — so those keep the old whole-window text.
    const MAX_QUERY_CHARS = 1200; // same window the insert uses
    const MIN_MEANINGFUL = 16;    // below this there is no question being asked

    const context = typeof getContext === "function" ? getContext() : null;
    if (!context || !context.chat) return "";

    const nonSystem = context.chat.filter(m => !m.is_system);
    const clean = (m) => meguminCleanChatHistoryText(m.mes);

    let userIdx = -1;
    for (let i = nonSystem.length - 1; i >= 0; i--) {
        if (nonSystem[i].is_user) { userIdx = i; break; }
    }
    const userText = userIdx >= 0 ? clean(nonSystem[userIdx]).trim() : "";

    const text = userText.length >= MIN_MEANINGFUL
        ? userText.slice(-MAX_QUERY_CHARS)
        : nonSystem.slice(-2).map(clean).join(" ").slice(-MAX_QUERY_CHARS);
    return text.trim();
}

export async function memUpdateSemanticQuery() {
    const mem = localProfile?.memoryCore;
    if (!mem || mem.scannerEngine !== 'semantic' || !mem.longTermVault || mem.longTermVault.length === 0) {
        currentSemanticMatches = [];
        _matchesQueryText = null;
        return;
    }

    const recentCleanedText = memBuildQueryText();
    if (!recentCleanedText) { currentSemanticMatches = []; _matchesQueryText = null; return; }

    const collectionId = memGetCollectionId();
    if (!collectionId) { currentSemanticMatches = []; _matchesQueryText = null; return; }
    // Claim the text up front: a query that fails should not leave the previous
    // turn's text recorded as if its results were still current.
    _matchesQueryText = recentCleanedText;
    try {
        const res = await fetch('/api/vector/query', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                collectionId,
                searchText: recentCleanedText,
                topK: 12,
                source: 'transformers',
                threshold: 0.2
            })
        });
        if (!res.ok) {
            console.error(`Megumin Suite: vector query HTTP ${res.status}.`);
            currentSemanticMatches = [];
        } else {
            const data = await res.json();
            // Clear first: a 200 carrying a shape we do not recognise must not keep last turn's rows.
            currentSemanticMatches = [];
            // ST returns { hashes: number[], metadata: object[] }
            if (data && Array.isArray(data.metadata)) {
                // Fix 8: one archive is stored as several "#n" windows, so every window
                // hash maps back to its parent entry. Dedupe to distinct archives and keep
                // 3, which is why topK above oversamples.
                // First entry wins, so a duplicate vault id resolves the way the old
                // longTermVault.find() did rather than the last one silently overwriting.
                const byHash = new Map();
                const claim = (k, v) => { if (!byHash.has(k)) byHash.set(k, v); };
                for (const v of mem.longTermVault) {
                    for (const p of memEmbedPieces(v)) claim(memStringHash(p.id), v);
                    claim(memStringHash(v.id), v);
                }
                const seen = new Set();
                for (const meta of data.metadata) {
                    let entry = byHash.get(meta.hash);
                    if (!entry) {
                        // Same leading-text fallback as before, for rows stored earlier.
                        entry = mem.longTermVault.find(v => (v.text || v.summary || "").substring(0, 100) === (meta.text || "").substring(0, 100));
                    }
                    if (!entry || seen.has(entry.id)) continue;
                    seen.add(entry.id);
                    currentSemanticMatches.push({ ...entry, score: 99, matchedWords: ["Semantic Embedding Match (Vectra)"] });
                    if (currentSemanticMatches.length >= 3) break;
                }
            }
        }
    } catch (e) {
        console.warn("Megumin Suite: Semantic query failed, falling back to TF-IDF.", e);
        currentSemanticMatches = [];
    }
}

// Three events can land inside one turn. Only the last one needs to run.
export const memUpdateSemanticQueryDebounced = debounce(memUpdateSemanticQuery, 800);

// ─────────────────────────────────────────────────────────────────────────────
// Guarantees the matches match THIS turn before the prompt is built.
//
// The debounced refresh above is a race it can lose. It is triggered by
// USER_MESSAGE_RENDERED, waits 800ms, and only then makes a network round-trip —
// while generation starts as soon as the message is sent. When generation wins,
// the prompt is assembled from the PREVIOUS turn's matches: the right memories,
// one turn late, which reads as intermittent flakiness rather than a bug.
//
// So the prompt builder waits here instead of hoping. It re-queries only when the
// search text has actually changed, so swipes, regenerations and token counting —
// which do not change what is being asked — cost nothing.
export async function memEnsureSemanticQueryFresh() {
    const mem = localProfile?.memoryCore;
    if (!mem || mem.scannerEngine !== 'semantic') return;
    if (!mem.longTermVault || mem.longTermVault.length === 0) return;

    const wanted = memBuildQueryText();
    if (!wanted) return;
    if (wanted === _matchesQueryText) return;   // already current for this text

    await memUpdateSemanticQuery();
}
