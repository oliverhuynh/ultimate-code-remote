#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const script = path.join(__dirname, 'ultimate-code-remote.js');
const tmpRoot = path.join(os.tmpdir(), `ucr-sessions-new-${Date.now()}`);
const rootDir = path.join(tmpRoot, '.ultimate-code-remote');
const reposPath = path.join(rootDir, 'repos.json');
const tokensPath = path.join(rootDir, 'tokens.json');

function run(cmd) {
    return execSync(cmd, {
        env: { ...process.env, HOME: tmpRoot },
        encoding: 'utf8'
    }).trim();
}

function runTest() {
    fs.mkdirSync(rootDir, { recursive: true });
    fs.writeFileSync(reposPath, JSON.stringify({
        repos: [{ name: 'repo1', path: '/tmp/repo1' }]
    }, null, 2));

    const out = run(`node ${script} sessions new --repo repo1`);
    if (!out.startsWith('Token:')) {
        throw new Error('sessions new did not output token');
    }

    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    const token = out.replace('Token:', '').trim();
    if (!tokens.tokens[token]) {
        throw new Error('token not written to tokens.json');
    }

    console.log('✅ sessions new test passed');
}

runTest();
