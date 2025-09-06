# ROADMAP — CodeOS

## Phase 1 — MVP (Weeks 1–4)
**Goal**: Produce a **passing GitHub PR** from a prompt via a linear workflow.

### Epics
1) **CLI & Config**
   - Commands: `init`, `blueprint`, `run`
   - YAML loader, defaults, validation
2) **Providers & Analyzer**
   - Provider interface; Claude/OpenAI drivers (stubs → real)
   - Analyzer (language, pm, lint/type/test commands)
3) **Roles**
   - Planner → Plan.md
   - Builder → diffs + tests (unified)
   - Verifier → sandbox apply + gates
   - Reviewer → PR summary
4) **Workflow Engine**
   - Linear runner, retries, run artifacts, resume
5) **GitHub Integration**
   - Branch/commit/PR; status checks per gate
6) **Verification Gates**
   - ESLint, tsc, Vitest reports

## Phase 2 — Community Growth (Weeks 5–8)
- Standards Library presets (TS/Node, Python/FastAPI)
- Slack notifications (start/fail/success)
- Jira/Linear read‑only → later bidirectional sync
- Plugin API draft (roles, gates, integrations)
- Example repos + docs site + tutorials

## Phase 3 — Pro/SaaS (Weeks 9–14)
- Hosted dashboard (runs viewer, artifacts, logs)
- Org memory (history, analytics on success rates)
- Premium integrations (Jira, Confluence, Teams)
- Managed runners (pay‑per‑run)

## Phase 4 — Enterprise (Weeks 15+)
- RBAC, SSO (SAML/OIDC), advanced audit
- Private/self‑hosted deployments
- Compliance packs (SOC2, HIPAA, FedRAMP)
- DLP & secrets policies

---

### Extracting Epics & Stories
- Each Phase → Epics → Stories.  
- See `docs/epics/*` for MVP epic breakdowns with **User Stories**, **Acceptance Criteria**, and **Dev Tasks**.  
- Use `docs/issues_export.csv` to import stories as GitHub Issues.
