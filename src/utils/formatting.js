function truncateText(text, maxLength) {
    if (!text) return '';
    if (!maxLength || text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

function splitText(text, maxLength) {
    if (!text) return [''];
    if (!maxLength || text.length <= maxLength) return [text];
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLength) {
        chunks.push(text.slice(i, i + maxLength));
    }
    return chunks;
}

function escapeTelegramMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/_/g, '\\_')
        .replace(/\*/g, '\\*')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/~/g, '\\~')
        .replace(/`/g, '\\`')
        .replace(/>/g, '\\>')
        .replace(/#/g, '\\#')
        .replace(/\+/g, '\\+')
        .replace(/-/g, '\\-')
        .replace(/=/g, '\\=')
        .replace(/\|/g, '\\|')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\./g, '\\.')
        .replace(/!/g, '\\!');
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatTelegramResponse(runnerName, command, finalText, maxLength = 3500) {
    if (runnerName === 'codex') {
        const escaped = escapeHtml(finalText || '');
        return {
            parseMode: 'HTML',
            commandText: escapeHtml(command),
            responseChunks: splitText(escaped, maxLength)
        };
    }

    return {
        parseMode: 'Markdown',
        commandText: command || '',
        responseChunks: splitText(finalText || '', maxLength)
    };
}

function formatLineResponse(runnerName, finalText, maxLength = 1500) {
    if (runnerName === 'codex') {
        return splitText(finalText || '', maxLength);
    }

    return splitText(finalText || '', maxLength);
}

module.exports = {
    truncateText,
    splitText,
    escapeTelegramMarkdown,
    escapeHtml,
    formatTelegramResponse,
    formatLineResponse
};
