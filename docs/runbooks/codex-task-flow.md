# Codex Task Flow Runbook

## Create New Task (Prompt)
Use this prompt to create a task folder and fill docs before any code changes:

```
You are Codex CLI working in this repo.
Role: Builder Agent.
Goal: Create a new task folder under tasks/NNN-short-title/ using tasks/_template/.
Requirements:
- Documentation-first: fill task.md, context7.md, constraints.md, plan.md, review.md.
- If APIs are involved, list Context7 library references in context7.md.
- Plan must include Context7 lookup as the first step when APIs are involved.
- Do not implement code yet.
- Keep changes minimal and auditable.
Output: summarize created files and next steps.
```

## Implement Task (Prompt)
Use this prompt to implement a task strictly using Context7:

```
You are Codex CLI working in this repo.
Role: Builder Agent.
Task folder: tasks/NNN-short-title/.
Requirements:
- Read task.md, constraints.md, plan.md, context7.md, review.md.
- Use Context7 for every library/framework API.
- Re-query Context7 if any API usage is uncertain.
- Put all implementation output under tasks/NNN-short-title/output/.
- Keep changes minimal and incremental.
- Update review.md with QA notes if required.
Output: list files created/changed in output/ and any follow-ups.
```

## QA Audit Task Output (Prompt)
Use this prompt to QA a task output before merge:

```
You are Codex CLI working in this repo.
Role: QA Agent (read-only).
Task folder: tasks/NNN-short-title/.
Requirements:
- Review output artifacts under tasks/NNN-short-title/output/.
- Use the relevant QA prompt from docs/prompts/.
- Provide a Markdown report with blockers vs warnings and a checklist.
- Do not modify files.
```
