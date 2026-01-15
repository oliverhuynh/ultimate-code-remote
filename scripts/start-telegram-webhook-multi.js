#!/usr/bin/env node

const path = require('path');
const os = require('os');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Start Telegram webhook for multi-repo routing.

Usage:
  node scripts/start-telegram-webhook-multi.js [--help]

Repo sessions are stored under:
  ~/.ultimate-code-remote/<repo-name>/sessions
`);
    process.exit(0);
}

// Ensure a shared sessions directory so multiple repos can map tokens to workdirs.
if (!process.env.TELEGRAM_SESSIONS_DIR) {
    process.env.TELEGRAM_SESSIONS_DIR = path.join(os.homedir(), '.ultimate-code-remote', 'sessions');
}

require(path.join(__dirname, '..', 'start-telegram-webhook'));
