# Evidence Index — TASK-20260723-003-startup-performance-print-audit

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-23T16:40:21Z | IntegrationLead |
| E-002 | browser timing | business content remains slow after an authenticated shell is already open | in-app browser, local `127.0.0.1:3122` | dashboard 11.49s; orders 5.23s; customers 4.86s | 2026-07-23T17:10:00Z | IntegrationLead |
| E-003 | code inspection | shell startup is a sequential onboarding-to-store-context waterfall | `src/features/stores/api/use-store-shell-context.ts` | observed | 2026-07-23T17:00:00Z | FE/API audit |
| E-004 | code inspection | preload starts unrelated domain reads on dashboard and customers | `src/features/preload/components/app-preload-bridge.tsx`; `src/features/preload/model/preload-plan.ts` | observed | 2026-07-23T17:00:00Z | FE/API audit |
| E-005 | code inspection | dashboard priority summary loads all active order rows before in-memory ranking | `src/features/dashboard/server/dashboard-summary.service.ts`; `src/features/orders/server/order.repository.ts` | observed | 2026-07-23T17:00:00Z | FE/API audit |
| E-006 | code inspection | customer list v3 uses database pagination but still waits for shell and contends with preload | `src/features/customers/server/customer.repository.ts`; customer screen/preload bridge | observed | 2026-07-23T17:00:00Z | FE/API audit |
| E-007 | code inspection | manager list single print is incorrectly controlled by export permission | `src/features/orders/screens/order-list-screen.tsx`; `src/server/permissions.ts` | observed defect | 2026-07-23T17:00:00Z | Print UX audit |
| E-008 | code inspection | print requires complete store output identity and active, printable order state | `src/entities/store/model/store-output-identity.ts`; `src/features/orders/screens/order-detail-screen.tsx` | observed | 2026-07-23T17:00:00Z | Print UX audit |
| E-009 | configuration inspection | local QR issuance flag is unset and preloading defaults enabled | non-secret environment flag check | observed | 2026-07-23T17:15:00Z | IntegrationLead |
| E-010 | visual evidence | annotated dashboard shows the delayed business-content region | owner-provided browser screenshot in task conversation | observed | 2026-07-23 | Owner |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-23T16:48:24Z` `e9a1309438` — .ai-company/memory/tasks/TASK-20260723-003-startup-performance-print-audit/EVIDENCE.md
