# CodeOS CLI

AI-native development framework that orchestrates LLMs into structured software workflows.

## Installation

```bash
npm install -g @taladari/codeos
```

## Quick Start

```bash
# Initialize CodeOS in your project
codeos init

# Authenticate with GitHub (OAuth Device Flow)
codeos auth login

# Create a blueprint
codeos blueprint "Add user authentication"

# Run a workflow
codeos run build

# Create a GitHub Pull Request
codeos pr <runId> --title "Add authentication feature"
```

## Commands

### Authentication
- `codeos auth login` - Authenticate with GitHub using OAuth
- `codeos auth logout` - Sign out of GitHub  
- `codeos auth status` - Check authentication status

### Workflow Management
- `codeos init` - Initialize CodeOS in current repository
- `codeos run <workflow>` - Run a workflow (e.g., build)
- `codeos runs` - List all workflow runs
- `codeos resume <runId>` - Resume a failed workflow
- `codeos retry <runId> <step>` - Retry from specific step
- `codeos inspect <runId>` - Inspect workflow details

### GitHub Integration
- `codeos pr <runId>` - Create GitHub Pull Request
- `codeos github setup` - Check GitHub integration

### Blueprints
- `codeos blueprint <title>` - Create a new blueprint

## Configuration

Create a `codeos.yml` file in your project root:

```yaml
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
  llm: claude

integrations:
  github:
    repo: owner/name
```

## Requirements

- Node.js 18+
- Git repository with GitHub remote
- GitHub authentication (OAuth or token)

## Documentation

Visit [https://github.com/taladari/codeos](https://github.com/taladari/codeos) for full documentation.
