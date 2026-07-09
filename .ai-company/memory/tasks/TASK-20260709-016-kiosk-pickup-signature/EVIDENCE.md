# Evidence Index — TASK-20260709-016-kiosk-pickup-signature

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-09T13:15:32Z | CEO-Orchestrator |
| E-002 | code | accepting a submitted kiosk signature stores private signature evidence and cleans raw data URL from accepted session payload | `src/features/kiosk/server/kiosk.repository.ts` | implemented | 2026-07-09T13:28:00Z | CEO-Orchestrator |
| E-003 | code | mock kiosk accept flow mirrors signature evidence persistence for local UI/demo mode | `src/features/kiosk/testing/mock-api.ts`; `src/features/kiosk/testing/mock-api.test.ts` | implemented and tested | 2026-07-09T13:28:00Z | CEO-Orchestrator |
| E-004 | code | order detail separates signature attachments from device photos and shows signature evidence link/status | `src/features/orders/components/order-overview-tab.tsx`; `src/features/orders/screens/order-detail-screen.tsx` | implemented | 2026-07-09T13:28:00Z | CEO-Orchestrator |
| E-005 | test | focused kiosk/API tests passed | `npm run test -- src/features/kiosk/model/kiosk-session.test.ts src/features/kiosk/testing/mock-api.test.ts src/lib/repairdesk/api.test.ts src/server/api/kiosk-public-source.test.ts` | 4 files / 16 tests passed | 2026-07-09T13:21:48Z | CEO-Orchestrator |
| E-006 | lint | changed files passed ESLint | `npx eslint src/features/kiosk/server/kiosk.repository.ts src/features/kiosk/testing/mock-api.ts src/features/kiosk/testing/mock-api.test.ts src/features/orders/components/order-overview-tab.tsx src/features/orders/screens/order-detail-screen.tsx` | passed | 2026-07-09T13:21:48Z | CEO-Orchestrator |
| E-007 | test | full Vitest suite passed | `npm run test` | 97 files / 638 tests passed | 2026-07-09T13:22:49Z | CEO-Orchestrator |
| E-008 | lint | full ESLint suite passed | `npm run lint` | passed | 2026-07-09T13:22:49Z | CEO-Orchestrator |
| E-009 | typecheck | full TypeScript check passed after local dependencies were installed in isolated worktree | `npm run typecheck` | passed | 2026-07-09T13:22:20Z | CEO-Orchestrator |
| E-010 | build | production build passed outside sandbox | `npm run build` with sandbox escalation | passed; sandbox-only run failed with Turbopack port binding `Operation not permitted` | 2026-07-09T13:23:26Z | CEO-Orchestrator |
| E-011 | db-dry-run | normal linked db push is unsafe for this task because it would require 25 historical migrations via `--include-all` | `supabase db push --linked --dry-run` | blocked; no DDL applied | 2026-07-09T13:24:52Z | CEO-Orchestrator |
| E-012 | db-readonly | task-specific remote DB prerequisites already exist | `supabase db query --linked` checks for `order_attachments`, `repair_orders.customer_signature`, private bucket, RLS, and kind constraint | all present; bucket `public=false`, size limit 8388608, allowed image/PDF MIME types | 2026-07-09T13:25:00Z | CEO-Orchestrator |
| E-013 | browser | mock iPad pickup signature flow accepted and generated signature attachment evidence | local API flow against `http://localhost:3013` | accepted `kiosk_session_2`, signature attachment `att_1783603831041_zyko7be7jpa` | 2026-07-09T13:30:31Z | CEO-Orchestrator |
| E-014 | screenshot | order detail shows signature evidence status and attachment timeline | `/tmp/repairdesk-kiosk-signature-evidence.png` | screenshot captured; page API returned 200 on `localhost` | 2026-07-09T13:31:00Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-09T13:37:05Z` `d4e91c3556` — Tests: focused kiosk/API 4 files/16 tests, full Vitest 97 files/638 tests, npm run lint, npm run typecheck, sandbox-external npm run build passed. DB: migration list shows kiosk MVP migration 20260709233000 remote-applied; db push dry-run blocked broad include-all; read-only queries confirmed order_attachments, customer_signature, private repairdesk-order-attachments bucket, RLS, and kind check. Screenshot: /tmp/repairdesk-kiosk-signature-evidence.png.
