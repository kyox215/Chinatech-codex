---
schema_version: 1
task_id: "TASK-20260718-003-safari-phone-input-fix"
title: "Safari桌面端电话输入与响应式键盘修复"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["FE", "QA", "UX"]
created_at: "2026-07-18T07:44:02Z"
updated_at: "2026-07-18T08:00:39Z"
closed_at: "2026-07-18T08:00:39Z"
---
# Task — Safari桌面端电话输入与响应式键盘修复

## Owner request

Safari桌面端电话输入与响应式键盘修复

## Business value

恢复Safari电脑端实体键盘电话录入，同时保持手机和平板虚拟键盘稳定

## Scope in

- `PhoneKeypadInput` desktop/mobile responsive behavior.
- Desktop WebKit and Chromium physical keyboard input.
- Existing mobile/tablet virtual phone keypad regression coverage.
- Task evidence, visual evidence, commit, and direct `main` push authorized by Owner.

## Scope out

- Money, PIN/device unlock, IMEI, and all other virtual keyboards.
- Database, API, dependency, permission, or business workflow changes.
- Manual production data changes or destructive operations.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] >=1024px电话字段为可聚焦原生tel输入且不显示虚拟键盘
- [x] <1024px继续显示固定底部电话虚拟键盘
- [x] WebKit和Chromium桌面输入通过，移动端键盘与搜索稳定性回归通过
- [x] 其他金额、PIN、IMEI虚拟键盘无改动

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Desktop phone control was always a button | observed | `src/components/orders/phone-keypad-input.tsx` baseline | fixed |
| WebKit pointer click did not focus the button, so its `onKeyDown` never received physical digits | observed | pre-fix WebKit/Chromium comparison | fixed by desktop native input |
| Project tablet/desktop boundary is 1024px | verified | `docs/RESPONSIVE_DENSITY_PLAN.md` | reused without global rule changes |
| Money, PIN, and IMEI keyboard implementations | verified | scoped diff review | unchanged |

## Decision and approval points

- Owner explicitly authorized implementation and direct application/main push.
- No database, production data, secret, permission, or dependency approval is required.

## Work packages

- WP-01: responsive phone control implementation and focused unit tests.
- WP-02: WebKit/Chromium desktop E2E plus mobile phone keypad regression.
- WP-03: full repository quality gates and screenshot evidence.
- WP-04: scoped commit, latest-main integration check, direct `main` push, and release verification.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
