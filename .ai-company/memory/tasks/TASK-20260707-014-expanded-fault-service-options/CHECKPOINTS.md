# Checkpoints — TASK-20260707-014-expanded-fault-service-options

## 2026-07-07T19:46:22Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-07T19:46:33Z — Expanded new-order fault diagnosis option data across all categories, added Italian translations for the new services, and tightened fault-name translation so slash/hyphen labels like PIN/图案解锁 and Wi-Fi/蓝牙异常 remain intact.

- **Phase:** verified
- **Completed/current state:** Expanded new-order fault diagnosis option data across all categories, added Italian translations for the new services, and tightened fault-name translation so slash/hyphen labels like PIN/图案解锁 and Wi-Fi/蓝牙异常 remain intact.
- **Next:** Ready for owner review; do not stage, push, or deploy unless explicitly requested for this scoped task.
- **Decision:** No UI layout or picker interaction logic was changed; this is limited to service option data, translation mapping, and tests.
- **Evidence:**
  - Files changed: src/components/orders/fault-diagnosis-picker.tsx; src/features/orders/model/order-italian.ts; src/features/orders/components/order-option-pickers.test.tsx; src/features/orders/model/order-message-templates.test.ts
  - Validation passed: npx eslint scoped files; npx vitest run src/features/orders/components/order-option-pickers.test.tsx src/features/orders/model/order-message-templates.test.ts; npm run typecheck; npm run lint; npm run test (83 files, 542 tests); npm run build (sandbox retry with approved external execution due Turbopack port restriction).
  - Visual evidence: screenshots/TASK-20260707-014-expanded-fault-service-options/orders-new-dialog-system-options.png shows new system service options in the order dialog.
- **Recorded by:** Integration Lead
## 2026-07-07T21:10:19Z — Expanded front-desk fault/service options were isolated into clean main deployment commit c8829ba752dc33da0cd640c0f1c939036711fa16 and production Vercel deployment dpl_2JLZima5GdP7ZLGMsxBPYiEWq8ur reached READY.

- **Phase:** deployed_to_main
- **Completed/current state:** Expanded front-desk fault/service options were isolated into clean main deployment commit c8829ba752dc33da0cd640c0f1c939036711fa16 and production Vercel deployment dpl_2JLZima5GdP7ZLGMsxBPYiEWq8ur reached READY.
- **Next:** No action needed for this task unless production smoke testing reveals an issue; rollback candidate is prior Vercel production deployment dpl_Hci6Kayr51uZgQaXFSvAt2qt6y3Z / commit a6fcb6d.
- **Decision:** Used a clean deployment clone instead of staging the dirty main workspace because the original worktree had 461 mixed changes and unrelated tenant/onboarding WIP.
- **Evidence:**
  - Clean deploy clone /private/tmp/repairdesk-main-deploy-20260707; commit c8829ba; npm run typecheck PASS; npm run lint PASS; npm run test PASS 76 files/489 tests; npm run build PASS; Vercel production READY for githubCommitSha c8829ba.
- **Recorded by:** CEO-Orchestrator
