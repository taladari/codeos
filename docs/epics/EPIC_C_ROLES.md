# EPIC C — Roles (Planner, Builder, Verifier, Reviewer)

## Goal
Transform a blueprint into patches, verify them, and prepare a PR.

## User Stories
- As a dev, I can generate a Plan from a ticket/idea.
- As a dev, I can ask CodeOS to propose **minimal diffs** and tests.
- As a dev, I can see verification results (lint, typecheck, tests).
- As a dev, I receive a PR summary with risks and a checklist.

## Acceptance Criteria
- Planner → `plan/Plan.md` with goals, constraints, affected files, test plan (≤200 lines).
- Builder → **unified diffs** only; rejects prose; includes test edits/new tests.
- Verifier → applies diffs in sandbox; runs gates; writes JSON reports.
- Reviewer → `review/PR_SUMMARY.md` referencing artifacts with clear pass/fail.

## Dev Tasks
1. Plan generator prompt + contract.
2. Unified diff protocol (file path + hunks) + parser.
3. Sandbox executor (temp workspace or container).
4. Report summary generator with manual QA checklist.
