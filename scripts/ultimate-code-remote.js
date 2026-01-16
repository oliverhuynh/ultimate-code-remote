#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const sessionStore = require('../src/utils/session-store');
const { formatSessionsList } = require('../src/utils/sessions-list-format');

const HOME_DIR = os.homedir();
const ROOT_DIR = path.join(HOME_DIR, '.ultimate-code-remote');
const REPOS_PATH = path.join(ROOT_DIR, 'repos.json');

function ensureRootDir() {
    if (!fs.existsSync(ROOT_DIR)) {
        fs.mkdirSync(ROOT_DIR, { recursive: true });
    }
}

function loadRepos() {
    ensureRootDir();
    if (!fs.existsSync(REPOS_PATH)) {
        return { repos: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(REPOS_PATH, 'utf8'));
    } catch (error) {
        return { repos: [] };
    }
}

function readJson(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        return fallback;
    }
}

function saveRepos(data) {
    ensureRootDir();
    fs.writeFileSync(REPOS_PATH, JSON.stringify(data, null, 2));
}

function showHelp() {
    console.log(`
ultimate-code-remote

Usage:
  ultimate-code-remote            Start ngrok + services
  ultimate-code-remote --dry-run  Show what would start
  ultimate-code-remote telegram   Start Telegram webhook (multi-repo)
  ultimate-code-remote line       Start LINE webhook
  ultimate-code-remote email      Start email relay daemon
  ultimate-code-remote webhooks   Start all webhook servers
  ultimate-code-remote ngrok      Start ngrok + services
  ultimate-code-remote repo list  List registered repos
  ultimate-code-remote repo add <name> <path>
  ultimate-code-remote repo init
  ultimate-code-remote repo remove <name>
  ultimate-code-remote sessions list [--repo <name>] [--filter <filter>] (top 10 by latest access)
  ultimate-code-remote sessions reindex
  ultimate-code-remote sessions new --repo <name>
  ultimate-code-remote codex sync [list|import] [--all|--id <id>] [--repo <name>] [--auto-add] [--dry-run] [--migrate-map]

Storage:
  ${REPOS_PATH}

Flags:
  --dry-run     Print enabled platforms without starting them
`);
}

function normalizeRepoPath(repoPath) {
    if (!repoPath) return '';
    if (repoPath.startsWith('~')) {
        return path.join(HOME_DIR, repoPath.slice(1));
    }
    return path.resolve(repoPath);
}

function repoList() {
    const data = loadRepos();
    if (!data.repos || data.repos.length === 0) {
        console.log('No repos registered.');
        return;
    }
    data.repos.forEach((repo) => {
        console.log(`${repo.name} -> ${repo.path}`);
    });
}

function repoAdd(name, repoPath) {
    if (!name || !repoPath) {
        console.log('Usage: ultimate-code-remote repo add <name> <path>');
        process.exit(1);
    }

    const data = loadRepos();
    const normalizedPath = normalizeRepoPath(repoPath);

    if (!fs.existsSync(normalizedPath)) {
        console.log(`Path does not exist: ${normalizedPath}`);
        process.exit(1);
    }

    if (data.repos.find(repo => repo.name === name)) {
        console.log(`Repo name already exists: ${name}`);
        process.exit(1);
    }

    data.repos.push({
        name,
        path: normalizedPath,
        addedAt: new Date().toISOString()
    });

    saveRepos(data);
    console.log(`Added repo: ${name} -> ${normalizedPath}`);
}

function repoRemove(name) {
    if (!name) {
        console.log('Usage: ultimate-code-remote repo remove <name>');
        process.exit(1);
    }

    const data = loadRepos();
    const nextRepos = data.repos.filter(repo => repo.name !== name);

    if (nextRepos.length === data.repos.length) {
        console.log(`Repo not found: ${name}`);
        process.exit(1);
    }

    data.repos = nextRepos;
    saveRepos(data);
    console.log(`Removed repo: ${name}`);
}

function repoInit() {
    const cwd = process.cwd();
    const name = path.basename(cwd);
    repoAdd(name, cwd);
}

function sessionsList(repoName = null, filter = null) {
    const entries = sessionStore.listSessions({ repoName, filter, limit: 10 });
    if (entries.length === 0) {
        console.log('No active sessions.');
        return;
    }
    const showDebugColumns = String(process.env.DEBUG || '').toLowerCase() === 'yes';
    console.log(formatSessionsList(entries, {
        padToken: true,
        sessionIdColumn: showDebugColumns,
        repoColumn: showDebugColumns
    }));
}

function sessionsNew(repoName) {
    if (!repoName) {
        console.log('Usage: ultimate-code-remote sessions new --repo <name>');
        process.exit(1);
    }

    const { token } = sessionStore.createManualSession(repoName);
    console.log(`Token: ${token}`);
}

function loadConfig() {
    const envPath = path.join(__dirname, '..', '.env');
    dotenv.config({ path: envPath });
    const ConfigManager = require(path.join(__dirname, '..', 'src', 'core', 'config'));
    const config = new ConfigManager();
    config.load();
    return config;
}

