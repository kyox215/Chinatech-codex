# Checkpoint — 2026-07-24 12:58 Europe/Rome

## Verified facts

- Fixed A5 PDF: one page, 595.276×419.528pt (210×148mm).
- Fixed A4 half-cut PDF: one page, 595.276×841.89pt (210×297mm), identical ticket on upper half and cut line at 148.5mm.
- PNG inspection confirms full-width alignment, complete footer, two columns and QR without clipping.
- Chromium fixed-PDF E2E passes; lint, typecheck, 11 related unit tests and webpack production build pass.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Evidence: `screenshots/TASK-20260724-006-fixed-pdf-print/`.

## Decision

Use the existing print DOM as the single layout source, render at 3× with `html2canvas`, and package with `pdf-lib`. A synchronous loading window preserves the user gesture before asynchronous QR and PDF generation.

## Open operational risk

- Repository Playwright config exposes Chromium only; native Windows driver and iPhone/iPad AirPrint remain physical checks.
- Drivers can still scale the whole fixed PDF when non-100% options are chosen, but cannot reflow or misalign its internal layout.

## Next action

Release candidate commit `9bf16da5` is complete and the worktree is clean. It has not been pushed or deployed. Next action requires Owner approval: push to main, deploy Vercel Production, smoke-test, then perform one A5 and one A4 physical print/QR scan.
## 2026-07-24T11:12:29Z — 四按钮固定 PDF 已实现并完成发布前验证：A5 横向、A4 横向铺满、A4 上半裁切、A4 双联；复用同一工单 DOM 与二维码。

- **Phase:** release-ready
- **Completed/current state:** 四按钮固定 PDF 已实现并完成发布前验证：A5 横向、A4 横向铺满、A4 上半裁切、A4 双联；复用同一工单 DOM 与二维码。
- **Next:** 提交变更，推送 HEAD 到 main，部署 Vercel Production 并做生产冒烟验证。
- **Decision:** 最终界面只保留老板指定的四种模式；A4 横向等比放大，A4 双联同页复制两份完整票据。
- **Evidence:**
  - Chromium E2E 1 passed；PDF 尺寸分别为 595.276x419.528pt、841.89x595.276pt、595.276x841.89pt、595.276x841.89pt；四张 PNG 视觉检查完整；lint/typecheck/9 tests/webpack build passed。
- **Recorded by:** IntegrationLead
## 2026-07-24T11:19:57Z — 四模式固定 PDF 已推送 main 并部署到 Vercel Production。

- **Phase:** deployed
- **Completed/current state:** 四模式固定 PDF 已推送 main 并部署到 Vercel Production。
- **Next:** 关闭任务；门店按需用真实 Windows/AirPrint 打印机各做一次物理走纸检查。
- **Decision:** 正式域名已指向本次部署；无数据库迁移，回滚可恢复到 4f0be676。
- **Evidence:**
  - Git main=623f7ef2；deployment dpl_FVuQVF4JAQ6WyyMzqEyXW84CEphs Ready；www.chinatech.in/orders 返回预期 307 到登录页。
- **Recorded by:** IntegrationLead
## 2026-07-24T11:19:57Z — Task closeout

- **Status:** closed
- **Outcome:** 四个打印按钮、固定尺寸 PDF、二维码、文档、验证、main 推送和生产部署全部完成。
- **Residual risks:** 浏览器自动化无法控制实体 Windows/HP/iOS 打印驱动；固定 PDF 已消除内部重排，但用户仍应使用实际大小/100%。
- **Follow-up:** 如门店发现特定驱动缩放，记录打印机型号、驱动版本与系统打印设置后单独处理。
- **Closed by:** IntegrationLead
