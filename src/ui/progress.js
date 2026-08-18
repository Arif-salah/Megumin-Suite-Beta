// The bottom-right progress toast used while a background generation runs.
//
// Lived among the image-gen helpers, which meant the Memory Core and the NPC
// portrait generator both had to depend on image gen to show progress. It is a
// generic piece of chrome, so it lives with the UI.
//
// Two modes:
//   showKazumaProgress("text")        indeterminate — the barber-pole stripe
//   showKazumaProgress("text", 0..100) determinate — a real bar
//
// Callers that know nothing about how far along they are (memory syncing, prompt
// writing) keep the stripe. ComfyUI reports genuine step counts over its
// websocket, so image generation fills the bar for real.

function ensureOverlay() {
    if ($("#kazuma_progress_overlay").length) return;
    $("body").append(`
        <div id="kazuma_progress_overlay" style="position: fixed; bottom: 20px; right: 20px; width: 300px; background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 15px; z-index: 99999; box-shadow: 0 10px 30px rgba(0,0,0,0.8); display: none; align-items: center; gap: 15px; font-family: 'Inter', sans-serif;">
            <div style="flex:1">
                <span id="kazuma_progress_text" style="font-weight: 600; font-size: 0.85rem; color: #fff; margin-bottom: 8px; display: block;">Generating Image...</span>
                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                    <div id="kazuma_progress_fill" style="height: 100%; width: 100%; border-radius: 3px;"></div>
                </div>
            </div>
        </div>
        <style>@keyframes kazuma-stripe-anim { 0% { background-position: 0 0; } 100% { background-position: 20px 0; } }</style>
    `);
}

const STRIPES = "linear-gradient(45deg, #a855f7 25%, transparent 25%, transparent 50%, #a855f7 50%, #a855f7 75%, transparent 75%, transparent)";

export function showKazumaProgress(text = "Processing...", percent = null) {
    ensureOverlay();
    $("#kazuma_progress_text").text(text);

    const fill = $("#kazuma_progress_fill");
    const known = percent !== null && percent !== undefined && isFinite(percent);
    if (known) {
        // Clamped rather than trusted: a workflow that reports more steps than it
        // predicted would otherwise push the bar past its track.
        const pct = Math.max(0, Math.min(100, Number(percent)));
        fill.css({
            width: pct + "%",
            background: "linear-gradient(90deg, #a855f7, #d946ef)",
            "background-size": "auto",
            animation: "none",
            transition: "width 0.15s linear",
        });
    } else {
        fill.css({
            width: "100%",
            background: STRIPES,
            "background-size": "20px 20px",
            animation: "kazuma-stripe-anim 1s linear infinite",
            transition: "none",
        });
    }
    $("#kazuma_progress_overlay").css("display", "flex");
}

export function hideKazumaProgress() {
    $("#kazuma_progress_overlay").hide();
}