function startProcess(scriptPath, args = []) {
    const child = spawn(process.execPath, [scriptPath, ...args], {
        stdio: 'inherit'
    });
    child.on('error', (error) => {
        console.error(`Failed to start ${scriptPath}: ${error.message}`);
    });
    return child;
}

function startTelegram() {
    const scriptPath = path.join(__dirname, 'start-telegram-webhook-multi.js');
    startProcess(scriptPath);
}

function startLine() {
    const scriptPath = path.join(__dirname, '..', 'start-line-webhook.js');
    startProcess(scriptPath);
}

function startWebhooks() {
    const scriptPath = path.join(__dirname, '..', 'start-all-webhooks.js');
    startProcess(scriptPath);
}

function startEmailDaemon() {
    const scriptPath = path.join(__dirname, '..', 'claude-remote.js');
    startProcess(scriptPath, ['daemon', 'start']);
}

function startCodexSync(args) {
    const scriptPath = path.join(__dirname, 'sync-codex-sessions.js');
    startProcess(scriptPath, args);
}


function startEnabledPlatforms() {
    const config = loadConfig();
    const telegram = config.getChannel('telegram');
    const line = config.getChannel('line');
    const email = config.getChannel('email');

    const dryRun = process.env.UCR_DRY_RUN === 'true';
    const started = [];

    if (telegram && telegram.enabled) {
        if (dryRun) {
            started.push('telegram');
        } else {
            startTelegram();
        }
    }
    if (line && line.enabled) {
        if (dryRun) {
            started.push('line');
        } else {
            startLine();
        }
    }
    if (email && email.enabled) {
        if (dryRun) {
            started.push('email');
        } else {
            startEmailDaemon();
        }
    }

    if (dryRun) {
        if (started.length === 0) {
            console.log('No enabled platforms found.');
        } else {
            console.log(`Would start: ${started.join(', ')}`);
        }
    }
}

async function run() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        process.chdir(path.join(__dirname, '..'));
        startProcess(path.join(__dirname, 'start-with-ngrok.js'));
        return;
    }

    if (args[0] === '--help' || args[0] === '-h') {
        showHelp();
        return;
    }

    if (args[0] === '--dry-run') {
        process.env.UCR_DRY_RUN = 'true';
        process.chdir(path.join(__dirname, '..'));
        startEnabledPlatforms();
        return;
    }

    if (args[0] === 'repo') {
        const action = args[1];
        if (action === 'list') {
            repoList();
            return;
        }
        if (action === 'add') {
            repoAdd(args[2], args[3]);
            return;
        }
        if (action === 'remove') {
            repoRemove(args[2]);
            return;
        }
        if (action === 'init') {
            repoInit();
            return;
        }
        showHelp();
        process.exit(1);
    }

    if (args[0] === 'sessions') {
        const action = args[1];
        if (action === 'list') {
            const repoFlagIndex = args.indexOf('--repo');
            const repoName = repoFlagIndex !== -1 ? args[repoFlagIndex + 1] : null;
            const filterFlagIndex = args.indexOf('--filter');
            const filter = filterFlagIndex !== -1 ? args[filterFlagIndex + 1] : null;
            sessionsList(repoName || null, filter || null);
            return;
        }
        if (action === 'reindex') {
            sessionStore.reindexSessions();
            console.log('✅ Sessions reindexed');
            return;
        }
        if (action === 'new') {
            const repoFlagIndex = args.indexOf('--repo');
            const repoName = repoFlagIndex !== -1 ? args[repoFlagIndex + 1] : null;
            sessionsNew(repoName || null);
            return;
        }
        showHelp();
        process.exit(1);
    }

    if (args[0] === 'codex') {
        const action = args[1];
        if (action === 'sync') {
            process.chdir(path.join(__dirname, '..'));
            const syncArgs = args.slice(2);
            if (!syncArgs.length || syncArgs[0].startsWith('--')) {
                const hasImportFlag = syncArgs.includes('--all') || syncArgs.includes('--id') || syncArgs.includes('--file');
                if (hasImportFlag) {
                    startCodexSync(['import', ...syncArgs]);
                    return;
                }
            }
            startCodexSync(syncArgs);
            return;
        }
        showHelp();
        process.exit(1);
    }

    if (args[0] === 'telegram') {
        process.chdir(path.join(__dirname, '..'));
        startTelegram();
        return;
    }

    if (args[0] === 'line') {
        process.chdir(path.join(__dirname, '..'));
        startLine();
        return;
    }

    if (args[0] === 'email') {
        process.chdir(path.join(__dirname, '..'));
        startEmailDaemon();
        return;
    }

    if (args[0] === 'webhooks') {
        process.chdir(path.join(__dirname, '..'));
        startWebhooks();
        return;
    }

    if (args[0] === 'ngrok') {
        process.chdir(path.join(__dirname, '..'));
        startProcess(path.join(__dirname, 'start-with-ngrok.js'));
        return;
    }

    showHelp();
    process.exit(1);
}

run().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
