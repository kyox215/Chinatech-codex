# CEO Closeout Report — 打印智能 QR 与客户进度入口

## 结论

功能已完成并上线。标准与批量维修单恢复为每张票据一个智能 QR；客户扫码只看到精简维修状态，已登录且具备同店订单权限的员工可解析同一个 token 进入内部任务页。打印准备失败时不会启动打印，Safari 连续点击和失败清理路径已修复。

## 发布身份

- Feature application: origin/main@24190b26a9a23994fc90c3c5b2e07c4337a35865.
- Database: production migration 20260720190759 applied and postchecked.
- Deployment: dpl_J8AFvJEJTb9D9zikWizy42s79Dv5, READY on chinatech.in and www.chinatech.in.
- Configuration: encrypted Production feature flag and rate-limit secret are present; secret values are not recorded.

## 验收证据

- Lint、typecheck、326 files / 2138 tests 与 production build 全部通过。
- Chromium 5/5、WebKit 5/5、production-header 1/1。
- 标准、批量、长内容 PDF 分别为 1、2、2 页；每张票据恰有一个 QR。
- 生产 /r 返回 200 和 no-store/noindex/CSP/frame/referrer/CORP/nosniff 头；无效合成 token 返回 404；未登录 issue/staff-resolve 返回 401；范围内错误日志为空。
- DATA/Architecture 和 Security 独立复核 PASS；QA/UX 为 CONDITIONAL PASS，且没有 P0/P1 软件阻塞。

## 安全与数据边界

- 纸面 QR 是固定源 /r#opaque-token，不含订单 ID 或客户 PII；fragment 不进入服务器请求。
- 数据库只保存 SHA-256 digest。公开 DTO 排除姓名、联系方式、IMEI/序列号、诊断/备注、金额、附件和内部 ID。
- Issue/revoke 是 service-role-only 原子 RPC，使用 UUID、同店 FK、订单锁、同事务审计和 one-unrevoked partial unique index。
- 公开入口使用组合 IP/global 限流与 live-token bucket；生产只信任 Vercel 规范化客户端 IP 头。

## 生产迁移事故

第一次 apply 因测试 fixture 把生产 UUID 订单键错误建模为 text，PostgreSQL 以 SQLSTATE 42804 在首条建表语句安全拒绝。迁移未登记、表未创建、功能未开启、应用未推送，因此无客户或数据影响。修正为 UUID 后重新执行完整 PostgreSQL 17 重放、并发、回滚、RLS/grants 与限流验证，再成功应用生产。详情见 INCIDENT-20260720-001.md。

## 剩余风险与回滚

1. 老板仍需在门店使用实体 Safari + HP 打印机完成预览、纸张输出和手机扫码；现有证据为合成 Chromium/WebKit/PDF，不能替代物理设备认证。
2. 批量 50 张未做真实浏览器压力测试，保留为 P2；当前批量双单、分页和 all-or-nothing 已覆盖。
3. 分布式多 IP 滥用仍属于监控/WAF 风险。
4. 回滚先关闭 CUSTOMER_STATUS_QR_ENABLED，再恢复上一个兼容 Vercel deployment；保留 additive schema、link 与 audit 历史。

## 视觉证据

- screenshots/TASK-20260720-003-smart-print-qr/public-status-success-webkit-390.png
- screenshots/TASK-20260720-003-smart-print-qr/print-media-webkit-1440.png
- screenshots/TASK-20260720-003-smart-print-qr/repair-order-standard-smart-qr.pdf
- screenshots/TASK-20260720-003-smart-print-qr/repair-order-batch-two-smart-qr.pdf

全部使用合成数据，不包含真实客户 PII、凭据或可复用 token。
