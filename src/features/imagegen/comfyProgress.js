// ─────────────────────────────────────────────────────────────────────────────
// Real generation progress from ComfyUI.
//
// The bar used to be a barber-pole animation: it moved, but it knew nothing. It
// looked identical at step 1 of 40 and at step 39, and identical again when the
// server had quietly died.
//
// ComfyUI publishes genuine progress over a websocket, but only to the client id
// that submitted the job — so the id has to be minted here, handed to the socket
// AND sent in the /prompt body. Miss either half and the socket connects fine and
// then stays silent forever, which is the failure mode to watch for.
//
// Everything here is best-effort by design. If the socket cannot open, or the
// server never reports, the caller keeps the animated bar and the existing
// history poll still finishes the job. Progress reporting must never be able to
// break image generation.
// ─────────────────────────────────────────────────────────────────────────────

export function makeComfyClientId() {
    try {
        if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    } catch (e) { /* fall through */ }
    return "megumin-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

// Opens the progress socket. Returns a handle with close(); call it on every exit
// path, success or failure, or the socket outlives the job it was watching.
//
// onProgress(value, max) fires per sampler step. onNode(nodeId) fires when the
// running node changes — nodeId null means the queue finished.
export function openComfyProgressSocket(comfyUrl, clientId, { onProgress, onNode } = {}) {
    let ws = null;
    let closed = false;

    try {
        // http://host:8188 → ws://host:8188/ws , https → wss.
        // https is tested first: matching "http" would otherwise consume the prefix
        // of "https" and leave the secure case to work only by coincidence.
        const base = String(comfyUrl || "").trim().replace(/\/+$/, "");
        const wsUrl = base.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:")
            + "/ws?clientId=" + encodeURIComponent(clientId);
        ws = new WebSocket(wsUrl);

        ws.onmessage = (ev) => {
            if (closed) return;
            // ComfyUI also pushes binary preview frames down this socket. Those are
            // Blobs, not JSON, so anything that does not parse is simply not for us.
            if (typeof ev.data !== "string") return;
            let msg;
            try { msg = JSON.parse(ev.data); } catch (e) { return; }
            if (!msg || !msg.type) return;

            if (msg.type === "progress" && msg.data && typeof msg.data.max === "number" && msg.data.max > 0) {
                if (typeof onProgress === "function") onProgress(msg.data.value || 0, msg.data.max);
            } else if (msg.type === "executing" && msg.data) {
                if (typeof onNode === "function") onNode(msg.data.node ?? null);
            }
        };

        // Silent on error: a missing socket costs the caller its percentage, nothing
        // more, and ComfyUI setups behind proxies that block websockets are common.
        ws.onerror = () => { };
    } catch (e) {
        console.debug("[Megumin Suite] ComfyUI progress socket unavailable; using the indeterminate bar.", e);
        ws = null;
    }

    return {
        close() {
            closed = true;
            try { if (ws) ws.close(); } catch (e) { /* already gone */ }
            ws = null;
        }
    };
}
