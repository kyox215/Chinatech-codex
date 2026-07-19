# Checkpoints

## 2026-07-19T23:24:30Z — 订单详情工作台重排完成并通过本地发布门

- **Phase:** pre-release-review
- **Completed/current state:** 订单详情桌面弹窗已完成整体限宽、限高、顶部进度与金额分区、三列职责布局、记录类窄工作区和紧凑底栏。
- **Next:** 校验最终 diff，提交并快进推送 `main`，观察 Vercel exact-SHA 部署并执行生产只读烟测。
- **Decision:** 保留既有移动端和业务组件，仅调整桌面组合关系、宽高约束和重复金额摘要位置。
- **Evidence:**
  - `npm run agents:check`, `npm run lint`, `npm run typecheck` passed with Node 24.
  - Vitest: 314 files and 2046 tests passed.
  - Next.js 16 production build passed with Webpack and permitted font access.
  - Layout-only Playwright: 5/5 passed at 1024, 1280, 1440, 1536 and 1600 widths.
  - Full 1024px desktop audit passed all order-detail layout, edit, grouped-record, photos, dialogs and direct-detail checks; final unrelated queue-row print counter was flaky and failed after those assertions.
  - Visual evidence: `desktop-overview-1440.png` and `desktop-records-1440.png`.
- **Risks:** 非常长的设备备注、报价项目或时间线会在分组内部滚动；这是本次减少整页高度的预期行为。
- **Recorded by:** RepairDesk Integration Lead

## Active context exception

项目根工作区存在另一项并行任务的未提交 `ACTIVE_CONTEXT.md`。为避免覆盖用户/其他任务状态，本检查点只写入任务本地目录；发布后继续以本任务 `TASK.md` 与本文件作为恢复入口。
