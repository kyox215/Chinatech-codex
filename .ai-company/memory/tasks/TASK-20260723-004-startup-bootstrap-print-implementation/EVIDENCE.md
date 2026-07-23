# Evidence Index — TASK-20260723-004-startup-bootstrap-print-implementation

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-23T20:11:40Z | IntegrationLead |
| E-002 | code | Shell cold start uses one bootstrap contract and retains legacy fallback | `src/server/api/repairdesk-router.ts`; `src/features/stores/api/use-store-shell-context.ts` | implemented | 2026-07-23T20:58:00Z | IntegrationLead |
| E-003 | test | bootstrap success, 404/405/501 fallback, 401/403 no-fallback and cache clearing | `use-store-shell-context.test.tsx`; `tenant-cache.test.ts` | passed | 2026-07-23T20:58:00Z | IntegrationLead |
| E-004 | code/test | manager/sales/technician single-print and owner batch-print matrix | `order.repository.ts`; `order.repository.test.ts` | passed | 2026-07-23T20:58:00Z | IntegrationLead |
| E-005 | UI/test | list/detail print disabled reasons and recovery entries | `order-list-screen.tsx`; `order-detail-screen.tsx`; `order-preload-intent.test.tsx` | passed | 2026-07-23T20:58:00Z | IntegrationLead |
| E-006 | gate | repository lint and TypeScript checks | `npm run lint`; `npm run typecheck` | passed | 2026-07-23T20:58:00Z | IntegrationLead |
| E-007 | gate | full Vitest suite | `npm run test -- --reporter=dot` | 342 files / 2289 tests passed | 2026-07-23T20:58:00Z | IntegrationLead |
| E-008 | gate | optimized Next.js production build | `npm run build` | passed | 2026-07-23T20:58:00Z | IntegrationLead |
| E-009 | screenshot | local desktop order detail shows actionable store-output recovery | `screenshots/TASK-20260723-004-startup-bootstrap-print-implementation/order-detail-print-disabled-reason.png` | observed | 2026-07-23T20:58:00Z | IntegrationLead |
| E-010 | independent QA | no remaining P0/P1; release conclusion PASS | `/root/b_qa_gate` final review | 4 files / 87 tests passed | 2026-07-23T20:58:00Z | QA |
| E-011 | declaration | project-level startup and print readiness rules, planning matrix and change gate | `docs/STARTUP_PERFORMANCE_AND_PRINT_READINESS_DECLARATION.md`; `AGENTS.md`; `docs/ARCHITECTURE.md` | active declaration | 2026-07-23T21:15:00Z | IntegrationLead |
| E-012 | final gate | final integrated release candidate | `npm run agents:check`; `npm run lint`; `npm run typecheck`; `npm run test -- --reporter=dot`; `npm run build` | 343 files / 2292 tests; all static and build gates passed | 2026-07-23T21:52:52Z | IntegrationLead |
| E-013 | browser regression | dashboard, workspace intent, create navigation and print simulation | Playwright Chromium combined flow; Chromium/WebKit `print-safari-reliability.spec.ts` | combined flows passed after stale selector contract fixes; print 5/5 on each engine | 2026-07-23T21:52:52Z | IntegrationLead |
| E-014 | release | exact main release commit and Vercel production deployment | commit `274dc50f`; deployment `dpl_Gx8EapZ7xGaF6QmewhU3R9YSutYW` | pushed to `origin/main`; Vercel `Ready` | 2026-07-23T22:00:00Z | IntegrationLead |
| E-015 | production smoke | authenticated home and shared new-order dialog render; unauthenticated bootstrap fails closed | `https://www.chinatech.in/`; `GET /api/repairdesk/shell/bootstrap`; in-app browser | home/dialog available; unauthenticated bootstrap `401`; QR environment variable name present | 2026-07-23T22:04:00Z | IntegrationLead |
| E-016 | production screenshot | customer-free shared new-order surface after deployment | `screenshots/TASK-20260723-004-startup-bootstrap-print-implementation/production-new-order-dialog-1306.png` | observed | 2026-07-23T22:04:00Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-23T20:58:49Z` `7f64038c9c` — lint、typecheck、342 files/2289 tests、build、TASK-004截图、独立QA PASS
- `2026-07-23T21:01:13Z` `d743b6b02a` — Memory Index、Project Memory、FE/API/SEC/QA/DOC部门记忆、Capability Registry已更新；git diff --check通过
- `2026-07-23T21:13:03Z` `de597cb52f` — 新声明文件存在且Prettier通过；引用目标存在；git diff --check通过；E-011已登记
- `2026-07-23T22:04:00Z` — `274dc50f` 已推送 main；Vercel `dpl_Gx8EapZ7xGaF6QmewhU3R9YSutYW` Ready；生产冒烟和截图完成；回滚点为上一 Ready deployment `chinatech-codex-7n7epauk3-kyox120-9295s-projects.vercel.app`。
- `2026-07-23T21:52:52Z` `2c2587370d` — npm run agents:check; npm run lint; npm run typecheck; npm run test -- --reporter=dot; npm run build; Playwright dashboard/workspace/create navigation; Chromium/WebKit print-safari-reliability; git diff --check
