# CodeOS

**CodeOS** is an AI‑native development framework that turns large language models (LLMs) into **structured, reliable teammates** for software teams.  
It orchestrates the messy bits of AI‑assisted coding into a **repeatable workflow** that outputs **tested pull requests** with **auditable artifacts**.

> TL;DR — CodeOS = *Blueprint → Plan → Build (diffs + tests) → Verify (gates) → Review → GitHub PR*

---

## ✨ Why CodeOS?

AI coding tools are great at generating snippets — but weak at **process**:
- They forget your **repo standards** and **context**.
- They produce **inconsistent output** that often fails tests.
- They don’t collaborate; there’s no **handoff** or **quality gates**.

**CodeOS fixes this** by adding a thin orchestration layer over Git + CI:
- **Blueprints** capture intent (human + AI‑readable).
- **Roles** (Planner, Builder, Verifier, Reviewer) perform focused steps.
- **Gates** enforce formatting, linting, typing, tests, security.
- **Artifacts** make every AI decision **observable and auditable**.
- **Integrations** (GitHub, trackers, chat) keep your team in the loop.

---

## 🧠 Core Concepts

- **Blueprint** — durable description of a change: goals, constraints, acceptance criteria.
- **Plan** — structured breakdown: affected files, steps, test plan.
- **Roles**
  - **Planner** — turns a Blueprint into a Plan.
  - **Builder** — proposes **unified diffs** + tests (no prose blobs).
  - **Verifier** — applies patches in a sandbox and runs **gates**.
  - **Reviewer** — generates PR summary with risks & manual checklist.
- **Workflow** — linear in MVP: `planner → builder → verifier → reviewer`.
- **Gates** — ESLint, TypeScript compile, Vitest tests (more later).
- **Artifacts** — everything recorded under `.codeos/` for auditability.

---

## 🚀 Quick Start (scaffold)

```bash
pnpm i
pnpm -w build
pnpm -w dev    # runs the CLI in dev mode
```

Now try:

```bash
codeos init
codeos blueprint "Add login form"
codeos run build
```

> MVP stubs are scaffolded; use this repo as the base for implementing v0.1.

---

## 🔄 How It Works (MVP)

1) **`codeos blueprint "…" `** → writes `.codeos/blueprints/<slug>.md`  
2) **Planner** → `.codeos/plan/Plan.md` (goals, constraints, affected files, test plan)  
3) **Builder** → `.codeos/patches/*.diff` + tests (unified diff only)  
4) **Verifier** → applies diffs in temp workspace, runs ESLint/tsc/Vitest; writes `.codeos/reports/*`  
5) **Reviewer** → `.codeos/review/PR_SUMMARY.md`; opens a PR with artifacts & checks

---

## 🧱 Repo Layout (Monorepo)

```
codeos/
├─ README.md
├─ PROBLEM.md
├─ MVP_SCOPE.md
├─ ROADMAP.md
├─ ARCHITECTURE.md
├─ CONTRIBUTING.md
├─ codeos.yml
├─ .github/workflows/ci.yml
├─ packages/
│  ├─ cli/         # CLI entrypoint + commands
│  ├─ core/        # config, workflow engine, artifacts
│  └─ providers/   # LLM drivers (Claude/OpenAI stubs)
└─ docs/
   ├─ epics/       # MVP epics → user stories & tasks
   └─ integrations/ (notes for VSCode/Cursor/Claude Code)
```

---

## 🗺️ Roadmap (Short)

- **Phase 1 — MVP**: CLI, roles (linear), gates, GitHub PRs.  
- **Phase 2 — Community**: Standards presets, Slack, Jira/Linear (read‑only), Plugin API draft, examples & docs.  
- **Phase 3 — Pro/SaaS**: hosted dashboard, org memory, analytics, premium integrations, managed runners.  
- **Phase 4 — Enterprise**: SSO, RBAC, audit, self‑hosted, compliance packs.

Full details in [ROADMAP.md](./ROADMAP.md).

---

## 🤝 Contributing

We love contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, style, tests, and PR guidelines.

---

## 📝 License

MIT — do whatever you want, just don’t remove the copyright and license notice.
