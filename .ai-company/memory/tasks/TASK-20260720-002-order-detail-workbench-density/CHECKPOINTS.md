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

## 2026-07-19T23:35:00Z — 生产首轮烟测后调整工作台高度

- **Phase:** production-correction
- **Observed:** `main@5942a9de` 的 Vercel 部署 Ready；生产真实订单在 1437×771 视口下所有列宽约束正确，但较长的设备保管交接摘要让默认概览出现 25px 内部滚动。
- **Decision:** 桌面工作台高度上限由 680px 调整为 720px；宽度、列布局和业务行为不变。
- **Next:** 重新运行布局回归和构建，提交修正，等待新 exact-SHA Ready 后复测生产滚动差。

## 2026-07-19T23:47:24Z — 最终生产验证通过并关闭任务

- **Phase:** closed
- **Outcome:** 订单详情桌面工作台整体重排已部署，真实默认概览滚动差为 0，进度、金额、三列概览、记录分组和底部操作区均按限宽规则生效。
- **Release:** `main@5d32dee6e5a61fb0c2bd68f114ea509a1aa0ccaa`; Vercel `dpl_AKAaD6MSXnMU4Ftw7ntFRxbg4MZG` Ready，别名包含 `chinatech.in` 和 `www.chinatech.in`。
- **Production evidence:** 1437×771 视口下弹窗 1040×720、概览滚动差 0、设备卡/底栏间距 23px、进度 662px、保管 780px、客户 260px、设备 406px、报价 290px、切换组 390px、底栏 512px；记录工作区 920px；时间线切换成功；控制台错误和近 15 分钟 `/orders` 运行时错误均为 0。
- **Residual risk:** 极端长文本和大批时间线仍会在当前分组内部滚动；这是保持主页面紧凑的一致降级方式。
- **Memory:** 可复用布局候选保留在任务 `MEMORY_DELTA.md`；未提升为公司/部门正式规则，未修改权限或能力等级。
- **Active context:** 因根工作区存在另一并行任务的未提交上下文，本任务未覆盖 `ACTIVE_CONTEXT.md`，以任务目录作为恢复档案。
- **Closed by:** RepairDesk Integration Lead
