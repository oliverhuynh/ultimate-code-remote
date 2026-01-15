#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const CodexRunner = require('../src/runners/CodexRunner');

async function run() {
    const sessionPath = path.join(os.tmpdir(), `codex-session-clear-${Date.now()}.json`);
    fs.writeFileSync(sessionPath, JSON.stringify({
        sessions: { 'test:user': 'session-1' },
        lastUpdated: new Date().toISOString()
    }, null, 2));

    const runner = new CodexRunner({ sessionPath });
    await runner.clearSessions();

    const raw = fs.readFileSync(sessionPath, 'utf8');
    const data = JSON.parse(raw);

    if (data.sessions && Object.keys(data.sessions).length === 0) {
        console.log('✅ codex session clear test passed');
        return;
    }

    throw new Error('Session map not cleared');
}

run().catch((error) => {
    console.error('❌ codex session clear test failed:', error.message);
    process.exit(1);
});
