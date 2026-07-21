# Checkpoints — TASK-20260721-005-new-order-blank-name-safari-transition

## 2026-07-21T15:46:35Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-21T15:46:35Z — 已完成空姓名前向迁移与建单后缓存同步；全量2170测试、lint、typecheck、build及WebKit建单后立即打开流转面板验证通过。

- **Phase:** pre-release
- **Completed/current state:** 已完成空姓名前向迁移与建单后缓存同步；全量2170测试、lint、typecheck、build及WebKit建单后立即打开流转面板验证通过。
- **Next:** 复核差异后提交，先应用数据库迁移，再发布应用并执行生产只读验证。
- **Decision:** 采用前向迁移移除唯一空姓名拦截；导航前等待分店作用域缓存刷新并预热新工单详情。
- **Blocker:** 无；实际生产迁移和部署尚未执行。
- **Evidence:**
  - supabase db push --dry-run仅列出20260721150000；WebKit 2项通过；截图screenshots/TASK-20260721-005-new-order-blank-name-safari-transition/safari-created-order-transition-ready.png
- **Recorded by:** IntegrationLead
