---
schema_version: 1
task_id: "TASK-20260718-011-global-style-recovery"
title: "防止后台恢复时暴露无样式 RepairDesk 页面"
status: "conditional"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["FE", "UX", "QA", "DOC"]
created_at: "2026-07-18T19:21:26+02:00"
updated_at: "2026-07-18T19:33:20+02:00"
---

# Task — 防止后台恢复时暴露无样式 RepairDesk 页面

## Owner goal

检查手机 Chrome 退出后台后再进入时出现的无样式原始页面，确认电脑端、其他浏览器和其他恢复场景的影响，并从全局移除该画面。

## Scope

### In scope

- 根布局的全局 CSS 就绪保护。
- 后台恢复、BFCache、重新联网和样式资源错误后的自动恢复。
- 移除浏览器运行时的 Google Fonts 外部 CSS 依赖，改为 Next.js 构建时自托管。
- 手机与桌面、正常样式与样式失败状态的自动化验证。

### Out of scope

- 生产发布与域名切换。
- Service Worker 离线业务能力重构。
- 业务页面、权限、数据库和 API 行为变化。

## Acceptance criteria

1. CSS 正常时应用页面和字体正常显示，不出现额外恢复层。
2. CSS 未加载或失效时，侧栏、顶栏和业务页面原始 DOM 不可见。
3. 页面从后台、BFCache、重新联网或资源失败恢复时会检查样式并至多自动刷新一次，避免循环。
4. 线上浏览器不再直接请求 `fonts.googleapis.com`。
5. lint、typecheck、unit test、build 和相关浏览器检查有真实结果。

## Facts, assumptions and risks

- Verified: screenshot content matches `AppSidebar`, `AppBar` and settings fallback text with all global styles absent.
- Verified: production CSS is hashed and immutable on Vercel, but begins with a runtime `@import` to Google Fonts.
- Verified: the current Service Worker caches only `/offline` and the app icon; it does not cache CSS.
- Assumption: mobile app switching can freeze, discard or restore the page while network resources are unavailable or delayed.
- Risk: root-layout changes affect every route; rollback is limited to the files listed below.

## Change contract

- Allowed: `src/app/layout.tsx`, `src/styles.css`, style-recovery component/helper/tests, task evidence.
- Forbidden: database, auth, permissions, payments, production deploy, unrelated dirty files.
- Rollback: remove the guard/recovery files and revert the scoped layout/style additions.

## Agent plan

- Main thread is the single writer and Integration Lead.
- No sub-agents spawned: this is one localized root-layout/CSS recovery slice; multi-agent coordination would duplicate the same reads, and the active developer rule does not authorize spawning without an explicit request.
- UX, FE and QA reviews are performed as structured main-thread passes.

## Concurrent-work note

`ACTIVE_CONTEXT.md` already points to an unrelated active R4 AI assistant task and has uncommitted changes. This task does not overwrite that file; its state remains isolated in this directory.

## Closeout

- Result: scoped implementation and browser acceptance completed.
- Quality gate: CONDITIONAL because the repository-wide suite has five unrelated date-sensitive failures in the already modified store invitation tests; 1487 other tests passed.
- Production: not deployed. Owner approval is required for release.
- Visual evidence: `screenshots/TASK-20260718-011-global-style-recovery/mobile-login-styled.jpg` and `desktop-login-styled.jpg`.
