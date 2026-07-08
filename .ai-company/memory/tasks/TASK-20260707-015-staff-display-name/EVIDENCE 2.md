# Evidence Index — TASK-20260707-015-staff-display-name

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-07T19:54:57Z | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-07T19:55:09Z` `b4b8657f15` — Files changed for this task: src/server/staff-display-name.ts; src/server/staff-display-name.test.ts; src/server/auth-context.ts; src/server/repairdesk-shared.ts; src/features/platform/server/platform.repository.ts.
- `2026-07-07T19:55:09Z` `6d7d0b4045` — Validation passed: npx eslint scoped files; npx vitest run src/server/staff-display-name.test.ts src/features/platform/server/platform.repository.test.ts src/features/orders/testing/mock-api.test.ts; npm run typecheck; npm run lint; npm run test (84 files, 546 tests); npm run build after sandbox-external rerun due Turbopack port restriction.
- `2026-07-07T19:55:09Z` `e422a2202d` — Visual evidence: screenshots/TASK-20260707-015-staff-display-name/orders-new-dialog-recorder-alessio-scrolled.png shows the new-order recorder card with Alessio while the role chip remains highest admin.
- `2026-07-07T21:10:32Z` `93eb14fc38` — Clean deploy clone /private/tmp/repairdesk-main-deploy-20260707; commit c8829ba; src/server/staff-display-name.ts and test added; auth context, operator name, and platform account return paths patched; npm run typecheck/lint/test/build PASS; Vercel production dpl_2JLZima5GdP7ZLGMsxBPYiEWq8ur READY for c8829ba.
