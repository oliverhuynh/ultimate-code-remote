#!/usr/bin/env node

const sessionStore = require('../src/utils/session-store');

function usage() {
    console.log(`
Validate a Telegram session token and show its mapped repo/workdir.

Usage:
  node scripts/validate-telegram-session.js <TOKEN>

Storage:
  ~/.ultimate-code-remote/tokens.json
  ~/.ultimate-code-remote/sessions.json
`);
}

function run() {
    const token = process.argv[2];
    if (!token || token === '--help' || token === '-h') {
        usage();
        process.exit(token ? 0 : 1);
    }

    try {
        const session = sessionStore.findSessionByToken(token);
        if (session) {
            const repo = sessionStore.getRepoByName(session.repoName);
            console.log('✅ Token found');
            console.log(`Repo: ${session.repoName}`);
            console.log(`Workdir: ${repo ? repo.path : 'Unknown'}`);
            console.log(`Project: ${session.project || 'Unknown'}`);
            console.log(`Expires: ${session.expires || 'Unknown'}`);
            return;
        }
    } catch (error) {
        console.error(`Lookup failed: ${error.message}`);
        process.exit(1);
    }

    console.log('❌ Token not found');
    process.exit(1);
}

run();
