#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message} (expected: ${expected}, got: ${actual})`);
    }
}

function run() {
    const root = path.join(os.tmpdir(), `ucr-reindex-${Date.now()}`);
    const ucrRoot = path.join(root, '.ultimate-code-remote');
    const reposPath = path.join(ucrRoot, 'repos.json');
    const tokensPath = path.join(ucrRoot, 'tokens.json');
    const sessionsPath = path.join(ucrRoot, 'sessions.json');
    const repoSessionsDir = path.join(ucrRoot, 'repo1', 'sessions');

    process.env.HOME = root;

    fs.mkdirSync(repoSessionsDir, { recursive: true });
    fs.writeFileSync(reposPath, JSON.stringify({
        repos: [{ name: 'repo1', path: '/tmp/repo1' }]
    }, null, 2));

    const session = {
        id: 'session-1',
        token: 'ABC12345',
        repoName: 'repo1'
    };
    fs.writeFileSync(path.join(repoSessionsDir, 'session-1.json'), JSON.stringify(session, null, 2));

    const sessionStore = require('../src/utils/session-store');
    sessionStore.reindexSessions();

    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    assertEqual(tokens.tokens.ABC12345.repoName, 'repo1', 'reindex token missing');

    const sessionsIndex = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
    assertEqual(sessionsIndex.sessions['session-1'].repoName, 'repo1', 'reindex session missing');

    console.log('✅ session reindex test passed');
}

run();
