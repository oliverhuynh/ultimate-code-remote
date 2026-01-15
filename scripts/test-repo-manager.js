#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const script = path.join(__dirname, 'ultimate-code-remote.js');
const tmpRoot = path.join(os.tmpdir(), `ucr-${Date.now()}`);
const reposPath = path.join(tmpRoot, '.ultimate-code-remote', 'repos.json');

function run(cmd) {
    return execSync(cmd, {
        env: { ...process.env, HOME: tmpRoot },
        encoding: 'utf8'
    }).trim();
}

function assertContains(text, expected, message) {
    if (!text.includes(expected)) {
        throw new Error(`${message} (expected to include: ${expected})`);
    }
}

function runTest() {
    fs.mkdirSync(tmpRoot, { recursive: true });
    const repoPath = path.join(tmpRoot, 'repo1');
    fs.mkdirSync(repoPath, { recursive: true });

    run(`node ${script} repo add repo1 ${repoPath}`);
    const list = run(`node ${script} repo list`);
    assertContains(list, `repo1 -> ${repoPath}`, 'Repo list missing entry');

    run(`node ${script} repo remove repo1`);
    const listAfter = run(`node ${script} repo list`);
    if (listAfter.includes('repo1')) {
        throw new Error('Repo remove failed');
    }

    // init uses cwd basename
    const repo2Path = path.join(tmpRoot, 'repo2');
    fs.mkdirSync(repo2Path, { recursive: true });
    run(`cd ${repo2Path} && node ${script} repo init`);
    const listInit = run(`node ${script} repo list`);
    assertContains(listInit, `repo2 -> ${repo2Path}`, 'Repo init missing entry');

    if (!fs.existsSync(reposPath)) {
        throw new Error('repos.json not created');
    }

    console.log('✅ repo manager test passed');
}

runTest();
