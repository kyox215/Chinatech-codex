# Checkpoints — TASK-20260707-013-new-order-device-under-diagnosis

## 2026-07-07T19:35:10Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-07T19:35:23Z — Moved the new order Device Information panel beneath Fault & Diagnosis while keeping Customer Information in the left column and preserving device field behavior.

- **Phase:** completed-local-verification
- **Completed/current state:** Moved the new order Device Information panel beneath Fault & Diagnosis while keeping Customer Information in the left column and preserving device field behavior.
- **Next:** Ready for owner review. If shipping, stage only scoped UI/model/test/task-memory files and avoid unrelated dirty worktree changes.
- **Decision:** Move layout by splitting existing component rather than duplicating fields, preserving history model selection, Apple model suggestions, IMEI scanner, and device unlock editor behavior.
- **Evidence:**
  - src/features/orders/forms/new-order-customer-device-section.tsx:78 splits Customer and Device into separately reusable sections while preserving shared compact field styling and device inputs.
  - src/features/orders/screens/new-order-screen.tsx:522 keeps NewOrderCustomerSection in the left column; src/features/orders/screens/new-order-screen.tsx:533 renders NewOrderFaultDiagnosisSection followed by NewOrderDeviceSection in the middle column.
  - Validation passed: targeted eslint for new-order screen/device files; npx vitest run src/features/orders/model/new-order-form.test.ts (1 file, 7 tests); npm run typecheck; npm run lint; npm run test (83 files, 539 tests); npm run build outside sandbox; git diff --check for scoped files.
  - Browser verification on http://localhost:3012/orders: deviceIsBelowFault true and deviceSameColumnAsFault true; after scroll, device section visible beneath fault diagnosis. Screenshots: /private/tmp/repairdesk-new-order-device-under-diagnosis-20260707.png and /private/tmp/repairdesk-new-order-device-under-diagnosis-visible-20260707.png.
- **Recorded by:** CEO-Orchestrator
