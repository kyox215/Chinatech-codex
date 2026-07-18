# Phase 03 — 逐切片与整体验证

状态：`completed — release-unit PASS / repository baseline exceptions documented`

## Gate

- [x] 任务相关单测/集成测试逐批通过。
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test` — 280 files / 1786 tests PASS。
- [x] `npm run build` — Next.js 16.2.6 production build PASS；首次 sandbox 网络字体失败不计产品失败，获准联网复跑通过。
- [x] 权限、租户隔离、失败/恢复和 feature-off 行为验证。
- [x] UI 关键桌面/移动页面截图，且仅使用 synthetic data。
- [x] `npm run test:e2e:settings:mock` — 67/67 PASS。
- [x] device-custody targeted E2E — 3/3 PASS。
- [x] 订单桌面审计 1280/1440/1536/1600 PASS；1024 的既有“详情打印”定位在本分支与 `origin/main@448c2404` 基线逐字复现，不归因于本发布。

## Exit condition

三个 release unit 的关键验收均有单元、集成或浏览器证据，结论为 PASS。仓库级桌面套件仍有未改动的 buyback/inventory 弹窗定位债务和上述 1024 基线缺口，作为独立跟进项记录，不扩大本次发布范围。
