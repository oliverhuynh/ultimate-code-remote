const fs = require('fs');

const DEFAULT_MAX_CONVERSATION_LENGTH = 120;

function formatRelativeTime(sessionPath) {
    if (!sessionPath || !fs.existsSync(sessionPath)) return 'unknown';
    const mtimeMs = fs.statSync(sessionPath).mtimeMs;
    const diffMs = Date.now() - mtimeMs;
    if (diffMs < 0) return '0 seconds ago';
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return formatTimeUnit(seconds, 'second');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return formatTimeUnit(minutes, 'minute');
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return formatTimeUnit(hours, 'hour');
    const days = Math.floor(hours / 24);
    return formatTimeUnit(days, 'day');
}

function formatTimeUnit(value, unit) {
    const label = value === 1 ? unit : `${unit}s`;
    return `${value} ${label} ago`;
}

function formatConversation(initialMessage, lastMessage, maxLength = DEFAULT_MAX_CONVERSATION_LENGTH) {
    const parts = [];
    if (initialMessage) parts.push(initialMessage.trim());
    if (lastMessage && lastMessage.trim() !== initialMessage?.trim()) {
        parts.push(lastMessage.trim());
    }
    const combined = parts.filter(Boolean).join(' | ');
    if (!combined) return '(no user prompt captured)';
    const singleLine = combined.replace(/\s+/g, ' ');
    if (!Number.isFinite(maxLength)) return singleLine;
    if (singleLine.length <= maxLength) return singleLine;
    return `${singleLine.slice(0, maxLength - 3)}...`;
}

function formatSessionsList(entries, options = {}) {
    const includeHeader = options.includeHeader !== false;
    const tokenColumn = options.tokenColumn !== false;
    const sessionIdColumn = options.sessionIdColumn === true;
    const repoColumn = options.repoColumn === true;
    const padToken = options.padToken === true;
    const updatedLabel = options.updatedLabel || 'Updated';
    const tokenLabel = options.tokenLabel || 'Token';
    const sessionIdLabel = options.sessionIdLabel || 'Session';
    const repoLabel = options.repoLabel || 'Repo';
    const conversationLabel = options.conversationLabel || 'Conversation';
    const maxLength = typeof options.maxLength === 'number'
        ? options.maxLength
        : DEFAULT_MAX_CONVERSATION_LENGTH;

    const lines = entries.map(({ token, info, sessionPath, initialMessage, lastMessage }) => {
        const updated = formatRelativeTime(sessionPath);
        const conversation = formatConversation(initialMessage, lastMessage, maxLength);
        if (!tokenColumn) {
            return `${updated} ${conversation}`;
        }
        if (padToken) {
            const sessionId = sessionIdColumn ? String(info?.sessionId || '').padEnd(38) : '';
            const sessionPart = sessionIdColumn ? `${sessionId} ` : '';
            const repoPart = repoColumn ? `${String(info?.repoName || '').padEnd(14)} ` : '';
            return `${updated.padEnd(15)} ${String(token || '').padEnd(9)} ${sessionPart}${repoPart}${conversation}`;
        }
        const sessionPart = sessionIdColumn ? ` ${info?.sessionId || ''}` : '';
        const repoPart = repoColumn ? ` ${info?.repoName || ''}` : '';
        return `${updated} ${token}${sessionPart}${repoPart} ${conversation}`;
    });

    if (!includeHeader) return lines.join('\n');

    const header = tokenColumn
        ? `${updatedLabel}${padToken ? '         ' : ' '} ${tokenLabel}${sessionIdColumn ? ` ${sessionIdLabel}` : ''}${repoColumn ? ` ${repoLabel}` : ''} ${conversationLabel}`
        : `${updatedLabel} ${conversationLabel}`;

    return `${header}\n${lines.join('\n')}`;
}

module.exports = {
    DEFAULT_MAX_CONVERSATION_LENGTH,
    formatRelativeTime,
    formatConversation,
    formatSessionsList
};
