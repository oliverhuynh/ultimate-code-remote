# Security Notes

## Threat Model (High Level)
This project provides **remote command relay** for local AI agents. By design, any party who can authenticate to a channel and present a valid token can trigger command injection into local sessions. Treat access to all channels as high-risk.

## Recommended Hardening
1. **Set APP_SECRET**
   - APP_SECRET is required in webhook URLs and will be auto-generated in-memory if missing when starting webhooks.
2. **Telegram Verification**
   - Telegram webhooks use both the URL secret and `X-Telegram-Bot-Api-Secret-Token` header.
3. **Email Sender Verification**
   - Default `EMAIL_AUTH_MODE=strict` requires SPF/DKIM/DMARC pass.
   - Use `EMAIL_AUTH_MODE=relaxed` only if your provider omits auth headers.
4. **Rate Limiting**
   - Defaults are lenient; tune to your environment.
5. **Redaction**
   - Replies and notifications are redacted for secrets by default.
6. **Outbound allowlist**
   - Outbound webhook + notification endpoints are restricted to allowlisted hosts.

## Operational Guidance
- Use allowlists for Telegram/LINE and `ALLOWED_SENDERS` for email.
- Keep `.env` out of version control.
- Rotate APP_SECRET if exposed.

## Defaults
- `EMAIL_AUTH_MODE=strict`
- Missing auth headers: hard-fail in strict mode; warn+allow in relaxed mode.
- Outbound allowlist scope: webhook + notification endpoints.
