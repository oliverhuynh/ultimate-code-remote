const crypto = require('crypto');

function getEnvSecretValues() {
    const secretKeys = Object.keys(process.env).filter((key) => {
        return /(_TOKEN|_SECRET|_KEY|_PASS|_PASSWORD|_COOKIE)$/i.test(key);
    });

    return secretKeys
        .map((key) => process.env[key])
        .filter((value) => typeof value === 'string' && value.length > 0);
}

function getCustomKeys() {
    const raw = process.env.REDACT_KEYS || '';
    return raw.split(',').map(k => k.trim()).filter(Boolean);
}

function redactText(text) {
    if (!text || typeof text !== 'string') return text;

    if (process.env.REDACT_SECRETS === 'false') {
        return text;
    }

    let output = text;

    const customKeys = getCustomKeys();
    const values = [...getEnvSecretValues(), ...customKeys];

    // Redact direct secret values
    values.forEach((value) => {
        if (!value || typeof value !== 'string') return;
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        output = output.replace(new RegExp(escaped, 'g'), '***');
    });

    // Redact common token/key patterns in text
    const patterns = [
        /(api[_-]?key\s*[:=]\s*)([^\s]+)/gi,
        /(token\s*[:=]\s*)([^\s]+)/gi,
        /(secret\s*[:=]\s*)([^\s]+)/gi,
        /(password\s*[:=]\s*)([^\s]+)/gi,
        /(authorization\s*[:=]\s*)([^\s]+)/gi,
        /(bearer\s+)([^\s]+)/gi,
        /(session\s*[:=]\s*)([^\s]+)/gi,
        /(cookie\s*[:=]\s*)([^\s]+)/gi
    ];

    patterns.forEach((pattern) => {
        output = output.replace(pattern, '$1***');
    });

    // Redact long base64-like strings (potential tokens)
    output = output.replace(/[A-Za-z0-9+/=]{40,}/g, (match) => {
        const hash = crypto.createHash('sha256').update(match).digest('hex').slice(0, 8);
        return `***${hash}`;
    });

    return output;
}

module.exports = {
    redactText
};
