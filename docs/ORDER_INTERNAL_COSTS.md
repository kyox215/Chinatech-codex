# 维修项目内部成本与经营毛利

## 功能边界

当前应用已移除订单专用内部成本入口：新建订单不再提交成本字段，订单详情、默认成本设置和对应 API 路由均已停用。数据库历史表、触发器及投影维护仍保留，以支持历史审计；库存采购成本、配件分配、利润、导出和回填工具继续按各自权限运行。本次应用退役不代表数据库结构或历史数据退役。

维修项目内部成本是店铺敏感数据，和客户报价分开保存。设置页“默认规则”中的默认成本只会在新订单项目创建时生成快照；修改默认值不会改写已有订单。空白表示未知成本，`0` 表示明确零成本。第二期在第一期快照上增加成本状态、来源、修订、采购批次和原始币种证据；所有历史金额采用不可变 EUR 快照，不能因为后来修改默认成本、采购价或汇率而重算。

第二期提供的是维修业务经营毛利，不是会计净利润，也不处理 VAT、工资、房租、税费等间接成本。客户报价、收款与门店利润汇总仍以 EUR 为基准。客户消息、打印、普通订单列表、普通订单详情 DTO、实时广播与离线 IndexedDB 均不得包含成本值、采购价或汇率。

## 第二期能力

- 利润中心：区分预计报价毛利、已交付报价毛利与收款参考，显示未知/估算/确认成本覆盖率、负毛利、趋势和无客户 PII 的明细下钻。未知成本不能按零参与精确毛利。
- 配件采购：维护店铺私有配件目录和供应商采购批次；授权人员将批次分配给订单项目，扣减库存并保存实际成本快照，释放时写补偿流水而不删除历史。
- 成本导出：仅导出最小化维修财务字段，限制日期、筛选数量和最多 10,000 行；CSV 防公式注入，审计只记录筛选摘要、行数和内容哈希，不保存财务明细。
- 历史回填：Owner/授权 Manager 可预览，只有 Owner 可分批应用或补偿撤销；仅使用订单创建时已生效的历史默认版本，找不到证据时保持未知。部署不会自动创建或执行回填运行。
- 多币种采购：内部采购固定支持 EUR、USD、GBP、CNY、CHF。Owner 离线维护“1 原币 = X EUR”的汇率；EUR 永远等于 1，非 EUR 汇率超过 30 天会阻止新收货。系统不连接外部汇率服务。

## 权限

- `owner` 固有全部第二期财务能力，包括 `finance:cost_backfill_apply` 和 `finance:currency_manage`。
- `manager` 默认没有敏感财务权限，只能由店主单独授予允许的能力：`finance:profit_read`、`finance:cost_manage`、`finance:cost_export`、`finance:cost_backfill_preview`、`inventory:cost_allocate` 和 `supplier:read`。
- `technician`、`sales`、`viewer` 不能获得这些成本权限；伪造 grant 必须被权限矩阵拒绝。
- 导出依赖利润读取，回填预览依赖成本管理，配件成本分配依赖成本管理；批量回填应用和汇率管理始终是 Owner-only。
- 未获授权时，前端不挂载对应组件、不发敏感请求，也不显示成本文案。服务端仍在路由、服务层和数据库 RPC 三层独立校验权限与店铺范围。

## 数据、并发与审计

- `store_fault_cost_defaults` 保存当前默认成本；`store_fault_cost_default_revisions` 保存有效期历史。
- `repair_order_line_costs` 保存当前订单项目成本投影；`repair_order_line_cost_revisions` 追加保存每次修订。移除的报价项目只标记 `is_active=false`，不删除证据。
- `fault_prices` 只增加非敏感的 `line_id` 和 `catalog_key`；成本值不进入 JSON 报价字段。
- `parts_catalog_items`、`parts_purchase_lots`、`order_part_allocations` 与 `part_stock_movements` 保存目录、不可变采购快照、订单分配和补偿库存流水。
- 回填运行与候选是店铺私有控制数据；预览不修改订单业务数据，应用使用运行 ID、幂等键、预期版本、订单哈希和整单批次锁避免覆盖新修改。
- 默认成本保存、订单成本修正和采购分配使用版本/锁/幂等约束。并发不一致时必须刷新或报告冲突，不能覆盖他人修改。
- 成员权限替换与 `update_member_permissions` 审计在同一个 `SECURITY DEFINER` RPC 事务内完成；审计写入失败时授权变更必须整体回滚。
- 第二期表启用 RLS 且不直接授权 browser roles；敏感操作通过精确授权的服务端 RPC 执行。导出、回填、成本修订、收货、分配、释放和汇率变更都保留最小化审计证据。

