# Evidence Index — TASK-20260707-014-expanded-fault-service-options

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-07T19:46:22Z | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-07T19:46:33Z` `99de945e21` — Files changed: src/components/orders/fault-diagnosis-picker.tsx; src/features/orders/model/order-italian.ts; src/features/orders/components/order-option-pickers.test.tsx; src/features/orders/model/order-message-templates.test.ts
- `2026-07-07T19:46:33Z` `c4071fb975` — Validation passed: npx eslint scoped files; npx vitest run src/features/orders/components/order-option-pickers.test.tsx src/features/orders/model/order-message-templates.test.ts; npm run typecheck; npm run lint; npm run test (83 files, 542 tests); npm run build (sandbox retry with approved external execution due Turbopack port restriction).
- `2026-07-07T19:46:33Z` `2d8113fe47` — Visual evidence: screenshots/TASK-20260707-014-expanded-fault-service-options/orders-new-dialog-system-options.png shows new system service options in the order dialog.
- `2026-07-07T21:10:19Z` `bd9b574c92` — Clean deploy clone /private/tmp/repairdesk-main-deploy-20260707; commit c8829ba; npm run typecheck PASS; npm run lint PASS; npm run test PASS 76 files/489 tests; npm run build PASS; Vercel production READY for githubCommitSha c8829ba.
