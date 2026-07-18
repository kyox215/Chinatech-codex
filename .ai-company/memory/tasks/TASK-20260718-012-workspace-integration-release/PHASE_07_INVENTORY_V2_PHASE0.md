# Phase 07 — 启动库存商品 V2 Phase 0

状态：`completed — adopted verified concurrent result; no duplicate execution`

## Gate

- [x] 核对 `TASK-20260718-011-inventory-product-v2-plan`：Owner 已批准执行，任务已条件关闭并记录生产激活边界。
- [x] 并行批准链已在隔离 worktree `/private/tmp/repairdesk-inventory-v2-20260718` 基于稳定主线完成实施与验证。
- [x] V1 数据、入口、写入、权限、财务历史和异常基线继续保留；V2 仅 additive、fail-closed。
- [x] 产品计划、执行合同、威胁边界、迁移/回滚 runbook 和验证证据已经进入 `main`。
- [x] V2 代码以 `f7df2df8`、`7238123c`、`9465ead4` 进入 `main` 并默认关闭；本次没有删除 V1、apply V2 migration、grant RPC、启用付费 AI 或打开 V2 flags。

## Verified safe stop

- 最终 linked production dry-run 仍列出 `20260718175622` 与 `20260718181148` 两份 Inventory V2 migration；并发进入主线的 `20260718174042_ai_assistant_cost_governance_v1.sql` 也保持未应用，三者均未被本任务捆绑执行。
- Vercel 环境不存在 `INVENTORY_V2_*` 或 `INVENTORY_LEGACY_MUTATIONS_ENABLED` 名称，Web 自动部署不会启用 V2。
- 下一动作是 runbook 定义的独立 D4 生产激活：恢复证明、精确 dry-run、migration apply、RPC grant、单店 allowlist 和观察窗；本任务未执行。

## Exit condition

Phase 0 及默认关闭纵向切片已验证并采纳；下一阶段仍需单独生产授权。
