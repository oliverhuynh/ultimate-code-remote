#!/usr/bin/env node

const sessionStore = require('../src/utils/session-store');

function run() {
    if (typeof sessionStore.listTokens !== 'function') {
        throw new Error('sessionStore.listTokens missing');
    }
    if (typeof sessionStore.getRepos !== 'function') {
        throw new Error('sessionStore.getRepos missing');
    }
    console.log('✅ telegram admin commands helpers available');
}

run();
