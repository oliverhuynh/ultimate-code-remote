# Task

## Goal
Make user-facing notification/help copy model-agnostic by replacing Claude-specific model references with AI-neutral wording, and update related tests accordingly. Keep product identifiers like “Claude-Code-Remote” unchanged.

## Definition of Done
- [ ] Notification/help titles and message strings no longer refer to “Claude” as the model (use “AI” instead).
- [ ] Product/identifier names like “Claude-Code-Remote” remain unchanged.
- [ ] Any tests or test fixtures referencing the old copy are updated to match.
- [ ] Changes are limited to wording (no behavior changes).

## Acceptance Tests
- [ ] Run `node test-telegram-notification.js` and confirm the notification title/body uses “AI” language.
- [ ] Run `node test-real-notification.js` and confirm the notification title/body uses “AI” language.
- [ ] Send `/help` in Telegram and confirm the header is no longer “Claude Code Remote Bot Help”.

Status: Done
