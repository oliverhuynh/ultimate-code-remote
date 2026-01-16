const fs = require('fs');
const path = require('path');
const os = require('os');
const Logger = require('../core/logger');

const logger = new Logger('SessionStore');
const ROOT_DIR = path.join(os.homedir(), '.ultimate-code-remote');
const REPOS_PATH = path.join(ROOT_DIR, 'repos.json');
const TOKENS_PATH = path.join(ROOT_DIR, 'tokens.json');
const SESSIONS_INDEX_PATH = path.join(ROOT_DIR, 'sessions.json');
const CONVERSATIONS_PATH = path.join(__dirname, '../data/conversations.json');
const { getCodexConversation } = require('./codex-conversation');
const { formatConversation } = require('./sessions-list-format');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function readJson(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        logger.warn(`Failed to read ${filePath}: ${error.message}`);
        return fallback;
    }
}

function loadConversations() {
    return readJson(CONVERSATIONS_PATH, {});
}

function parseTimestamp(value) {
    if (!value) return null;
    if (typeof value === 'number') {
        return value < 1e12 ? value * 1000 : value;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function getSessionLastAccess(session, sessionPath) {
    const candidates = [
        session?.lastAccess,
        session?.lastCommand,
        session?.updatedAt,
        session?.updated,
        session?.created,
        session?.createdAt
    ];

    for (const candidate of candidates) {
        const ts = parseTimestamp(candidate);
        if (ts) return ts;
    }

    if (sessionPath && fs.existsSync(sessionPath)) {
        try {
            return fs.statSync(sessionPath).mtimeMs;
        } catch (error) {
            logger.warn(`Failed to read session stat ${sessionPath}: ${error.message}`);
        }
    }

    return 0;
}

function getSessionMessages(session, conversations) {
    if (session?.codex?.sessionId) {
        const codexConversation = getCodexConversation(session.codex.sessionId);
        if (codexConversation.initialMessage || codexConversation.lastMessage || codexConversation.lastAssistant) {
            return {
                initialMessage: codexConversation.initialMessage || '',
                lastMessage: codexConversation.lastMessage || appeaseMessageFallback(session, codexConversation),
                lastAssistant: codexConversation.lastAssistant || ''
            };
        }
    }

    const initialMessage = [
        session?.notification?.metadata?.userQuestion,
        session?.notification?.message,
        session?.notification?.metadata?.claudeResponse
    ].find(text => typeof text === 'string' && text.trim());

    let lastMessage = null;
    if (conversations && session?.id && conversations[session.id]?.messages?.length) {
        const messages = conversations[session.id].messages;
        const firstUser = messages.find(msg => msg.type === 'user' && msg.content && !looksLikeSlashCommand(msg.content))?.content || null;
        const lastUser = [...messages].reverse().find(msg => msg.type === 'user' && msg.content && !looksLikeSlashCommand(msg.content))?.content || null;
        const lastAssistant = [...messages].reverse().find(msg => msg.type === 'claude' && msg.content)?.content || null;
        return {
            initialMessage: firstUser || initialMessage || '',
            lastMessage: lastUser || '',
            lastAssistant: lastAssistant || ''
        };
    }

    if (!lastMessage) {
        lastMessage = [
            session?.notification?.metadata?.claudeResponse,
            session?.notification?.metadata?.userQuestion,
            session?.notification?.message
        ].find(text => typeof text === 'string' && text.trim()) || null;
    }

    if ((!initialMessage && !lastMessage) && session?.codex?.sessionId) {
        const codexConversation = getCodexConversation(session.codex.sessionId);
        return {
            initialMessage: codexConversation.initialMessage || '',
            lastMessage: codexConversation.lastMessage || ''
        };
    }

    return { initialMessage: initialMessage || '', lastMessage: lastMessage || '', lastAssistant: '' };
}

function looksLikeSlashCommand(text) {
    const trimmed = String(text).trim();
    if (!trimmed) return false;
    return trimmed.startsWith('/');
}

function getSessionSummary(session) {
    if (!session) return '(no conversation recorded)';
    const conversations = loadConversations();
    const { lastMessage, lastAssistant } = getSessionMessages(session, conversations);
    return formatConversation(lastMessage, lastAssistant, Infinity);
}

function appeaseMessageFallback(session, codexConversation) {
    if (codexConversation.lastMessage) return codexConversation.lastMessage;
    return session?.notification?.metadata?.claudeResponse ||
        session?.notification?.metadata?.userQuestion ||
        session?.notification?.message ||
        '';
}

function writeJsonAtomic(filePath, data) {
    ensureDir(path.dirname(filePath));
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, filePath);
}

function getRepos() {
    const data = readJson(REPOS_PATH, { repos: [] });
    return data.repos || [];
}

function getRepoByName(repoName) {
    const repos = getRepos();
    return repos.find(repo => repo.name === repoName) || null;
}

function getRepoNameByWorkdir(workdir) {
    const repos = getRepos();
    const normalized = path.resolve(workdir || '');
    const match = repos.find(repo => path.resolve(repo.path) === normalized);
    return match ? match.name : null;
}

function getRepoSessionsDir(repoName) {
    if (!repoName) {
        throw new Error('Repo name is required');
    }
    return path.join(ROOT_DIR, repoName, 'sessions');
}

function saveSession(repoName, session) {
    const repo = getRepoByName(repoName);
    if (!repo) {
        throw new Error(`Repo not registered: ${repoName}`);
    }
    if (!session || !session.id || !session.token) {
        throw new Error('Session must include id and token');
    }

    const tokens = readJson(TOKENS_PATH, { tokens: {} });
    const sessionsIndex = readJson(SESSIONS_INDEX_PATH, { sessions: {} });

    const existing = tokens.tokens[session.token];
    if (existing && existing.sessionId !== session.id) {
        throw new Error(`Token already exists: ${session.token}`);
    }

    const sessionsDir = getRepoSessionsDir(repoName);
    ensureDir(sessionsDir);
    const sessionPath = path.join(sessionsDir, `${session.id}.json`);

    const payload = { ...session, repoName };
    fs.writeFileSync(sessionPath, JSON.stringify(payload, null, 2));

    tokens.tokens[session.token] = { repoName, sessionId: session.id };
    sessionsIndex.sessions[session.id] = { repoName };

    writeJsonAtomic(TOKENS_PATH, tokens);
    writeJsonAtomic(SESSIONS_INDEX_PATH, sessionsIndex);

    return sessionPath;
}

function loadSessionFile(repoName, sessionId) {
    const sessionPath = path.join(getRepoSessionsDir(repoName), `${sessionId}.json`);
    if (!fs.existsSync(sessionPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    } catch (error) {
        logger.warn(`Failed to read session ${sessionId}: ${error.message}`);
        return null;
    }
}

function findSessionByToken(token) {
    const tokens = readJson(TOKENS_PATH, { tokens: {} });
    const entry = tokens.tokens[token];
    if (!entry) return null;

    const session = loadSessionFile(entry.repoName, entry.sessionId);
    if (!session) return null;

    const repo = getRepoByName(entry.repoName);
    if (!repo) {
        throw new Error(`Repo not registered: ${entry.repoName}`);
    }

    return { ...session, repoName: entry.repoName, workdir: repo.path };
}

function getSessionById(sessionId) {
    const sessionsIndex = readJson(SESSIONS_INDEX_PATH, { sessions: {} });
    const entry = sessionsIndex.sessions[sessionId];
    if (!entry) return null;

    const session = loadSessionFile(entry.repoName, sessionId);
    if (!session) return null;

    const repo = getRepoByName(entry.repoName);
    if (!repo) {
        throw new Error(`Repo not registered: ${entry.repoName}`);
    }

    return { ...session, repoName: entry.repoName, workdir: repo.path };
}

function removeSession(repoName, sessionId) {
    const sessionsDir = getRepoSessionsDir(repoName);
    const sessionPath = path.join(sessionsDir, `${sessionId}.json`);
    let removed = false;

    if (fs.existsSync(sessionPath)) {
        fs.unlinkSync(sessionPath);
        removed = true;
    }

    const tokens = readJson(TOKENS_PATH, { tokens: {} });
    const sessionsIndex = readJson(SESSIONS_INDEX_PATH, { sessions: {} });

    for (const [token, entry] of Object.entries(tokens.tokens)) {
        if (entry.sessionId === sessionId) {
            delete tokens.tokens[token];
        }
    }

    if (sessionsIndex.sessions[sessionId]) {
        delete sessionsIndex.sessions[sessionId];
    }

    writeJsonAtomic(TOKENS_PATH, tokens);
    writeJsonAtomic(SESSIONS_INDEX_PATH, sessionsIndex);

    return removed;
}

function updateSession(repoName, session) {
    if (!session || !session.id) {
        throw new Error('Session id required');
    }
    const sessionsDir = getRepoSessionsDir(repoName);
    ensureDir(sessionsDir);
    const sessionPath = path.join(sessionsDir, `${session.id}.json`);
    const payload = { ...session, repoName };
    fs.writeFileSync(sessionPath, JSON.stringify(payload, null, 2));
}

function listTokens(repoName = null) {
    const tokens = readJson(TOKENS_PATH, { tokens: {} });
    const entries = Object.entries(tokens.tokens || {});
    if (!repoName) return entries;
    return entries.filter(([, info]) => info.repoName === repoName);
}

function listSessions(options = {}) {
    const repoName = options.repoName || null;
    const filter = options.filter ? String(options.filter).toLowerCase() : null;
    const limit = typeof options.limit === 'number' ? options.limit : 10;

    const tokens = readJson(TOKENS_PATH, { tokens: {} });
    const entries = Object.entries(tokens.tokens || {});
    const filtered = repoName
        ? entries.filter(([, info]) => info.repoName === repoName)
        : entries;

    const conversations = filter ? loadConversations() : null;
    const results = [];

    filtered.forEach(([token, info]) => {
        const session = loadSessionFile(info.repoName, info.sessionId);
        const localSessionPath = session
            ? path.join(getRepoSessionsDir(info.repoName), `${info.sessionId}.json`)
            : null;
        let sessionPath = localSessionPath;
        if (session?.codex?.sessionId) {
            const codexPath = require('./codex-conversation').findCodexSessionFile(
                session.codex.sessionId,
                require('./codex-conversation').getCodexSessionsDir()
            );
            if (codexPath) {
                sessionPath = codexPath;
            }
        }
        const lastAccess = getSessionLastAccess(session, sessionPath || localSessionPath);
        const { initialMessage, lastMessage } = getSessionMessages(session, conversations);

        if (filter) {
            const matches = (initialMessage && initialMessage.toLowerCase().includes(filter)) ||
                (lastMessage && lastMessage.toLowerCase().includes(filter));
            if (!matches) return;
        }

        results.push({
            token,
            info,
            session,
            lastAccess,
            sessionPath,
            initialMessage,
            lastMessage
        });
    });

    results.sort((a, b) => b.lastAccess - a.lastAccess);

    if (limit >= 0) {
        return results.slice(0, limit);
    }

    return results;
}

function generateToken() {
    const tokens = readJson(TOKENS_PATH, { tokens: {} }).tokens || {};
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    do {
        token = '';
        for (let i = 0; i < 8; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (tokens[token]);
    return token;
}

function createManualSession(repoName) {
    const repo = getRepoByName(repoName);
    if (!repo) {
        throw new Error(`Repo not registered: ${repoName}`);
    }

    const tokens = readJson(TOKENS_PATH, { tokens: {} });
    let token = generateToken();
    while (tokens.tokens[token]) {
        token = generateToken();
    }

    const sessionId = require('uuid').v4();
    const session = {
        id: sessionId,
        token,
        type: 'manual',
        created: new Date().toISOString(),
        createdAt: Math.floor(Date.now() / 1000),
        workdir: repo.path,
        project: repoName,
        notification: {
            type: 'manual',
            project: repoName,
            message: 'Manual session'
        }
    };

    saveSession(repoName, session);
    return { token, sessionId };
}

function reindexSessions() {
    const repos = getRepos();
    const tokens = { tokens: {} };
    const sessionsIndex = { sessions: {} };

    repos.forEach((repo) => {
        const sessionsDir = getRepoSessionsDir(repo.name);
        if (!fs.existsSync(sessionsDir)) return;

        const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
        files.forEach((file) => {
            const sessionPath = path.join(sessionsDir, file);
            try {
                const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
                if (!session.id || !session.token) return;
                tokens.tokens[session.token] = { repoName: repo.name, sessionId: session.id };
                sessionsIndex.sessions[session.id] = { repoName: repo.name };
            } catch (error) {
                logger.warn(`Failed to reindex session ${file}: ${error.message}`);
            }
        });
    });

    writeJsonAtomic(TOKENS_PATH, tokens);
    writeJsonAtomic(SESSIONS_INDEX_PATH, sessionsIndex);
}

module.exports = {
    ROOT_DIR,
    REPOS_PATH,
    TOKENS_PATH,
    SESSIONS_INDEX_PATH,
    getRepos,
    getRepoByName,
    getRepoNameByWorkdir,
    getRepoSessionsDir,
    saveSession,
    findSessionByToken,
    getSessionById,
    removeSession,
    updateSession,
    listTokens,
    listSessions,
    getSessionSummary,
    reindexSessions,
    createManualSession,
    generateToken
};
