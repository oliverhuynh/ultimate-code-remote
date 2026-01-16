# Conversation Summary Format (UI Spec)

## Purpose
Give users a quick, human‑readable snapshot of what the session is about, focusing on user intent and the latest ask.

## Content Rules
1) **User‑authored only** for summary lines.
2) **Filter out boilerplate/system text**, including:
   - `<instructions>` blocks
   - `AGENTS.md instructions`
   - `<environment_context>` blocks
   - Any line starting with `/` (slash commands)
3) **Primary summary** = `first_user_message | last_user_message`
   - If `first_user_message === last_user_message`, show only once.
4) **Fallback**: If no valid user messages exist, show:
   - `(no user prompt captured)`

## Formatting
- Separator: ` | `
- Single line only (no hard line breaks)
- Collapse whitespace to single spaces

## Length Policy
- **Work‑on confirmation**: no truncation.
- **Sessions list view**: apply a length cap to keep lists scannable.
  - Default cap: 120 chars (configurable).

## Examples
- `Please open the app | Can you share me screenshot`
- `Audit repo for trojans`
- `(no user prompt captured)`
