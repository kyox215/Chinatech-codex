---
schema_version: 1
task_id: "TASK-20260721-001-orders-filter-removal"
title: "移除工单页重复筛选侧栏"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["frontend", "qa"]
created_at: "2026-07-21T08:10:40Z"
updated_at: "2026-07-21T10:43:39Z"
---
# Task — 移除工单页重复筛选侧栏

## Owner request

移除工单页重复筛选侧栏

## Business value

减少桌面工单页重复入口与误触，保持主工具栏精简。

## Scope in

- Remove the desktop Orders toolbar button named `筛选`.
- Remove the right-side filter Sheet and its screen-local state/callbacks.
- Update the responsive Playwright regression to prevent reintroduction.

## Scope out

- Order data, query contracts, workflow queues, search, archive view, scan, and new-order behavior.
- The reusable filter component and legacy routes that still consume it.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 工单页不再显示名为筛选的按钮或右侧筛选抽屉。
- [x] 搜索、队列、归档视图、扫码与新建工单保持可用。
- [x] lint、typecheck、完整单元测试、build 和定向 Playwright 回归通过。
- [x] 合并提交已部署到生产，认证后的 `/orders` 页面和线上错误日志均完成核验。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner requested production deployment | approved | main Codex task: `部署` | completed |
| Exact merged production source | verified | `origin/main` and Vercel source commit `50a7b11988ad8e3802968e60af5a16ace9ac6ad7` | closed |
| Production Orders toolbar behavior | verified | authenticated Chrome inspection and screenshot | closed |

## Decision and approval points

- Owner approved production deployment.
- Release remained R1/L2 because it changed only a reversible client-side UI entry; no database, permission, secret, environment, dependency, or data mutation was included.
- The separately active store-purge task context remained untouched.

## Work packages

- Main thread: inspection, minimal implementation, regression updates, validation, screenshot, checkpoint.
- No-spawn reason: this was one localized UI removal with a single write surface; sub-agent overhead and shared-file coordination would exceed the task risk and value.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
