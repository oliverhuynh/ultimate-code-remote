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
    const root = path.join(os.tmpdir(), `ucr-${Date.now()}`);
    const repoRoot = path.join(root, '.ultimate-code-remote');
    const reposPath = path.join(repoRoot, 'repos.json');
    const tokensPath = path.join(repoRoot, 'tokens.json');
    const sessionsPath = path.join(repoRoot, 'sessions.json');

    // Override HOME so store uses temp root
    process.env.HOME = root;

    // Load after setting HOME so root dir is derived from it.
    const sessionStore = require('../src/utils/session-store');

    fs.mkdirSync(repoRoot, { recursive: true });
    fs.writeFileSync(reposPath, JSON.stringify({
        repos: [{ name: 'repo1', path: '/tmp/repo1' }]
    }, null, 2));

    const session = {
        id: 'session-123',
        token: 'ABC12345',
        workdir: '/tmp/repo1',
        type: 'telegram'
    };

    sessionStore.saveSession('repo1', session);

    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    assertEqual(tokens.tokens.ABC12345.repoName, 'repo1', 'token index missing repo');

    const sessionsIndex = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
    assertEqual(sessionsIndex.sessions['session-123'].repoName, 'repo1', 'session index missing repo');

    const found = sessionStore.findSessionByToken('ABC12345');
    assertEqual(found.repoName, 'repo1', 'findSessionByToken repo mismatch');

    const removed = sessionStore.removeSession('repo1', 'session-123');
    assertEqual(removed, true, 'session removal failed');

    console.log('✅ session store test passed');
}

run();
