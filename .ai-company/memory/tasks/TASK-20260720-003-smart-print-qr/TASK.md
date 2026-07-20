---
schema_version: 1
task_id: "TASK-20260720-003-smart-print-qr"
title: "打印单双用途智能 QR 与客户进度入口"
status: "release_ready"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["FLOW", "DATA", "SEC", "UX", "FE", "API", "QA", "INT"]
created_at: "2026-07-20T18:59:37Z"
updated_at: "2026-07-20T20:41:49Z"
---

# Owner goal

恢复打印维修单上的二维码，并实现一个安全的双用途入口：客户可查询精简维修进度，已登录且有权限的内部人员可进入对应订单任务页；完成验证后推送 `main` 并应用到生产。

# Business value

- 客户无需电话询问即可查看安全、精简、可理解的维修阶段。
- 内部人员保留扫码直达工单的效率，同时不把内部 URL、订单 UUID 或客户 PII 直接编码到纸面。
- 打印前强制准备二维码，避免再次出现“页面看似修好但打印件缺少 QR”的静默降级。

# Verified context

- 实施基线为 `origin/main` 的 `19f420717709991ed9f055124bdb9eb08934bcdd`。
- 原始 checkout 大量 dirty；唯一写入位置为 `/private/tmp/repairdesk-smart-print-qr-20260720`。
- 当前客户打印单与批量打印单没有 QR；全局 CSS 仍保留旧 QR 样式。
- 当前 `/r` 与对应公开 API 尚不存在，proxy 会把普通未登录业务页面送到登录页。
- `repair_orders(id, store_id)` 已有唯一索引，可用于同店复合外键。
- `OPEN_CONFLICTS` 的生产 migration history 漂移仍为硬门禁；在 remote migration list 与 dry-run 未通过前不应用生产数据库。

# Product decision

- 一张 QR 使用 `https://www.chinatech.in/r#<token>`；fragment 不进入 HTTP request URL。
- 32-byte 随机 token 只在签发响应中短暂返回；数据库只存 SHA-256 hash。
- 客户公开投影只含店铺公开信息、公开单号、设备名称、简化阶段、更新时间和下一步，不含姓名、电话、IMEI、解锁资料、内部备注、附件、技师、金额、成本或内部 UUID。
- 员工入口必须先认证，再基于当前 actor/store/order 权限由服务器解析并返回内部任务路由。
- 链接支持过期与撤销；作废工单或停用/关闭店铺统一显示不可用。

# Scope

## In scope

- additive Supabase token-link table、RLS/grants/index/FK 与 migration proof。
- staff-only token issuance API、public customer projection API、authenticated staff resolve API。
- `/r` 公共状态页与公开路由边界。
- 单单/批量打印在 `window.print()` 前签发 token，并渲染对应 QR；签发失败时可见报错且不启动打印。
- 状态映射、错误模型、速率/滥用保护、no-store/no-referrer/noindex、安全测试。
- 单元、集成、Chromium/WebKit、PDF/截图、完整质量门禁、Git main、Supabase/Vercel 生产应用与 smoke。

## Out of scope

- 向客户自动发送 WhatsApp/SMS/Email。
- 在公开页面暴露完整时间线、诊断、财务、附件或客户身份资料。
- 历史工单全量回填 QR token。
- 修改订单状态机、付款或成员权限矩阵。

# Risk and authority

- **R3:** 新公开客户入口、客户数据投影、认证授权、数据库 schema 与生产发布。
- **L2 bounded:** Owner 已明确批准按已审阅规划实施、推送和应用，覆盖本任务的 D3 代码/迁移/发布决定；仍不得绕过 migration-history、dry-run、安全或质量门禁。
- **Single writer:** 只有 Integration Lead 写业务代码、migration、memory、Git 和 release；三名子 Agent 全部只读。
- **Stop conditions:** 迁移历史不一致、dry-run 含未审历史迁移、同店约束/权限无法证明、公开响应泄露敏感字段、打印可在 QR 未准备时继续、质量门禁失败、远端 main 前进导致非快进、部署非 READY。

# Acceptance criteria

- 标准与批量打印每张票据恰有一个可扫描 QR，值为 `/r#<opaque-token>`，不含订单 ID/PII。
- 打印动作等待签发完成；签发失败显示错误且不调用 `window.print()`；重复点击不会并发签发/打印。
- 未登录客户可打开 `/r` 并只获得允许的公开投影；无效/过期/撤销/作废/关店采用统一不可用响应。
- 公开 route/API 不带 AppShell、不被登录重定向，响应禁止缓存、引用和索引。
- 员工扫码后只有登录且当前 actor 对同店订单具 `order:detail` 权限时才能获得 `/orders/{id}/task`。
- 数据表启用 RLS，`anon`/`authenticated` 无直接表权限，应用只通过服务端 service role 访问。
- lint、typecheck、full Vitest、build、相关 Chromium/WebKit/PDF/截图和安全用例通过。
- migration history 与 dry-run 通过后才应用数据库；代码推送 `origin/main`，对应 Vercel production READY 且 public/auth/smoke 通过。

# Agent plan

- `/root/smart_qr_arch_data`: DATA/Architecture, read_only, schema/API/migration gate review.
- `/root/smart_qr_security`: SEC/Privacy, read_only, threat model/auth/public boundary review.
- `/root/smart_qr_qa_ux`: QA/UX, read_only, print/public page states and verification matrix.
- Integration Lead: sole writer, integration, validation and release.

# Visual evidence

- Use synthetic order data only.
- Capture desktop/mobile public status states plus standard/batch print PDFs and print-media screenshots.
- Production screenshots must not contain real customer PII, tokens, credentials or internal UUIDs.
