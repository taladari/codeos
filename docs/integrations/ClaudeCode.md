# Claude Code Integration

- Roles (Planner/Builder/Reviewer) can call Anthropic via provider drivers.
- Keep prompts tiny: pass **Plan excerpts** + **file slices** only.
- Redact secrets; never send large binary blobs.
