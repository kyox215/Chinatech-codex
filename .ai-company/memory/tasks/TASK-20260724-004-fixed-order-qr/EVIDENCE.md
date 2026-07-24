# Evidence

## Baseline

- 当前生产基线提交：`71b2d925`，本地 `main` 与 `origin/main` 对齐。
- 工作区存在多个已验证但未提交任务；本任务开始时未清理或覆盖它们。
- 当前二维码为打印时随机签发，数据库只存 SHA-256，且默认拒绝作废/删除订单。
- 当前公开页通过按钮显式进入员工登录/内部解析，不符合老板要求的自动身份分流。

## Implementation and review

- DATA、SEC、Explorer 与独立 QA 均为只读；主线程为唯一写入者。
- QA 最初发现 active key version 与声明冲突两个 P1；新增 service-role-only singleton 后，历史回填、新订单 trigger、ensure/reset 均与 application active version 对齐，复核确认两个 P1 关闭。
- v2 token 使用完整 HMAC-SHA256、严格解析和 constant-time compare；旧 43 字符 token 继续解析。
- 未登录、已授权自动跳转、无权限公开回落和 fragment 清理均有页面测试。
- voided 与 soft-deleted 固定二维码准备、缺 QR 时 `window.print()` 零调用、单张/批量每页一个 QR 均有自动化证据。

## Database and production configuration

- Vercel Production 已配置独立 32-byte 随机 HMAC keyring 与 active version 1；密钥未输出、未写文件或记忆。
- `supabase db push --linked --dry-run` 仅列出 `20260724071717_fixed_order_customer_status_qr.sql`。
- 生产迁移已成功应用。
- 生产只读核验：repair orders 6390、identities 6390、missing 0、cross-store 0、active key version 1、RLS true、anon/authenticated grants 0、create/restore triggers 各 1。
- 安全 advisor 对两个新表仅报告预期的 service-role-only `RLS enabled no policy` INFO；没有新增本任务 WARN。

## Quality evidence

- `npm run lint`: PASS。
- `npm run typecheck`: PASS。
- full Vitest: 349 files / 2326 tests PASS（新增测试后相关定向套件继续 PASS）。
- production build: PASS。
- Chromium print/QR/public scan E2E: 5/5 PASS。
- WebKit/Safari-equivalent print/QR/public scan E2E: 5/5 PASS。
- Visual/PDF evidence: `screenshots/TASK-20260724-004-fixed-order-qr/`。

## Pending release evidence

- 精确 stage/commit/push `main`。
- Vercel Production deployment READY 与生产 HTTP/业务冒烟。
- 实体手机扫描与门店打印机纸张输出仍为 Owner 设备验收项，不能由软件测试代替。
- `2026-07-24T07:53:15Z` `5c3c5f70ee` — 生产 identity 6390/6390、missing 0、cross-store 0；lint/typecheck/full test/build；Chromium/WebKit E2E 5/5。
