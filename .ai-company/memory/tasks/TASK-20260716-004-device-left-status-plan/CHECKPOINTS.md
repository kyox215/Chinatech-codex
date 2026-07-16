# Checkpoints

## 2026-07-16T19:58:27+02:00 — Planning integrated

Phase: planned_waiting_owner_start

Completed:

- Verified that new order, detail, shared types, API schemas, repository, database schema, offline drafts, print, and import/export have no independent device-custody field.
- Verified that the current `留存` UI is accessory notes and `快修 / 送修` is repair type.
- Integrated three real read-only department reviews: FLOW+UX, DATA+API+Architecture, and QA+Security.
- Selected nullable `with_shop / with_customer / NULL` custody semantics and documented create, receipt, return, cancel, complete, pickup, unlock, offline, migration, release, and rollback rules.
- Created a staged implementation contract and acceptance matrix in `PLAN.md`.

Not completed:

- No business code, migration, UI, test, screenshot, commit, push, deploy, production query, or historical backfill was performed.

Decisions:

- Do not reuse `order_type` or accessory notes.
- Do not store `returned` or `unknown` as normal business enum values; use `delivered_at` and nullable legacy state.
- Do not backfill old orders as shop custody.
- New orders visibly default to shop custody and explicitly send the value.
- Existing-order custody changes are dedicated, online, version-locked, and audited actions.

Risks and approvals:

- Implementation is R3 because false custody evidence affects cancellation, completion, pickup, and sensitive unlock credentials.
- Production migration/deploy, destructive correction, and permission expansion require separate Owner approval.
- Order data import/export may overlap another settings task and must be assigned to a single writer before implementation.

Next:

- On Owner command `开始`, create an isolated worktree from the then-latest `origin/main`, recheck active-task ownership, and execute WP-00 before any migration or business-code edit.

Evidence:

- `PLAN.md`
- `EVIDENCE.md`
- Baseline `6717932e316cbe5054709646ca7ea1087f517a49`

## 2026-07-16T18:03:53Z — 已完成新建工单留机/未留机的跨模块只读审计与完整计划；确认现有留存仅是随附物品，采用独立 nullable with_shop/with_customer 保管状态，并规划新建、详情、取消、完成、取机、解锁、离线、迁移、发布和回滚。未改业务代码或数据库。

- **Phase:** planned_waiting_owner_start
- **Completed/current state:** 已完成新建工单留机/未留机的跨模块只读审计与完整计划；确认现有留存仅是随附物品，采用独立 nullable with_shop/with_customer 保管状态，并规划新建、详情、取消、完成、取机、解锁、离线、迁移、发布和回滚。未改业务代码或数据库。
- **Next:** 等待老板确认；收到开始后，从最新 origin/main 建立隔离工作树，先执行 WP-00 文件所有权与状态/迁移合同复核，再实施服务端和数据测试。
- **Decision:** 不复用 order_type/accessory_notes；旧订单保持 NULL 未知；生产 migration/deploy 另行批准。
- **Evidence:**
  - .ai-company/memory/tasks/TASK-20260716-004-device-left-status-plan/PLAN.md; EVIDENCE.md; baseline 6717932e
- **Recorded by:** CEO-Orchestrator

## 2026-07-16T18:10:03Z — 留机/未留机规划交付已完成并通过任务范围文档门禁：主计划、证据、CEO 报告、部门 proposed 记忆与实施边界齐全；git diff --check、任务包 Prettier、agents:check 通过。业务代码、migration、数据库、发布均未开始。

- **Phase:** closeout_ready
- **Completed/current state:** 留机/未留机规划交付已完成并通过任务范围文档门禁：主计划、证据、CEO 报告、部门 proposed 记忆与实施边界齐全；git diff --check、任务包 Prettier、agents:check 通过。业务代码、migration、数据库、发布均未开始。
- **Next:** 关闭规划任务；如老板说开始，建立新的/恢复的实施阶段，从最新 origin/main 隔离工作树执行 WP-00，生产 migration/deploy 另行批准。
- **Decision:** 规划范围 PASS；repo validate 的 12 个重复 Agent 名称是未改动的既有问题，不作为本任务实施证据。
- **Evidence:**
  - PLAN.md; EVIDENCE.md; CEO_REPORT.md; git diff --check PASS; scoped Prettier PASS; npm run agents:check PASS
- **Recorded by:** CEO-Orchestrator

## 2026-07-16T18:10:12Z — Task closeout

- **Status:** closed
- **Outcome:** 已完成新建工单留机/未留机现状审计、独立设备保管状态产品/架构方案、完整工作包、验收矩阵、迁移发布回滚计划和三部门只读复核；本轮仅规划。
- **Residual risks:** 当前运行时仍没有该选项，取消/完成/取机/解锁逻辑仍按旧行为；实施为 R3，生产 migration/deploy 需 D3 单独批准。仓库全量 validate 仍有 12 个既有重复 Agent 名称错误，与本任务 diff 无关。
- **Follow-up:** 老板确认后从最新 origin/main 隔离工作树执行 PLAN.md 的 WP-00 至 WP-05；生产 WP-06 另行批准。
- **Closed by:** CEO-Orchestrator
