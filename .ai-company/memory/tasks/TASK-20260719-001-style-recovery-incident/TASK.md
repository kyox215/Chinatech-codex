---
schema_version: 1
task_id: "TASK-20260719-001-style-recovery-incident"
title: "无样式页面恢复保护二次事故加固"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["frontend", "design", "qa", "release", "documentation"]
created_at: "2026-07-19T09:45:00+02:00"
updated_at: "2026-07-19T10:08:43+02:00"
closed_at: "2026-07-19T10:08:43+02:00"
---

# Task — 无样式页面恢复保护二次事故加固

## Incident statement

- Severity: SEV-2 customer-visible availability regression.
- Reported at: 2026-07-19 09:40 Europe/Rome from mobile Chrome.
- Impact: a restored RepairDesk tab can expose unstyled navigation and business DOM, making the page confusing and temporarily unusable.
- Data/security: no evidence of data loss, permission bypass, secret exposure or database impact.
- Incident Commander and single writer: Integration Lead.

## Verified facts and resolution

- The new screenshot has no `正在恢复 RepairDesk…` fallback text, which is consistent with a document opened before the first recovery guard was deployed.
- The previous fallback and shell had no inline `style`; both still depended on the same author style layer they were meant to recover.
- Production commit `362e4c3d7624793718fa65b7c96d84fac481c61d` adds independent inline presentation for the fallback and shell.
- Vercel deployment `dpl_3A6RVWswPoUgJueqmYiqJq1jHWRR` is `READY` and owns both `www.chinatech.in` and `chinatech.in`.
- Public HTML is HTTP 200 and contains the critical guard, fallback copy, fixed fallback inline style and shell `style="display:none"`.
- Production Chromium and WebKit each pass all four recovery scenarios on mobile and desktop viewports.

## Findings

1. The screenshot is strongly consistent with mobile Chrome restoring a pre-fix root document; no server-side release can retroactively alter an already-open document, so that tab requires one manual refresh.
2. The remaining structural defect was reproduced: removing the complete author style layer from the previous implementation exposed the business shell.
3. The new inline fallback closes that structural defect without forcing navigation or risking unsaved form input.

## Scope and change contract

- Allowed: root-layout fallback/shell inline presentation, focused Playwright coverage, incident evidence and screenshots.
- Forbidden: API, auth, permissions, database, migrations, service-worker forced tab navigation, unrelated AI/inventory/order/print work.
- No forced refresh of hidden tabs because it could discard unsaved repair/order input.
- Release: continue the Owner-authorized production correction from the preceding `main` release request; fast-forward only after all gates pass.

## Acceptance criteria

1. Normal CSS keeps the recovery fallback hidden and the application shell visible on mobile and desktop.
2. Removing every external stylesheet and the critical `<head>` style after the page has loaded still leaves the fallback visible and the business shell hidden.
3. Aborted CSS requests still reload at most once and never loop.
4. Chromium and WebKit pass the normal, missing-CSS and complete-author-style-loss scenarios.
5. Latest-main lint, typecheck, unit tests, production build and full regression pass.
6. Final `main`, Vercel deployment and `chinatech.in` runtime state are recorded with mobile/desktop visual evidence.

## Plan and rollback

- Add static inline presentation to the fallback, its content and the application shell; normal global CSS continues to override only `display` with `!important`.
- Add an E2E regression that removes both stylesheet links and the critical style node after initial rendering.
- Rollback is a single Git revert of the isolated incident commit; no data rollback is involved.

## Concurrency note

- The root checkout and `TASK-20260718-012-workspace-integration-release` remain untouched.
- No sub-agents spawned: the active developer rule does not permit delegation without an explicit user request, and this fix has one tightly coupled layout/test write set.
