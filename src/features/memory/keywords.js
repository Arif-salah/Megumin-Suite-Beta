// ────────────────────────────────────────────────────────────────────────────
// Keyword extraction — the bottom of the memory feature.
//
// A true leaf: it depends on nothing else in memory, and the vector store, the
// vault scorer, NPC injection and image tags all read from it. Pulled out first
// for that reason.
// ────────────────────────────────────────────────────────────────────────────

import { meguminCleanChatHistoryText } from "../../engine/chatText.js";

// Cached Intl.Segmenter — reusing it avoids expensive re-instantiation on every call
export let _cachedWordSegmenter = null;

// Per-prompt keyword cache — avoids re-cleaning and re-tokenizing the same recent messages
// across memGetRelevantVaultEntries, NPC injection, and NPC image tags in a single prompt build
export let _promptKeywordCache = { hash: "", keywords: [], cleanedText: "" };

/**
 * Returns cached keywords + cleaned text for the last N messages.
 * All callers within a single prompt build get the same result without re-computing.
 * @param {Array} chat - The chat array from context
 * @param {number} sliceCount - How many recent non-system messages to use (default 2)
 * @returns {{ keywords: string[], cleanedText: string }}
 */
export function memGetCachedKeywords(chat, sliceCount = 2) {
    const recent = chat.filter(m => !m.is_system).slice(-sliceCount);
    // Fast hash: combine message lengths + first 32 chars of each to detect changes
    const hash = recent.map(m => (m.mes || "").length + "|" + (m.mes || "").substring(0, 32)).join(";") + "#" + sliceCount;
    if (_promptKeywordCache.hash === hash) {
        return _promptKeywordCache;
    }
    const cleanedText = recent.map(m => meguminCleanChatHistoryText(m.mes)).join(" ").toLowerCase();
    const keywords = memExtractKeywords(cleanedText);
    _promptKeywordCache = { hash, keywords, cleanedText };
    return _promptKeywordCache;
}

// Universal Language Tokenizer: Automatically handles English, Arabic, Russian, and CJK (Chinese/Japanese/Korean)
export function memExtractKeywords(text) {
    let rawWords = [];

    // 1. Use modern native JS segmenter which understands Japanese/Chinese word boundaries!
    if (window.Intl && Intl.Segmenter) {
        if (!_cachedWordSegmenter) _cachedWordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
        for (const { segment, isWordLike } of _cachedWordSegmenter.segment(text)) {
            if (isWordLike) rawWords.push(segment.toLowerCase());
        }
    } else {
        // Fallback for extremely old browsers
        rawWords = text.match(/\p{L}+/gu) || [];
    }

    // 2. Filter the words smartly based on their language
    return [...new Set(rawWords)].filter(kw => {
        // Drop English stop words
        if (MEMORY_STOP_WORDS.has(kw)) return false;

        // If it contains CJK characters (Chinese, Japanese, Korean)
        if (/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(kw)) {
            return kw.length >= 1; // CJK nouns can be 1 character (e.g. 剣 "sword", 猫 "cat")
        }

        // Alphabetic languages (English, Arabic, Russian) need 3+ letters to filter out small junk
        return kw.length >= 3;
    });
}

// Expanded stop words including common RP verbs and adjectives
export const MEMORY_STOP_WORDS = new Set(["about", "above", "across", "after", "again", "against", "almost", "alone", "along", "already", "always", "among", "another", "anybody", "anyone", "anything", "anywhere", "around", "asked", "became", "because", "become", "been", "before", "began", "behind", "being", "below", "beside", "besides", "between", "beyond", "both", "came", "cannot", "come", "could", "didn't", "does", "doesn't", "doing", "don't", "during", "each", "either", "enough", "even", "ever", "every", "everyone", "everything", "everywhere", "except", "feel", "find", "first", "from", "front", "gave", "getting", "give", "given", "going", "good", "great", "happened", "have", "having", "heard", "hello", "help", "here", "herself", "himself", "however", "inside", "itself", "just", "knew", "know", "known", "left", "less", "like", "little", "look", "looked", "looking", "made", "make", "many", "matter", "mean", "might", "more", "most", "much", "must", "myself", "never", "next", "nobody", "none", "nothing", "nowhere", "often", "only", "other", "others", "ought", "ourselves", "outside", "over", "perhaps", "please", "probably", "quite", "rather", "really", "right", "said", "same", "saying", "seem", "seemed", "seems", "several", "shall", "should", "since", "small", "some", "somebody", "someone", "something", "sometimes", "somewhere", "soon", "still", "such", "sure", "take", "tell", "than", "that", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "thing", "things", "think", "this", "those", "though", "thought", "three", "through", "together", "told", "took", "toward", "towards", "tried", "under", "unless", "until", "upon", "very", "want", "wanted", "well", "went", "were", "what", "when", "where", "which", "while", "whom", "whose", "will", "with", "within", "without", "would", "wrong", "yeah", "your", "yours", "yourself", "yourselves", "details", "summary", "infoblock", "chatter", "dialogue", "narration", "narrative", "status", "tracker", "world", "state", "action", "words", "smiled", "nodded", "sighed", "walked", "eyes", "face", "turned", "replied", "whispered", "gazed", "stared", "glanced", "stepped", "shifted", "voice", "hands", "head", "fingers", "hair", "door", "room", "time", "back", "away", "down", "suddenly", "slowly", "softly", "quietly", "gently", "slightly", "single", "simply", "short", "sharp", "began"]);

// --- SEMANTIC EMBEDDING HELPERS ---

// Converts a string ID to a numeric hash (required by ST's Vectra backend)
export function memStringHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}
