# Phase 05 — 推送、部署与生产验证

状态：`pending`

## Gate

- [ ] staged scope、secret scan、`git diff --cached --check` 通过。
- [ ] 非强制快进推送 `origin/main`，记录 SHA。
- [ ] Vercel 部署/自动部署对应同一 SHA，状态 READY。
- [ ] 关键页面、API、权限和 feature-off 生产冒烟通过。
- [ ] 扫描发布后错误日志，确认 rollback 目标可用。
- [ ] 保存 Owner 可见截图或说明无可视页面原因。

## Exit condition

Git、database、deployment、runtime 四层证据一致；否则执行回滚或停止。

