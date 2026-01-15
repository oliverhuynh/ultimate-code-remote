function isCommandSafe(command, maxLength = 1000) {
    if (!command || typeof command !== 'string') return false;
    if (command.length > maxLength) return false;

    const dangerousPatterns = [
        /rm\s+-rf/i,
        /sudo\s+/i,
        /chmod\s+777/i,
        />\s*\/dev\/null/i,
        /curl.*\|\s*sh/i,
        /wget.*\|\s*sh/i,
        /eval\s*\(/i,
        /exec\s*\(/i
    ];

    return !dangerousPatterns.some((pattern) => pattern.test(command));
}

module.exports = {
    isCommandSafe
};
