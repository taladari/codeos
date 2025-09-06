# EPIC B — Providers & Repo Analyzer

## Goal
Detect repo characteristics and expose LLM providers behind a stable interface.

## User Stories
- As a dev, I can view detected language, package manager, and test runner.
- As a dev, CodeOS knows how to run lint/type/test for my repo.
- As a dev, I can switch providers (Claude/OpenAI) via config.

## Acceptance Criteria
- Analyzer writes `reports/analyze.json` with language, pm, formatter, linter, test runner.
- Provider interface: `generate(messages[], opts)` with retries/timeouts/token limits.
- Sensitive env vars are redacted from prompts by default.

## Dev Tasks
1. Analyzer for Node/TS (Python later).
2. Provider interface; Claude/OpenAI stub drivers with mock tests.
3. Prompt templating helper + redaction (env var denylist).
4. Unit tests for analyzer detection logic.
