#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const sessionStore = require('../src/utils/session-store');

const CODEX_SESSIONS_DIR = process.env.CODEX_SESSIONS_DIR || path.join(process.cwd(), 'codex-sessions');
const SESSION_MAP_PATH = path.join(os.homedir(), '.ultimate-code-remote', 'codex-session-map.json');
const MIGRATE_SCRIPT = path.join(__dirname, 'migrate-codex-session-map.js');

function loadCodexSessionMeta(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let meta = null;
    let lastUserText = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        try {
            const event = JSON.parse(trimmed);
            if (event.type === 'session_meta' && event.payload?.id) {
                meta = event.payload;
            }
            if (event.type === 'response_item' && event.payload?.role === 'user') {
                const part = event.payload?.content?.[0]?.text || event.payload?.content?.[0]?.input_text;
                if (part) lastUserText = part;
            }
        } catch (error) {
            continue;
        }
    }

    if (!meta) return null;

    return {
        id: meta.id,
        cwd: meta.cwd || null,
        timestamp: meta.timestamp || null,
        modelProvider: meta.model_provider || null,
        cliVersion: meta.cli_version || null,
        instructions: meta.instructions || null,
        lastUserText
    };
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

function loadRepos() {
    const reposPath = sessionStore.REPOS_PATH;
    if (!fs.existsSync(reposPath)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(reposPath, 'utf8'));
        return data.repos || [];
    } catch (error) {
        return [];
    }
}

function saveRepos(data) {
    const dir = path.dirname(sessionStore.REPOS_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(sessionStore.REPOS_PATH, JSON.stringify(data, null, 2));
}

function findRepoForCwd(cwd, repos) {
    if (!cwd) return null;
    const normalized = path.resolve(cwd);
    return repos.find(repo => path.resolve(repo.path) === normalized) || null;
}

function loadSessionMap() {
    if (!fs.existsSync(SESSION_MAP_PATH)) return { sessions: {} };
    try {
        return JSON.parse(fs.readFileSync(SESSION_MAP_PATH, 'utf8'));
    } catch (error) {
        return { sessions: {} };
    }
}

function saveSessionMap(data) {
    const dir = path.dirname(SESSION_MAP_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SESSION_MAP_PATH, JSON.stringify(data, null, 2));
}

function upsertCodexSessionKey(sessionKey, codexSessionId) {
    const data = loadSessionMap();
    data.sessions = data.sessions || {};
    data.sessions[sessionKey] = codexSessionId;
    saveSessionMap(data);
}

function generateToken() {
    return sessionStore.generateToken();
}

function createSession(repoName, codexMeta, tokenOverride) {
    const token = tokenOverride || generateToken();
    const sessionId = codexMeta.id || uuidv4();

    const session = {
        id: sessionId,
        token,
        type: 'codex',
        created: new Date().toISOString(),
        createdAt: Math.floor(Date.now() / 1000),
        workdir: codexMeta.cwd || process.cwd(),
        project: repoName,
        codex: {
            sessionId: codexMeta.id,
            modelProvider: codexMeta.modelProvider,
            cliVersion: codexMeta.cliVersion
        },
        notification: {
            type: 'codex',
            project: repoName,
            message: 'Imported Codex session'
        }
    };

    sessionStore.saveSession(repoName, session);
    return session;
}

function printUsage() {
    console.log(`\nUsage:\n  node scripts/sync-codex-sessions.js list\n  node scripts/sync-codex-sessions.js import --all [--repo <name>] [--auto-add] [--dry-run]\n  node scripts/sync-codex-sessions.js import --id <codex_session_id> [--repo <name>] [--session-key <key>] [--bind <channel:id>] [--auto-add] [--dry-run]\n  node scripts/sync-codex-sessions.js import --file <path> [--repo <name>] [--session-key <key>] [--bind <channel:id>] [--auto-add] [--dry-run]\n  node scripts/sync-codex-sessions.js --migrate-map [--dry-run]\n\nNotes:\n- Default source dir: ${CODEX_SESSIONS_DIR}\n- Use --session-key to bind a channel sessionKey.\n- Use --bind as a convenience alias for --session-key.\n- Use --auto-add to register missing repos from session cwd (with confirmation).\n`);
}

function parseArgs() {
    const args = process.argv.slice(2);
    const flags = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = args[i + 1];
            if (!next || next.startsWith('--')) {
                flags[key] = true;
            } else {
                flags[key] = next;
                i++;
            }
        } else if (!flags._) {
            flags._ = [arg];
        } else {
            flags._.push(arg);
        }
    }
    return flags;
}

function shouldAssumeYes(flags) {
    return flags.y === true || flags.yes === true;
}

