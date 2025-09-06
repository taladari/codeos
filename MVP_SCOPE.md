# MVP Scope — CodeOS v0.1

## 🎯 Objective
Deliver a minimal but real **end‑to‑end** path from prompt to **passing PR**.

## 🧩 Features (In Scope)
- **CLI**: `init`, `blueprint <title>`, `run <workflow>`
- **Roles (linear)**:
  - Planner → `.codeos/plan/Plan.md`
  - Builder → `.codeos/patches/*.diff` + tests (unified diff only; prose rejected; size limits enforced)
  - Verifier → sandbox apply + ESLint/tsc/Vitest; `.codeos/reports/*`
  - Reviewer → `.codeos/review/PR_SUMMARY.md`
- **GitHub**: create branch, commit patch, open PR, attach summary, post gate checks
- **Artifacts** under `.codeos/` (blueprints, plan, patches, reports, review, run logs)
- **Provider drivers** (stubs for Claude/OpenAI)
- **Analyzer (extensible)**: pluggable detector registry for language/package manager/tools
- **Redaction**: redact sensitive env vars from prompts/artifacts by default

## 🧪 Gates
- **Formatting/Lint**: ESLint
- **Typing**: TypeScript compiler (`tsc`)
- **Unit tests**: Vitest discovery & run
  - Run in a deterministic local sandbox (temp workspace/container)

## 🚫 Out of Scope (v0.1)
- Concurrency across roles
- SaaS dashboard and hosted services
- Jira/Linear, Slack/Teams integrations
- Plugin API & Standards Library presets beyond defaults
- Enterprise features (SSO/RBAC/audit policies)

## 📦 Artifact Contract
- `.codeos/blueprints/<slug>.md`
- `.codeos/plan/Plan.md`
- `.codeos/patches/<change>.diff` (unified diff)
- `.codeos/reports/{lint.json,tests.json}` (+ optional coverage later)
- `.codeos/review/PR_SUMMARY.md`
- `.codeos/run/<timestamp>/{logs.txt, meta.json}`

## ✅ Definition of Done
Running `codeos run build` on a small TS repo:
1. Creates Blueprint & Plan
2. Produces minimal unified diffs + tests (no prose)
3. Applies in sandbox; passes ESLint + tsc + Vitest locally; writes JSON reports
4. Opens a PR with summary; posts one status per gate; links `.codeos/reports/*`

## 🗓️ Suggested 4‑Week Plan
- **Week 1**: CLI skeleton, config loader, `init`, `blueprint`
- **Week 2**: Planner + Builder (diff contract + small patch capability)
- **Week 3**: Verifier gates + sandbox + GitHub PR creation
- **Week 4**: Reviewer summary + end‑to‑end demo + docs polish
