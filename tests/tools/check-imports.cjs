// Static import check: every relative import inside the extension points at a
// file that exists and exports the names it asks for. Run from the extension
// folder:  node tests/tools/check-imports.cjs
// (Modules that import SillyTavern cannot be loaded under node; this catches
// broken wiring in them without a browser.)
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..", "..");
const files = [];
const walk = d => {
    for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) { if (!/node_modules|\.git|\.claude|tests/.test(p)) walk(p); }
        else if (p.endsWith(".js")) files.push(p);
    }
};
walk(path.join(root, "src")); walk(path.join(root, "data")); files.push(path.join(root, "index.js"));
const cache = new Map();
const getExports = p => {
    if (cache.has(p)) return cache.get(p);
    const s = fs.readFileSync(p, "utf8").replace(/\/\/.*$/gm, "");
    const names = new Set();
    for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([\w$]+)/g)) names.add(m[1]);
    for (const m of s.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(",").map(x => x.trim()).filter(Boolean).forEach(x => names.add(x.split(/\s+as\s+/).pop().trim()));
    if (/export\s+\*\s+from/.test(s)) names.add("*");
    cache.set(p, names);
    return names;
};
let problems = 0;
for (const f of files) {
    const s = fs.readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "");
    for (const m of s.matchAll(/import\s*(?:\{([^}]*)\}|([\w$]+))?\s*(?:from\s*)?["']([^"']+)["']/g)) {
        const spec = m[3];
        if (!spec.startsWith(".")) continue;
        const target = path.resolve(path.dirname(f), spec);
        if (!target.startsWith(root)) continue;            // SillyTavern core, outside the extension
        if (!fs.existsSync(target)) { console.log("MISSING FILE", path.relative(root, f), spec); problems++; continue; }
        if (!m[1]) continue;
        const ex = getExports(target);
        if (ex.has("*")) continue;
        for (const n of m[1].split(",").map(x => x.trim()).filter(Boolean)) {
            const name = n.split(/\s+as\s+/)[0].trim();
            if (!ex.has(name)) { console.log("MISSING EXPORT", path.relative(root, f), "->", spec, name); problems++; }
        }
    }
}
console.log("files", files.length, "problems", problems);
process.exitCode = problems ? 1 : 0;
