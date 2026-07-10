---
schema_version: 1
task_id: "TASK-20260710-007-email-link-registration-completion"
title: "邮箱验证链接完成注册流程"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "鹤祥"
departments_considered: ["INT", "FLOW", "SEC", "DATA", "QA", "DOC", "REL"]
departments_spawned: []
created_at: "2026-07-10T12:53:57Z"
updated_at: "2026-07-10T13:04:07Z"
closed_at: "2026-07-10T13:04:07Z"
---
# Task — 邮箱验证链接完成注册流程

## Owner Request

把注册流程改为使用邮箱验证链接来完成注册；先规划完善，然后开始执行；完成后自动推送到 `main`，并应用数据库。

## Product Plan

注册完成标准改为：用户提交注册表单后必须通过邮箱中的验证链接回到系统，系统完成 Supabase callback 交换 session 后，进入注册完成页，再继续店铺开通或登录后续路径。

## Scope In

- 注册提交后不再因为 Supabase 返回 session 而直接进入 `/onboarding`。
- 注册邮件 redirect 指向 `/auth/callback?next=/register/complete`。
- 新增注册完成页，显示邮箱验证已完成并引导继续店铺开通。
- 登录页显示注册验证等待状态，支持重发验证邮件。
- 本地 Supabase 配置明确启用邮箱确认。
- 更新计划文档、任务记忆、截图、测试和 Supabase dry-run 证据。

## Scope Out

- 不通过代码修改生产 Supabase Dashboard Auth 设置、SMTP、模板或 redirect allowlist。
- 不发送真实客户邮件，不创建真实生产账号。
- 不新增数据库表或不可逆迁移，除非 dry-run 显示本任务有明确迁移。

## Risk And Approval

- R2/L2: 认证用户流程变化，影响注册体验和 onboarding 入口；代码可回滚。
- Production Auth Dashboard changes remain an approval/configuration item, not an automatic DB migration.

## No-Spawn Reason

Owner asked for direct planning and execution but did not explicitly ask for sub-agents, departments, AI employees, or multi-agent review. Main thread will execute product/security/data/QA/documentation checks directly.

## Acceptance Criteria

- [x] Register submit shows email-verification pending state and does not route directly to onboarding.
- [x] Confirmation/resend email link uses `/auth/callback?next=/register/complete`.
- [x] `/register/complete` is a thin App Router page backed by a reusable auth feature screen.
- [x] Local Supabase config enables email confirmations.
- [x] Tests cover callback redirect helper and post-login/register completion routing where appropriate.
- [x] Lint, typecheck, test, build, screenshots, and Supabase linked dry-run are complete.
- [x] Implementation commit created for `main` push: `5de1195a`.
