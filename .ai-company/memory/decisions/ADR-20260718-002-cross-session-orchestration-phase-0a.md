---
schema_version: 1
decision_id: "ADR-20260718-002"
title: "Project-scoped SQLite control plane for cross-session orchestration"
status: "accepted"
owner: "Hexiang Huang / 鹤祥"
decided_at: "2026-07-18"
review_after: "Phase 0B proposal or more than five concurrent workers"
---

# ADR-20260718-002 — Project-scoped SQLite control plane

## Context

Several top-level Codex windows can otherwise infer conflicting task identity from chat history, cwd, branches or `ACTIVE_CONTEXT.md`. Shared Markdown/JSON cannot provide atomic CAS, idempotency or an exclusive Integration Lead.

## Decision

Adopt one embedded SQLite/WAL Registry per RepairDesk project, resolved through the Git common directory to the same physical runtime for linked worktrees. Use a committed stable `project_id`, explicit project/task/run/window/worker/WP identities, immutable hashed Context Packets, command idempotency, CAS claims and an expiring project integration lease.

SQLite is the runtime identity source. Git Task Memory remains the durable audit projection. `ACTIVE_CONTEXT.md` is only a foreground hint.

Phase 0A is enabled in cooperative `shadow` mode. It does not automatically control GUI sessions, hooks, agents, worktrees, writers, integration, Git publication, deploys or migrations. Identity binding never raises authorization.

## Alternatives considered

- Shared Markdown/JSON: rejected because concurrent read-modify-write loses updates and cannot enforce CAS.
- Per-task databases: rejected because they cannot arbitrate project-wide task ambiguity or Integration Lead ownership.
- Local daemon/socket: deferred because process lifecycle and upgrade cost are unnecessary at the current 2–5-window scale.
- `ACTIVE_CONTEXT.md` routing: rejected because a single foreground pointer cannot represent concurrent task identity.

## Consequences

- All linked worktrees must resolve and verify one Registry path and common-dir fingerprint.
- New applicable windows begin UNBOUND and fail closed on identity ambiguity.
- Context Packets are task-scoped, redacted, deterministic and immutable.
- Database/file packet recovery is a small PENDING-to-READY saga; mismatches quarantine/fail closed.
- File modes do not provide confidentiality from processes running as the same OS user.
- Hook migration, resource leases, backups and cleanup automation remain Phase 0B.

## Rollback

Disable the committed configuration through a reviewed change, leave the Registry read-only for audit, and return to the legacy single-task workflow. Revert Git normally. Do not force-push, silently rebuild a corrupt Registry or automatically delete runtime/worktrees.
