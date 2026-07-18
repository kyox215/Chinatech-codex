# Inventory Product V2 Release Runbook

## 当前发布形态

本次是 additive、fail-closed 的首个可发布纵向切片：

- 新增目录、型号、单台库存、多标识符、库存移动和幂等命令账本。
- 新增原子入库与原子全额售卖 RPC，但 migration 默认撤销所有运行时 `EXECUTE`。
- 新增 `/inventory/new` 六步页面；V2 未开放时自动回到 `/inventory?new=1`。
- V1 表、历史、回收证据、客户关系、旧入口和旧写入默认全部保留。
- AI 只生成候选；员工勾选“确认应用”后才进入页面草稿，仍不能直接正式写入。

因此，代码推送和自动 Web 部署不会让 V2 在生产门店生效，也不会要求生产数据库立即变更。

## 功能开关

默认值：

```text
INVENTORY_V2_SCHEMA_READY=0
INVENTORY_V2_SHADOW_READ=0
INVENTORY_V2_COMMANDS=0
INVENTORY_V2_UI=0
INVENTORY_V2_STORE_ALLOWLIST=
INVENTORY_LEGACY_MUTATIONS_ENABLED=1
```

层级约束：schema ready → commands/UI → store allowlist。任意父开关关闭时，子能力保持关闭。正式切换前不得关闭 legacy mutations。

## 生产启用门禁

1. 在隔离环境对 linked migration 执行 dry-run，确认只新增对象且没有未预期 migration 漂移。
2. 完成可恢复备份/导出、恢复演练和 migration history 核对。
3. 应用两份 migration 后验证表、复合外键、索引、RLS、table grants、函数 `security invoker` 与空 `search_path`。
4. 通过单独的 Owner 批准 migration，只向 `service_role` grant 两个 RPC 的 `EXECUTE`；不得 grant 给 `anon` 或 `authenticated`。
5. 先只设置 `SCHEMA_READY=1`，执行影子读取和 V1/V2 对账。
6. 将一个测试门店加入 allowlist，再开启 `COMMANDS=1` 与 `UI=1`。
7. 验证六步入库、重复标识、网络重试、并发版本、原子售卖、客户关联、财政状态、打印失败和权限拒绝。
8. 观察窗口内保持 V1 可写和可回滚；达到批准指标后再扩大门店。

## 回滚

- UI/命令异常：先设 `INVENTORY_V2_UI=0`、`INVENTORY_V2_COMMANDS=0`，立即回到 V1；不要删除 V2 数据。
- 数据对账异常：移除门店 allowlist，保留账本和事件作调查证据。
- RPC 风险：撤销 `service_role` 的 RPC `EXECUTE`，保留表和函数。
- Web 回归：回滚 Web 部署；additive migration 保留，不执行 down/delete。
- 不得使用回滚删除历史商品、付款、客户、附件、回收证据或审计日志。

## 已验证证据

- PostgreSQL 17 隔离库：两份 migration 执行成功。
- 原子入库、入库幂等重放、失败无残留、原子售卖、售卖幂等重放与不重复收款通过。
- 两个 RPC 对 `service_role` 默认不可执行，核心表 RLS 已开启。
- lint、typecheck、全量 Vitest、Next production build 通过。
- 390×844 和 1440×900 的来源、AI、复核页面通过浏览器检查。

历史 migration 链存在早于 V2 的本地 reset 漂移：`20260611102805_repairdesk_remote_schema_compatibility.sql` 假设远端专用列存在，后续还有 trigram immutable 问题。V2 已在最小真实依赖契约的 PostgreSQL 17 空库独立验证，但全链 reset 修复应单独治理，不能通过修改已应用历史 migration 偷渡解决。
