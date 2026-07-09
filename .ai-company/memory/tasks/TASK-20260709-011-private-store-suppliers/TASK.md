---
task_id: TASK-20260709-011-private-store-suppliers
title: Private per-store supplier management
status: complete
risk_level: R3
autonomy_level: L2
owner: CEO-Orchestrator
created_at: 2026-07-09T10:00:00Z
updated_at: 2026-07-09T11:05:00Z
---

## Objective

Implement private per-store supplier management for RepairDesk, starting from an empty supplier list, with owner/manager maintenance in Settings and order-level parts supplier selection on desktop and mobile.

## Scope

- Store-scoped supplier API, schemas, permissions, audit logging, and migration metadata.
- Settings supplier section with add/edit/archive and responsive desktop/mobile layout.
- Order list and order detail supplier picker using current-store active suppliers only.
- Mock source updated to start with zero suppliers by default.

## Constraints

- Preserve original checkout unrelated kiosk WIP by working in isolated worktree `/private/tmp/repairdesk-private-suppliers-20260709`.
- Do not apply production migrations automatically.
- Do not expose one store's suppliers to another store.

## No-Spawn Reason

No real sub-agents spawned. The user requested implementation and push, not multi-agent/departments; scoped single-writer execution reduced write-conflict risk.
