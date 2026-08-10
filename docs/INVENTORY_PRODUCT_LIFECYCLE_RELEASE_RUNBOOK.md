# 商品库存全生命周期实施与发布手册

状态：代码已实现，默认关闭；生产数据库迁移和门店激活必须单独通过门禁。

## 1. 目标

本功能把商品身份、库存、销售、付款、交付、保障和售后拆成独立但关联的事实，支持：

- 在售商品建立客户预订，默认 7 天有效并记录预计取走时间；
- 定金、尾款、退款和冲正使用追加式账本，历史款项不可覆盖；
- 结清后完成销售，未结清时普通员工不可确认取走；
- 实际取走时间独立记录，商业保修默认从该时间开始，默认月数由门店设置提供；
- 法定保障与商业保修分离，商业保修调整产生新版本；
- 售后/返修建立独立案件，不覆盖原销售、付款或首次交付事实；
- 手机、平板、电脑、游戏机等设备支持结构化检测；Apple 设备支持电池健康度、Face ID、Touch ID、原彩、激活锁等状态，空值表示未知；
- UI 的写按钮仅依据服务端 `allowed_actions` 显示，不从旧状态字段自行推断权限。

SeaTable 是只读外部参考源。本发布不连接、不回写、不导入或修改 SeaTable 数据。

## 2. 状态与业务规则

### 2.1 组合业务状态

服务端把库存单元、销售单、实际取走和活动售后案件投影为：

- `in_stock`：在售；
- `reserved`：已预订；
- `sold_pending_pickup`：已成交待取；
- `delivered`：已实际取走；
- `after_sales`：存在未关闭售后案件；
- `removed`：已取消、回收或移出正常销售。

### 2.2 核心不变量

1. 同一库存单元只能有一张活动销售单。
2. 预订必须绑定同门店客户；免定金只允许负责人并要求原因。
3. 正向付款累计不得超过约定售价。
4. 成交要求精确余额为零，且销售时间不得早于预订或最近正向付款。
5. 销售事务同时写 V2 movement、兼容交易、sale ledger、库存事件与审计。
6. 欠款取走只允许有权限的负责人，并写入独立例外账本、余额和原因。
7. 取消预订只记录 `refund_pending`、`retain` 或 `pending`，不会伪造已退款事实。
8. 检测、付款、保修版本、取货例外和售后事件均为追加式证据。
9. 同一销售单最多一个未关闭售后案件。
10. 每条命令携带幂等键和期望版本；冲突返回 409，客户端刷新后恢复。

## 3. 数据对象

Expand migration：`supabase/migrations/20260807120000_inventory_product_lifecycle.sql`

新增对象：

- `inventory_product_acquisitions`
- `inventory_device_inspections`
- `inventory_sale_orders`
- `inventory_sale_payment_entries`
- `inventory_pickup_override_ledger`
- `inventory_warranty_versions`
- `inventory_after_sales_cases`
- `inventory_after_sales_events`
- `inventory_lifecycle_command_ledger`
- `repairdesk_inventory_lifecycle_command(...)`

Enable migration：`supabase/migrations/20260807120100_inventory_product_lifecycle_enable.sql`

Expand 默认不授予浏览器写权限。九张表启用 RLS；`service_role` 仅有 SELECT，写入只能通过固定空 `search_path` 的 SECURITY DEFINER RPC。Enable 会重新验证列型、同店索引、RLS、ACL、函数 owner、安全属性和 `search_path`，任何不一致都失败关闭。

## 4. 应用边界

### 4.1 BFF 命令

统一入口：`POST /api/repairdesk/inventory/lifecycle/command`

命令：

- `acquisition.save`
- `inspection.save`
- `reservation.create`
- `payment.append`
- `sale.complete`
- `pickup.confirm`
- `reservation.cancel`
- `warranty.adjust`
- `after_sales.create`
- `after_sales.update`
- `after_sales.close`

请求体上限 48 KiB，并限制 JSON 深度、节点、键和字符串长度。门店和员工身份只从认证上下文注入，浏览器不能指定 `store_id` 或 `actor_id`。

### 4.2 只读投影

- `inventory/lifecycle/summary`：按商品读取最小摘要与允许动作；
- `inventory/lifecycle/sale`：按销售单读取约定价、累计已收、余额、交付、保修和活动售后；
- `inventory/lifecycle/after-sales`：读取当前门店活动售后队列；
- `inventory/lifecycle/after-sales/case`：读取案件及最小事件历史。

