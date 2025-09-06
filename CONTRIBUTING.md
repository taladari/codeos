# CONTRIBUTING — CodeOS

Thanks for considering contributing!

## Setup
```bash
pnpm i
pnpm -w build
pnpm -w dev
```

## Style & Quality
- TypeScript strict mode
- ESLint (recommended + TS rules)
- Vitest for unit tests
- Keep PRs small (≤200 LOC, <10 files)

## Running Tests & Lint
```bash
pnpm -w lint
pnpm -w test
```

## PRs
- Include tests and a brief rationale.
- Link to the relevant **Epic** in `docs/epics/`.
- Attach before/after examples when relevant.
