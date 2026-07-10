---
schema_version: 1
current_task_id: "TASK-20260710-110532-task"
status: "in_progress"
phase: "release-validation"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
last_checkpoint_at: "2026-07-10T19:31:40Z"
checkpoint_required: true
last_rehydrated_at: null
---
# Active Context

## Current objective

**设置页主店主专用工单详情导入导出实施**

## Current state

Implementation is rebased onto `23ac0e06` (`Close TASK-009 release evidence`). Creator-only Settings order-data roundtrip, XLSX security controls, preview ledger, atomic apply RPC, customer stats export, and active order-page CSV export removal are implemented. Release review removed automatic `pg_cron` install/job scheduling from this task migration; cleanup now remains an RPC called before import preview creation. QA blocker fixes are applied for backup-phone preservation, mixed repair-item identifiers, preview row visibility, and final screenshot evidence. Latest validation passed: `git diff --check`, lint, typecheck, full Vitest 108 files / 729 tests, production build, linked dry-run listing only `20260710150000_order_data_roundtrip.sql`, and final desktop/mobile browser evidence. Linked migration `20260710150000_order_data_roundtrip.sql` is applied and post-verified.

## Blocking decisions

- None for this task after owner approval, provided final linked dry-run still lists only `20260710150000_order_data_roundtrip.sql`.
- Broad database gate issues from TASK-009 remain out of scope; this task may only apply its reviewed additive migration.
- Any unrelated pending migrations, unresolved conflicts, destructive SQL, secret exposure, or tenant isolation regression is a hard stop.

## Next action

Stage final migration correction and memory updates, commit, push `main`, then close task.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260710-110532-task/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
