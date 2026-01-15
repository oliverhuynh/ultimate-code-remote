# Folder Tasks Standard

This repo uses a "folder-tasks" workflow. Every unit of work lives in a dedicated
`tasks/NNN-short-title/` folder with documentation-first planning and auditable output.

## Why
- Keeps scope, constraints, and API references explicit.
- Ensures Context7 references are captured before implementation.
- Provides a clear audit trail for review and QA.

## Required Structure
Each task folder must include:
- `task.md` (goal + definition of done)
- `context7.md` (Context7 library references)
- `constraints.md` (must-not rules)
- `plan.md` (step-by-step plan)
- `review.md` (review + QA checklist)
- `output/` (implementation artifacts prior to merge)

## Naming
- Use `tasks/NNN-short-title/` (e.g., `tasks/001-mobile-onboarding-wizard/`).
- Keep titles short and specific.

## Workflow
1. Create the task folder from `tasks/_template/`.
2. Fill in docs first.
3. Use Context7 for any library/framework API work.
4. Place implementation output in `tasks/.../output/` until merged.
5. Run QA when required and record results in `review.md`.

## Related Docs
- `tasks/README.md`
- `docs/standards/context7.md`
