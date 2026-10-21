// ────────────────────────────────────────────────────────────────────────────
// How to set up Chomusuke's connection profiles. Shown in the Chomusuke tab and
// on the Model Setup page (features/modelsetup/ui.js), which replaced the Model
// guide popup that used to live here (plan 018, phase 5).
// ────────────────────────────────────────────────────────────────────────────

// How to make the connection profiles Chomusuke switches between. A profile for
// the story too: after a job, Chomusuke switches back to the profile that was
// on, so the story needs one.
// Shown before the steps: a profile saved with its presets reloads the chat
// every time Chomusuke switches to it or back.
export const CHOMUSUKE_SETUP_NOTE = "<b>Before you start:</b> when you save a profile, <b>uncheck Settings Preset and Regex Preset</b>. Otherwise the chat reloads every time Chomusuke switches. Already have profiles saved with them? Make new ones the same way.";

export const CHOMUSUKE_SETUP_STEPS = [
    "Open SillyTavern's <b>API Connections</b> panel (the plug icon in the top bar).",
    "Connect your story model as usual. Then, at the top of the panel under <b>Connection Profile</b>, click <b>Create a new connection profile</b> (the page with a +), name it <b>Story</b> and save. Keep this profile picked while you play.",
    "Want Chomusuke on the same model (DeepSeek, local models)? You're done here: pick <b>Story</b> in step 5.",
    "For another model: in the same panel, connect the model Chomusuke should use (API, key, model, Connect), create a new connection profile again and name it <b>Chomusuke</b>. Then pick your <b>Story</b> profile again.",
    "In the <b>Chomusuke</b> tab, turn Chomusuke on, pick the profile under <b>Worker connection</b> and press <b>Test</b>.",
    "Turn on the jobs you want it to do, for example <b>Blocks</b> with World State."
];
