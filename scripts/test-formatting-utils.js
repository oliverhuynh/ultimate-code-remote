#!/usr/bin/env node

const {
    escapeTelegramMarkdown,
    truncateText,
    formatTelegramResponse,
    formatLineResponse
} = require('../src/utils/formatting');

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message} (expected: ${expected}, got: ${actual})`);
    }
}

function run() {
    const escaped = escapeTelegramMarkdown('Hello *world* [link](test)');
    assertEqual(escaped, 'Hello \\*world\\* \\[link\\]\\(test\\)', 'escapeTelegramMarkdown failed');

    const truncated = truncateText('1234567890', 7);
    assertEqual(truncated, '1234...', 'truncateText failed');

    const codexFormatted = formatTelegramResponse('codex', '*cmd*', 'Hello *world*', 50);
    assertEqual(codexFormatted.commandText, '\\*cmd\\*', 'formatTelegramResponse codex command');
    assertEqual(codexFormatted.responseBody, 'Hello \\*world\\*', 'formatTelegramResponse codex response');

    const claudeFormatted = formatTelegramResponse('claude', '*cmd*', 'Hello *world*', 50);
    assertEqual(claudeFormatted.commandText, '*cmd*', 'formatTelegramResponse claude command');
    assertEqual(claudeFormatted.responseBody, 'Hello *world*', 'formatTelegramResponse claude response');

    const codexLine = formatLineResponse('codex', '1234567890', 7);
    assertEqual(codexLine, '1234...', 'formatLineResponse codex');

    const claudeLine = formatLineResponse('claude', '1234567890', 7);
    assertEqual(claudeLine, '1234567890', 'formatLineResponse claude');

    console.log('✅ formatting utils test passed');
}

run();