投影不返回客户姓名、电话、完整设备标识、进价、付款引用或付款备注。查询键包含当前门店作用域。

## 5. UI 信息架构

保留“商品库存”单一主入口：

- `/inventory`：图形化 KPI、移动卡片、桌面原生表格；
- `/inventory/[id]`：当前业务、唯一下一步、设备健康和检测录入；
- `/inventory/[id]/reserve`：选择客户、成交价、定金、支付方式、到期和预计取走；
- `/inventory/reservations/[reservationId]`：预订、追加收款、取消；
- `/inventory/sales/[saleId]`：成交、取走、保修和售后登记；
- `/inventory/after-sales`：返修队列；
- `/inventory/after-sales/[caseId]`：检测、保障判断、返还和关闭。

移动端使用 RepairOS Floating Card，关键触控目标至少 44px；桌面库存表不超过六列。付款、成交、取走、取消和售后结果在页面持续显示，不只依赖 Toast。

## 6. 功能开关

所有开关默认 `0`：

- `INVENTORY_LIFECYCLE_SCHEMA_READY`
- `INVENTORY_LIFECYCLE_COMMANDS`
- `INVENTORY_LIFECYCLE_UI`
- `INVENTORY_LIFECYCLE_ALL_STORES_ENABLED`
- `INVENTORY_LIFECYCLE_STORE_ALLOWLIST`
- `INVENTORY_LIFECYCLE_STORE_DENYLIST`

应用部署不能自动执行迁移。全部开关关闭时：

- 现有商品列表、录入、详情和编辑保持原行为；
- 商品详情不请求生命周期表，也不显示功能关闭警告；
- 新工作流直达路由显示受保护的不可用状态；
- 不产生任何生命周期数据库写入。

## 7. 发布顺序

生产启用必须按以下顺序，禁止跳步：

1. 固定待发布 Git SHA、迁移文件 SHA256 和目标 Supabase 项目 ID。
2. 只读核验生产迁移目录、表列型、同店唯一索引、函数 owner、ACL/RLS 和历史迁移 lineage。
3. 获得可验证的生产备份与恢复演练证据，记录 RPO/RTO、负责人和回滚窗口。
4. 在 PostgreSQL 17 同构临时库原样执行 expand、enable 和 pgTAP。
5. 生产先应用 expand，保持所有开关关闭；核验表为空、RLS 开启、无浏览器 grant。
6. 应用 enable；核验仅 `service_role` 可执行 RPC，九张表仍无直接 DML。
7. 仅允许 Chinatech 门店进入 allowlist，并打开 `SCHEMA_READY` 与 `UI`，观察只读投影。
8. 再打开 `COMMANDS`，使用专用脱敏测试商品验证预订到售后主链和 reconcile。
9. UI 继续限于同一 allowlist；执行移动/桌面浏览器 smoke、日志和错误率观察。
10. 其他门店保持关闭；不得使用 `ALL_STORES=1` 作为首次上线方式。

## 8. 当前生产门禁

本次应用代码允许在全部开关关闭的前提下部署。以下条件未关闭前，生产数据库迁移和激活为 NO-GO：

- 生产迁移目录存在未纳入当前 Git 主线的 SeaTable 相关迁移，lineage 需要独立核对；
- 既有恢复基线冲突仍开放，尚无本功能范围的物理恢复演练；
- 生产 `store_restore_proofs` 和相关导出证据为空；
- 17 张旧表存在 RLS 未启用的历史安全债，不能在本功能中静默扩大处理范围。

上述问题需要独立的数据/恢复治理任务，不得在本发布中改写历史迁移或删除生产对象。

## 9. 验证清单

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- PostgreSQL 17 expand：事务内成功并回滚
- expand + enable + `supabase/tests/inventory_product_lifecycle.sql`
- 超付、时间因果、exact-balance、幂等、欠款取走、售后唯一性行为测试
- ACL：九表 `service_role` 仅 SELECT，anon/authenticated 无授权
- 390/430/768/1024/1280/1440 响应式检查及 `scrollWidth <= innerWidth`
- 官方域 `/inventory` 与六条新路由 smoke
- Vercel READY、函数日志/控制台/网络错误检查、无 PII 截图

## 10. 回滚

应用回滚：把 UI、commands、schema/read 开关全部设为 `0`，回滚至记录的上一 Vercel READY deployment。

