---
schema_version: 1
task_id: "TASK-20260724-010-qr-scan-routing-security"
title: "维修工单二维码扫码分流与凭据保护修复"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["FRONTEND", "SEC", "QA", "DOCS", "RELEASE"]
created_at: "2026-07-24T15:18:00Z"
updated_at: "2026-07-24T17:15:41Z"
closed_at: "2026-07-24T17:15:41Z"
---
# Objective

确保应用内扫描固定维修工单二维码时，授权店主/员工进入对应内部详情，未登录或无权限人员进入公开进度，同时禁止 bearer token 进入普通搜索、缓存键或订单列表会话状态。

# Scope

- 专用 `/r#token` 扫码类型与官方域名别名兼容。
- 扫码结果敏感值遮罩，禁止复制和普通搜索。
- `/r` 公开/员工请求 generation 与 abort 防竞态。
- 清理历史订单列表中误持久化的二维码搜索。
- 单元、组件、移动 E2E、安全、文档与发布验证。

# Non-goals

- 不改变公开进度 DTO。
- 不改变服务端租户、角色或技术员分配权限。
- 不新增数据库迁移。

# Acceptance

- 官方 `/r#token` 只导航到 `/r`，不进入任何业务搜索。
- 授权同店员工进入对应内部详情；匿名、跨店、无权限保持公开进度。
- token 不出现在扫描结果正文、复制操作、通用 API、React Query key 或订单列表 sessionStorage。
- 连续扫描只允许最新二维码导航。
- targeted、lint、typecheck、test、build 和移动 E2E 通过后方可发布。

# Current state

- 实现、验证、main 推送和生产部署完成。
- 无数据库迁移、无权限模型变化、无生产数据写入。
- 安全 Reviewer 最终 PASS：P0/P1/P2 均无未关闭项。
- Release commit `5ac58f61`；Vercel deployment `dpl_GCgyDGC4GjLgBywtkmU7RuHBEfco` Ready。
