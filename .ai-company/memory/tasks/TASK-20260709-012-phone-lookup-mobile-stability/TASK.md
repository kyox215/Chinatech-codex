---
schema_version: 1
task_id: "TASK-20260709-012-phone-lookup-mobile-stability"
title: "Mobile phone lookup popover stability"
status: "verified"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["UX", "FE", "QA"]
created_at: "2026-07-09T11:22:12Z"
updated_at: "2026-07-09T12:15:35Z"
---
# Task — Mobile phone lookup popover stability

## Owner Goal

老板反馈 `/orders/new` 新建维修订单的电话搜索字段在手机虚拟键盘打开后，输入第一个数字时位置会变化，导致点错。目标是优化 UI 交互，让首位号码输入时键盘和输入区域保持稳定。

## Scope

- `CustomerIntakeLookup` used by new-order customer phone intake.
- Reusable `CustomerPhoneLookup` used by order/customer phone editing.
- Regression tests for phone lookup popover opening thresholds.
- Playwright mobile validation spec for future screenshot/visual verification.

## Out Of Scope

- Customer search API/data contract changes.
- Production deployment.
- Current unrelated kiosk/staff review worktree changes.

## Acceptance

- A 1-digit or 2-digit numeric phone input must not open the search popover.
- A 3-digit numeric phone input may open the search popover and query normally.
- A 2-character text search must still open lookup results.
- New-order mobile e2e spec records the intended visual/position assertion when a dev server can bind a local port.

## Agent Plan

- Single-agent implementation.
- No spawned sub-agents: scope is a small local UI behavior fix across two closely related components; spawning would add coordination cost without independent file ownership benefit.

## Verification Summary

- Passed: focused Vitest for lookup stability.
- Passed: full Vitest.
- Passed: full ESLint.
- Passed: full TypeScript check.
- Passed after non-sandbox rerun: mobile Playwright screenshot/e2e for first digit stability.
- Passed after non-sandbox rerun: production build.

## Active Context Note

`.ai-company/memory/ACTIVE_CONTEXT.md` was not overwritten because it already belongs to the unrelated `TASK-20260709-008-kiosk-staff-review` release-isolation workstream in this dirty checkout.
