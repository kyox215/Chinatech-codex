---
schema_version: 1
task_id: "TASK-20260619-007"
title: "New order desktop dialog three-column density refactor"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["UX", "FE", "QA", "INT"]
created_at: "2026-06-19T19:31:44Z"
updated_at: "2026-06-19T19:31:44Z"
closed_at: "2026-06-19T19:31:44Z"
---
# Task — New order desktop dialog three-column density refactor

## Owner request

Optimize the desktop display of the "新建维修订单" page/dialog. Space use was poor; show as much as possible in one screen and refactor to a three-column desktop layout.

## Business value

Make high-frequency repair order intake faster for Chinatech by keeping customer/device, diagnosis, quotation, and service settings visible together on desktop.

## Scope in

- Refactor the new order desktop workspace into customer/device, diagnosis, and quotation/service columns.
- Keep mobile and narrow desktop responsive behavior safe.
- Reuse existing RepairDesk UI tokens and form components.
- Validate static checks, build, tests, and desktop overflow/browser behavior.

## Scope out

- Data model, API payload, status workflow, auth, payment, inventory, or production data changes.
- Deployment or pushing to remote.
- Reworking unrelated order detail desktop audit failures.

## Hard constraints

- Preserve customer/device and create-order business logic.
- Do not introduce hard-coded colors outside existing tokens.
- Do not modify existing dirty-worktree files outside the explicit UI scope.
- Keep 1024px safe by degrading to two columns when the app sidebar leaves too little content width.

## Acceptance criteria

- [x] New order desktop dialog uses three columns at 1280px and 1440px.
- [x] 1024px avoids horizontal overflow by using two columns with readable section widths.
- [x] Quotation and service settings are editable in the right column instead of hidden in a duplicated summary panel.
- [x] `/orders/new` has no page-level overflow at 1024px, 1280px, and 1440px.
- [x] `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Desktop form was previously two columns until 2xl | observed | `src/features/orders/screens/new-order-screen.tsx` before diff | resolved |
| True three-column layout is safe from 1280px | observed | Playwright metrics in `EVIDENCE.md` | complete |
| 1024px cannot safely fit three columns after sidebar and padding | observed | failed first E2E and passing adjusted metrics | resolved by two-column breakpoint |
| Existing order detail audit selectors still fail in full desktop E2E | observed | first `npm run test:e2e:desktop` run | outside scope |

## Decision and approval points

- Risk: R1, local UI-only refactor.
- Autonomy: L2 controlled execution.
- No owner approval was required because there were no production, data, secret, payment, permission, dependency, or destructive source-code changes.

## Definition of done

- UI refactor implemented with existing components/tokens.
- Required quality gates passed.
- Browser evidence confirms no overflow and expected columns.
- Task memory updated.
