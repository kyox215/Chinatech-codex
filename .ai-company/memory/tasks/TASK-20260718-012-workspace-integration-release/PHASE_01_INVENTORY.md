# Phase 01 — 改动与任务归属盘点

状态：`completed`

## Gate

- [x] 获取最新 `origin/main` 只读状态。
- [x] 记录主工作区、所有 worktree、local commits、tracked/untracked 路径。
- [x] 每项映射到任务、状态、证据、远端是否已包含和发布决定。
- [x] 六份 migration 单独映射，不把“文件存在”当作“可 apply”。
- [x] 三个只读部门完成独立复核。

## Verification

- `git status --short --branch`
- `git fetch --prune` 后比较 `HEAD...origin/main`
- `git worktree list --porcelain`
- `git diff --name-status`、`git ls-files --others --exclude-standard`
- 任务 `TASK.md` / `EVIDENCE.md` / `CHECKPOINTS.md` 状态交叉检查

## Exit condition

生成完整 release-unit 矩阵；unknown、unfinished、rejected 和 destructive 项不得进入下一阶段。

## Exit result

- 权威基线：`origin/main@448c2404`；当前根 checkout ahead 2 / behind 47，两个 ahead commit 均 patch-equivalent，禁止重推。
- 本轮只重建三个最小单元：工单进度排序、设备解锁信息保留残差、店铺默认打印地址。
- lifecycle 与成本 migrations 已在 linked history，禁止重放；purge/export runtime 保持关闭。
- 店铺打印地址旧 migration 时间戳失序，必须以新的 forward migration 重发；dry-run 只出现该一份才可 apply。