## 功能开关

父开关 `REPAIRDESK_ORDER_COSTS_ENABLED` 只有精确等于 `1` 时才开放内部成本。第二期子能力各自 fail-closed，且父开关关闭时全部无效：

- `REPAIRDESK_PROFIT_REPORTS_ENABLED`
- `REPAIRDESK_PARTS_PROCUREMENT_ENABLED`
- `REPAIRDESK_COST_EXPORT_ENABLED`
- `REPAIRDESK_COST_BACKFILL_ENABLED`
- `REPAIRDESK_COST_MULTI_CURRENCY_ENABLED`

生产首次发布时全部子开关保持 `0`。回填工具即使启用也不会自动应用历史数据；真实回填必须由 Owner 查看预览并在应用内显式确认。

## 当前生产状态（2026-07-18）

- 第一、二期数据库迁移均已应用，linked dry-run 为 up to date。
- 业务版本 `main@b8932b2c` 已部署到生产；五个第二期子开关仍未配置并保持 fail-closed。
- 生产没有自动创建采购、分配、库存流水或历史回填记录，也没有运行真实历史成本回填。
- （2026-07-18 历史记录）当前可见行为仍是第一期：获授权最高管理人员可在新建订单的维修项目中输入内部成本和客户报价，并在设置中维护默认成本；低权限用户继续看不到成本。

### 2026-09-05 本地候选状态

当前本地候选已移除第一期订单成本录入与默认值维护入口；历史数据和数据库投影继续保留，库存采购成本及利润、导出、配件分配、回填、多币种工具仍按各自权限开放。该候选尚未发布。

- 利润中心、成本导出、配件采购、历史回填和多币种采购必须在新的审批/验证任务中逐项启用，不能因 schema 已存在而视为开放。

## 发布顺序与停止条件

1. 获取串行 release lock，重新 fetch `origin/main`，固定候选提交和操作者。
2. 重新读取 linked migration history；精确 dry-run 必须只包含本任务的六个第二期 migration。
3. 按 Database Application Gate 记录当前备份/PITR、隔离恢复证明、回滚负责人和维护窗口。任何无关 migration、恢复证明缺失、历史链不可恢复或未处置的 browser-role 暴露都必须停止生产写入。
4. 先应用迁移，立即核对 migration history、表、约束、索引、RLS、ACL 和 RPC grants。迁移均为加法式，旧代码应继续工作。
5. 再把同一候选提交快进到 `main` 并部署同一 SHA；所有第二期子开关继续关闭。
6. 在 schema 后检通过后逐个启用所需子能力；分别用 Owner、获授权 Manager 和未授权角色验证显示、请求与拒绝路径。
7. 检查运行时错误、跨店异常、负库存、重复分配、未知成本误计和导出/回填审计。观察窗口通过后才关闭发布任务。

禁止使用 `--include-all` 绕过迁移顺序漂移，禁止在发布脚本中自动运行历史回填，禁止因本地 schema-clone 通过而跳过 linked 数据库恢复与安全门禁。

## 回滚

优先将对应子开关设为 `0`，必要时关闭父开关并回滚应用部署。迁移为加法式；为保留审计和成本证据，紧急回滚不得删除成本、采购、汇率、导出或回填记录。已应用的历史回填只能通过受控补偿撤销，并且遇到后续人工修改时必须停止而不是覆盖。数据库问题使用经过审查的 forward fix。

## 迁移清单

第一期已应用：

- `20260718120000_order_cost_defaults.sql`
- `20260718121000_order_cost_permission_audit_atomic.sql`

第二期已应用（运行能力仍默认关闭）：

- `20260718122000_order_cost_phase2_ledger_permissions.sql`
- `20260718123000_order_cost_phase2_profit_reports.sql`
- `20260718124000_order_cost_phase2_parts_procurement.sql`
- `20260718130000_order_cost_phase2_cost_export.sql`
- `20260718133000_order_cost_phase2_history_backfill.sql`
- `20260718140000_order_cost_phase2_multi_currency.sql`
