# Handoff — TASK-20260718-012

## Resume first

1. Read `TASK.md`, the latest `CHECKPOINTS.md`, and all `PHASE_*.md` files.
2. Inspect current Git status before editing; concurrent workspace changes are expected.
3. Preserve the primary checkout; integrate only in a clean worktree based on current `origin/main`.
4. Never infer that an untracked migration or a completed local test equals production approval.

## Current state

- 三个此前完成的 release unit 已整合并推送 `main`，获准的 `20260718150000` 迁移已精确应用，生产 Web 已 READY。
- Inventory V2 Phase 0 与默认关闭纵向切片已经由并行批准链完成并进入 `main`；生产 DB migration、RPC grant 和功能开关仍未启用。
- 原始 dirty/diverged checkout 与其他用户工作树保持原样；不要为了“清理”而 reset、clean、删除分支或重放 patch-equivalent 提交。

## Current next action

如 Owner 要求正式启用 Inventory V2，从 `docs/INVENTORY_PRODUCT_V2_RELEASE_RUNBOOK.md` 的 D4 门禁开始：先恢复证明和精确 linked dry-run，再单独批准 migration、RPC grant 与单店 canary。不得直接开启全部 flags。
