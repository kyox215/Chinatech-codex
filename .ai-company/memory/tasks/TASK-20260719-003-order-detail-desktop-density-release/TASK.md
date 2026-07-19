---
schema_version: 1
task_id: "TASK-20260719-003-order-detail-desktop-density-release"
title: "工单详情桌面进度与记录分组优化发布"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["FE", "UX", "QA", "RELEASE"]
created_at: "2026-07-19T21:20:00+02:00"
updated_at: "2026-07-19T22:18:24Z"
closed_at: "2026-07-19T22:18:24Z"
---
# Task

## Owner request

缩小桌面工单详情顶部进度条，把关键信息、历史通知和时间线合并为一个分组；完成后推送并应用。

## Business outcome

桌面工单详情默认概览减少纵向滚动，记录类内容在同一详情工作面内按需切换；移动端、订单状态机、权限、金额和数据契约保持兼容。

## Scope

- Desktop dialog compact stage rail.
- Desktop overview and records/info view switch.
- Group key information, notification history, and timeline behind one accessible segmented view.
- Update focused tests and loading skeleton where required.
- Push the validated commit to `main`, observe Vercel deployment, and verify production UI.

## Out of scope

- Database migrations or Supabase changes.
- API, workflow-state, payment, notification-send, custody, or permission behavior changes.
- Mobile RepairOS layout redesign.
- Unrelated cleanup or refactors.

## Acceptance criteria

1. Dialog stage rail is a single compact row and preserves all five stage semantics.
2. Default desktop overview does not mount the full key-info, message, or timeline sections.
3. `记录与信息` opens inside the current dialog and contains accessible sub-tabs for `关键信息`, `历史通知`, and `时间线`.
4. Editing returns to overview; mobile detail remains unchanged.
5. Cost visibility, custody gates, action dock, payment, notification, and workflow behavior remain unchanged.
6. Lint, typecheck, tests, build, focused desktop E2E, and browser screenshot verification pass before push.
7. Production deployment is READY and the real order-detail path passes a no-mutation smoke check.

## Risk and approval

- Implementation: R2/L2, reversible UI change.
- Production push/deploy: R3/L2; explicitly approved by Owner in this task.
- Stop before push if any required gate fails. Roll back to the previous production commit on material UI or workflow regression.

## Workspace isolation

Implementation is isolated from the dirty root checkout in `/private/tmp/repairdesk-order-density.Rtt85d`, based on the verified `origin/main` baseline. The unrelated root `ACTIVE_CONTEXT.md` is intentionally not overwritten.
