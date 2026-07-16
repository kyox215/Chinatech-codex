---
schema_version: 1
task_id: "TASK-20260710-011-account-password-reset-mobile-actions"
title: "账号中心忘记密码邮件入口与移动端操作优化"
status: "closed"
task_class: "T1"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "Security", "QA"]
created_at: "2026-07-10T18:40:30Z"
updated_at: "2026-07-16T18:21:15Z"
---
# Task — 账号中心忘记密码邮件入口与移动端操作优化

## Owner request

开始执行账号自助计划，在账号中心加入忘记密码找回功能，通过邮箱链接重置密码，并优化移动端操作页面。

## Business value

让已登录员工在忘记当前密码时不用退出系统即可给当前登录邮箱发送重置链接，同时让账号中心在手机上更容易点击主要操作按钮。

## Scope in

- 在账号中心密码区加入发送重置密码邮件入口。
- 复用已有 Supabase password recovery callback：`/auth/callback?next=/reset-password`。
- 移动端账号中心操作按钮改为手机全宽、桌面自适应。
- 记录直接组件测试、脱敏视觉证据、验证结果和未推送原因。

## Scope out

- 不新增数据库表、RPC、RLS policy 或 linked Supabase schema migration。
- 不更改 `/forgot-password`、`/reset-password` 的核心链路，除非验证发现缺陷。
- 不发送真实重置邮件；视觉验证仅使用 `.test` 合成邮箱。
- 不自动推送 `main`；最终 push 仍由 TASK-20260716-004 的统一发布门控制。

## Acceptance criteria

- [x] 账号中心“修改密码”区域提供“发送重置邮件”入口。
- [x] 发送逻辑使用当前登录邮箱，调用 Supabase `resetPasswordForEmail`，回调到 `/reset-password`。
- [x] 成功和失败状态使用现有中文 auth error/toast 规范。
- [x] 移动端相关操作按钮不挤压、不竖排，手机宽度下可全宽点击。
- [x] 直接测试当前邮箱、缺失邮箱、pending 防连点、错误提示与安全回调。
- [x] 运行静态、类型、全量测试与构建，并保留 390/430 脱敏截图。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| `/forgot-password` already sends Supabase reset email | observed | `src/features/auth/screens/forgot-password-screen.tsx` | reuse flow |
| Auth callback sets recovery cookie for `/reset-password` | observed | `src/app/auth/callback/route.ts` | reuse flow |
| Account center currently lacks logged-in reset email shortcut | observed | `src/features/account/screens/account-center-screen.tsx` | implement |
| Database schema change is unnecessary | decision | Supabase Auth handles recovery email | no migration |
| Existing mocked-email screenshot exposed real-style identity data | observed | security and QA review | exclude all legacy screenshots; replace with `qa@example.test` evidence |
| Actual email delivery depends on linked Supabase Auth configuration | residual risk | no production send was authorized | verify only after a separate owner-approved release |

## Definition of done

- Scoped code diff is reviewed.
- Validation results are recorded in `EVIDENCE.md`.
- Checkpoint is appended in `CHECKPOINTS.md`.
- Final report explains any skipped push/deploy/database apply.

## Closeout

- Local package completed on `codex/account-password-reset-closeout-20260716`.
- No database migration, production read/write, reset-email send, deploy, or push was performed.
- Final release remains gated by the parent worktree-delivery task.
