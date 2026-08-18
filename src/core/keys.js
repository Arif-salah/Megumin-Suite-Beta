// ─────────────────────────────────────────────────────────────────────────────
// Profile identity — which chat/character the settings on screen belong to.
//
// Everything here answers one question: "what key does this data save under?"
// Extracted from index.js unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { getContext, extension_settings, saveSettingsDebounced } from "../st.js";
import { extensionName } from "./constants.js";

// The memory feature supplies the vector-collection half of the data identity.
// It is registered rather than imported because memory still lives in index.js;
// once it becomes a module this hook goes away and the import goes back to being
// a plain one. Registering keeps the original `typeof` guard honest — dropping the
// call entirely would have silently turned every identity into "...|none".
let _collectionIdProvider = null;
export function setCollectionIdProvider(fn) { _collectionIdProvider = fn; }

// One string naming both halves of "which chat is this data for": the profile key a
// save would write under, and the vector collection the memory helpers insert into.
// Work that spans an await (an LLM call, a setTimeout, a batch loop) captures this
// once at the start and re-checks it before every write, so nothing lands in a chat
// the user switched to mid-run. Both halves fall back to a fixed string so a plain
// "not ready yet" reads as one identity rather than as constant churn.
export function meguminActiveDataIdentity() {
    const key = getCharacterKey() || "default";
    const collection = (typeof _collectionIdProvider === "function" ? _collectionIdProvider() : null) || "none";
    return key + "|" + collection;
}

export function getCharacterKey() {
    const context = getContext();
    const saveMode = extension_settings[extensionName]?.globalSettings?.saveMode || "chat";
    
    // Priority 1: Group chat
    if (context.groupId !== undefined && context.groupId !== null) { return `group_${context.groupId}`; }
    
    // Priority 2: Chat-level (if save mode is per chat)
    if (saveMode === "chat") {
        const cid = context.chatId;
        if (cid && typeof cid === 'string' && cid.trim() !== '') {
            return `chat::${cid}`;
        }
    }
    
    // Priority 3: Character-level (avatar name)
    if (context.characterId !== undefined && context.characterId !== null && context.characters && context.characters[context.characterId]) {
        return context.characters[context.characterId].avatar;
    }
    return null;
}

// Returns the raw chatId from context (for debugging and advanced use)
export function getRawChatId() {
    const context = getContext();
    return context?.chatId ?? null;
}

// Returns the raw avatar name from context (for backward compatibility)
export function getRawAvatar() {
    const context = getContext();
    if (context.characterId !== undefined && context.characterId !== null && context.characters && context.characters[context.characterId]) {
        return context.characters[context.characterId].avatar;
    }
    return null;
}

// Returns just the avatar name (for backward compatibility with old profile storage)
export function getAvatarKey() {
    const context = getContext();
    if (context.characterId !== undefined && context.characterId !== null && context.characters && context.characters[context.characterId]) {
        return context.characters[context.characterId].avatar;
    }
    return null;
}

// Debug helper: logs all profile-related state to the console
// Call via: debugProfileState() in the browser console
export function debugProfileState() {
    const context = getContext();
    const key = getCharacterKey();
    const avatar = getRawAvatar();
    const chatId = getRawChatId();
    const settings = extension_settings?.[extensionName]?.profiles || {};
    console.group('🔍 Megumin Profile Debug');
    console.log('context.chatId:', chatId);
    console.log('context.characterId:', context.characterId);
    console.log('context.groupId:', context.groupId);
    console.log('context.chat (messages count):', context.chat ? context.chat.length : 'null');
    console.log('context.characters count:', context.characters ? Object.keys(context.characters).length : 'null');
    console.log('getCharacterKey():', key);
    console.log('getRawAvatar():', avatar);
    console.log('isChatLevelProfile():', isChatLevelProfile());
    console.log('getProfileLevel():', getProfileLevel());
    console.log('\n📦 All profile keys in storage:');
    Object.keys(settings).forEach(k => console.log(`  [${k}]`));
    console.log('\n📊 Profile for key "' + key + '":', key ? (settings[key] ? 'FOUND' : 'NOT FOUND') : 'N/A');
    if (avatar && avatar !== key) {
        console.log('📊 Profile for key "' + avatar + '":', settings[avatar] ? 'FOUND' : 'NOT FOUND');
    }
    console.groupEnd();
}

