#!/usr/bin/env node

const ConfigManager = require('../src/core/config');

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message} (expected: ${expected}, got: ${actual})`);
    }
}

function run() {
    const config = new ConfigManager();
    const base = {
        telegram: {
            config: {
                botToken: 'env-token',
                chatId: '123'
            }
        }
    };

    const overrideEmpty = {
        telegram: {
            config: {
                botToken: '',
                chatId: ''
            }
        }
    };

    const mergedEmpty = config._deepMerge(base, overrideEmpty);
    assertEqual(mergedEmpty.telegram.config.botToken, 'env-token', 'Empty string should not override env value');
    assertEqual(mergedEmpty.telegram.config.chatId, '123', 'Empty string should not override env value');

    const overrideValue = {
        telegram: {
            config: {
                botToken: 'file-token',
                chatId: '999'
            }
        }
    };

    const mergedValue = config._deepMerge(base, overrideValue);
    assertEqual(mergedValue.telegram.config.botToken, 'file-token', 'Non-empty should override env value');
    assertEqual(mergedValue.telegram.config.chatId, '999', 'Non-empty should override env value');

    console.log('✅ config merge test passed');
}

run();
