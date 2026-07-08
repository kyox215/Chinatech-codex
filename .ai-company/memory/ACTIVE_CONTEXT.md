---
schema_version: 1
current_task_id: "TASK-20260708-009-employee-management"
status: "active"
phase: "hotfix-validated-pending-push"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
last_checkpoint_at: "2026-07-08T18:12:44Z"
checkpoint_required: false
last_rehydrated_at: "2026-07-08T18:12:44Z"
---
# Active Context

## Current objective

完善员工注册到设置页员工管理闭环：邀请、邀请码、加入申请审批、员工查看、改角色、停用和恢复。

## Current state

Implementation and production read hotfix are complete in isolated worktree `/tmp/repairdesk-employee-management` on branch `codex/employee-management`.

Added store member lifecycle APIs, schema/router/client types, repository implementation, Settings employee management UI, mock source support, and focused tests. Four real read-only sub-agents reviewed Product, Data, Security, and UX. No production database migration is required for the base lifecycle because `store_memberships.role` and `store_memberships.status` already exist.

Owner later reported production `/settings` showing `无法读取员工管理` while logged in as `kyox120@gmail.com`. Evidence indicates this is not an account-permission denial: production logs returned `400`, and read-only table checks showed `store_memberships` and `store_invitations` readable while `store_invite_links` is missing from the PostgREST schema cache. The hotfix makes `listStoreMembers` return `invite_links: []` only for the narrow `PGRST205 + store_invite_links + schema cache` missing-table case; all other employee, invitation, permission, and invite-link errors still fail.

Validation passed after hotfix: repository focused Vitest 45/45, `npm run typecheck`, `npm run lint`, full `npm run test` 80 files / 539 tests, and `npx next build --webpack`. Plain `npm run build` previously failed only because the temporary worktree uses a `node_modules` symlink and Turbopack rejects symlinks pointing outside the project filesystem root.

Visual evidence exists at:

- `/tmp/repairdesk-employee-management/screenshots/employee-management-settings-desktop.png`
- `/tmp/repairdesk-employee-management/screenshots/employee-management-settings-mobile-full.png`

## Blocking decisions

- No production migration, owner transfer, last-owner removal flow, or external email delivery was included.
- Production migration `supabase/migrations/20260704221944_store_invite_links.sql` is still required before invite-code create/redeem/revoke can fully work in production. This needs explicit Owner approval because it changes production schema.
- If stronger concurrent last-owner protection is required for future owner-transfer/removal work, design a DB transaction/RPC or trigger as a separate data-migration task.

## Next action

Commit scoped hotfix and memory checkpoint from `/tmp/repairdesk-employee-management`, rebase on latest `origin/main`, push `HEAD:main`, and verify Vercel deployment/alias state. Do not stage unrelated screenshots or original-worktree WIP.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260708-009-employee-management/TASK.md` and latest checkpoint.
3. Inspect `git -C /tmp/repairdesk-employee-management status --short --branch`.
4. Preserve original worktree unrelated WIP; commit/push only scoped employee-management files from the isolated worktree.
