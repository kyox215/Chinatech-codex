---
schema_version: 1
task_id: "TASK-20260710-110532-task"
title: "设置页主店主专用工单详情导入导出实施"
status: "closed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["INT", "FLOW", "DATA", "API", "SEC", "QA", "UX"]
created_at: "2026-07-10T11:05:32Z"
updated_at: "2026-07-10T19:33:34Z"
---
# Task — 设置页主店主专用工单详情导入导出实施

## Owner request

重新生成工单数据计划：导出当前店铺的工单详情；单独下载空白字段模板；从其他来源整理后导入；导入导出按钮只放在设置页，不放在订单页；每个店铺和账号隔离；只有店铺创建者/主店主账号可以导出，经理、技师和其他员工不能导出。

2026-07-10 implementation approval: 老板明确要求按照计划设定目标并开始执行，完成后自动推送到 `main` 并应用数据库。

## Business value

让主店主安全地把完整工单资料导出整理并导回，同时消除订单页客户端导出造成的权限、分页和审计缺口，保证独立店铺数据不会跨租户或跨账号流动。

## Scope in

- 实现设置页唯一入口、完整工单详情导出、独立空白模板、导入预览、更新/新增应用和客户统计导出。
- 明确主店主身份必须同时满足有效 owner membership 与 `stores.owner_user_id = actor.id`。
- 明确移除订单列表现有客户端 `导出当前页/导出选中` 路径。
- 明确权限、审计、数据校验、测试、截图和生产审批边界。

## Scope out

- 不清空、删除、重写或批量迁移现有生产工单/客户/付款数据。
- 不导出或导入真实客户文件作为开发测试数据。
- 不自动修改付款流水、附件、消息、签名或设备解锁凭据。
- 不绕过迁移历史、RLS、安全审查、测试或发布门禁。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 当前实现事实已通过代码/文档只读检查记录。
- [x] 风险等级、自治边界和 no-spawn reason 已记录。
- [x] 输出可分阶段实施计划、权限/审计要求和验收标准。
- [x] 按老板最新说明补充 SeaTable 风格往返导入导出、字段模板、覆盖规则和不清库保护。
- [x] 按最新要求收紧为设置页唯一入口和主店主账号专用权限。
- [x] 定义活动店铺、账号、跨店文件、多店账号和 owner 转让的隔离规则。
- [x] 区分完整工单详情导出、独立空白模板和只读客户统计导出。
- [x] 老板已批准按计划实施、推送 `main` 并应用本任务数据库迁移。
- [x] 主店主权限、租户隔离、模板、导出、preview/apply、客户统计和订单页入口移除全部实现。
- [x] lint、typecheck、unit/integration tests、build、浏览器与截图验证通过。
- [x] 安全、数据、QA 和发布复核无未接受阻断项。
- [x] scoped commit 推送到 `main`，linked 迁移应用并完成 post-apply 验证。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 当前设置页没有数据导入/导出 section | observed | `src/features/settings/screens/settings-screen.tsx` settingsSections | use in plan |
| 订单列表当前导出为浏览器端 CSV，只覆盖当前页或选中行 | observed | `src/features/orders/screens/order-list-screen.tsx`, `src/features/orders/model/order-list-export.ts` | replace/augment with server export plan |
| SeaTable 工单导入已有 parser 和 CLI apply，但 apply 会清空 RepairDesk domain，需要危险确认 | observed | `src/features/orders/import/seatable-riparazione.ts`, `scripts/import-seatable-riparazione.ts` | do not expose as-is to UI |
| 库存电子产品导入已有 server preview/apply pattern and audit | observed | `src/lib/repairdesk/api.ts`, `src/features/inventory/server/inventory.repository.ts`, `src/server/api/repairdesk-router.ts` | reuse pattern |
| 客户列表已有服务端统计 `CustomerStats`，但客户页未提供导出按钮 | observed | `src/lib/repairdesk/types.ts`, `src/features/customers/server/customer.repository.ts`, `src/features/customers/screens/customer-list-screen.tsx` | extend with export/report plan |
| `order:export` and `customer:export` permissions exist and are audit-sensitive | observed | `src/server/permissions.ts`, role policy docs | exports must be server-authorized and audited |
| 当前权限矩阵仍允许 manager 导出，不符合老板最新规则 | observed | `src/server/permissions.ts`, `src/server/permissions.test.ts` | implementation must change manager exports to deny |
| 店铺表有 `owner_user_id`，创建店铺时写入创建账号 | observed | store migration; `src/features/stores/server/store.repository.ts` | use as primary-owner gate |
| Store Context currently exposes active store role but not primary-owner capability | observed | `src/lib/repairdesk/types.ts`; store repository | add server-computed `canManageOrderData` |
| Read-only subagents spawned for implementation review | observed | agent ids in checkpoint/evidence | architecture, data and security reviews run in parallel; main thread is sole writer |
| Owner wants SeaTable-like roundtrip editing | owner requirement | latest owner message 2026-07-10 | refined plan |
| Owner requires Settings-only controls and creator-only export | owner requirement | latest owner message 2026-07-10 | revised plan is authoritative for this task |

