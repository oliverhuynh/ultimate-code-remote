#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const script = path.join(__dirname, 'ultimate-code-remote.js');
const tmpRoot = path.join(os.tmpdir(), `ucr-sessions-${Date.now()}`);
const rootDir = path.join(tmpRoot, '.ultimate-code-remote');
const tokensPath = path.join(rootDir, 'tokens.json');

function run(cmd) {
    return execSync(cmd, {
        env: { ...process.env, HOME: tmpRoot },
        encoding: 'utf8'
    }).trim();
}

function runTest() {
    fs.mkdirSync(rootDir, { recursive: true });
    fs.writeFileSync(tokensPath, JSON.stringify({
        tokens: {
            ABC12345: { repoName: 'repo1', sessionId: 'session-1' }
        }
    }, null, 2));

    const out = run(`node ${script} sessions list`);
    if (!out.includes('ABC12345 -> repo1 (session-1)')) {
        throw new Error('sessions list output missing token');
    }

    const filtered = run(`node ${script} sessions list --repo repo1`);
    if (!filtered.includes('ABC12345 -> repo1 (session-1)')) {
        throw new Error('sessions list --repo output missing token');
    }

    console.log('✅ ultimate-code-remote sessions list test passed');
}

runTest();
