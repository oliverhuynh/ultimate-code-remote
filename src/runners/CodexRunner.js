const BaseRunner = require('./BaseRunner');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Logger = require('../core/logger');

class CodexRunner extends BaseRunner {
    constructor(options = {}) {
        super('codex');
        this.supportsResume = true;
        this.logger = new Logger('CodexRunner');
        this.spawnImpl = options.spawnImpl || spawn;
        this.bin = options.bin || process.env.CODEX_BIN || 'codex';
        this.args = this._parseArgs(options.args || process.env.CODEX_ARGS);
        this.sandbox = options.sandbox || process.env.CODEX_SANDBOX || 'read-only';
        this.fullAuto = this._parseBool(options.fullAuto ?? process.env.CODEX_FULL_AUTO);
        this.skipGitCheck = this._parseBool(options.skipGitCheck ?? process.env.CODEX_SKIP_GIT_CHECK);
        this.workdir = options.workdir || process.env.WORKDIR || path.join(__dirname, '../..');
        this.sessionPath = options.sessionPath || path.join(os.homedir(), '.ultimate-code-remote', 'codex-session-map.json');
    }

    _parseBool(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        return false;
    }

    _parseArgs(value) {
        if (!value || typeof value !== 'string') return [];
        return value.split(' ').map(part => part.trim()).filter(Boolean);
    }

    async hasSession(sessionKey) {
        const state = await this._loadState();
        return !!(state.sessions && state.sessions[sessionKey]);
    }

    async run(prompt, context = {}) {
        return this._execute({ mode: 'run', prompt, context });
    }

    async resume(prompt, context = {}) {
        return this._execute({ mode: 'resume', prompt, context });
    }

    async _execute({ mode, prompt, context }) {
        const sessionKey = context.sessionKey || 'default';
        let sessionId = null;
        let note = '';

        if (mode === 'resume') {
            sessionId = await this._getSessionId(sessionKey);
            if (!sessionId) {
                note = 'No previous Codex session found for this chat. Starting a new task instead.';
                mode = 'run';
            }
        }

        const outputFile = this._createOutputFilePath();
        const sandbox = context.sandbox || this.sandbox;
        const args = this._buildArgs({ mode, sessionId, prompt, outputFile, sandbox });

        const workdir = context.workdir || this.workdir;
        const result = await this._spawnCodex(args, outputFile, workdir);

        if (result.sessionId) {
            await this._setSessionId(sessionKey, result.sessionId);
        }

        return {
            finalText: note ? `${note}\n\n${result.finalText}` : result.finalText,
            sessionId: result.sessionId || sessionId,
            logs: result.logs
        };
    }

    _buildArgs({ mode, sessionId, prompt, outputFile, sandbox }) {
        const args = ['exec', '--json', '--output-last-message', outputFile, '--sandbox', sandbox];

        if (this.fullAuto) {
            args.push('--full-auto');
        }

        if (this.skipGitCheck) {
            args.push('--skip-git-repo-check');
        }

        if (this.args.length > 0) {
            args.push(...this.args);
        }

        if (mode === 'resume') {
            args.push('resume', sessionId, prompt);
        } else {
            args.push(prompt);
        }

        return args;
    }

    _createOutputFilePath() {
        const filename = `codex-last-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`;
        return path.join(os.tmpdir(), filename);
    }

    _spawnCodex(args, outputFile, workdir) {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let sessionId = null;

            if (this._isVerbose()) {
                this.logger.info('Codex command:', [this.bin, ...args].join(' '));
            }

            const child = this.spawnImpl(this.bin, args, {
                cwd: workdir,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            child.stdout.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                sessionId = sessionId || this._extractSessionIdFromJsonl(text);
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (error) => {
                if (error.code === 'ENOENT') {
                    reject(new Error(`Codex CLI not found. Set CODEX_BIN or install codex CLI. (${this.bin})`));
                    return;
                }
                reject(error);
            });

            child.on('close', async (code) => {
                if (code !== 0) {
                    const message = stderr.trim() || stdout.trim() || `Codex exited with code ${code}`;
                    reject(new Error(message));
                    return;
                }

                if (!sessionId && stdout) {
                    sessionId = this._extractSessionIdFromJsonl(stdout);
                }

                const finalText = await this._readOutputFile(outputFile, stdout);
                resolve({
                    finalText,
                    sessionId,
                    logs: stdout
                });
            });
        });
    }

    _extractSessionIdFromJsonl(text) {
        const lines = text.split('\n');
        let found = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('{')) continue;
            try {
                const event = JSON.parse(trimmed);
                const candidate = event.session_id || event.sessionId || event.thread_id || event.threadId;
                if (candidate) {
                    found = candidate;
                }
            } catch (error) {
                continue;
            }
        }

        return found;
    }

    _isVerbose() {
        const debug = String(process.env.DEBUG || '').toLowerCase();
        return debug.split(',').map(part => part.trim()).includes('codex-verbose');
    }

    async _readOutputFile(outputFile, stdout) {
        try {
            if (fs.existsSync(outputFile)) {
                const content = await fs.promises.readFile(outputFile, 'utf8');
                if (content && content.trim()) {
                    return content.trim();
                }
            }
        } catch (error) {
            this.logger.warn(`Failed to read Codex output file: ${error.message}`);
        }

        const fallback = stdout.trim();
        return fallback ? fallback : 'No response captured from Codex.';
    }

    async _loadState() {
        try {
            if (!fs.existsSync(this.sessionPath)) {
                return { sessions: {} };
            }
            const raw = await fs.promises.readFile(this.sessionPath, 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            this.logger.warn(`Failed to load Codex session map: ${error.message}`);
            return { sessions: {} };
        }
    }

    async _saveState(state) {
        const dir = path.dirname(this.sessionPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        await fs.promises.writeFile(this.sessionPath, JSON.stringify(state, null, 2));
    }

    async _getSessionId(sessionKey) {
        const state = await this._loadState();
        return state.sessions ? state.sessions[sessionKey] : null;
    }

    async _setSessionId(sessionKey, sessionId) {
        const state = await this._loadState();
        state.sessions = state.sessions || {};
        state.sessions[sessionKey] = sessionId;
        state.lastUpdated = new Date().toISOString();
        await this._saveState(state);
    }

    async clearSessions() {
        const state = { sessions: {}, lastUpdated: new Date().toISOString() };
        await this._saveState(state);
    }
}

module.exports = CodexRunner;
