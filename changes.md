# Changes

## 2026-01-16
- Sessions list now shows Updated/Token/Conversation with optional Session/Repo columns when `DEBUG=yes`.
- Sessions list pulls Codex conversation summaries from `~/.codex/sessions` and filters instruction/environment blocks.
- Updated time for Codex sessions now uses the Codex session file timestamp.
- Telegram send errors include full detail and support configurable timeout via `TELEGRAM_TIMEOUT_MS`.
- Slash commands are now prioritized in messages across channels (Telegram/LINE/email), with notices when extra content is ignored.
- Work-on replies now include a short conversation summary for context.
- Conversation summaries now ignore slash command lines and use user-only messages.
- Work-on summaries now include the last assistant reply.
- Repo update command can set per-repo `codexSandbox` values.

## 2026-01-15
- **2026-01-15**: Add Codex runner with resume support and safety notes.
- **2026-01-15**: Multi-repo routing with global token/session indexes and admin commands.
- **2026-01-15**: Multi-webhook CLI with validation and launcher help.
- **2026-01-15**: Repo manager commands (list/add/remove/init) with storage under `~/.ultimate-code-remote`.
- **2026-01-15**: `ultimate-code-remote` CLI with platform subcommands and `--dry-run`.
- **2026-01-15**: One-command ngrok launcher for webhook setup.
- **2026-01-15**: Make notification/help copy model-agnostic (AI wording).
- **2026-01-15**: Tokens no longer expire and expiration copy removed.
- **2026-01-15**: Current token support added for LINE and email; working token hides reply headers.
- **2026-01-15**: Simplified reply format for Telegram/LINE.
- **2026-01-15**: Long replies are split into multiple messages instead of truncated.

## 2026-01-15
- Make user-facing notification and help copy model-agnostic (AI wording).
- Security hardening: APP_SECRET webhook enforcement, Telegram secret header verification, SPF/DKIM email checks, rate limiting, unified command safety checks, redaction, and opt-in auto-approval.
- Add Codex session sync script to import ~/.codex/sessions into local session store.
- Add migration script to map legacy email-based Codex session keys to raw token keys.

## August 2025
- **2025-08-02**: Add full execution trace to email notifications (#14 by @vaclisinc).
- **2025-08-01**: Enhanced Multi-Channel Notification System (#1 by @laihenyi, @JessyTsui).
  - ✅ **Telegram Integration Completed** - Interactive buttons, real-time commands, smart personal/group chat handling
  - ✅ **Multi-Channel Notifications** - Simultaneous delivery to Desktop, Telegram, Email, LINE
  - ✅ **Smart Sound Alerts** - Always-on audio feedback with customizable sounds
  - ✅ **Intelligent Session Management** - Auto-detection, real conversation content
- **2025-08-01**: Fix #9 #12: Add configuration to disable subagent notifications (#10 by @vaclisinc).
- **2025-08-01**: Implement terminal-style UI for email notifications (#8 by @vaclisinc).
- **2025-08-01**: Fix working directory issue - enable claude-remote to run from any directory (#7 by @vaclisinc).

## July 2025
- **2025-07-31**: Fix self-reply loop issue when using same email for send/receive (#4 by @vaclisinc).
- **2025-07-28**: Remove hardcoded values and implement environment-based configuration (#2 by @kevinsslin).
