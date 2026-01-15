function truncateText(text, maxLength) {
    if (!text) return '';
    if (!maxLength || text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
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
        return {
            parseMode: 'HTML',
            commandText: escapeHtml(command),
            responseBody: escapeHtml(truncateText(finalText, maxLength))
        };
    }

    return {
        parseMode: 'Markdown',
        commandText: command || '',
        responseBody: finalText || ''
    };
}

function formatLineResponse(runnerName, finalText, maxLength = 1500) {
    if (runnerName === 'codex') {
        return truncateText(finalText, maxLength);
    }

    return finalText || '';
}

module.exports = {
    truncateText,
    escapeTelegramMarkdown,
    escapeHtml,
    formatTelegramResponse,
    formatLineResponse
};
