class RateLimiter {
    constructor() {
        this.buckets = new Map();
    }

    check(key, limit, windowMs) {
        if (!key) return { allowed: true };
        const now = Date.now();
        const bucket = this.buckets.get(key) || [];
        const fresh = bucket.filter(ts => (now - ts) <= windowMs);
        fresh.push(now);
        this.buckets.set(key, fresh);

        if (fresh.length > limit) {
            const retryAfter = windowMs - (now - fresh[0]);
            return { allowed: false, retryAfterMs: Math.max(retryAfter, 0) };
        }

        return { allowed: true };
    }
}

module.exports = RateLimiter;
