# Checkpoints

## 2026-07-05 CEST - Planning draft created

Status: planned_waiting_owner_decision

Completed:

- Created customer workbench planning document.
- Identified existing customer detail data and UI structure.
- Defined default recommendation: device-centered customer detail workbench.
- Listed owner decisions before implementation.

Not completed:

- No UI implementation yet.
- No tests run; no code changed.
- No browser screenshot generated because no UI changed.

Next:

- Wait for owner choices.
- If owner confirms default options, start Phase CUST-1 derived model and tests.

Risks:

- Future implementation touches customer PII and payment summaries, so store isolation and server-side permission boundaries must be preserved.
- Current repository has broad unrelated dirty worktree changes; implementation must stage only task-owned files.
## 2026-07-05T13:28:25Z — Created customer management workbench planning document focused on lightweight outer cards and device-centered customer detail with history orders, payment stats, followups, and owner decision options.

- **Phase:** planned_waiting_owner_decision
- **Completed/current state:** Created customer management workbench planning document focused on lightweight outer cards and device-centered customer detail with history orders, payment stats, followups, and owner decision options.
- **Next:** Wait for owner choices. If default all-A is approved, start Phase CUST-1 derived customer workbench model and tests before changing detail UI.
- **Decision:** Default recommendation is all A: device-centered detail, current matters first, unpaid-first money label, merged tabs, no device-level followups in phase 1, no customer merge in phase 1.
- **Evidence:**
  - docs/CUSTOMER_MANAGEMENT_WORKBENCH_PLAN.md; .ai-company/memory/tasks/TASK-20260705-006-customer-workbench-planning/
- **Recorded by:** CEO-Orchestrator
## 2026-07-05T13:31:21Z — Supplemented customer workbench plan with feature priority tiers and approval-time implementation work packages WP-01 through WP-04.

- **Phase:** planned_waiting_owner_decision
- **Completed/current state:** Supplemented customer workbench plan with feature priority tiers and approval-time implementation work packages WP-01 through WP-04.
- **Next:** Wait for owner feature choices. If owner confirms all A, start WP-01 derived customer workbench model and tests, then WP-02 detail IA refresh.
- **Decision:** Implementation remains paused until owner confirms feature options; no UI or database code changed.
- **Evidence:**
  - docs/CUSTOMER_MANAGEMENT_WORKBENCH_PLAN.md sections 11-15; .ai-company/memory/tasks/TASK-20260705-006-customer-workbench-planning/TASK.md
- **Recorded by:** CEO-Orchestrator
## 2026-07-05T14:03:23Z — Customer workbench phase 1 implemented: order-centered history, profile-first overview, simplified mobile customer cards, merged followups/messages/timeline, unified money/status semantics, device empty state, tab ARIA.

- **Phase:** phase-1-implemented
- **Completed/current state:** Customer workbench phase 1 implemented: order-centered history, profile-first overview, simplified mobile customer cards, merged followups/messages/timeline, unified money/status semantics, device empty state, tab ARIA.
- **Next:** Next phase: decide whether to implement device-level analytics, safer device delete confirmation, and customer list desktop table simplification.
- **Decision:** Owner selected 1B 2B 3B 4A 5A 6A; integrated read-only QA/UX sub-agent findings for money consistency, workflow closed classification, cancelled order exclusion, timeline visibility, empty state, list density, tab count and ARIA.
- **Evidence:**
  - npm run test passed 54 files / 351 tests; customer tests passed 4 files / 22 tests; npx tsc --noEmit passed; npm run lint passed; npm run build passed; screenshots saved under screenshots/TASK-20260705-006-customer-workbench-planning/
- **Recorded by:** CEO-Orchestrator
## 2026-07-05T14:33:55Z — Customer workbench phase 2 implemented: device tab now derives linked order statistics, latest order, repair/active counts, total/unpaid amounts, warranty label, and cancelled-order-safe state classification; validation passed customer tests, typecheck, lint, build; mobile screenshot saved.

