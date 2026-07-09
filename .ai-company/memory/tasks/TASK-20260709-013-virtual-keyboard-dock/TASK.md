---
schema_version: 1
task_id: "TASK-20260709-013-virtual-keyboard-dock"
title: "Fixed bottom virtual keyboard dock and overlay avoidance"
status: "released"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["UX", "FE", "QA"]
created_at: "2026-07-09T11:46:44Z"
updated_at: "2026-07-09T12:27:07Z"
---
# Task - Fixed bottom virtual keyboard dock and overlay avoidance

## Owner Goal

老板要求把所有系统内自定义虚拟键盘固定在下方中间，不能随着画面内容变化而跳动；当弹出选择窗口时，选项框需要上移，避免遮挡虚拟键盘。

## Scope

- Add a shared fixed-bottom virtual keyboard dock for custom in-app keypads.
- Migrate reusable order money keypad to the fixed dock so all existing money keypad usages inherit the behavior.
- Migrate device unlock PIN keypad to the fixed dock.
- Make related phone lookup, customer/device option menus, fault diagnosis picker, and multi-select dropdown prefer upward overlays with max-height constrained by keyboard avoidance variables.
- Add/adjust component tests for money and PIN keyboard stability.

## Out Of Scope

- Browser/native OS keyboard behavior.
- Production deploy.
- Customer search API/data contract changes.
- Existing unrelated kiosk/staff review worktree changes.

## Acceptance

- Custom virtual keyboards render in a bottom-centered fixed portal and do not move with form reflow.
- Money keypad and device unlock PIN keypad both use the fixed dock.
- Opening dropdown/popover options near the lower screen prefers upward placement and limits height using keyboard avoidance space.
- Existing order form behavior and phone lookup threshold fix remain intact.
- Local lint, typecheck, and tests pass where the sandbox allows execution.

## Agent Plan

- Single-agent implementation with one writer.
- No spawned sub-agents: the owner did not request multi-agent execution for this implementation turn, and the change is a tightly coupled UI refactor across shared components where multiple writers would create ownership overlap.

## Verification Summary

- Passed: targeted ESLint over changed files.
- Passed: related Vitest suite for money keypad, PIN keypad, phone lookup stability, and option picker behavior.
- Passed: full TypeScript check.
- Passed: full Vitest test suite.
- Passed: full ESLint.
- Passed after final CSS class correction: targeted ESLint, TypeScript check, related Vitest, and diff whitespace check.
- Passed after non-sandbox rerun: production build and mobile Playwright screenshot/e2e.
- Passed on clean `origin/main` worktree after cherry-pick conflict resolution: lint, typecheck, full Vitest, production build, and mobile Playwright.
- Release target: scoped commit to `main`, excluding unrelated kiosk/staff worktree changes.

## Active Context Note

`.ai-company/memory/ACTIVE_CONTEXT.md` was not overwritten because it currently belongs to the unrelated `TASK-20260709-008-kiosk-staff-review` release-isolation workstream and is dirty in this checkout.
