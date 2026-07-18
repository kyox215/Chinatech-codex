# Phase 06 — 发布关闭与遗漏审计

状态：`pending`

## Gate

- [ ] 验收矩阵、CEO 报告、EVIDENCE、CHECKPOINTS、HANDOFF 更新。
- [ ] 文档、架构、运行手册和任务状态与实际生产一致。
- [ ] 比较原工作区、所有 worktree/branches 与 `origin/main`，列出真正剩余项。
- [ ] 运行 memory checkpoint；关闭或条件关闭每个 release-unit。
- [ ] 不把未完成 WIP 误报为遗漏发布。

## Exit condition

此前可发布改动已关闭，残余项有明确任务/owner/原因，才能启动下一步。

