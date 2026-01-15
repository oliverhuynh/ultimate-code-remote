#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

function run() {
    const root = path.join(os.tmpdir(), `ucr-repowork-${Date.now()}`);
    const ucrRoot = path.join(root, '.ultimate-code-remote');
    const reposPath = path.join(ucrRoot, 'repos.json');

    process.env.HOME = root;
    fs.mkdirSync(ucrRoot, { recursive: true });
    fs.writeFileSync(reposPath, JSON.stringify({
        repos: [{ name: 'repo1', path: '/tmp/repo1' }]
    }, null, 2));

    const sessionStore = require('../src/utils/session-store');
    const result = sessionStore.createManualSession('repo1');
    if (!result.token) {
        throw new Error('Token not created');
    }

    console.log('✅ repo work-on helper test passed');
}

run();
