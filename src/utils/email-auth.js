function normalizeHeaderValue(value) {
    if (!value) return '';
    if (Array.isArray(value)) {
        return value.join(' ');
    }
    if (typeof value === 'string') return value;
    return String(value);
}

function parseAuthResults(authResults) {
    const text = normalizeHeaderValue(authResults).toLowerCase();
    if (!text) return {};

    const result = {};
    const spf = text.match(/spf=(pass|fail|softfail|neutral|none|temperror|permerror)/i);
    const dkim = text.match(/dkim=(pass|fail|neutral|none|temperror|permerror)/i);
    const dmarc = text.match(/dmarc=(pass|fail|bestguesspass|none|temperror|permerror)/i);

    if (spf) result.spf = spf[1].toLowerCase();
    if (dkim) result.dkim = dkim[1].toLowerCase();
    if (dmarc) result.dmarc = dmarc[1].toLowerCase();

    return result;
}

function getAuthResults(headers) {
    if (!headers) return {};
    const authResults = headers.get ? headers.get('authentication-results') : headers['authentication-results'];
    const spfHeader = headers.get ? headers.get('received-spf') : headers['received-spf'];

    const results = parseAuthResults(authResults);

    if (!results.spf && spfHeader) {
        const spfMatch = normalizeHeaderValue(spfHeader).match(/(pass|fail|softfail|neutral|none)/i);
        if (spfMatch) results.spf = spfMatch[1].toLowerCase();
    }

    return results;
}

function isEmailAuthPass(headers, mode = 'strict') {
    const results = getAuthResults(headers);
    const hasAny = Object.keys(results).length > 0;

    if (!hasAny) {
        return { ok: mode !== 'strict', reason: 'missing_auth_results' };
    }

    if (results.spf && results.spf !== 'pass') {
        return { ok: false, reason: `spf_${results.spf}` };
    }

    if (results.dkim && results.dkim !== 'pass') {
        return { ok: false, reason: `dkim_${results.dkim}` };
    }

    if (results.dmarc && results.dmarc !== 'pass') {
        return { ok: false, reason: `dmarc_${results.dmarc}` };
    }

    if (mode === 'strict') {
        if (results.spf !== 'pass' || results.dkim !== 'pass') {
            return { ok: false, reason: 'spf_dkim_required' };
        }
    }

    return { ok: true };
}

module.exports = {
    getAuthResults,
    isEmailAuthPass
};
