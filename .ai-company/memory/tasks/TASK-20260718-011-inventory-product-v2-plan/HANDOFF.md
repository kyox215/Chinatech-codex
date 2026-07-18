# Handoff — TASK-20260718-011-inventory-product-v2-plan

## Current state

首个 V2 可发布纵向切片已推送 `main`，并由 Vercel Git 集成完成 production Ready：additive schema、原子入库/售卖、六步跨端页面、AI 人工复核、权限/flag、mock/API 和发布手册均已实现。生产 DB 未 apply，V2 flags 默认关闭，V1 保持可用。

## Resume first action

生产正式启用时，从 `docs/INVENTORY_PRODUCT_V2_RELEASE_RUNBOOK.md` 的 linked dry-run、恢复证明和单店 allowlist 开始；不得直接打开全部 flags。

## Stop conditions

- 不在原 dirty/diverged 工作区合并或清理用户改动。
- 不删除 V1 数据或 AI 资产。
- 生产 migration apply、RPC grant、真实 AI 数据与全店切换仍是独立 D4 门禁。
- 历史全链 `supabase db reset` 漂移必须单独治理，不编辑已应用 migration 伪装通过。
