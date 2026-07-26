# Inventory Product V2 Release Runbook

## 当前发布形态

本次是 additive、fail-closed 的首个可发布纵向切片：

- 新增目录、型号、单台库存、多标识符、库存移动和幂等命令账本。
- 新增原子入库与原子全额售卖 RPC，但 migration 默认撤销所有运行时 `EXECUTE`。
- 新增店主/店长可调用的只读 V1/V2 影子对账 RPC；仍只通过服务端 `service_role` 访问。
- 新增 `/inventory/new` 六步页面；V2 未开放时自动回到 `/inventory?new=1`。
- V1 表、历史、回收证据、客户关系、旧入口和旧写入默认全部保留。
- AI 只生成候选；员工勾选“确认应用”后才进入页面草稿，仍不能直接正式写入。

因此，代码推送和自动 Web 部署不会让 V2 在生产门店生效，也不会要求生产数据库立即变更。

## 欧洲手机目录（2026-07-26）

`TASK-20260726-002-eu-phone-catalog` 在现有字符串合同上加入了只读、版本控制的欧洲手机目录：

- 手机入库按品牌 → 型号 → RAM / 容量 / 颜色联动选择；目录按 UTC 日历日滚动保留近十年机型。
- 颜色同时显示官方名称和有边框的物理色块；色块 CSS 值不会进入 API 或数据库。
- 找不到品牌、型号或配置时始终可手动填写，目录异常不得阻断入库。
- 精确人工确认目录项才写 `standard`；手动值写 `unstandardized`；AI 候选仍写 `needs_review`。
- 不新增 migration、不回填历史库存、不改变权限/RPC/功能开关；回滚只需回退 Web 版本。

目录数据、来源和维护规则见 [`EU_PHONE_CATALOG_DECLARATION.md`](./EU_PHONE_CATALOG_DECLARATION.md)。

## 当前生产状态（2026-07-18）

- 四份 linked migrations `20260718174042`、`20260718175622`、`20260718181148`、`20260718195257` 已按 Owner 批准顺序应用；最终 linked dry-run 为 up to date。
- 仅 Chinatech 门店进入 allowlist；`SCHEMA_READY`、`SHADOW_READ`、`COMMANDS`、`UI` 已启用，`LEGACY_MUTATIONS_ENABLED` 继续为 `1`。
- 正式域名已验证桌面与手机六步录入、型号/唯一标识输入和 V1 fallback；生产 rollback-only canary 最终零残留，对账 `healthy=true`。
- AI 图片识别步骤仍保留为可选入口，但没有启用图片供应商或付费调用；员工可跳过 AI 手工扫码/输入。
- 当前状态的审计证据、截图和回滚结果以 `TASK-20260718-013-inventory-v2-production-canary` 为准。第二门店扩量、AI 供应商启用、V1 关闭或数据清理仍需新的 Owner 批准。

## 多店铺应用代码状态（2026-07-24）

`TASK-20260724-001-multistore-feature-availability` 已加入可回滚的全店铺发布策略，但没有修改生产环境：

- `INVENTORY_V2_ALL_STORES_ENABLED=1` 只在 schema、commands/UI 等父开关已开启时生效；`INVENTORY_V2_STORE_DENYLIST` 始终优先，可立即隔离单店。
- 通过全店铺开关新增的门店，rollout 资格只给 `owner` / `manager`；V2 入库因包含采购成本与标价，还必须具备 `inventory:cost_allocate`，销售则继续要求 `inventory:sale`。同一字段权限也适用于精确 allowlist 门店，不能用旧试点资格绕过财务权限。
- V2 数据库依赖错误只向客户端返回稳定的 `INVENTORY_V2_DEPENDENCY_UNAVAILABLE`，不转发 Supabase/PostgreSQL 原始错误文本。
- 两个 V2 JSON 命令在 `Content-Length` 和无长度流式请求上都限制为 64 KiB，超限在 repository 调用前返回 413。
- V1 页面与旧写入保持可用；本次不关闭 legacy mutation、不迁移、不删除数据。

这表示应用代码已具备逐店或全店铺灰度能力，不表示生产已经全量开启。全量开关仍是 D4 生产变更，必须先完成每店对账、权限抽查、审计时间策略确认和回滚演练。

## 单台手机完整工作流（2026-07-26，已应用生产）

`TASK-20260726-001-inventory-phone-sales-complete` 已发布完整手工入库后的原子检测、整备、待售、上架与单台售出闭环：

- `20260726181436_inventory_v2_workflow_expand.sql` 只新增追加式工作流幂等账本、原子 RPC 和售出数据库门禁；RPC 默认对所有角色撤销执行权。
- `20260726181537_inventory_v2_workflow_enable.sql` 在授权前强制检查所有 V2 marker 的 unit 关联、状态、采购成本和挂牌价投影；存在任何不一致即中止，不自动改写历史。
- `20260726182246_inventory_v2_workflow_production_type_compat.sql` 为生产受约束 `text` 字段提供仅 `service_role` 可用的兼容别名；不改变列类型、不回填、不重写历史行。
- `20260726182556_inventory_v2_workflow_fk_indexes.sql` 补齐工作流账本三组外键的覆盖索引。
- 新工作流以 V1 `updated_at` 与 V2 `version` 双 CAS 锁定同一台手机；检测、价格/成本、保修、状态、事件、审计和幂等结果在同一事务完成。
- 新 RPC 只允许 `intake → evaluating → refurbishing/ready_for_sale → listed` 的非数量流程；预订、售出、退货、报废和取消不能借此绕过库存移动。
- 售出继续使用现有原子销售 RPC；V2 单台手机的旧更新、旧检测、旧状态和旧销售入口均 fail closed。
- 保修月数仍由 V1 `inventory_items` 持有；V2 当前没有独立保修列，文档和 UI 不得声称它已双模型存储。

