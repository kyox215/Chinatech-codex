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
