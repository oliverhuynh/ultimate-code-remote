# Plan
1. Add shared slash command extraction helper.
2. Use it in Telegram/LINE handlers and email listener to prioritize slash commands.
3. Add notice when extra content is ignored.

## Current Work: Webhook Master + Live Stream
1. Consolidate webhook servers into a single master Express app with live stream routes.
2. Standardize public base URL on WEBHOOK_BASE_URL for webhook + live stream links.
3. Update CLI scripts and setup docs to use the new env var.
4. Improve live stream UI formatting and keep redaction in place.
