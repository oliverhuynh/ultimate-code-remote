const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_CODEX_SESSIONS_DIR = path.join(os.homedir(), '.codex', 'sessions');
const conversationCache = new Map();

function getCodexSessionsDir() {
    return process.env.CODEX_SESSIONS_DIR || DEFAULT_CODEX_SESSIONS_DIR;
}

function findCodexSessionFile(sessionId, baseDir) {
    if (!sessionId || !baseDir || !fs.existsSync(baseDir)) return null;
    const stack = [baseDir];

    while (stack.length) {
        const dir = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (error) {
            continue;
        }
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (entry.isFile() && entry.name.endsWith('.jsonl') && entry.name.includes(sessionId)) {
                return fullPath;
            }
        }
    }

    return null;
}

function extractText(content) {
    if (!Array.isArray(content)) return '';
    const parts = [];
    content.forEach((item) => {
        if (item && typeof item.text === 'string') {
            parts.push(item.text);
        } else if (item && typeof item.input_text === 'string') {
            parts.push(item.input_text);
        } else if (item && typeof item.output_text === 'string') {
            parts.push(item.output_text);
        }
    });
    return parts.join(' ').trim();
}

function extractConversationFromFile(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const lines = raw.split('\n').filter(Boolean);
        let firstUser = '';
        let lastMessage = '';
        let lastNonInstruction = '';
        let lastUser = '';

        for (const line of lines) {
            let entry;
            try {
                entry = JSON.parse(line);
            } catch (error) {
                continue;
            }
            if (entry.type !== 'response_item') continue;
            const payload = entry.payload;
            if (!payload || payload.type !== 'message') continue;
            const role = payload.role;
            const text = extractText(payload.content);
            if (!text) continue;
            const isInstruction = looksLikeInstructions(text);

            if (role === 'user' && !isInstruction && !looksLikeSlashCommand(text)) {
                lastUser = text;
            }
            if (!firstUser && role === 'user' && !isInstruction && !looksLikeSlashCommand(text)) {
                firstUser = text;
            }
            lastMessage = text;
            if (!isInstruction) {
                lastNonInstruction = text;
            }
        }

        return {
            initialMessage: firstUser || '',
            lastMessage: lastUser || lastNonInstruction || lastMessage || ''
        };
    } catch (error) {
        return { initialMessage: '', lastMessage: '' };
    }
}

function looksLikeInstructions(text) {
    const lowered = String(text).toLowerCase();
    const compact = lowered.replace(/\s+/g, '');
    if (lowered.includes('<instructions>') || compact.includes('<instructions>')) return true;
    if (lowered.includes('agents.md instructions')) return true;
    if (lowered.includes('<environment_context>') || compact.includes('<environment_context>')) return true;
    return false;
}

function looksLikeSlashCommand(text) {
    const trimmed = String(text).trim();
    if (!trimmed) return false;
    return trimmed.startsWith('/');
}

function getCodexConversation(sessionId) {
    if (!sessionId) return { initialMessage: '', lastMessage: '' };
    const baseDir = getCodexSessionsDir();
    const filePath = findCodexSessionFile(sessionId, baseDir);
    if (!filePath) {
        const empty = { initialMessage: '', lastMessage: '' };
        conversationCache.set(sessionId, { mtimeMs: 0, conversation: empty });
        return empty;
    }
    const mtimeMs = safeStatMtime(filePath);
    const cached = conversationCache.get(sessionId);
    if (cached && cached.mtimeMs === mtimeMs) {
        return cached.conversation;
    }
    const conversation = extractConversationFromFile(filePath);
    conversationCache.set(sessionId, { mtimeMs, conversation });
    return conversation;
}

function safeStatMtime(filePath) {
    try {
        return fs.statSync(filePath).mtimeMs;
    } catch (error) {
        return 0;
    }
}

module.exports = {
    getCodexSessionsDir,
    findCodexSessionFile,
    extractConversationFromFile,
    getCodexConversation
};
