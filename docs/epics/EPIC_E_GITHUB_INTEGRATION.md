# EPIC E — GitHub Integration

## Goal
Open PRs automatically with artifacts and checks attached.

## User Stories
- As a dev, I can trigger a PR with branch, commits, and summary.
- As a reviewer, I can see gate statuses and a concise change summary in the PR.

## Acceptance Criteria
- Create branch, commit patches, open PR.
- Attach/inline `PR_SUMMARY.md` and link reports.
- Post status checks per gate (lint/type/tests) with pass/fail.

## Dev Tasks
1. Git & GitHub API integration (PAT/OAuth app later).
2. Status checks API calls & error handling.
3. Retries and informative failures in comments.
