---
schema_version: 1
task_id: "TASK-20260711-001-seatable-repairdesk-import"
title: "SeaTable 维修工单整理与 RepairDesk 导入"
status: "closed"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["INT", "FLOW", "DATA", "SEC", "QA"]
created_at: "2026-07-10T22:04:19Z"
updated_at: "2026-07-16T18:04:44Z"
closed_at: "2026-07-11T08:09:00Z"
---
# Task — SeaTable 维修工单整理与 RepairDesk 导入

## Owner Request

老板要求打开 SeaTable `ChinaTech (1)` 表格，把所有表格、已完成订单、进行中订单、寄修订单等维修记录按 `OGGETTO` / 状态整理，字段包括电话号码、金额、型号、品牌、定金和问题描述，然后导入当前 RepairDesk 项目；同时清空当前项目中老板自己店铺/账号下的测试数据，保留其他店铺数据。

## Business Value

将当前日常维修业务从 SeaTable 迁入 RepairDesk，让 Chinatech 自己店铺的数据成为系统内的真实初始数据，并避免测试数据干扰经营。

## Scope In

- 读取或接收 SeaTable `RIPARAZIONE` 数据。
- 生成导入前整理清单和导入预览。
- 将中文/意大利语状态映射到 RepairDesk 工单主状态和侧状态。
- 在安全范围内准备客户、设备、供应商、维修工单、工单事件导入。
- 仅针对老板目标店铺的测试数据设计清理范围。
- 保留其他店铺和其他店主数据。

## Scope Out

- 未验证备份/恢复前的生产删除或写入。
- 跨店铺清空、全库清表、默认店铺猜测。
- 自动发送 WhatsApp/SMS/邮件通知。
- 迁移 SeaTable 的非维修表、电子产品库存或优惠券，除非另开任务。
- 暴露 SeaTable 登录凭据、Supabase service role 或客户完整 PII 到日志/截图/记忆。

## Acceptance Criteria

- [x] SeaTable 数据已通过登录态读取，或老板提供 CSV/Excel 导出文件。
- [x] 本地导入器支持老板列出的中文状态：正在处理中、已经下单了、到货、到货一通知、修好、修好一通知、完成、作废。
- [x] 本地 dry-run 支持在仓库外私有目录生成强制 `0600` 的整理清单；默认输出是受限假名化数据，完整客户资料或 warning 原始值还需显式私有输出确认。
- [x] 导入预览清单列出每条订单的状态、电话、金额、品牌、型号、定金、问题、留存物品和 warning。
- [x] 生产写入前有目标项目、目标 store_id、目标 owner/membership、备份、恢复/回滚、计数校验和最终确认。
- [x] 生产导入后只读校验确认其他店铺行数未变化，老板店铺行数与预览一致。

## Verified Facts

| Fact | Evidence |
|---|---|
| SeaTable 已通过老板登录态读取。 | Browser title `ChinaTech (1) - RIPARAZIONE`; workspace/view identifiers intentionally omitted |
| `进行中` 视图导出只有 5666 行，不是完整表。 | private filtered-view workbook inspection outside the repository |
| `默认` 视图导出后转换为 CSV，共 6284 条非空源记录。 | private default-view workbook and owner-only CSV outside the repository |
| 初始 dry-run 生成 6284 orders、3664 customers、6284 devices；总报价 EUR 334902.50，定金 EUR 39192.51。 | owner-only pseudonymized dry-run artifact; path intentionally omitted |
| Chrome 扩展后端不可用，无法使用老板本机 Chrome 登录态。 | Browser backend list only has Codex In-app Browser. |
| 当前项目已有 SeaTable 维修 CSV 导入器。 | `scripts/import-seatable-riparazione.ts`; `src/features/orders/import/seatable-riparazione.ts` |
| 导入脚本当前写入模式限制为 local Supabase，并要求 project ref、store id、确认短语和备份目录。 | `scripts/import-seatable-riparazione.ts`; `scripts/lib/supabase-admin-safety.ts`; `docs/SEATABLE_RIPARAZIONE_WORKFLOW_PLAN.md` |
| 生产导入需要独立 staging/import/swap 方案。 | `docs/SEATABLE_RIPARAZIONE_WORKFLOW_PLAN.md` |
| 当时工作区已有 unrelated dirty files，且 `main` 落后 `origin/main` 7 个提交。 | historical intake `git status --short --branch`; superseded by TASK-20260716-004 preservation |
| 只读生产 preflight 已确认目标 project/store/active owner，碰撞为 0；生产结论为 FAIL。 | `/tmp/repairdesk-seatable-import/production-preflight-redacted.json` |
| 20 个三重标记测试工单中，13 个可进入 owner 复核，7 个因额外事件或附件被阻断。 | `/tmp/repairdesk-seatable-import/cleanup-preview-redacted.json` |
| 4 条定金大于报价已按 Owner 批准提高报价至定金，金额违规降为 0。 | `/tmp/repairdesk-seatable-import/import-manifest-v2.json` |
| 生产批次已提交并通过双重回滚演练与独立只读验收。 | `/tmp/repairdesk-seatable-import/production-import-receipt-v2.json` |

## Risk Classification

- R4: 客户 PII、金额、生产数据库删除/写入、租户隔离和跨店铺数据保留。
- L2: 可做本地代码、预览、只读调查和文档；生产删除/写入必须再次确认并满足数据门禁。

## Sub-Agents

- `019f4e0d-7e3c-7510-a4eb-218375683c4d` / Sage / FLOW / read-only / completed. Key conclusion: `到货一通知` maps to `parts_arrived + notify_status=sent`, not pickup/notified; `留下` is ambiguous and should be warning/manual context unless it is `OGGETTO`.
- `019f4e0d-a311-7eb3-8510-2e378567dee3` / Delta / DATA / read-only / completed. Key conclusion: target tables are customers/devices/suppliers/repair_orders/order_events, but production import needs import batch provenance, deterministic IDs, collision checks and no broad clear.
- `019f4e0d-c410-7bb0-982b-e887c55f6db9` / Cipher / SEC / read-only / completed. Key conclusion: production import/reset/delete remains NO-GO; current scripts are not suitable for “only clear test data” because they clear the whole store domain.
- `019f4e4b-388f-71c0-bd6c-c08df4c55866` / Index / DATA / read-only / completed. Key conclusions integrated: deterministic UUID compatibility, money invariant blocker, attachment/payment guards and no raw event payload.
- `019f4e4b-3911-7461-990a-26bb03ab8b14` / Sentinel / SEC / read-only / completed. Key conclusions integrated: active owner/store gate, strict test provenance, PII minimization and no production mutation without recovery evidence.
- `019f4ffb-64a3-7700-bb54-875d879935da` / Gaia / DATA / read-only / completed. Key conclusions integrated: private staging, set-based single transaction, exact test-parent closure and retained rollback provenance.
- `019f4ffb-6537-7fe2-b3be-337ca4e6a4f1` / Aegis / SEC / read-only / completed. Key conclusions integrated: Data API isolation, explicit consent false, audit metadata and PII retention limit.

## Current Blocker

None. The production import and exact test-data cleanup are complete.

## Next Action

The repository package is restored and validated on latest `origin/main` in `codex/seatable-import-closeout-20260716`. Retain the private rollback batch through 2026-07-18; after the rollback window, obtain privacy/data approval before removing private PII staging data. Do not rerun the production import.
