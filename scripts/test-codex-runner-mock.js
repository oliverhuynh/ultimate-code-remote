#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');
const EventEmitter = require('events');
const CodexRunner = require('../src/runners/CodexRunner');

function mockSpawnFactory(expectations = {}) {
    return (bin, args, options) => {
        if (expectations.cwd && options.cwd !== expectations.cwd) {
            throw new Error(`Unexpected cwd: ${options.cwd}`);
        }

        const child = new EventEmitter();
        child.stdout = new PassThrough();
        child.stderr = new PassThrough();

        process.nextTick(() => {
            try {
                if (expectations.bin && bin !== expectations.bin) {
                    child.stderr.write(`Unexpected bin: ${bin}`);
                    child.emit('close', 1);
                    return;
                }

                if (expectations.containsArgs) {
                    for (const expected of expectations.containsArgs) {
                        if (!args.includes(expected)) {
                            child.stderr.write(`Missing arg: ${expected}`);
                            child.emit('close', 1);
                            return;
                        }
                    }
                }

                const outputIndex = args.indexOf('--output-last-message');
                const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : null;
                if (outputFile) {
                    fs.writeFileSync(outputFile, 'Mock response from Codex');
                }

                child.stdout.write(JSON.stringify({ session_id: 'mock-session-123' }) + '\n');
                child.stdout.end();
                child.stderr.end();
                child.emit('close', 0);
            } catch (error) {
                child.stderr.write(error.message);
                child.emit('close', 1);
            }
        });

        return child;
    };
}

async function run() {
    const sessionPath = path.join(os.tmpdir(), `codex-session-${Date.now()}.json`);
    const altWorkdir = path.join(os.tmpdir(), `codex-workdir-${Date.now()}`);
    const runner = new CodexRunner({
        bin: 'codex',
        sandbox: 'read-only',
        fullAuto: true,
        skipGitCheck: true,
        workdir: process.cwd(),
        sessionPath,
        spawnImpl: mockSpawnFactory({
            bin: 'codex',
            containsArgs: ['--json', '--sandbox', 'read-only', '--full-auto', '--skip-git-repo-check'],
            cwd: altWorkdir
        })
    });

    const sessionKey = 'test:user-1';
    const first = await runner.run('Hello from test', { sessionKey, workdir: altWorkdir });
    if (!first.finalText.includes('Mock response')) {
        throw new Error('Final text not captured from output file');
    }

    const hasSession = await runner.hasSession(sessionKey);
    if (!hasSession) {
        throw new Error('Session ID not stored for resume');
    }

    const resumeRunner = new CodexRunner({
        bin: 'codex',
        sandbox: 'read-only',
        workdir: process.cwd(),
        sessionPath,
        spawnImpl: mockSpawnFactory({
            bin: 'codex',
            containsArgs: ['resume', 'mock-session-123']
        })
    });

    const resumed = await resumeRunner.resume('Follow up', { sessionKey });
    if (!resumed.finalText.includes('Mock response')) {
        throw new Error('Resume did not capture response');
    }

    console.log('✅ CodexRunner mock test passed');
}

run().catch((error) => {
    console.error('❌ CodexRunner mock test failed:', error.message);
    process.exit(1);
});
