---
schema_version: 1
current_task_id: "TASK-20260710-009-security-reliability-hardening-release"
status: "in_progress"
phase: "release"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "鹤祥"
last_checkpoint_at: "2026-07-10T18:48:01Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**RepairDesk 高优先级安全与可靠性加固发布**

## Current state

用户已要求“推送main 以及应用数据库”。本次按 payment-only 有界例外执行：linked dry-run 只包含 `20260710145642_order_payment_ledger_atomic_rpc.sql`，该迁移已应用并通过 post-apply catalog/权限复验；final dry-run 显示 remote database up to date。代码门禁中 typecheck、test、build、desktop E2E 已通过；scoped ESLint 0 errors；`npm run lint` 在本环境挂起未完成。当前已完成 scoped staging 与 cached diff 复验，下一步是 commit/push。

## Blocking decisions

- Normal Database Application Gate remains NO-GO for broad database work because 17 linked legacy tables are directly exposed, the historical migration chain cannot reset from zero, and current backup/PITR restore proof is missing.
- Owner approved this payment-only risk-reduction exception by asking to push main and apply the database; this does not approve legacy-table RLS containment, migration repair, destructive cleanup, unlock credential purge or other database work.
- Unlock credential key-management/retention remains undecided; one plaintext pattern exists and must not be printed or purged automatically.

## Next action

commit staged TASK-009 diff 并 push `main`。TASK-010/TASK-011 UI 改动、截图和重复文件继续排除。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260710-009-security-reliability-hardening-release/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
