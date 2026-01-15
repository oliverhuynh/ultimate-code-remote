#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, 'ultimate-code-remote.js');

function run(cmd) {
    return execSync(cmd, {
        encoding: 'utf8'
    });
}

function assertContains(text, expected, message) {
    if (!text.includes(expected)) {
        throw new Error(`${message} (expected to include: ${expected})`);
    }
}

function runTest() {
    const help = run(`node ${script} --help`);
    assertContains(help, 'Start all enabled platforms', 'Help missing default behavior');
    assertContains(help, 'ultimate-code-remote telegram', 'Help missing telegram');
    assertContains(help, 'ultimate-code-remote repo init', 'Help missing repo init');
    console.log('✅ ultimate-code-remote CLI help test passed');
}

runTest();
