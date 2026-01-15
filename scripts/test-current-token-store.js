#!/usr/bin/env node

const os = require('os');
const path = require('path');

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message} (expected: ${expected}, got: ${actual})`);
    }
}

function run() {
    const root = path.join(os.tmpdir(), `ucr-current-${Date.now()}`);
    process.env.HOME = root;

    const store = require('../src/utils/current-token-store');
    store.setToken('telegram:1', 'ABC12345');
    assertEqual(store.getToken('telegram:1'), 'ABC12345', 'token not set');
    store.clearToken('telegram:1');
    assertEqual(store.getToken('telegram:1'), null, 'token not cleared');

    console.log('✅ current token store test passed');
}

run();
