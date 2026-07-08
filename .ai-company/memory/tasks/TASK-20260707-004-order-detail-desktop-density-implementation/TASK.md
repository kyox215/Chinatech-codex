---
schema_version: 1
task_id: "TASK-20260707-004-order-detail-desktop-density-implementation"
status: "completed"
task_class: "T2"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead"
created_at: "2026-07-07T15:43:20+02:00"
updated_at: "2026-07-07T14:44:43Z"
---
# Task

## Owner Goal

按照 `docs/ORDER_DETAIL_DESKTOP_DENSITY_UI_PLAN.md` 设置实施目标并执行，优化电脑端工单详情 Dialog，使其不再简单随大屏拉伸，并保持高密度、紧凑、直观。

## Business Value

Chinatech 前台和技师在电脑端处理工单时需要一屏快速看到客户、设备、故障、报价、照片和记录入口。桌面高密度布局减少滚动和空白，提高查单、改单、收款效率。

## In Scope

- Bound order detail Dialog width.
- Rebuild desktop overview layout around primary/secondary aligned columns.
- Compress desktop photo panel.
- Adjust action dock breakpoint behavior.
- Update desktop UI audit assertions.
- Verify with static checks and, where available, browser screenshots.

## Out of Scope

- Mobile RepairOS detail redesign.
- Database/API/order workflow/payment/notification behavior changes.
- Production deploy, push, schema changes, Supabase commands.
- Broad cleanup of unrelated dirty worktree files.

## File Ownership

- `src/lib/ui-patterns.ts`
- `src/lib/component-patterns.ts`
- `src/features/orders/screens/order-list-screen.tsx`
- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/components/order-overview-tab.tsx`
- `tests/e2e/order-desktop-ui-audit.spec.ts`
- `.ai-company/memory/tasks/TASK-20260707-004-order-detail-desktop-density-implementation/*`

## Acceptance

- Dialog does not expand beyond the planned desktop maximum on 1440/1536.
- Desktop overview keeps customer/device/finance readable and aligns photos/secondary info without full-width stretched photo rows.
- Photo panel remains bounded and thumbnail-based.
- Action dock remains compact and does not force button text overflow at 1024.
- Mobile detail path remains untouched except verification.
- Tests or documented verification evidence exists.

## No-Spawn Reason

This implementation is a single bounded UI slice with one writer and no owner request for multi-agent execution. Sub-agent spawning would duplicate reads over the same files and increase coordination risk in an already dirty worktree.
