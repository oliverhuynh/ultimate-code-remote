function extractSlashCommand(text) {
    if (!text) return { command: null, ignored: false };
    const lines = String(text).split(/\r?\n/);
    let command = null;
    let ignored = false;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('/')) {
            command = line;
            break;
        }
    }

    if (!command) {
        return { command: null, ignored: false };
    }

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line === command) continue;
        ignored = true;
        break;
    }

    return { command, ignored };
}

module.exports = {
    extractSlashCommand
};
