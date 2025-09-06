# EPIC F — Verification Gates

## Goal
Enforce quality via lint, typecheck, and tests before PR creation.

## User Stories
- As a dev, I want CodeOS to fail fast on formatting, lint, typing, or tests.
- As a team, I want consistent, machine‑readable reports.

## Acceptance Criteria
- ESLint, tsc, and Vitest wired into Verifier.
- Reports saved to `.codeos/reports/` as JSON.
- Non‑zero exit halts workflow; Reviewer summarizes failures.
 - Verification runs in a deterministic **sandbox** (temp workspace or container) with fail‑fast behavior.

## Dev Tasks
1. Command execution per analyzer (e.g., `pnpm lint`, `pnpm test`).
2. Parse outputs to JSON (errors, warnings, counts).
3. Map failures to concise human summary in Reviewer.
