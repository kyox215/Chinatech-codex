---
schema_version: 1
task_id: "TASK-20260709-020-account-center-recovery"
title: "账号中心与找回密码上线流程"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["API", "DATA", "DOC", "FE", "FLOW", "INT", "QA", "SEC", "UX"]
created_at: "2026-07-09T17:36:19Z"
updated_at: "2026-07-09T18:05:43Z"
closed_at: "2026-07-09T18:05:43Z"
---
# Task — 账号中心与找回密码上线流程

## Owner request

账号中心与找回密码上线流程

## Business value

完善员工账号自助流程：找回密码、个人中心、密码修改、手机号绑定、账号菜单邮箱与退出，减少门店账号支持成本。

## Scope in

- 登录页进入独立找回密码页，Supabase recovery callback 进入独立重置密码页。
- 工单页左下角账号下拉菜单补齐个人中心入口，保留当前邮箱显示和退出登录。
- 新增个人中心页面，支持查看邮箱/店铺身份、保存显示名、保存联系手机号、修改当前登录密码。
- staff_profiles 兼容新增 `phone_e164` 和 `phone_verified_at` 字段、格式约束和索引。
- 预检并应用本次 Supabase migration，完成 lint/typecheck/test/build 与视觉截图验证。

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 找回密码从登录页进入独立页面，发送重置邮件后通过安全回调进入重置密码页。
- [x] 登录后工单页左下角菜单显示当前账号邮箱并提供个人中心与退出登录。
- [x] 个人中心可查看邮箱/店铺身份，修改显示名，修改当前密码，保存手机号。
- [x] 新增 staff_profiles 手机号字段的兼容 migration，经预检后应用到 Supabase。
- [x] lint/typecheck/test/build 通过并推送 main。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Existing sidebar already displayed account email and logout | observed | `src/components/app-sidebar.tsx` before task diff | personal center link added |
| Supabase Auth reset flow requires callback redirect and updateUser | observed | official Supabase password docs, current code | implemented with `/auth/callback?next=/reset-password` |
| `staff_profiles` had no phone columns | observed | migration history and schema query | migration added nullable columns |
| Production migration was approved by owner | observed | owner request: "完成后推送main 以及应用migration" | applied after dry-run |

## Decision and approval points

- Owner approved applying migration and pushing main in the task request.
- No sub-agents spawned: user did not explicitly request sub-agents for this execution turn, single-writer scope was safer for auth/schema changes, and the main thread handled implementation + security/data checks directly.

## Work packages

- Implement Auth recovery pages and middleware recovery guard.
- Implement account center UI and account profile phone persistence.
- Add migration and verify linked Supabase schema.
- Run QA/build and capture screenshots.
- Commit and push to main after scoped diff review.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
