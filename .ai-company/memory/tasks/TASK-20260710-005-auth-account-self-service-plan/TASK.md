---
schema_version: 1
task_id: "TASK-20260710-005-auth-account-self-service-plan"
title: "用户注册、找回密码、账号安全与邮箱绑定计划书"
status: "closed"
task_class: "T2"
risk_level: "R1"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["INT", "FLOW", "SEC", "QA", "DOC"]
created_at: "2026-07-10T11:13:24Z"
updated_at: "2026-07-10T11:13:24Z"
closed_at: "2026-07-10T11:13:24Z"
---
# Task — 用户注册、找回密码、账号安全与邮箱绑定计划书

## Owner request

完善项目的用户注册、找回密码、设置中更改密码和绑定邮箱，并推荐还需要做什么，规划一份计划书。

## Business value

减少门店账号支持成本，补齐员工账号自助生命周期，同时避免注册、找回密码、邮箱变更和店铺加入流程破坏租户隔离。

## Scope in

- 核对当前注册、找回密码、个人中心、设置账号入口和 Supabase Auth 相关实现。
- 参考最新 Supabase 官方认证文档。
- 输出实施计划书，覆盖注册、找回密码、修改密码、邮箱绑定/变更、推荐安全能力、验收和审批点。
- 记录当前任务记忆和检查点。

## Scope out

- 不改认证业务代码。
- 不改 Supabase dashboard、生产配置、迁移或数据。
- 不发送真实邮件，不创建真实用户，不操作生产账号。

## Risk classification

- Current planning task: R1, reversible documentation-only change.
- Future implementation plan: R3 when it changes auth, permissions, Supabase config, email templates, production migrations, or account lifecycle behavior.

## Acceptance criteria

- [x] 计划书写入 `docs/AUTH_ACCOUNT_SELF_SERVICE_PLAN.md`。
- [x] 计划明确当前已完成能力和待补齐能力。
- [x] 计划覆盖注册、找回密码、修改密码、邮箱绑定/变更和推荐安全能力。
- [x] 计划列出实现顺序、验收矩阵、风险和 Owner 审批点。
- [x] 任务记忆记录 no-spawn reason 和无截图原因。

## Agent plan

No real sub-agents spawned.

No-spawn reason: the available multi-agent tool policy only permits spawning when the user explicitly asks for sub-agents/delegation/parallel agent work. The owner asked for a plan书, not sub-agents. The main thread performed the read-only product/security/QA planning and recorded the future departments as considered/not spawned.

## Definition of done

- Planning document exists and is scoped to future implementation.
- Current repo facts are distinguished from recommendations.
- No runtime/auth/production behavior is changed.
- Final owner report includes document path, validation, no-screenshot reason, and residual approval points.