- **Phase:** phase-2-implemented
- **Completed/current state:** Customer workbench phase 2 implemented: device tab now derives linked order statistics, latest order, repair/active counts, total/unpaid amounts, warranty label, and cancelled-order-safe state classification; validation passed customer tests, typecheck, lint, build; mobile screenshot saved.
- **Next:** Next recommended action: Phase 3 device detail drill-down and safer device deletion/archiving rules. Start by reviewing customer device delete flow, order-device relations, and customer detail mobile device panel before any schema change.
- **Decision:** Continue with detail-workbench-first strategy; no schema migration in phase 2; cancelled orders are closed before unpaid checks so they do not affect device financial stats.
- **Evidence:**
  - src/features/customers/model/customer-workbench.ts; src/features/customers/model/customer-workbench.test.ts; src/features/customers/components/customer-profile-blocks.tsx; src/features/customers/components/customer-detail-panels.tsx; src/features/customers/screens/customer-detail-screen.tsx; screenshots/TASK-20260705-006-customer-workbench-planning/customer-detail-mobile-devices-phase2-viewport.png; npm run test -- src/features/customers; npx tsc --noEmit --pretty false; npm run lint; npm run build
- **Recorded by:** CEO-Orchestrator
## 2026-07-05T21:55:08Z — Customer workbench Phase 3 planned after owner selected option A: mobile device detail uses a near-full-screen bottom sheet. Product, UX, and data read-only sub-agents reviewed the plan. Phase 3 remains migration-free, reuses CustomerDeviceWorkbenchItem, blocks hard delete for linked-order devices, and defers true device archive to Phase 4.

- **Phase:** phase-3-planned
- **Completed/current state:** Customer workbench Phase 3 planned after owner selected option A: mobile device detail uses a near-full-screen bottom sheet. Product, UX, and data read-only sub-agents reviewed the plan. Phase 3 remains migration-free, reuses CustomerDeviceWorkbenchItem, blocks hard delete for linked-order devices, and defers true device archive to Phase 4.
- **Next:** Next implementation action: implement Phase CUST-11 selected device state and bottom sheet trigger in customer detail devices panel, then build the device sheet component using existing CustomerDeviceWorkbenchItem data. Do not add database migration or fake archive in Phase 3.
- **Decision:** Owner selected option A bottom sheet. Integrated sub-agent consensus: no independent route, no migration, no true archive, no hard delete for devices with any linked repair_orders; cancelled orders visible in history but excluded from device stats.
- **Evidence:**
  - docs/CUSTOMER_MANAGEMENT_WORKBENCH_PLAN.md; .ai-company/memory/tasks/TASK-20260705-006-customer-workbench-planning/TASK.md; product sub-agent 019f3443-574e-7c10-9da0-15685cf081a4; UX sub-agent 019f3443-5862-7be2-bf05-a87f2895db90; data sub-agent 019f3443-590f-71d2-ac76-bb0af6b96140; src/features/customers/model/customer-workbench.ts; src/features/customers/components/customer-profile-blocks.tsx; src/features/customers/components/customer-detail-panels.tsx
- **Recorded by:** CEO-Orchestrator
## 2026-07-05T21:56:26Z — Customer workbench phase 3 implemented: customer device cards now expose an expandable device history preview and hide destructive delete action when a device has linked historical orders, showing a retention reason instead. No schema migration, production deployment, permission model change, or customer merge was performed.

- **Phase:** phase-3-implemented
- **Completed/current state:** Customer workbench phase 3 implemented: customer device cards now expose an expandable device history preview and hide destructive delete action when a device has linked historical orders, showing a retention reason instead. No schema migration, production deployment, permission model change, or customer merge was performed.
- **Next:** Consider a separate Phase 4 for full device detail drawer or true archive semantics; pause before schema/API changes.
- **Decision:** Use UI-level delete protection aligned with existing backend rule that blocks deleting devices linked to repair_orders; do not introduce archive schema in this phase.
- **Evidence:**
  - customer-workbench.ts; customer-workbench.test.ts; customer-profile-blocks.tsx; screenshot customer-detail-mobile-devices-phase3-history.png; focused and full tests, typecheck, lint, build passed
- **Recorded by:** CEO-Orchestrator

## 2026-07-06T00:54:58+02:00 — Customer workbench Phase 3 bottom sheet implemented: device cards now open a near-full-screen mobile Sheet with device identity, 2x2 statistics, current risk, full linked order history, sticky actions, and linked-order delete protection.