function list() {
    const files = listCodexSessions(CODEX_SESSIONS_DIR);
    if (!files.length) {
        console.log('No Codex sessions found.');
        return;
    }
    console.log(`Found ${files.length} Codex sessions:`);
    files.slice(0, 200).forEach((filePath) => {
        const meta = loadCodexSessionMeta(filePath);
        if (!meta) return;
        console.log(`- ${meta.id} | ${meta.timestamp || 'n/a'} | ${meta.cwd || 'n/a'} | ${path.basename(filePath)}`);
    });
    if (files.length > 200) {
        console.log(`...and ${files.length - 200} more`);
    }
}

function importByFile(filePath, options) {
    const meta = loadCodexSessionMeta(filePath);
    if (!meta) {
        console.log(`Skipping ${filePath}: no session_meta found.`);
        return null;
    }

    const repos = loadRepos();
    let repo = null;
    if (options.repo) {
        repo = repos.find(r => r.name === options.repo);
        if (!repo) {
            console.error(`Repo not found: ${options.repo}`);
            return null;
        }
    } else {
        repo = findRepoForCwd(meta.cwd, repos);
    }

    if (!repo) {
        if (options.autoAdd && meta.cwd) {
            const addName = path.basename(meta.cwd);
            if (!options.dryRun && !options.assumeYes) {
                const prompt = `Repo not found for cwd ${meta.cwd}. Add repo '${addName}'? (y/N) `;
                const answer = readLine(prompt).trim().toLowerCase();
                if (answer !== 'y' && answer !== 'yes') {
                    console.log(`Skipping ${meta.id}: repo not added`);
                    return null;
                }
            }
            if (!options.dryRun) {
                const reposData = { repos: loadRepos() };
                reposData.repos.push({ name: addName, path: meta.cwd, addedAt: new Date().toISOString() });
                saveRepos(reposData);
                repo = { name: addName, path: meta.cwd };
                console.log(`Added repo: ${addName} -> ${meta.cwd}`);
            } else {
                console.log(`[dry-run] Would add repo ${addName} -> ${meta.cwd}`);
                return null;
            }
        } else {
            console.log(`Skipping ${meta.id}: no matching repo for cwd ${meta.cwd}`);
            return null;
        }
    }

    if (options.dryRun) {
        console.log(`[dry-run] Would import ${meta.id} -> repo ${repo.name}`);
        return null;
    }

    const session = createSession(repo.name, meta, options.token);
    if (options.sessionKey) {
        upsertCodexSessionKey(options.sessionKey, meta.id);
    } else {
        upsertCodexSessionKey(session.token, meta.id);
    }

    console.log(`Imported ${meta.id} -> repo ${repo.name}, token ${session.token}`);
    return session;
}

function importAll(options) {
    const files = listCodexSessions(CODEX_SESSIONS_DIR);
    if (!files.length) {
        console.log('No Codex sessions found.');
        return;
    }
    files.forEach(filePath => importByFile(filePath, options));
}

function readLine(prompt) {
    const fd = fs.openSync('/dev/tty', 'rs');
    const buffer = Buffer.alloc(1024);
    process.stdout.write(prompt);
    const bytes = fs.readSync(fd, buffer, 0, buffer.length, null);
    fs.closeSync(fd);
    return buffer.slice(0, bytes).toString('utf8').trim();
}

function main() {
    const flags = parseArgs();
    if (flags['migrate-map']) {
        const args = ['--dry-run'].filter(() => !!flags['dry-run']);
        if (flags['auto-add']) {
            args.push('--auto-add');
        }
        if (flags.y || flags.yes) {
            args.push('-y');
        }
        const child = require('child_process').spawnSync('node', [MIGRATE_SCRIPT, ...args], { stdio: 'inherit' });
        process.exit(child.status || 0);
    }
    const cmd = (flags._ && flags._[0]) || 'list';

    if (cmd === 'list') {
        list();
        return;
    }

    if (cmd === 'import') {
        const options = {
            repo: flags.repo,
            sessionKey: flags['session-key'] || flags.bind || null,
            dryRun: !!flags['dry-run'],
            token: flags.token || null,
            autoAdd: !!flags['auto-add'],
            assumeYes: shouldAssumeYes(flags)
        };

        if (flags.all) {
            importAll(options);
            return;
        }
        if (flags.id) {
            const files = listCodexSessions(CODEX_SESSIONS_DIR);
            const match = files.find(file => file.includes(flags.id));
            if (!match) {
                console.error(`Codex session id not found: ${flags.id}`);
                process.exit(1);
            }
            importByFile(match, options);
            return;
        }
        if (flags.file) {
            importByFile(flags.file, options);
            return;
        }
    }

    printUsage();
    process.exit(1);
}

main();
