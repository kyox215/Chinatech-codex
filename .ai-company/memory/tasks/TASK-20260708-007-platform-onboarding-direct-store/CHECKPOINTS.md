## 2026-07-08T11:28:04Z — Fixed platform onboarding queue schema drift by falling back when onboarding_requests.review_scope is missing, and auto-approving legacy create_store requests into active stores with owner membership and audit log. Verified /platform no longer shows the review_scope error.

- **Phase:** verified
- **Completed/current state:** Fixed platform onboarding queue schema drift by falling back when onboarding_requests.review_scope is missing, and auto-approving legacy create_store requests into active stores with owner membership and audit log. Verified /platform no longer shows the review_scope error.
- **Next:** If shipping this task, stage only src/features/platform/server/platform.repository.ts, src/features/platform/server/platform.repository.test.ts, .ai-company/memory/tasks/TASK-20260708-007-platform-onboarding-direct-store/TASK.md, and screenshots/TASK-20260708-007-platform-onboarding/platform-queue-fixed.png from the dirty main workspace or reproduce the scoped diff in a clean worktree.
- **Decision:** New store registration remains self-service through stores/create; platform queue now heals old pending create_store requests instead of requiring platform approval.
- **Evidence:**
  - npm run lint pass; npm run typecheck pass; vitest platform/stores/auth/router/schema focused suite 5 files 74 tests pass; npm run build pass after sandbox escalation; screenshot screenshots/TASK-20260708-007-platform-onboarding/platform-queue-fixed.png
- **Recorded by:** Integration Lead
## 2026-07-08T11:40:33Z — 平台审批队列 review_scope 缺列 fallback、旧 create_store 自动开通、直接创建店铺默认配置初始化已同步到干净 worktree；focused tests 78 passed，typecheck/lint passed，webpack build passed，git diff --check passed。

- **Phase:** ready_to_push
- **Completed/current state:** 平台审批队列 review_scope 缺列 fallback、旧 create_store 自动开通、直接创建店铺默认配置初始化已同步到干净 worktree；focused tests 78 passed，typecheck/lint passed，webpack build passed，git diff --check passed。
- **Next:** stage scoped onboarding/platform/store files, commit, push HEAD to origin/main, then verify origin/main SHA and record pushed checkpoint.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
## 2026-07-08T11:42:36Z — 已提交并推送 main：2b642adb260d3507fcad24571d40c6ed075d4d84。修复平台审批队列 review_scope 缺列 fallback，旧 create_store 申请自动开通店铺，直接创建店铺时初始化默认设置/消息模板/工单流程，并加入邮箱验证和生产 mock fail-closed 保护。验证：focused tests 78 passed，typecheck passed，lint passed，next build --webpack passed，git diff --cached --check passed，远端 refs/heads/main 已核对为该 SHA。

- **Phase:** pushed_main
- **Completed/current state:** 已提交并推送 main：2b642adb260d3507fcad24571d40c6ed075d4d84。修复平台审批队列 review_scope 缺列 fallback，旧 create_store 申请自动开通店铺，直接创建店铺时初始化默认设置/消息模板/工单流程，并加入邮箱验证和生产 mock fail-closed 保护。验证：focused tests 78 passed，typecheck passed，lint passed，next build --webpack passed，git diff --cached --check passed，远端 refs/heads/main 已核对为该 SHA。
- **Next:** 等待 Vercel/GitHub main 自动部署完成；若平台页仍异常，优先检查生产数据库 onboarding_requests schema 与部署日志。
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
