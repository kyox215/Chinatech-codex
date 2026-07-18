# Execution Plan — TASK-20260718-013

Status: approved by Owner instruction for Phase 0A implementation and non-force Git push

## Architecture decision

Use a project-level SQLite/WAL registry for cross-task identities and locks, task-specific runtime namespaces for immutable Context Packets, and existing Git Task Memory as a controller-written audit projection. Keep ACTIVE_CONTEXT as a foreground compatibility hint only.

Rejected:

- Shared mutable Markdown/JSON as runtime truth.
- One database per task without project-wide arbitration.
- Automatic worktree creation, ownership transfer, integration or production release in Phase 0A.

## Phase sequence

1. Baseline and task collision check.
2. Registry schema and runtime path/permission implementation.
3. Window/task/run binding and immutable Context Packet.
4. ai_company compatibility fixes and adapter.
5. Project declaration, config, ADR and Skill.
6. Unit, concurrency, recovery, governance and forward tests.
7. Independent review and remediation.
8. Fresh remote fetch, rebase if required, scoped commit and non-force push.
9. Evidence, memory and formal closeout.

## File budget

Allowed:

- tools/orchestration/**
- tools/ai_company.py
- .ai-company/orchestration.json
- .ai-company/schemas/orchestration.schema.json
- .ai-company/.gitignore
- .agents/skills/cross-session-orchestration/**
- .agents/README.md
- .agents/skills/README.md
- AGENTS.md
- docs/CROSS_SESSION_ORCHESTRATION_DECLARATION.md
- .ai-company/memory/decisions/ADR-20260718-002-cross-session-orchestration-phase-0a.md
- .ai-company/memory/DECISION_INDEX.md
- .ai-company/memory/CAPABILITY_REGISTRY.md
- this task directory

Forbidden:

- src/**
- supabase/**
- tests/e2e/**
- package or lockfile changes
- Vercel/deploy configuration
- TASK-012 worktree or task files
- unrelated project memory

## Test and evidence matrix

| Acceptance | Verification |
|---|---|
| SQLite/WAL and permissions | focused unittest + doctor output |
| Identity isolation | wrong project/task/run/window tests |
| Exactly-one concurrency | threaded/process-style contention tests |
| ACTIVE_CONTEXT compatibility | temporary repository fixture tests |
| Immutable Context Packet | hash/version/idempotency tests |
| Project Skill | skill quick_validate + fresh-agent forward-test |
| Governance | agents:config, agents:templates, agents:check, ai_company.py validate |
| Scope and secret safety | git diff checks + lightweight secret scan |
| Remote delivery | fetch, scoped staged diff, commit SHA, non-force push, remote SHA |

## Promotion boundary

This task ends at Phase 0A. Phase 0B requires real multi-window read-only drills; Phase 1 requires five low-risk single-Writer pilots. Neither is silently enabled by this release.
