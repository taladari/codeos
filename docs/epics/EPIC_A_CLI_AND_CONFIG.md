# EPIC A — CLI & Config

## Goal
Bootstrap a minimal, ergonomic CLI and configuration system.

## User Stories
- As a dev, I can run `codeos --help` to see available commands.
- As a dev, I can run `codeos init` to scaffold `.codeos/` safely.
- As a dev, I can define settings in `codeos.yml` with validation & defaults.
- As a dev, I can create a blueprint with `codeos blueprint "Title"`.

## Acceptance Criteria
- Commands: `init`, `blueprint <title>`, `run <workflow>`, `--help`, `--version`.
- `init` is idempotent; re‑running never destroys data.
- Config loader reads YAML, applies defaults, validates schema; helpful error output.
- Basic unit tests for CLI behaviors and config parsing.

## Dev Tasks
1. Command router with Commander.
2. `.codeos/` scaffolder + sample `codeos.yml` and subfolders.
3. YAML schema validator (Zod or custom).
4. Console logger (info/warn/error) with quiet/verbose flags.
5. Vitest tests for arg parsing and init idempotency.

## Out of Scope
- Multi‑project config discovery; plugin loading.
