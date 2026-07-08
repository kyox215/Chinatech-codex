---
schema_version: 1
current_task_id: "TASK-20260708-009-employee-management"
status: "active"
phase: "validated-local"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
last_checkpoint_at: "2026-07-08T17:44:31Z"
checkpoint_required: false
last_rehydrated_at: "2026-07-08T17:44:31Z"
---
# Active Context

## Current objective

完善员工注册到设置页员工管理闭环：邀请、邀请码、加入申请审批、员工查看、改角色、停用和恢复。

## Current state

Implementation is complete in isolated worktree `/tmp/repairdesk-employee-management` on branch `codex/employee-management`.

Added store member lifecycle APIs, schema/router/client types, repository implementation, Settings employee management UI, mock source support, and focused tests. Four real read-only sub-agents reviewed Product, Data, Security, and UX. No production database migration is required for the base lifecycle because `store_memberships.role` and `store_memberships.status` already exist.

Validation passed: repository focused Vitest 40/40, schema/router focused Vitest 16/16, `npm run typecheck`, `npm run lint`, full `npm run test` 80 files / 534 tests, and `npx next build --webpack`. Plain `npm run build` failed only because the temporary worktree uses a `node_modules` symlink and Turbopack rejects symlinks pointing outside the project filesystem root.

Visual evidence exists at:

- `/tmp/repairdesk-employee-management/screenshots/employee-management-settings-desktop.png`
- `/tmp/repairdesk-employee-management/screenshots/employee-management-settings-mobile-full.png`

## Blocking decisions

- No production migration, deploy, owner transfer, last-owner removal flow, or external email delivery was included.
- If stronger concurrent last-owner protection is required for future owner-transfer/removal work, design a DB transaction/RPC or trigger as a separate data-migration task.

## Next action

Commit scoped files from `/tmp/repairdesk-employee-management` and push `HEAD:main` if the Owner push-main request remains active. Do not stage unrelated changes from the original dirty worktree.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260708-009-employee-management/TASK.md` and latest checkpoint.
3. Inspect `git -C /tmp/repairdesk-employee-management status --short --branch`.
4. Preserve original worktree unrelated WIP; commit/push only scoped employee-management files from the isolated worktree.
