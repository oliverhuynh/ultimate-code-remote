const ClaudeRunner = require('./ClaudeRunner');
const CodexRunner = require('./CodexRunner');

function getRunnerName() {
    return (process.env.RUNNER || 'claude').toLowerCase();
}

function createRunner() {
    const runnerName = getRunnerName();
    if (runnerName === 'codex') {
        return new CodexRunner();
    }
    return new ClaudeRunner();
}

module.exports = {
    createRunner,
    getRunnerName
};
