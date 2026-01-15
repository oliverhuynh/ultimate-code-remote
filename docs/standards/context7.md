# Context7 Standard

Context7 is the source of truth for library and framework APIs in this repo.
All API usage must be backed by Context7 references in each task's `context7.md`.

## How We Use Context7
- Use Context7 before writing code that calls a library/framework API.
- Record the library references in the task's `context7.md`.
- If unsure or if an API seems missing/outdated, re-query Context7.
- Do not invent or guess APIs.

## Referencing Libraries
Use the Context7 library notation in `context7.md`, for example:
- `use library /fastapi/fastapi`
- `use library /sqlalchemy/sqlalchemy`
- `use library /pydantic/pydantic`
- `use library /expo/expo`
- `use library /vercel/next.js`

## Re-Query Rules
- Re-query if any API name, signature, or usage is uncertain.
- Re-query when upgrading versions or switching major versions.
- Re-query if implementation fails due to API mismatch.

## How to Enable Context7 in Codex
Run this once in your Codex environment:
```bash
codex mcp add context7 -- npx -y @upstash/context7-mcp
```

## Related Docs
- `docs/standards/folder-tasks.md`
- `tasks/README.md`
