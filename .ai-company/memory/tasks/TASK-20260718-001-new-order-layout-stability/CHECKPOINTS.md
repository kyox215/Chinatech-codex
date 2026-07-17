# Checkpoints — TASK-20260718-001-new-order-layout-stability

## 2026-07-17T22:23:35Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.

## 2026-07-17T22:53:31Z — 新建工单布局稳定性、待检测安全提交、本机暂停草稿与 outbox 剥离已实现；lint/typecheck、214 文件 1472 测试、Webpack build、六档 Playwright 与截图通过。

- **Phase:** implementation
- **Completed/current state:** 新建工单布局稳定性、待检测安全提交、本机暂停草稿与 outbox 剥离已实现；lint/typecheck、214 文件 1472 测试、Webpack build、六档 Playwright 与截图通过。
- **Next:** 等待员工邀请并发任务把已应用的 4 个生产 migration 连同代码推送 main；随后 fetch/rebase、复跑门禁、linked list/dry-run no-op、提交并非强制推送 main、验证部署。
- **Decision:** 本任务无 schema 变化，不创建空 migration；待检测提交空报价与零定金，本机 paused 字段进入 outbox 前剥离。
- **Blocker:** 并发员工邀请任务已将 4 个 migration 应用生产，但 origin/main 尚未包含其代码和迁移文件；发布必须等待其先完成，禁止复制半成品或使用 --include-all。
- **Evidence:**
  - 214 test files / 1472 tests passed; Playwright 390/430/768/1024/1280/1440 6/6 passed; screenshots/TASK-20260718-001-new-order-layout-stability; production migration list is ahead of origin/main by 20260717220219, 20260717223030, 20260717223222, 20260717223354.
- **Recorded by:** IntegrationLead

## 2026-07-17T23:06:08Z — 已吸收员工邀请并发发布，修复其 Next Route 非法导出构建阻断；lint/typecheck/agents、218 文件 1489 测试、24 路由 Webpack build、六档 Playwright 通过；linked Supabase list 对齐且 db push dry-run 为 up to date。

- **Phase:** release
- **Completed/current state:** 已吸收员工邀请并发发布，修复其 Next Route 非法导出构建阻断；lint/typecheck/agents、218 文件 1489 测试、24 路由 Webpack build、六档 Playwright 通过；linked Supabase list 对齐且 db push dry-run 为 up to date。
- **Next:** 提交刷新后的证据截图，rebase origin/main@00d3eca4，复跑受影响门禁，获取发布锁并非强制推送 HEAD:main；验证远端 SHA、Vercel READY、生产 /orders/new 和 post-push Supabase no-op 后关闭任务。
- **Decision:** 本任务无 migration，生产应用为 no-op；员工邀请并发代码完整进入 main 后才继续，且 Route 构建修复单独提交。
- **Evidence:**
  - commit 18d09ef9; full Vitest 218/1489; Playwright 6/6; Next Webpack build 24 routes; Supabase list aligned through 20260717223354; dry-run Remote database is up to date.
- **Recorded by:** IntegrationLead
