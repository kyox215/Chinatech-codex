---
schema_version: 1
task_id: "TASK-20260717-employee-invite-registration"
title: "员工邮箱邀请注册完整流程"
status: "release_ready"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2_code_L1_production"
owner: "IntegrationLead"
departments: ["FLOW", "UX", "DATA", "API", "SEC", "QA", "INT"]
created_at: "2026-07-17T22:00:00Z"
updated_at: "2026-07-17T22:53:58Z"
---
# Owner goal

店主填写员工邮箱和非 Owner 角色后，系统自动发送安全邀请邮件；新员工通过邮件完成账号和密码设置，已有账号通过邮件登录；双方最终明确接受邀请后才原子开通店铺成员关系。完成实现、验证、必要迁移应用，并安全推送到 `main`。

# Business outcome

- 员工不需要先自行注册再寻找邀请。
- 店主能区分邀请记录和邮件投递结果，并可重发或撤销。
- 邮件链接只证明邮箱所有权；店铺访问仍由有效业务邀请、当前验证邮箱和服务端原子授权共同决定。

# In scope

- Supabase Invite/Magic Link 邮件发送与 SSR token confirmation。
- 新账号设置姓名/密码、已有账号直接确认加入。
- 邮件投递状态、重发、撤销、过期和重复提交。
- 原子接受邀请 RPC、当前 Auth 邮箱绑定、店铺状态与生命周期并发锁。
- 设置页和邀请完成页 UI、测试、迁移、文档、截图和发布证据。

# Out of scope

- 新邮件供应商采购或新增付费订阅。
- 邮件打开像素追踪。
- Owner 角色邀请或店铺所有权转移。
- 自动删除 Supabase Auth 用户。

# Constraints

- 单一写入者为 Integration Lead；子 Agent 全部只读。
- 原脏工作区不修改；实现位于 `/private/tmp/repairdesk-employee-invite-registration-20260717`。
- 不记录密码、OTP、token hash、完整确认链接或 SMTP 原始错误。
- 生产迁移先 linked dry-run；Auth/SMTP 配置必须有真实环境证据。

# Acceptance criteria

1. 授权店主/管理员可发送邀请邮件，普通员工不可发送。
2. 新邮箱收到 Invite 邮件，确认后设置姓名和密码并加入受邀店铺。
3. 已有邮箱收到 Magic Link，确认后可接受邀请且不创建重复 Auth 用户。
4. 当前 Auth 验证邮箱必须和邀请邮箱一致；旧 staff profile 邮箱不能授权。
5. 接受邀请在一个数据库事务内完成，并和店铺生命周期操作使用同一 advisory lock。
6. 过期、撤销、已使用、错误邮箱、Owner 角色和非 active 店铺全部拒绝。
7. 重发保持同一业务邀请并更新投递状态；邮件失败不会显示为成功。
8. SSR token confirmation 限定 `invite|magiclink`、内部 next 路径、no-store/no-referrer，GET 不消费 token。
9. 相关单元/集成测试、lint、typecheck、全量 test、build 和浏览器移动/桌面验证通过。
10. 迁移 dry-run/apply 后核对 history、RPC grants、RLS/constraints；提交范围隔离并推送 main。

# Risk and authority

- R3：认证、邮箱身份、角色、数据库事务和生产邮件配置。
- L2：本地代码、测试、文档和可逆迁移准备可执行。
- L1 production：linked apply、Auth 模板/SMTP 配置、部署只在明确目标和证据下执行。

# Agent plan

- FLOW/UX `/root/flow_ux_invite`: read-only workflow/UI review, completed.
- DATA/API `/root/data_api_invite`: read-only schema/API review, completed.
- SEC/QA `/root/security_qa_invite`: read-only threat/test review, completed.
- INT main thread: sole writer, integration, tests, migration, commit, push, closeout.

# Visual evidence

Required: Settings member invitation on mobile/desktop and dedicated invitation completion page, without real customer PII or secrets.

# Release state

- Local code gates and responsive browser verification passed.
- Linked migrations `20260717220219`, `20260717223030`, `20260717223222` and `20260717223354` are applied and aligned; remote database lint reports no schema errors.
- Hosted Auth Site URL, redirect allow-list and Invite/Magic Link templates are applied while preserving existing MFA/OTP settings and callbacks.
- Vercel Production has `NEXT_PUBLIC_SITE_URL` and `REPAIRDESK_EMAIL_INVITES_ENABLED` configured.
- Remaining before close: scoped commit, push `main`, verify the resulting Vercel deployment and production routes.
