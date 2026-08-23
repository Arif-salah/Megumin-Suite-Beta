// ─────────────────────────────────────────────────────────────────────────────
// Megumin Suite — the die.
//
// Its own module, and not part of buildBaseDict, for two reasons. It has no
// dependencies at all, while buildBaseDict sits at the very top of the graph and
// pulls in every feature — so anything wanting a fair d20 would have had to drag
// the whole extension in behind it, tests included. And the honesty check that
// compares what the model wrote against what was handed to it lives near the
// renderer, at the other end of the graph entirely; both ends can reach here.
// ─────────────────────────────────────────────────────────────────────────────

// The dice, rolled by the extension rather than by the model.
//
// A language model is a poor random number generator: it favours some values,
// avoids others, and once it has read the scene it is choosing rather than
// rolling. Handing it numbers it did not pick removes that. What is left for it
// to decide is whether an attempt deserves a roll, which is a judgement, and
// what the difficulty is, which is written down.
//
// Rejection sampling rather than a bare modulo. The bias from `% 20` over a
// 32-bit draw is roughly four parts in a billion and nobody would ever see it,
// but a die advertised as fair should be fair and the correction is one
// comparison.
export function meguminRollD20s(n) {
    const count = Math.max(1, Math.min(10, Number(n) || 1));
    const out = [];
    // The largest multiple of 20 that fits in 32 bits. Draws at or above it are
    // thrown away, which is what keeps all twenty faces exactly equally likely.
    const limit = Math.floor(0xFFFFFFFF / 20) * 20;
    const buf = typeof Uint32Array === "function" ? new Uint32Array(1) : null;

    let guard = 0;
    while (out.length < count && guard++ < 200) {
        let v;
        if (buf && typeof crypto !== "undefined" && crypto && typeof crypto.getRandomValues === "function") {
            crypto.getRandomValues(buf);
            v = buf[0];
        } else {
            // No crypto: still random, just not cryptographically so. A die does
            // not have to resist an attacker, only the model's own preferences.
            v = Math.floor(Math.random() * 0x100000000);
        }
        if (v >= limit) continue;
        out.push((v % 20) + 1);
    }
    // Only reachable if the source of randomness is broken outright. A short
    // list would silently mean "no more rolls this turn", so it is filled.
    while (out.length < count) out.push(1 + Math.floor(Math.random() * 20));
    return out;
}
