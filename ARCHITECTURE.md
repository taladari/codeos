# ARCHITECTURE — CodeOS

## Packages
- **packages/cli** — CLI entrypoint (`codeos`), commands, I/O
- **packages/core** — config loader, workflow runner, artifacts
- **packages/providers** — LLM drivers (Claude/OpenAI interface & stubs)

## Sequence (MVP)
```
Blueprint ──▶ Planner ──▶ Plan.md
             │
             ▼
           Builder ──▶ patches/*.diff + tests
             │
             ▼
           Verifier ──▶ reports/{lint,tests}.json (in sandbox)
             │
             ▼
           Reviewer ──▶ PR_SUMMARY.md ──▶ GitHub PR (+ status checks)
```

## Artifact Layout
```
.codeos/
├─ blueprints/
├─ plan/Plan.md
├─ patches/*.diff
├─ reports/{lint.json,tests.json}
├─ review/PR_SUMMARY.md
└─ run/<timestamp>/{logs.txt,meta.json}
```

## Config (codeos.yml)
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
  llm: claude # or openai
integrations:
  github:
    repo: org/name
```

## Extensibility (Later)
- **Plugin API** for Roles, Gates, Integrations (NPM packages).
- **Standards Library** presets per language/framework.
- **Local/remote model** support through provider drivers.

## Security & Privacy
- Redact secrets from prompts.
- Minimize context to needed file slices.
- Run verification in sandboxed environment.
