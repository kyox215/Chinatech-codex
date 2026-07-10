---
schema_version: 1
task_id: "TASK-20260710-006-auth-account-self-service-implementation"
title: "用户注册、找回密码、账号安全中心与邮箱绑定实施"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "鹤祥"
departments_considered: ["INT", "FLOW", "SEC", "DATA", "QA", "DOC", "REL"]
departments_spawned: []
created_at: "2026-07-10T12:41:58Z"
updated_at: "2026-07-10T12:48:26Z"
closed_at: "2026-07-10T12:48:26Z"
---
# Task — 用户注册、找回密码、账号安全中心与邮箱绑定实施

## Owner Request

设置目标并开始任务；完善注册、找回密码、设置中改密码和绑定邮箱；任务完成后推送到 `main`，并应用数据库。

## Scope In

- 完善注册表单、密码确认、注册后邮箱确认提示和 resend confirmation。
- 统一 Supabase Auth 回调 URL 和 safe next path helper。
- 保持找回密码流程，改用共享 callback URL helper。
- 将 `/account` 做成账号安全中心：邮箱验证状态、重发验证邮件、邮箱变更请求、个人资料和改密码。
- 在 `/settings?section=account` 添加账号安全入口，链接到 `/account`。
- 让 onboarding status 暴露 `emailVerified`，供账号中心显示。
- 增加单元测试、截图、Supabase linked dry-run、提交并推送 `main`。

## Scope Out

- 不修改 Supabase dashboard 生产 Auth 设置。
- 不新增数据库迁移，不写生产数据，不发送真实客户邮件。
- 不实现 P4/P5 推荐项，例如 CAPTCHA、MFA、session management、完整安全审计事件。

## Risk And Autonomy

- R2/L2: 认证前端与有限服务端类型/API 扩展，可通过测试和 dry-run 验证。
- 数据库动作以 linked dry-run 为硬门槛；dry-run 显示远端已最新，因此无实际迁移可应用。

## Agent Plan

No real sub-agents spawned.

No-spawn reason: owner requested direct execution and did not explicitly ask for sub-agents, departments, multi-agent execution, or review agents. Main thread performed implementation, Supabase/data gate, QA, documentation, and release closeout directly.

## Acceptance Criteria

- [x] Registration supports password confirmation and post-signup verification/resend state.
- [x] Forgot password and signup use canonical callback URL helper.
- [x] Account center supports email verification resend and email change request with current-password confirmation.
- [x] Settings account section links password/email actions to account center.
- [x] Onboarding status exposes email verification state.
- [x] Unit tests cover auth helper/error additions and onboarding mapping.
- [x] Lint, typecheck, tests, build, screenshots, and Supabase dry-run are recorded.
- [x] Commit created for `main` push: `0173a182`.
