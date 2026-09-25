// ──────────────────────────────────────────────────────────────────────────────
// Centralized Character Name Matcher & Canonical Resolution Utility
//
// Pure, deterministic, and node-testable ladder:
// 1. Exact case-insensitive match
// 2. Explicit aliases / nicknames match
// 3. Token containment / Title & honorific stripping
// 4. Unambiguous prefix matching (min length >= 3, strictly single candidate)
// ──────────────────────────────────────────────────────────────────────────────

export function normalizeName(str) {
    if (!str || typeof str !== "string") return "";
    return str
        .trim()
        .toLowerCase()
        .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
        .trim();
}

export function stripHonorificsAndParentheticals(str) {
    if (!str || typeof str !== "string") return "";
    let clean = str.replace(/\s*\([^)]*\)/g, " ").replace(/\s*\[[^\]]*\]/g, " ");
    clean = clean.replace(/^(lady|lord|captain|sir|madam|master|miss|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, "");
    clean = clean.replace(/\s+(sama|san|chan|kun|dono|sensei|senpai)$/i, "");
    return clean.trim();
}

export function isCharacterNameMatch(nameA, nameB, aliasesA = [], aliasesB = []) {
    const normA = normalizeName(nameA);
    const normB = normalizeName(nameB);
    if (!normA || !normB) return false;

    // 1. Exact CI match
    if (normA === normB) return true;

    // 2. Explicit aliases check
    const listA = [normA, ...(Array.isArray(aliasesA) ? aliasesA.map(normalizeName).filter(Boolean) : [])];
    const listB = [normB, ...(Array.isArray(aliasesB) ? aliasesB.map(normalizeName).filter(Boolean) : [])];
    for (const a of listA) {
        for (const b of listB) {
            if (a === b) return true;
        }
    }

    // 3. Title / parenthetical stripping
    const strippedA = normalizeName(stripHonorificsAndParentheticals(nameA));
    const strippedB = normalizeName(stripHonorificsAndParentheticals(nameB));
    if (strippedA && strippedB) {
        if (strippedA === strippedB) return true;
        // Token containment (e.g. "Matthew Miller" matches "Matthew")
        const tokensA = strippedA.split(/\s+/).filter(Boolean);
        const tokensB = strippedB.split(/\s+/).filter(Boolean);
        if (tokensA.includes(strippedB) || tokensB.includes(strippedA)) return true;
    }

    // 4. Prefix matching (min length >= 3)
    const shorter = normA.length <= normB.length ? normA : normB;
    const longer = normA.length > normB.length ? normA : normB;
    if (shorter.length >= 3 && longer.startsWith(shorter)) {
        return true;
    }

    return false;
}

export function resolveCanonicalCharacterName(candidateName, canonicalList = [], aliasesMap = {}) {
    const rawCandidate = typeof candidateName === "string" ? candidateName.trim() : "";
    if (!rawCandidate || !Array.isArray(canonicalList) || canonicalList.length === 0) return null;

    const normCandidate = normalizeName(rawCandidate);
    if (!normCandidate) return null;

    // 1. Exact CI match
    const exactMatch = canonicalList.find(c => normalizeName(c) === normCandidate);
    if (exactMatch) return exactMatch;

    // Helper to get aliases for a canonical name
    const getAliases = (canon) => {
        if (!aliasesMap || typeof aliasesMap !== "object") return [];
        const direct = aliasesMap[canon];
        if (Array.isArray(direct)) return direct;
        const key = Object.keys(aliasesMap).find(k => normalizeName(k) === normalizeName(canon));
        return key && Array.isArray(aliasesMap[key]) ? aliasesMap[key] : [];
    };

    // 2. Explicit aliases match
    const aliasMatches = canonicalList.filter(c => {
        const aliases = getAliases(c);
        return aliases.some(a => normalizeName(a) === normCandidate);
    });
    if (aliasMatches.length === 1) return aliasMatches[0];
    if (aliasMatches.length > 1) return null; // Ambiguous aliases

    // 3. Token / Title & parenthetical stripping
    const strippedCand = normalizeName(stripHonorificsAndParentheticals(rawCandidate));
    const candTokens = strippedCand ? strippedCand.split(/\s+/).filter(Boolean) : [];

    const tokenMatches = canonicalList.filter(c => {
        const strippedCanon = normalizeName(stripHonorificsAndParentheticals(c));
        if (!strippedCanon) return false;
        if (strippedCand === strippedCanon) return true;
        const canonTokens = strippedCanon.split(/\s+/).filter(Boolean);
        if (candTokens.includes(strippedCanon) || canonTokens.includes(strippedCand)) return true;
        return false;
    });
    if (tokenMatches.length === 1) return tokenMatches[0];
    if (tokenMatches.length > 1) return null; // Ambiguous token match

    // 4. Unambiguous prefix matching (min length >= 3)
    const prefixMatches = canonicalList.filter(c => {
        const normCanon = normalizeName(c);
        if (!normCanon) return false;
        const shorter = normCandidate.length <= normCanon.length ? normCandidate : normCanon;
        const longer = normCandidate.length > normCanon.length ? normCandidate : normCanon;
        return shorter.length >= 3 && longer.startsWith(shorter);
    });
    if (prefixMatches.length === 1) return prefixMatches[0];

    return null; // Ambiguous or not found
}