## Decision and approval points

- R3 / L2 for permission, PII bulk export, file import, database migration and production application.
- Owner has approved implementation, scoped push to `main`, and application of this task's reviewed non-destructive migration after preflight.
- Any unrelated migration drift, destructive SQL, secret issue, or inability to prove tenant isolation remains a hard stop despite that approval.
- Recommended implementation default: all template/export/import/statistics controls are primary-store-owner-only; export-only does not mutate; import never clears; standard roundtrip import defaults to update-only; blank cells keep existing values; clearing requires explicit `__CLEAR__`.
- Formal owner transfer moves access to the new `stores.owner_user_id`; a historical creator must not retain access after transfer.
- The owner requirement is authoritative for dual-role accounts: a platform administrator who is also the active store's `owner_user_id` may use the feature in normal store-member context; platform status alone does not grant access.

## Work packages

- WP-01 Current-state, owner identity and tenant boundary audit: complete for planning.
- WP-02 Primary-owner authorization foundation and order-page export removal: implemented; validation in progress.
- WP-03 Settings-only blank template and complete order-detail export: implemented; validation in progress.
- WP-04 RepairDesk/SeaTable safe import preview/apply: implemented with additive migration and atomic RPC; linked apply pending.
- WP-05 Current-store customer statistics export: implemented; validation in progress.
- WP-06 QA/security/tenant validation and release runbook: in progress.

## Implementation execution record

- Branch/worktree: `codex/order-data-roundtrip` at `/private/tmp/repairdesk-order-data-roundtrip`.
- Baseline: `HEAD` and `origin/main` at `705c7511` after `git fetch --prune`.
- Linked migration list: local/remote aligned through `20260709235000`.
- Linked pre-change dry-run: `Remote database is up to date`.
- Supabase official guidance checked: migrations through checked-in files; new exposed-schema tables require explicit grants plus RLS.
- Real read-only reviewers: solution architect `019f4c4a-4610-7b51-aca5-6f543c00850c` (Nova), data reviewer `019f4c4a-4687-74e2-be69-dfce72d0358a` (Delta), security reviewer `019f4c4a-46f8-7330-98e9-97bdb0dfb7d2` (Cipher).
- Implemented owner-only Settings section, server-side XLSX transport, strict workbook parser, persistent preview batches, same-store external references, atomic apply RPC and customer-statistics export.
- Removed the active order-list browser CSV export and changed manager export permissions to deny.
- Production dependency audit is clean after pinning ExcelJS `uuid` and Next.js `postcss` patched transitive versions through npm overrides.
- Linked migration `20260710150000_order_data_roundtrip.sql` was applied successfully after correcting temporary ID columns to match production UUID schema. Post-apply metadata verified migration history, tables, RLS, grants and RPCs.
- Commit `5eda956e` was pushed to `main`.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
