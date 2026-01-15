const BaseRunner = require('./BaseRunner');

class ClaudeRunner extends BaseRunner {
    constructor() {
        super('claude');
    }

    async run(prompt, context = {}) {
        return this._send(prompt, context);
    }

    async resume(prompt, context = {}) {
        return this._send(prompt, context);
    }

    async _send(prompt, context) {
        if (typeof context.sendCommand === 'function') {
            const ok = await context.sendCommand(prompt);
            if (!ok) {
                throw new Error('Failed to send command to Claude Code');
            }
            return { finalText: '', queued: true };
        }

        if (context.injector && context.sessionName) {
            await context.injector.injectCommand(prompt, context.sessionName);
            return { finalText: '', queued: true };
        }

        throw new Error('Claude runner requires an injector or sendCommand handler');
    }
}

module.exports = ClaudeRunner;