- **Phase:** phase-3-bottom-sheet-implemented
- **Completed/current state:** Implemented `CustomerDeviceSheet`, connected selected-device state in the customer `设备` panel, converted device card body into the Sheet trigger with keyboard support, stopped nested action/link propagation, added delete confirmation for direct card deletes, and broadened customer device/intake-search cache invalidation.
- **Next:** Phase 4 should be planned separately before adding true device archive semantics or schema/API changes. Keep Phase 3 migration-free and do not hard-delete devices linked to any repair order.
- **Decision:** Owner selected option A bottom sheet; Phase 3 replaces the previous inline history preview as the primary drill-down while preserving service-side hard-delete protection.
- **Evidence:**
  - `src/features/customers/components/customer-device-sheet.tsx`
  - `src/features/customers/components/customer-detail-panels.tsx`
  - `src/features/customers/components/customer-profile-blocks.tsx`
  - `src/features/customers/screens/customer-detail-screen.tsx`
  - `npm run test -- src/features/customers/model/customer-workbench.test.ts src/features/customers/testing/mock-api.test.ts src/features/customers/server/customer.repository.test.ts` passed 3 files / 16 tests
  - `npm run typecheck`, `npm run lint`, and elevated `npm run build` passed
  - 393px production preview screenshot: `screenshots/TASK-20260705-006-customer-workbench-planning/customer-phase3-mobile-device-sheet-393-prod.png`
  - Mobile metrics: `scrollWidth=393`, `innerWidth=393`, `hasOverflow=false`, linked-order device `hardDeleteVisible=false`, Sheet rect `{ top: 92, bottom: 852, width: 385 }`
- **Sub-agents used:** project_explorer `019f3470-c1a2-7a71-9211-cac5c6c2c554`, ux_reviewer `019f3470-c296-7f93-b9fb-3360abd356e2`, qa_reviewer `019f3470-c357-7da1-8cf1-b09d0e0eddee`
- **Recorded by:** CEO-Orchestrator
## 2026-07-05T23:12:55Z — Customer workbench Phase 3 bottom sheet implemented and verified: mobile device cards open a near-full-screen Sheet with full linked order history, stats, sticky actions, and linked-order delete protection. Focused tests, typecheck, lint, build, and 393px production-preview screenshot/metrics passed.

- **Phase:** implementation
- **Completed/current state:** Customer workbench Phase 3 bottom sheet implemented and verified: mobile device cards open a near-full-screen Sheet with full linked order history, stats, sticky actions, and linked-order delete protection. Focused tests, typecheck, lint, build, and 393px production-preview screenshot/metrics passed.
- **Next:** Push scoped Phase 3 bottom sheet implementation to main; Phase 4 true device archive requires separate schema/API planning and approval before any migration.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
## 2026-07-05T23:13:43Z — Customer workbench Phase 3 bottom sheet implementation is ready to push: mobile device cards open a near-full-screen Sheet with full linked order history, stats, sticky actions, confirmation delete for unlinked devices, and linked-order delete protection. Focused tests, typecheck, lint, build, and 393px production-preview screenshot/metrics passed.

- **Phase:** implementation
- **Completed/current state:** Customer workbench Phase 3 bottom sheet implementation is ready to push: mobile device cards open a near-full-screen Sheet with full linked order history, stats, sticky actions, confirmation delete for unlinked devices, and linked-order delete protection. Focused tests, typecheck, lint, build, and 393px production-preview screenshot/metrics passed.
- **Next:** Commit and push the scoped Phase 3 bottom sheet implementation to main; Phase 4 true device archive requires separate schema/API planning and approval before any migration.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
## 2026-07-05T23:21:20Z — Fix Vercel production build after customer device sheet push: latest deployment failed because main lacked store-scoped customersKeys.detail/list signatures. Added shared storeQueryScope helper and updated customer query keys; local lint, typecheck, customer tests, and next build pass.

- **Phase:** implementation
- **Completed/current state:** Fix Vercel production build after customer device sheet push: latest deployment failed because main lacked store-scoped customersKeys.detail/list signatures. Added shared storeQueryScope helper and updated customer query keys; local lint, typecheck, customer tests, and next build pass.
- **Next:** Stage only src/features/customers/api/query-keys.ts and src/shared/lib/store-query-scope.ts, commit, push main, then monitor Vercel until production deployment is Ready.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
