const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { redactText } = require('./redact-secrets');

const ROOT_DIR = path.join(os.homedir(), '.ultimate-code-remote');
const TOKENS_DIR = path.join(ROOT_DIR, 'tokens');
const EVENTS_DIR = path.join(ROOT_DIR, 'session-events');
const SECRET_TTL_MS = 30 * 60 * 1000;
const RETENTION_DAYS = 7;
const RETENTION_MAX_LINES = 10000;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function getTokenSecretPath(token) {
    return path.join(TOKENS_DIR, `${token}.json`);
}

function generateSecret() {
    return crypto.randomBytes(16).toString('hex');
}

function issueLiveSecret(token) {
    ensureDir(TOKENS_DIR);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SECRET_TTL_MS);
    const payload = {
        liveSecret: generateSecret(),
        liveSecretUpdatedAt: now.toISOString(),
        liveSecretExpiresAt: expiresAt.toISOString()
    };
    fs.writeFileSync(getTokenSecretPath(token), JSON.stringify(payload, null, 2));
    return payload;
}

function loadLiveSecret(token) {
    const filePath = getTokenSecretPath(token);
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        return null;
    }
}

function validateLiveSecret(token, secret) {
    const payload = loadLiveSecret(token);
    if (!payload || !payload.liveSecret || !payload.liveSecretExpiresAt) return false;
    if (payload.liveSecret !== secret) return false;
    const expiresAt = Date.parse(payload.liveSecretExpiresAt);
    if (Number.isNaN(expiresAt)) return false;
    return Date.now() <= expiresAt;
}

function getEventsPath(sessionId) {
    ensureDir(EVENTS_DIR);
    return path.join(EVENTS_DIR, `${sessionId}.jsonl`);
}

function redactValue(value) {
    if (typeof value === 'string') return redactText(value);
    return value;
}

function appendEvent(sessionId, event) {
    if (!sessionId) return;
    const safeEvent = {
        ...event,
        text: redactValue(event.text)
    };
    if (safeEvent.meta && typeof safeEvent.meta === 'object') {
        const meta = {};
        Object.keys(safeEvent.meta).forEach((key) => {
            meta[key] = redactValue(safeEvent.meta[key]);
        });
        safeEvent.meta = meta;
    }
    const line = `${JSON.stringify(safeEvent)}\n`;
    fs.appendFileSync(getEventsPath(sessionId), line);
    enforceRetention(getEventsPath(sessionId));
}

function enforceRetention(filePath) {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw) return;
    const lines = raw.split('\n').filter(Boolean);
    const cutoff = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let filtered = lines.filter((line) => {
        try {
            const event = JSON.parse(line);
            const ts = Date.parse(event.ts || '');
            if (Number.isNaN(ts)) return true;
            return ts >= cutoff;
        } catch (error) {
            return false;
        }
    });
    if (filtered.length > RETENTION_MAX_LINES) {
        filtered = filtered.slice(filtered.length - RETENTION_MAX_LINES);
    }
    fs.writeFileSync(filePath, `${filtered.join('\n')}\n`);
}

function getLiveBaseUrl() {
    const candidate = process.env.WEBHOOK_BASE_URL || '';
    if (!candidate) return '';
    try {
        const url = new URL(candidate);
        return url.origin;
    } catch (error) {
        return candidate;
    }
}

module.exports = {
    issueLiveSecret,
    loadLiveSecret,
    validateLiveSecret,
    appendEvent,
    getEventsPath,
    getLiveBaseUrl
};