数据库回滚：先撤销 RPC execute 并关闭开关；保留追加式付款、保修、取货例外和售后历史。禁止通过删除记录来“回滚”财务或保障事实。若 expand 已应用但尚无业务数据，可在独立批准、备份和目录验证后制定 drop 迁移；不得临时手工删除生产对象。

## 11. 明确不在本次范围

- SeaTable 历史导入、状态自动清洗或双向同步；
- 跨门店批量激活；
- 自动退款、自动没收定金或自动释放过期预订；
- AI 自动判断设备检测或保障责任；
- 旧表 RLS、历史迁移 lineage 和恢复治理的跨任务修复。

## 12. 商品检测 Phase 1（独立门禁）

商品检测不是生命周期 UI 或 commands 的隐式子开关。新增检测编排与表结构
必须在完整 V2/lifecycle migration 序列中 rehearsal 后，才允许设置：

- `INVENTORY_PRODUCT_INSPECTION_SCHEMA_READY`
- `INVENTORY_PRODUCT_INSPECTION_ENABLED`
- `INVENTORY_PRODUCT_INSPECTION_ALL_STORES`
- `INVENTORY_PRODUCT_INSPECTION_ALLOWLIST`
- `INVENTORY_PRODUCT_INSPECTION_DENYLIST`

常规商品保存不带 `inspection` 时必须继续走旧商品 RPC，省略检测不得查询检测表。
带检测的商品与检测必须经单一 service-role 编排 RPC 在一个 PostgreSQL 事务中完成；
`inventory:inspection` 权限与普通商品保存权限分离，销售角色即使能保存商品也不能
携带检测。Phase 1 只接受 `battery_health`（0–100 或 null）与四态
`face_id_status`；Touch ID、True Tone、激活锁、抹除和 IMEI 检测仍关闭。

目录能力必须是显式元数据；未知或手工型号默认无能力。iPhone/iPad/MacBook 的电池
能力和明确 Face ID 机型矩阵见代码目录测试，桌面 Mac 设备默认无电池能力。

### 12.1 当前窄授权迁移合同

商品检测生产序列固定为：

1. `20260810173524_inventory_product_inspection_atomic_20260810150000.sql`：自包含、追加式
   `inventory_device_inspections`、同店约束/复合 FK、最新检测索引、追加式专用
   幂等 ledger 和 dormant `SECURITY DEFINER` wrapper；此步不授予浏览器或
   `service_role` 直接 DML，也不启用任何 lifecycle command/UI。
2. `20260810173610_inventory_product_inspection_atomic_enable_20260810150100.sql`：只在对象、列型、
   约束、RLS、append-only trigger、索引、owner、`search_path` 和完整 ACL preflight
   通过后，授予 `service_role` wrapper `EXECUTE` 和两张检测表 `SELECT`。

生产 manifest 只允许上述精确的 `20260810173524 → 20260810173610` 顺序；远端迁移名中
保留的 `20260810150000` / `20260810150100` 仅作为来源迁移 provenance；
`20260806222149_authenticated_toolkit_library.sql`、
`20260807120000_inventory_product_lifecycle.sql`、
`20260807120100_inventory_product_lifecycle_enable.sql` 均明确排除，不得混入、重排或
作为前置依赖。不得做 migration repair、修改历史迁移或用 repair 标记掩盖 lineage
差异；任何历史 lineage 差异必须在临时 PostgreSQL 17 rehearsal 中 fail closed。

`20260807120000`/`20260807120100` 生命周期迁移不属于本次生产序列。若未来迁移先以
`CREATE IF NOT EXISTS` 建立检测表，`20260810173524` 仍会用显式幂等 DO block 补齐
`inventory_device_inspections_unit_item_same_store_fkey`，因此两条 lineage 都必须在
PostgreSQL 17 临时库 rehearsal：既验证 `20260810173524 → 20260810173610`，也验证“未来 lifecycle
先建表 → 20260810173524 → 20260810173610”。

可执行的 rollback-only 行为演练位于
`supabase/tests/inventory_product_inspection_atomic.sql`，覆盖 PG17、RLS/ACL、检测
字段 fail-closed（`battery_health` 的 0/100/null）、角色与跨店边界、sales 普通保存
与带检测拒绝、同 actor replay、actor binding、CAS 冲突及外层异常回滚。演练必须在
临时库或 staging 执行，外层事务最终 `ROLLBACK`，禁止指向生产。
