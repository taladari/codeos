# CodeOS

**CodeOS** is an AI-native development framework that turns large language models (LLMs) into **structured, reliable teammates**.  
It orchestrates **Blueprint → Plan → Build → Verify → Review → PR** into a repeatable workflow that outputs **tested, auditable pull requests**.

> **CodeOS ≠ another IDE copilot.**  
> It complements Cursor / Claude Code by enforcing a disciplined workflow, producing **unified diffs + tests**, running **quality gates**, and opening a **review-ready PR** with artifacts.

---

## Why CodeOS?

Modern AI coding tools are great at generating code, but weak at **process**:
- **Context drift** — assistants forget repo standards & structure  
- **Inconsistent quality** — outputs vary by prompt and user  
- **No governance** — no durable record of why a change exists  
- **Reviewer pain** — humans stitch together missing tests & fixes  

**CodeOS adds the missing layer**:
- **Blueprints** (durable intent)  
- **Roles** (Planner, Builder, Verifier, Reviewer)  
- **Gates** (lint, typecheck, tests, security)  
- **Artifacts** (auditable outputs under `.codeos/`)  
- **PR Automation** (summaries, checks, links to reports)  

---

## Modes of Use

CodeOS works **with** your IDE copilots, not against them:

- **CodeOS-led (Autonomous)**  
  CodeOS calls Claude / GPT **APIs** to generate **unified diffs + tests**, verifies, and opens a PR.

- **IDE-led (Assist)**  
  You code with **Cursor / Claude Code**.  
  CodeOS **does not generate code**; it captures intent (Blueprint), **verifies**, and **opens the PR** with artifacts.

- **Hybrid**  
  Use your IDE for parts, let CodeOS generate diffs for others. CodeOS always **verifies + ships**.

> **Who writes the code?**  
> You choose per feature: **(a)** CodeOS Builder via API models, **(b)** IDE assistant inside your editor, or **(c)** both.  
> CodeOS is the **orchestrator** that guarantees structure, quality, and a clean PR.

---

## Installation

**Prereqs:** Node.js ≥ 18, Git, a repo to work in.

```bash
# global install
npm install -g @taladari/codeos

# or run from a local checkout
pnpm i
pnpm -w build
pnpm -w dev
```

---

## Quick Start

```bash
# 1) Prepare repo for CodeOS
codeos init

# 2) Capture intent
codeos blueprint "Add Todos CRUD"

# 3) Create a plan (Planner via Claude/GPT API)
codeos run plan

# 4) Build (Builder via Claude/GPT API → emits unified diffs + tests)
codeos run build --feature "Todos CRUD"

# 5) Verify (lint, tsc, tests; machine-readable reports)
codeos verify

# 6) Open a PR (with PR summary + links to artifacts)
codeos pr
```

---

## Examples

### A) **CodeOS-led** — small, safe change end-to-end
```bash
codeos blueprint "Add password strength meter to login form"
codeos run plan
codeos run build --feature "Password strength meter"
codeos verify
codeos pr
```
- Builder returns **only unified diffs + test updates**
- Verifier enforces **eslint / tsc / vitest**
- Reviewer writes **PR_SUMMARY.md** and opens the PR

---

### B) **IDE-led** — you code in Cursor / Claude Code, CodeOS ships it
```bash
# Do the coding in your IDE with Cursor/Claude Code

# Capture intent for auditability
codeos blueprint "Refactor TodoItem into TodoCard component"

# Turn current git diff into artifacts + verification + PR
codeos verify
codeos pr
```
- CodeOS treats your local changes as the “patch,” produces reports, and ships the PR.

---

### C) **Full App (decomposed)** — “Build a Todo app”
```bash
# Optional: scaffold a preset (first PR)
codeos init --preset ts-web

# High-level ask → decomposed into feature blueprints
codeos blueprint "Build a Todo app with auth and filters"
codeos run plan

# Build features as separate PRs
codeos run build --feature "Project scaffolding"
codeos run build --feature "Auth: email/password"
codeos run build --feature "Todos CRUD"
codeos run build --feature "Filters & status"
codeos verify
codeos pr
```
- CodeOS uses API models to plan & generate **small, testable diffs** per feature
- Verified PRs keep the project green along the way

---

### D) **No LLM** — snapshot your local changes and ship
```bash
# You or your IDE made changes already
git add -A

# Ask CodeOS to verify and PR what's staged
codeos verify
codeos pr
```
- Useful when you just want artifacts, gates, and a clean PR workflow

---

## Artifacts (Auditability)

CodeOS produces a complete trail in your repo:

```
.codeos/
├─ blueprints/         # durable intent
├─ plan/Plan.md        # structured plan
├─ patches/*.diff      # unified diffs (Builder output)
├─ reports/*.json      # lint/type/test results
├─ review/PR_SUMMARY.md
└─ run/<timestamp>/    # logs + meta per run
```

---

## 🤖 Models, Providers, & IDEs

- **Planner / Builder / Reviewer** use **LLM APIs** (Anthropic Claude, OpenAI GPT, etc.)  
- **Verifier** uses **local tools** (eslint, tsc, vitest; later: security, coverage)  
- **IDE copilots (Cursor / Claude Code)** are **optional** and complementary  
  - Use them for rapid editing  
  - Let CodeOS own **structure, gates, and PRs**

---

## Configuration

`codeos.yml` (created by `codeos init`):

```yml
project:
  language: typescript
  package_manager: pnpm

workflow: build

workflows:
  build:
    steps:
      - role: planner
      - role: builder
      - role: verifier
      - role: reviewer

gates:
  - lint
  - typecheck
  - test

providers:
  llm: claude   # or openai

integrations:
  github:
    repo: your-org/your-repo
```

---

## Security & Privacy

- CodeOS **minimizes context** sent to models (file slices, plan excerpts)  
- Secrets are redacted from prompts when possible  
- Verification runs in a **sandbox / temp workspace**  
- Use your own provider keys or route via CodeOS Cloud (later)

---

## Roadmap (High Level)

- **Phase 1 (MVP)**: CLI, Planner/Builder/Verifier/Reviewer (linear), GitHub PR, gates, usage manager  
- **Phase 2 (Community)**: presets, Slack notifications, read-only Jira/Linear, plugin API draft, examples  
- **Phase 3 (Pro/SaaS)**: hosted dashboard, org memory, analytics, managed runners, premium integrations  
- **Phase 4 (Enterprise)**: SSO, RBAC, audit trails, compliance packs, self-hosted mode  

See the full [ROADMAP.md](./ROADMAP.md).

---

## Contributing

PRs welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md).  
- TypeScript strict, ESLint, Vitest  
- Keep PRs small and include tests  
- Link issues to epics in `docs/epics/`

---

## License

MIT — see [LICENSE](./LICENSE).
README.md