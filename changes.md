# Changes

## 2026-01-15
- Make user-facing notification and help copy model-agnostic (AI wording).
- Security hardening: APP_SECRET webhook enforcement, Telegram secret header verification, SPF/DKIM email checks, rate limiting, unified command safety checks, redaction, and opt-in auto-approval.
- Add Codex session sync script to import ~/.codex/sessions into local session store.
- Add migration script to map legacy email-based Codex session keys to raw token keys.
