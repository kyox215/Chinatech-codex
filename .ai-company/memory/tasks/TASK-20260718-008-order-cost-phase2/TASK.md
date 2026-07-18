---
schema_version: 1
task_id: "TASK-20260718-008-order-cost-phase2"
title: "订单成本第二期分阶段实施与发布"
status: "active"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
departments: ["API", "DATA", "DOC", "FE", "FLOW", "QA", "RELEASE", "SEC", "UX"]
created_at: "2026-07-18T10:18:13Z"
updated_at: "2026-07-18T14:38:02Z"
---
# Task — 订单成本第二期分阶段实施与发布

## Owner request

按照已经批准的第二期规划设置正式目标，把工作拆成独立小阶段；每个阶段写成一个 Markdown 文件，完成实现和验证后记录检查点并继续下一阶段。全部阶段通过后，精确应用本任务迁移，推送 `main`，部署应用并完成生产观察。

## Business value

将已上线的订单内部成本升级为可追溯、可统计、可关联采购、可安全回填与多币种折算的经营毛利系统

## Scope in

- 在第一期 `store_fault_cost_defaults`、`repair_order_line_costs` 和稳定 `line_id` 基础上增加成本来源、确认状态、修订历史和原始币种快照。
- 新增 Owner/授权 Manager 使用的利润中心：预计/已实现维修毛利、趋势、完整性、负毛利和明细下钻。
- 新增轻量维修配件目录、采购批次、供应商与订单项目成本分配；实际批次成本优先，默认成本兜底。
- 新增受权限控制且经过审计的成本/利润 CSV 导出。
- 新增历史订单成本回填的预览、候选、分批应用和按运行撤销能力；未知成本不得按零处理。
- 新增采购成本原始币种和 EUR 汇率快照；客户报价和门店报表仍以 EUR 为基准。
- 新增服务端权限、租户隔离、输入校验、审计、测试、文档、截图和发布证据。
- 在独立工作树完成，逐阶段验证，最后进行精确 linked migration、快进推送、Vercel 生产部署和观察。

## Scope out

- 会计净利润、VAT 申报、工资/房租/水电/税费等间接费用核算。
- 自动创建供应商订单、自动付款、自动抓取外部汇率或引入付费第三方服务。
- 自动批量修改生产历史订单成本；发布只交付受控回填工具，真实应用必须由 Owner 在预览后显式触发。
- 把成本写入普通订单 DTO、打印、客户消息、Realtime、离线 IndexedDB 或低权限缓存。
- 删除第一期表、改写历史迁移、无关重构、依赖升级、客户外部通信和任何无关的脏工作区改动。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 主线程是唯一代码、数据库、Git 和部署写入者；子代理只读复核。
- 所有 schema 变化必须 additive、RLS 开启、browser role 默认无直接表权限、RPC 精确授权。
- 每个阶段完成相关验证并写检查点后才能进入下一阶段。
- 未知成本与显式零成本严格区分；估算成本与确认成本严格区分。
- 历史金额和汇率采用快照，不因未来默认成本、采购价或汇率变化而重算。
- 生产写入前重新获取 remote、linked migration history、精确 dry-run、恢复/回滚证据和串行发布锁。

## Acceptance criteria

- [x] 每个阶段有独立 Markdown 合同、验证证据和检查点
- [x] 利润报表与趋势不把未知成本当作零，并遵守角色和门店隔离
- [x] 供应商、配件采购批次与订单项目成本可追溯且不会静默改写历史
- [x] 导出、历史回填和多币种均具备权限、审计、幂等及回滚边界
- [ ] 完整门禁通过后精确应用本任务迁移、快进推送 main、部署并完成生产观察

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 第一阶段已在生产发布 | verified | `docs/ORDER_INTERNAL_COSTS.md`; Phase 1 TASK/EVIDENCE; commits `fa6bf5c4`, `09b78664`, `3e969dd4` | 作为第二期基线 |
| 当前最新远端基线 | verified | isolated worktree rebased to `origin/main@0c474318` | 所有写入在隔离分支完成 |
| 普通报价仍固定 EUR | verified | `src/lib/money.ts`; Zod literal EUR | 第二期只扩展内部采购成本原币种 |
| 现有库存主要是二手设备 | verified | `InventoryItem` 设备字段与 `inventory_transactions` | 配件库存使用独立轻量模型 |
| 利润口径 | owner-approved plan default | 经营毛利，不是会计净利润 | 代码和 UI 必须明确命名 |
| 历史回填生产执行 | unsafe assumption | 无逐条可靠成本证据 | 只交付工具，不自动执行生产回填 |
| 生产迁移恢复门禁 | open risk | `OPEN_CONFLICTS.md` CONFLICT-20260619-006/011 | 发布前重新核验；失败则停止生产写入 |

## Decision and approval points

- Owner 已批准本目标的阶段实施、验证、必要迁移、`main` 推送和应用部署。
- D1/D2：目录、组件、测试、加法式 schema 和默认关闭的功能开关由 Integration Lead 在合同内决定。
- D3：生产 linked migration、开关启用和部署仅在全部门禁通过后按 Owner 本次授权串行执行。
- D4 保留：数据删除、真实历史成本批量回填、付费汇率服务、会计/VAT 口径、权限例外均不在本次自动执行授权内。

## Work packages

- `00_BASELINE_AND_EXECUTION_CONTRACT.md`
- `01_COST_LEDGER_AND_PERMISSIONS.md`
- `02_PROFIT_REPORTS_AND_TRENDS.md`
- `03_SUPPLIER_PARTS_COST_LINKING.md`
- `04_EXPORT_AND_HISTORY_BACKFILL.md`
- `04A_COST_EXPORT.md`
- `04B_HISTORY_BACKFILL.md`
- `05_MULTI_CURRENCY_COSTS.md`
- `06_QUALITY_SECURITY_AND_RELEASE.md`
- `07_PRODUCTION_RELEASE_AND_OBSERVATION.md`

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
