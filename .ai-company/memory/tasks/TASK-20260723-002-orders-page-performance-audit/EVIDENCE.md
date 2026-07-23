# Evidence Index — TASK-20260723-002-orders-page-performance-audit

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-23T12:32:51Z | IntegrationLead |
| E-002 | runtime | three warm navigations return HTML quickly but list is ready after about 5.53s average | in-app browser timing + local dev server session | 184/202/351ms HTML; 5858/5467/5265ms list-ready | 2026-07-23T12:29:00Z | IntegrationLead |
| E-003 | runtime | order list API is the slowest required page request | Next.js request timing log | 2.3s, 2.7s, 2.9s; application-code dominates | 2026-07-23T12:29:00Z | IntegrationLead |
| E-004 | code | cross-workspace preload adds customers and inventory on orders startup | `src/features/preload/components/app-preload-bridge.tsx`, `preload-plan.ts` | observed | 2026-07-23T12:25:00Z | IntegrationLead |
| E-005 | code | order list data path reads broad index set then current-page rows and workflow buckets | `src/features/orders/server/order.repository.ts`, `src/server/repairdesk-shared.ts` | observed | 2026-07-23T12:27:00Z | IntegrationLead |
| E-006 | code | every API request independently resolves actor, store memberships and permissions | `src/server/auth-context.ts`, `src/server/api/repairdesk-router.ts` | observed | 2026-07-23T12:31:00Z | IntegrationLead |
| E-007 | visual | local orders page loads meaningful content with no framework error overlay | in-app browser screenshot emitted in task turn | pass | 2026-07-23T12:28:00Z | IntegrationLead |
| E-008 | code | dialog screens are loaded only after their dialog opens | `order-list-screen.tsx`; production loadable manifest | two deferred chunks present; direct routes unchanged | 2026-07-23T14:47:00Z | IntegrationLead |
| E-009 | code | list/workflow/options use one existing queue-summary request | `order-list-screen.tsx`, `repairdesk-router.ts` | one actor resolution and partial failure envelope retained | 2026-07-23T14:44:00Z | IntegrationLead |
| E-010 | tests | application regression suite remains green | `npm run lint`; `npm run typecheck`; `npm run test`; `npm run build` | lint/typecheck pass; 341 files and 2272 tests pass; production build pass | 2026-07-23T14:48:00Z | IntegrationLead |
| E-011 | browser | no automatic detail request; first dialog intent performs one request and reuses it | controlled Chromium E2E | pass; screenshot `test-results/realtime-preload-coordinat-38081-quest-when-the-dialog-opens-chromium/desktop-intent-loaded-order-detail.png` | 2026-07-23T14:54:00Z | IntegrationLead |
| E-012 | browser | customer workspace is not requested before leaving `/orders` | controlled Chromium E2E | pass; requests start only after SPA navigation | 2026-07-23T14:52:00Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-23T12:33:51Z` `36642548c7` — E-002至E-007：浏览器计时、Next服务日志、代码路径与可视页面证据。
