#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const script = path.join(__dirname, 'ultimate-code-remote.js');
const tmpRoot = path.join(os.tmpdir(), `ucr-sessions-${Date.now()}`);
const rootDir = path.join(tmpRoot, '.ultimate-code-remote');
const tokensPath = path.join(rootDir, 'tokens.json');
const repoSessionsDir = path.join(rootDir, 'repo1', 'sessions');

function run(cmd) {
    return execSync(cmd, {
        env: { ...process.env, HOME: tmpRoot },
        encoding: 'utf8'
    }).trim();
}

function runTest() {
    fs.mkdirSync(rootDir, { recursive: true });
    fs.mkdirSync(repoSessionsDir, { recursive: true });
    fs.writeFileSync(path.join(repoSessionsDir, 'session-1.json'), JSON.stringify({
        id: 'session-1',
        token: 'ABC12345',
        created: new Date(Date.now() - 10000).toISOString(),
        lastCommand: new Date(Date.now() - 5000).toISOString(),
        notification: { message: 'Hello World' }
    }, null, 2));
    fs.writeFileSync(path.join(repoSessionsDir, 'session-2.json'), JSON.stringify({
        id: 'session-2',
        token: 'XYZ67890',
        created: new Date(Date.now() - 20000).toISOString(),
        lastCommand: new Date(Date.now() - 15000).toISOString(),
        notification: { message: 'Different Message' }
    }, null, 2));
    fs.writeFileSync(tokensPath, JSON.stringify({
        tokens: {
            ABC12345: { repoName: 'repo1', sessionId: 'session-1' },
            XYZ67890: { repoName: 'repo1', sessionId: 'session-2' }
        }
    }, null, 2));

    const out = run(`node ${script} sessions list`);
    if (!out.includes('ABC12345 -> repo1 (session-1)') || !out.includes('XYZ67890 -> repo1 (session-2)')) {
        throw new Error('sessions list output missing token');
    }

    const filtered = run(`node ${script} sessions list --repo repo1`);
    if (!filtered.includes('ABC12345 -> repo1 (session-1)')) {
        throw new Error('sessions list --repo output missing token');
    }

    const filteredMessage = run(`node ${script} sessions list --filter Hello`);
    if (!filteredMessage.includes('ABC12345 -> repo1 (session-1)') || filteredMessage.includes('XYZ67890')) {
        throw new Error('sessions list --filter output incorrect');
    }

    console.log('✅ ultimate-code-remote sessions list test passed');
}

runTest();
