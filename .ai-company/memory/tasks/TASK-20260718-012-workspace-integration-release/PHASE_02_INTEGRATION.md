# Phase 02 — 最新主线隔离集成

状态：`completed`

## Gate

- [x] 从最新 `origin/main@448c2404` 创建专用隔离 worktree/branch。
- [x] 原主工作区不 reset、不 clean、不 stash 覆盖。
- [x] 按 release-unit 顺序重放最小 scoped patches。
- [x] 每个批次执行 `git diff --check` 与路径归属审查。
- [x] 冲突按最新远端事实和任务验收解决，保留 `public_base_url`、lifecycle、order-cost、invite 和 AI 后续实现。

## Exit condition

集成树只包含批准发布单元，且每个文件可追溯到任务和验证证据。

## Exit result

- `bdffa5f8` — RU-01 工单列表按五步工作流进度排序。
- `05de4df8` — RU-02 保管状态变化不再隐式清除设备解锁信息。
- `675d2082` — RU-03 新店默认打印地址与租户中性数据库默认值。
- 旧 `20260717175731` 未复制；替换为 `20260718150000`，避免与后续独立门禁的 Inventory V2 migrations 形成生产历史倒序。
- 详细阶段证据见 `PHASE_02A_ORDER_SORT.md`、`PHASE_02B_DEVICE_UNLOCK.md`、`PHASE_02C_STORE_PRINT.md`。
