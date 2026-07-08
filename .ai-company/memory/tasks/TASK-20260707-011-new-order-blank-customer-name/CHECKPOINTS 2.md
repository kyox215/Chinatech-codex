# Checkpoints — TASK-20260707-011-new-order-blank-customer-name

## 2026-07-07T19:19:54Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-07T19:20:21Z — Implemented new-order customer-name handling so phone-generated names like 客户 + matching phone are treated as blank in the intake form and omitted from create-order payloads; real names remain preserved.

- **Phase:** completed-local-verification
- **Completed/current state:** Implemented new-order customer-name handling so phone-generated names like 客户 + matching phone are treated as blank in the intake form and omitted from create-order payloads; real names remain preserved.
- **Next:** Ready for owner review. If this batch is approved for release, stage only the scoped task files and avoid unrelated dirty worktree changes.
- **Decision:** Strip only generated names matching the selected phone pattern (客户 + same phone digits). Preserve real names and mismatched labels; keep phone as the toast fallback label; do not change update-order customer validation.
- **Evidence:**
  - src/features/orders/model/new-order-form.ts:53 adds customerNameForNewOrder/customerNameValueForCreateOrder helpers; src/features/orders/screens/new-order-screen.tsx:189 and :304 use them for customer selection, history prefill, and create payload.
  - src/features/orders/server/order.repository.ts:2661 allows creating a customer with phone and blank name; src/features/orders/testing/mock-api.ts:1525 mirrors the behavior.
  - Tests added in src/features/orders/model/new-order-form.test.ts:10 and src/features/orders/testing/mock-api.test.ts:602.
  - Validation passed: npm run lint; npm run typecheck; npm run test (83 files, 535 tests); npm run build outside sandbox after sandbox Turbopack port denial; targeted eslint and targeted vitest for order form/mock-api passed; git diff --check for touched task files passed.
  - Browser verification on http://localhost:3012/orders?new=1: after selecting phone 3335719865, nameValue was blank, hasGeneratedNameInNameInput false, history models visible true. Screenshot: /private/tmp/repairdesk-new-order-blank-customer-name-full-20260707.png.
- **Recorded by:** CEO-Orchestrator
