const DEFAULT_ALLOWLIST = ['api.telegram.org', 'api.line.me'];

function parseAllowlist() {
    const raw = process.env.OUTBOUND_ALLOWLIST;
    if (!raw || !raw.trim()) return DEFAULT_ALLOWLIST;
    return raw.split(',').map(v => v.trim()).filter(Boolean);
}

function hostMatches(host, pattern) {
    if (!host || !pattern) return false;
    if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(1);
        return host.endsWith(suffix);
    }
    if (pattern.startsWith('.')) {
        return host.endsWith(pattern);
    }
    return host === pattern;
}

function isAllowedUrl(url) {
    try {
        const allowlist = parseAllowlist();
        if (allowlist.length === 0) return true;
        const parsed = new URL(url);
        const host = parsed.hostname;
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
            return true;
        }
        return allowlist.some(pattern => hostMatches(host, pattern));
    } catch (error) {
        return false;
    }
}

function enforceAllowedUrl(url) {
    if (!isAllowedUrl(url)) {
        throw new Error(`Outbound URL blocked by allowlist: ${url}`);
    }
}

module.exports = {
    isAllowedUrl,
    enforceAllowedUrl
};
