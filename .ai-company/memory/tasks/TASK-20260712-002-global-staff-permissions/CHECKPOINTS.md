# Checkpoints — TASK-20260712-002-global-staff-permissions

## 2026-07-12T00:08:43Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.

## 2026-07-12T00:12:00Z — Contract and isolation established

- **Phase:** planning and architecture.
- **Completed:** owner goal normalized, R4/L2 classification, latest remote fetched, clean worktree created from `origin/main@77e7410e`, central permission/archive/aggregate paths inspected, four read-only reviewers spawned.
- **Evidence:** `TASK.md`, git baseline, `src/server/permissions.ts`, order/store repositories and settings member controls.
- **Decisions:** global role policy only; no store-specific branching; per-order finance separated from aggregate/profit/export; no order data mutation.
- **Risks/blockers:** member grant table currently accepts supplier actions only; production database apply is not yet approved and is not part of code push unless separately authorized.
- **Next:** integrate reviewer contracts, choose the smallest compatible grant strategy, then implement server-first.
## 2026-07-12T01:34:32Z — 全平台订单归档、角色权限、稳定负责人对象鉴权、集合财务脱敏、库存利润脱敏、成员原子撤权和权限缓存隔离已完成代码实现

- **Phase:** implementation
- **Completed/current state:** 全平台订单归档、角色权限、稳定负责人对象鉴权、集合财务脱敏、库存利润脱敏、成员原子撤权和权限缓存隔离已完成代码实现
- **Next:** 完成串行全量测试、build、浏览器桌面/移动截图、最终安全复核、提交并推送 main
- **Decision:** 生产数据库 apply 不在本次自动执行范围；代码保持迁移前非技师流程兼容，技师范围 fail-closed
- **Blocker:** 既有17张旧public表RLS/浏览器授权风险仍是独立生产安全门
- **Evidence:**
  - typecheck/lint/agents:check passed; 112 targeted tests passed; linked Supabase dry-run lists exactly two pending migrations
- **Recorded by:** Integration Lead
## 2026-07-12T03:13:37Z — 最终代码、UI、两份待应用迁移、角色负向测试、119文件/800测试、22路由构建、桌面移动截图、linked dry-run及独立安全复核均完成并通过

- **Phase:** release-ready
- **Completed/current state:** 最终代码、UI、两份待应用迁移、角色负向测试、119文件/800测试、22路由构建、桌面移动截图、linked dry-run及独立安全复核均完成并通过
- **Next:** 核对origin/main未前进，提交任务工作树并推送HEAD:main；远端SHA验证后关闭任务记录并推送closeout
- **Decision:** 迁移前技术员订单访问fail-closed；生产数据库apply仍需独立批准
- **Blocker:** 独立17张legacy public表RLS/浏览器授权风险仍为生产NO-GO，但不阻断本任务代码合并
- **Evidence:**
  - agents/lint/typecheck PASS；119/800 Vitest PASS；build 22 routes PASS；dry-run only two migrations；security PASS；browser screenshots and zero console errors
- **Recorded by:** Integration Lead
