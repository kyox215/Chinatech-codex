# Phase 06 — 发布关闭与遗漏审计

状态：`completed`

## Gate

- [x] 验收矩阵、CEO 报告、EVIDENCE、CHECKPOINTS、HANDOFF 已更新。
- [x] 文档、迁移边界、运行手册和任务状态与实际生产一致。
- [x] 比较原工作区、所有 worktree/branches 与 `origin/main`；原 `main` 两个领先提交均为 patch-equivalent，不需要重放。
- [x] 三个 release unit 已关闭并运行最终 memory checkpoint。
- [x] 未完成的 AI 成本治理、旧 preservation/WIP 分支和 Inventory V2 生产 canary 未被误报为本次遗漏发布。

## Residual ownership

- Lifecycle purge worker 的 retry-baseline 证明缺陷继续阻止其启用；schema dormant、flags off、生产 job 为零。
- Supabase advisor 的既有 RLS/search-path/permissive-policy 警告属于单独安全治理，本次迁移未改变 ACL、policy 或 RLS。
- 八个宽范围 E2E 定位器失败已在未改动基线复现，不属于三个 release unit；正式相关 settings 67/67 与 custody 3/3 均通过。
- 用户原始 dirty/diverged checkout 与其他工作树、stash、分支均保留，未 reset、clean 或批量删除。

## Exit condition

此前可发布改动已关闭，残余项有明确任务/owner/原因，才能启动下一步。
