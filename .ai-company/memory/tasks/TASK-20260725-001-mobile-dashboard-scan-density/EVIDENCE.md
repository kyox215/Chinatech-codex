# Evidence Index — TASK-20260725-001-mobile-dashboard-scan-density

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | plan and production deployment approved | `TASK.md` | observed | 2026-07-25T00:31:00Z | IntegrationLead |
| E-002 | architecture | reusable order scan resolver exists | `src/features/capture/model/scan-search-resolver.ts` | observed | 2026-07-25T00:31:00Z | IntegrationLead |
| E-003 | UI | current dashboard density causes tall mobile stack | dashboard components and owner screenshot | observed | 2026-07-25T00:31:00Z | IntegrationLead |
| E-004 | unit | dashboard, scanner resolver and priority behavior | focused Vitest run | 16/16 passed | 2026-07-25T00:39:13Z | IntegrationLead |
| E-005 | regression | complete repository unit/integration suite | `npm run test` | 357 files / 2371 tests passed | 2026-07-25T00:40:55Z | IntegrationLead |
| E-006 | responsive | Chromium dashboard flows at 320/360/390/430/768/1024/1440 | `tests/e2e/dashboard-quick-start.spec.ts` | 17/17 passed | 2026-07-25T00:38:50Z | IntegrationLead |
| E-007 | compatibility | WebKit dashboard density and scanner fallback | dashboard E2E focused run | 8/8 passed | 2026-07-25T00:40:59Z | IntegrationLead |
| E-008 | build | lint, TypeScript and production bundle | `npm run lint -- --no-cache`; `npm run typecheck`; `npm run build` | passed | 2026-07-25T00:41:38Z | IntegrationLead |
| E-009 | visual | final mobile dashboard at 320/390/430 and scanner sheet | `screenshots/TASK-20260725-001-mobile-dashboard-scan-density/` | reviewed; labels complete and no overflow | 2026-07-25T00:39:50Z | IntegrationLead |

Do not record secrets or unsupported passed claims.
- `2026-07-25T00:40:20Z` `5bf951c4aa` — screenshots/TASK-20260725-001-mobile-dashboard-scan-density；dashboard-quick-start E2E 17/17；lint/typecheck通过。