Owner 明确批准后，四份迁移已按生产历史版本应用。生产回滚型事务已真实走通“手工录入 → 检测 → 待售 → 商业信息更新 → 单台售出”，V1/V2 状态、采购成本与挂牌价一致，工作流账本 3 条、销售账本 1 条；事务回滚后 V2 marker、测试商品、测试库存单元与工作流账本均为 0。最终 lint、类型检查、359 个测试文件 / 2391 项测试和 27/27 页面生产构建通过。

## 功能开关

默认值：

```text
INVENTORY_V2_SCHEMA_READY=0
INVENTORY_V2_SHADOW_READ=0
INVENTORY_V2_COMMANDS=0
INVENTORY_V2_UI=0
INVENTORY_V2_ALL_STORES_ENABLED=0
INVENTORY_V2_STORE_ALLOWLIST=
INVENTORY_V2_STORE_DENYLIST=
INVENTORY_LEGACY_MUTATIONS_ENABLED=1
```

层级约束：schema ready → shadow/commands/UI → denylist → all-stores / exact allowlist。denylist 始终获胜；all-stores 只有精确值 `1` 才生效；`*` 没有通配语义。任意父开关关闭时，子能力保持关闭。正式切换前不得关闭 legacy mutations。

## 生产启用门禁

1. 在隔离环境对 linked migration 执行 dry-run，确认只新增对象且没有未预期 migration 漂移。
2. 完成可恢复备份/导出、恢复演练和 migration history 核对。
3. 严格按 linked history 应用候选链：独立且默认休眠的 AI 成本治理 migration、V2 foundation、V2 identity、V2 service-role grants；不得使用 `--include-all` 绕过顺序。
4. 验证表、复合外键、索引、RLS、table grants、函数 `security invoker` 与空 `search_path`；只向 `service_role` grant 两个命令 RPC 和一个只读对账 RPC 的 `EXECUTE`，不得 grant 给 `anon` 或 `authenticated`。
5. 先设置 `SCHEMA_READY=1`，再为 Chinatech allowlist 设置 `SHADOW_READ=1`；由店主/店长调用 `POST /api/repairdesk/inventory/v2/reconciliation`，要求 `healthy=true` 且所有 mismatch 为 0。
6. 将一个测试门店加入 allowlist，再开启 `COMMANDS=1` 与 `UI=1`。不要从单店直接跳到 `ALL_STORES_ENABLED=1`。
7. 验证六步入库、重复标识、网络重试、并发版本、原子售卖、客户关联、财政状态、打印失败和权限拒绝。
8. 观察窗口内保持 V1 可写和可回滚；达到批准指标后逐店扩大。只有所有 active 门店都完成 owner/manager 命令、角色拒绝、影子对账和审计验证后，才可另行批准全店铺开关。
9. 启用单台手机工作流时，先只应用 expand migration 并核对业务表行数不变；运行 marker/unit/status/金额只读预检为 0 后，才允许应用 enable migration。
10. 对工作流执行同 key 重放、同 key 冲突、V1/V2 stale、状态矩阵、质量门禁、事务故障注入以及与 sale RPC 的双会话并发测试；任一零写/无死锁条件不满足即停止。

## 回滚

- UI/命令异常：先设 `INVENTORY_V2_UI=0`、`INVENTORY_V2_COMMANDS=0`，立即回到 V1；不要删除 V2 数据。
- 单店异常：先把门店精确 ID 加入 `INVENTORY_V2_STORE_DENYLIST`；若仍不能隔离，再关闭全店铺开关。保留账本和事件作调查证据。
- allowlist 灰度的数据对账异常：移除对应门店 allowlist，保留账本和事件作调查证据。
- RPC 风险：撤销 `service_role` 的 RPC `EXECUTE`，保留表和函数。
- Web 回归：回滚 Web 部署；additive migration 保留，不执行 down/delete。
- 不得使用回滚删除历史商品、付款、客户、附件、回收证据或审计日志。

## 已验证证据

- PostgreSQL 17 生产快照隔离恢复库：116 张备份表、40,458 行逐表一致；四份候选 migration 按 linked 顺序执行成功。
- 原子入库、重复标识阻断、入库幂等重放、原子售卖、V2 状态/移动投影、售卖幂等重放、影子对账与强制事务回滚通过。
- 十张新增表 RLS 已开启且无策略；`anon`/`authenticated` 无表权限和 RPC 执行权，`service_role` 仅有最小表权限和三个 V2 RPC 执行权。
- lint、typecheck、全量 Vitest、Next production build 通过。
- 390×844 和 1440×900 的来源、AI、复核页面通过浏览器检查。
- 生产分阶段灰度、正式域名截图、rollback-only canary、最终对账和即时 runtime 观察记录在 `TASK-20260718-013-inventory-v2-production-canary/EVIDENCE.md`。

历史 migration 链存在早于 V2 的本地 reset 漂移：`20260611102805_repairdesk_remote_schema_compatibility.sql` 假设远端专用列存在，后续还有 trigram immutable 问题。V2 已在最小真实依赖契约的 PostgreSQL 17 空库独立验证，但全链 reset 修复应单独治理，不能通过修改已应用历史 migration 偷渡解决。
