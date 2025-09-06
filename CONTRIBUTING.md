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

## Adding a Detector (Analyzer)
CodeOS analyzer is extensible via a detector registry.

1) Create a detector file in `packages/core/src/` or your package, exporting a `Detector`:
```ts
import { registerLanguageDetector } from 'codeos-core'
registerLanguageDetector({
  id: 'my-lang', priority: 50,
  async detect(ctx) {
    const has = await ctx.exists('myconfig.toml')
    return has ? { match: true, score: 5, value: 'typescript' } : { match: false }
  }
})
```

2) Ensure it’s imported once (e.g., from `packages/core/src/detectors.defaults.ts` or your plugin entry) so it registers at runtime.

3) Test:
```bash
pnpm -w build
pnpm dev -- analyze
cat .codeos/reports/analyze.json
```

Scoring: higher `score` wins; `priority` controls eval order (lower first). Keep detection fast and side‑effect free.
