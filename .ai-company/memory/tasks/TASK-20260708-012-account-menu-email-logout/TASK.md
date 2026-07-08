---
schema_version: 1
task_id: "TASK-20260708-012-account-menu-email-logout"
title: "完善账号菜单邮箱显示和退出登录"
status: "active"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "QA", "Security"]
created_at: "2026-07-08T18:12:26Z"
updated_at: "2026-07-08T20:16:26Z"
---
# Task — 完善账号菜单邮箱显示和退出登录

## Owner request

完善账号菜单邮箱显示和退出登录

## Business value

让店铺菜单清楚显示当前登录账号，并提供可靠退出登录入口。

## Scope in

- To be refined by `$company-task-intake`.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [ ] 店铺菜单显示当前登录账号邮箱和姓名。
- [ ] 菜单提供退出登录按钮，执行 Supabase 登出、清理记住登录 cookie 并跳转登录页。
- [ ] 相关单元/类型检查通过，并完成可视验证截图。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |

## Decision and approval points

- None registered yet. Run `$risk-autonomy-classify`.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
