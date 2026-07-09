---
schema_version: 1
task_id: "TASK-20260709-015-phone-keypad-bottom-dock"
title: "Phone virtual keypad bottom dock fix"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["UX", "FE", "QA"]
created_at: "2026-07-09T12:57:49Z"
updated_at: "2026-07-09T13:10:57Z"
---
# Task - Phone virtual keypad bottom dock fix

## Owner Goal

老板截图反馈电话虚拟键盘仍然出现在上方，要求检查原因并继续执行，完成后推送 `main`。

## Root Cause

`PhoneKeypadInput` still used Radix `Popover` / `PopoverContent`, so the phone keypad was anchored around the phone field instead of the shared fixed-bottom `VirtualKeyboardDock`. The previous release migrated money and PIN keypads but did not migrate the phone keypad component.

## Scope

- Migrate `PhoneKeypadInput` to `VirtualKeyboardDock`.
- Preserve existing phone keypad trigger/value behavior and public props.
- Add component-level dock assertion for phone keypad.
- Add Playwright assertions that the phone keypad is inside `data-virtual-keyboard-dock`, uses fixed positioning, and opens in the lower part of the mobile viewport.
- Refresh visual screenshot evidence.

## Out Of Scope

- Native OS keyboard behavior.
- Customer search API/data changes.
- Unrelated kiosk/staff, supplier, migration, inventory, or IMEI workstreams.

## Acceptance

- Phone virtual keypad renders in the bottom-centered fixed dock.
- Phone keypad no longer uses field-anchored Popover positioning.
- Existing phone lookup 1-digit stability behavior still passes.
- Money keypad and other virtual keypad behavior remains intact.
- Lint, typecheck, tests, build, and mobile Playwright pass before push.

## Agent Plan

- Single-agent scoped implementation.
- No spawned sub-agents: this is a narrow follow-up bug fix in one shared component plus tests; multiple writers would add conflict risk without useful independence.

## Verification Summary

- Passed: focused Vitest for phone, money, PIN, lookup, and option picker tests.
- Passed: targeted ESLint and full project ESLint.
- Passed: full project TypeScript check.
- Passed: full Vitest suite.
- Passed: mobile Playwright screenshot/e2e.
- Passed: production build outside restrictive sandbox.
- Passed after rebase onto latest `origin/main`: full lint, typecheck, focused Vitest, and production build.

## Release Target

Pushed scoped fix commit `c316e953128d2944b5bd170189737cfc77aaa76b` from clean `/tmp/repairdesk-phone-keypad-dock` worktree to `main`.

## Closure

- Final status: closed.
- Closeout evidence commit is expected after this task memory update.
- Original checkout remained dirty/divergent and was not used for the scoped main push.
