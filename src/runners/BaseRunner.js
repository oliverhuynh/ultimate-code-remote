class BaseRunner {
    constructor(name) {
        this.name = name;
        this.supportsResume = false;
    }

    async run(prompt, context) {
        throw new Error('run() not implemented');
    }

    async resume(prompt, context) {
        throw new Error('resume() not implemented');
    }

    async hasSession(sessionKey) {
        return false;
    }
}

module.exports = BaseRunner;
