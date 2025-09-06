# EPIC D — Workflow Engine

## Goal
A simple, reliable runner that orchestrates roles and persists artifacts.

## User Stories
- As a dev, I can run `codeos run build` and see step‑by‑step progress.
- As a dev, I can resume a failed run without losing artifacts.

## Acceptance Criteria
- Steps: planner → builder → verifier → reviewer (serial).
- Step‑level retries; caching (don’t recompute unchanged outputs).
- Run artifacts under `.codeos/run/<timestamp>/` with `logs.txt` and `meta.json`.

## Dev Tasks
1. Linear runner with basic DAG model (serial for MVP).
2. Artifact cache & resume logic.
3. Structured logging (JSON Lines) per step.
