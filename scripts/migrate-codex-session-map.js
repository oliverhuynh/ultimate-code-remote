#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const sessionStore = require('../src/utils/session-store');

const MAP_PATH = path.join(os.homedir(), '.ultimate-code-remote', 'codex-session-map.json');
const CODEX_SESSIONS_DIR = process.env.CODEX_SESSIONS_DIR || path.join(os.homedir(), '.codex', 'sessions');

function loadMap() {
    if (!fs.existsSync(MAP_PATH)) return { sessions: {} };
    try {
        return JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
    } catch (error) {
        return { sessions: {} };
    }
}

function saveMap(data) {
    const dir = path.dirname(MAP_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MAP_PATH, JSON.stringify(data, null, 2));
}

function parseArgs() {
    const args = process.argv.slice(2);
    return {
        dryRun: args.includes('--dry-run'),
        cleanup: true,
        autoAdd: args.includes('--auto-add'),
        assumeYes: args.includes('-y') || args.includes('--yes')
    };
}

function generateToken() {
    return sessionStore.generateToken();
}

function listCodexSessions(dir) {
    const files = [];
    if (!fs.existsSync(dir)) return files;
    const walk = (p) => {
        const entries = fs.readdirSync(p, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(p, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
                files.push(full);
            }
        }
    };
    walk(dir);
    return files;
}

function loadCodexSessionMeta(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        try {
            const event = JSON.parse(trimmed);
            if (event.type === 'session_meta' && event.payload?.id) {
                return event.payload;
            }
        } catch (error) {
            continue;
        }
    }
    return null;
}

function buildCodexIndex() {
    const files = listCodexSessions(CODEX_SESSIONS_DIR);
    const index = new Map();
    files.forEach((filePath) => {
        const meta = loadCodexSessionMeta(filePath);
        if (meta?.id) {
            index.set(meta.id, meta);
        }
    });
    return index;
}

function readLine(prompt) {
    const fd = fs.openSync('/dev/tty', 'rs');
    const buffer = Buffer.alloc(1024);
    process.stdout.write(prompt);
    const bytes = fs.readSync(fd, buffer, 0, buffer.length, null);
    fs.closeSync(fd);
    return buffer.slice(0, bytes).toString('utf8').trim();
}

function ensureSessionForToken(token, codexSessionId, cwdHint, options) {
    if (!cwdHint) return null;
    let repoName = sessionStore.getRepoNameByWorkdir(cwdHint);
    if (!repoName) {
        if (!options.autoAdd) {
            return null;
        }
        if (options.dryRun) {
            console.log(`[dry-run] Would add repo ${path.basename(cwdHint)} -> ${cwdHint}`);
            return null;
        }
        if (!options.assumeYes) {
            const prompt = `Repo not registered for ${cwdHint}. Add repo '${path.basename(cwdHint)}'? (y/N) `;
            const answer = readLine(prompt).trim().toLowerCase();
            if (answer !== 'y' && answer !== 'yes') {
                return null;
            }
        }
        const reposPath = sessionStore.REPOS_PATH;
        const reposDir = path.dirname(reposPath);
        if (!fs.existsSync(reposDir)) {
            fs.mkdirSync(reposDir, { recursive: true });
        }
        let reposData = { repos: [] };
        if (fs.existsSync(reposPath)) {
            try {
                reposData = JSON.parse(fs.readFileSync(reposPath, 'utf8'));
            } catch (error) {
                reposData = { repos: [] };
            }
        }
        reposData.repos = reposData.repos || [];
        reposData.repos.push({ name: path.basename(cwdHint), path: cwdHint, addedAt: new Date().toISOString() });
        fs.writeFileSync(reposPath, JSON.stringify(reposData, null, 2));
        repoName = path.basename(cwdHint);
    }
    const session = {
        id: codexSessionId,
        token,
        type: 'codex',
        created: new Date().toISOString(),
        createdAt: Math.floor(Date.now() / 1000),
        workdir: cwdHint,
        project: repoName,
        notification: {
            type: 'codex',
            project: repoName,
            message: 'Migrated Codex session'
        }
    };
    try {
        sessionStore.saveSession(repoName, session);
        return session;
    } catch (error) {
        return null;
    }
}

function migrate() {
    const flags = parseArgs();
    const data = loadMap();
    data.sessions = data.sessions || {};

    const entries = Object.entries(data.sessions);
    if (entries.length === 0) {
        console.log('No codex session mappings found.');
        return;
    }

    const migrations = [];
    const cleanupKeys = [];
    const codexIndex = buildCodexIndex();

    entries.forEach(([key, value]) => {
        const isToken = /^[A-Z0-9]{8}$/.test(key);
        if (isToken) return;

        if (key.startsWith('email:')) {
            const sessionId = key.slice('email:'.length);
            try {
                const session = sessionStore.getSessionById(sessionId);
                if (session && session.token) {
                    migrations.push({ token: session.token, sessionId: value, legacyKey: key, legacyType: 'email-session', cwdHint: session.workdir });
                    cleanupKeys.push(key);
                    return;
                }
            } catch (error) {
                // fall through
            }

            // No resolvable token, generate a new one
            const token = generateToken();
            const meta = codexIndex.get(value);
            migrations.push({ token, sessionId: value, legacyKey: key, legacyType: 'email-session-generated', cwdHint: meta?.cwd || null });
            cleanupKeys.push(key);
            return;
        }

        const legacyChannel = key.startsWith('telegram:') || key.startsWith('line:') || key.startsWith('email:');
        if (legacyChannel) {
            // Option A: create a new token bound to this codex session id
            const token = generateToken();
            const meta = codexIndex.get(value);
            migrations.push({ token, sessionId: value, legacyKey: key, legacyType: 'channel', cwdHint: meta?.cwd || null });
            cleanupKeys.push(key);
            return;
        }
    });

    if (migrations.length === 0) {
        console.log('No legacy mappings suitable for migration.');
        return;
    }

    migrations.forEach(({ token, sessionId, legacyKey, legacyType, cwdHint }) => {
        data.sessions[token] = sessionId;
        if (cwdHint) {
            ensureSessionForToken(token, sessionId, cwdHint, flags);
        }
    });

    if (flags.cleanup) {
        cleanupKeys.forEach((key) => {
            delete data.sessions[key];
        });
    }

    if (flags.dryRun) {
        console.log(`[dry-run] Would migrate ${migrations.length} mappings.`);
        if (flags.cleanup) {
            console.log(`[dry-run] Would remove ${cleanupKeys.length} legacy keys.`);
        }
        return;
    }

    saveMap(data);
    console.log(`Migrated ${migrations.length} mappings to raw token keys.`);
    if (flags.cleanup) {
        console.log(`Removed ${cleanupKeys.length} legacy keys.`);
    }
}

migrate();