// Returns true if the current profile is a chat-level profile
export function isChatLevelProfile() {
    const key = getCharacterKey();
    return key !== null && key.startsWith('chat::');
}

// Detects if the current chat is a branch and returns the parent chat's key
// ST branch naming: original_chat_TIMESTAMP_HASH or original_chat_UUID_SUFFIX
export function getParentChatKey() {
    const context = getContext();
    // Check if this is a branched chat by reading the main_chat from SillyTavern chatMetadata
    if (context.chatMetadata && context.chatMetadata.main_chat) {
        return `chat::${context.chatMetadata.main_chat}`;
    }
    if (!context.chatId) return null;
    // Pattern: anything_uuidSuffix where suffix is 8-16 hex chars
    // Handles: my_chat_abc123def456789, chat_2024-01-15T12:30:45Z_abc123, etc.
    const branchMatch = context.chatId.match(/^(.+?)_([0-9a-f]{8,})$/);
    if (!branchMatch) return null;
    const parentChatId = branchMatch[1];
    // Return the chat-level key for the parent chat
    return `chat::${parentChatId}`;
}

// Returns the profile level: 'chat', 'group', 'character', or 'global'
export function getProfileLevel() {
    const context = getContext();
    const saveMode = extension_settings[extensionName]?.globalSettings?.saveMode || "chat";
    
    // Group chat
    if (context.groupId !== undefined && context.groupId !== null) return 'group';
    // Chat-level: only if mode is 'chat' and chatId is a valid, non-empty string
    if (saveMode === "chat" && context.chatId && typeof context.chatId === 'string' && context.chatId.trim() !== '') return 'chat';
    // Character-level: only if we can resolve an avatar
    if (context.characterId !== undefined && context.characterId !== null && context.characters && context.characters[context.characterId] && context.characters[context.characterId].avatar) return 'character';
    return 'global';
}

export function cleanGhostProfiles() {
    if (!extension_settings[extensionName] || !extension_settings[extensionName].profiles) return;

    const context = getContext();
    if (!context.characters || context.characters.length === 0) {
        return;
    }
    // Get all valid avatars, group IDs, and the current chat ID
    const activeAvatars = Object.values(context.characters || {}).map(c => c.avatar);
    const activeGroups = (context.groups || []).map(g => `group_${g.id}`);
    const activeChats = context.chatId ? [`chat::${context.chatId}`] : [];
    // Only protect the CURRENT chat's key; other chat profiles will be cleaned if no longer active
    const validKeys = ["default", ...activeAvatars, ...activeGroups, ...activeChats];

    // SillyTavern has no "groups have loaded" flag. `groups` is a plain module array that
    // getGroups() reassigns after an async fetch. Treating empty as "no groups exist" would
    // delete every group profile the user owns, permanently, on one bad startup. The cost is
    // that a user who deleted their last group keeps a few dead settings entries; the cost
    // the other way is losing live group configs, which is not recoverable.
    const groupsLoaded = Array.isArray(context.groups) && context.groups.length > 0;
    if (!groupsLoaded && Object.keys(extension_settings[extensionName].profiles).some(k => k.startsWith('group_'))) {
        console.debug("[Megumin-Suite] Ghost profile cleanup skipped every group_* profile this pass: SillyTavern reports no groups, which cannot be told apart from groups not having loaded yet. They will be reconsidered on a later startup once at least one group is visible.");
    }

    let deletedCount = 0;
    Object.keys(extension_settings[extensionName].profiles).forEach(key => {
        // Do not delete chat-level profiles; they are meant to persist per chat session
        if (key.startsWith('chat::')) {
            return;
        }
        if (key.startsWith('group_') && !groupsLoaded) {
            return;
        }
        if (!validKeys.includes(key)) {
            delete extension_settings[extensionName].profiles[key];
            deletedCount++;
        }
    });

    if (deletedCount > 0) {
        saveSettingsDebounced();
        console.log(`[Megumin Suite] Garbage Collection: Cleaned up ${deletedCount} ghost profiles.`);
    }
}
