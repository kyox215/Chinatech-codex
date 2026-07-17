# Handoff / Resume — TASK-20260717-165957-task

## Current handoff

- **Status:** first-phase local implementation verified.
- **Scope completed:** no-DDL online create recovery and duplicate-submit guard.
- **Important files:** `src/lib/repairdesk/api.ts`, `src/lib/repairdesk/types.ts`, `src/server/api/repairdesk-router.ts`, `src/server/api/repairdesk-schemas.ts`, `src/features/orders/server/order.repository.ts`, `src/features/orders/screens/new-order-screen.tsx`, `src/features/orders/forms/new-order-submit-bar.tsx`, tests listed in `EVIDENCE.md`.
- **Screenshots:** `screenshots/TASK-20260717-165957-order-create-recovery/new-order-desktop-1440x900.png`; `screenshots/TASK-20260717-165957-order-create-recovery/new-order-mobile-390x844.png`.
- **Verification:** lint, typecheck, targeted tests, full Vitest, build, mobile new-order E2E, visual overflow E2E all passed.
- **Not done:** production deployment, production DB migration, full atomic create RPC.
- **Next if releasing:** final diff review, commit scoped changes, push, then deploy/observe only with Owner approval.
