# Evidence Index — TASK-20260712-002-global-staff-permissions

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-12T00:08:43Z | 鹤祥 |
| E-002 | git baseline | task is isolated from unrelated dirty work and starts from latest remote | branch `codex/global-staff-permissions`, `origin/main@77e7410e` | clean | 2026-07-12T00:08Z | Integration Lead |
| E-003 | code baseline | centralized role matrix and supplier-only member grants exist | `src/server/permissions.ts`, `20260709235000_supplier_permission_grants.sql` | observed | 2026-07-12T00:11Z | Integration Lead |
| E-004 | code baseline | technician amount visibility is incorrectly coupled to payment collection | `canReadOrderFinance()` in order repository | observed | 2026-07-12T00:11Z | Integration Lead |
| E-005 | quality gate | final application snapshot passes static and full regression gates | `npm run agents:check`, `npm run lint`, `npm run typecheck`, `npx vitest run --maxWorkers=1`, `npm run build` | pass: 119 files / 800 tests; 22 routes built; build rerun outside sandbox after classified Turbopack port restriction | 2026-07-12T05:10+02:00 | Integration Lead |
| E-006 | database preflight | only the two owner-approved global permission migrations are pending | `/opt/homebrew/bin/supabase db push --linked --dry-run --include-all` | pass; lists only `20260712002317` and `20260712003452`; dry-run only, no production apply | 2026-07-12T05:01+02:00 | Integration Lead |
| E-007 | browser desktop | default active queue, archive switch and non-overflowing desktop toolbar | `evidence/orders-active-archive-desktop.jpg`, `evidence/orders-history-desktop.jpg` | pass; history shows 4 archived mock orders | 2026-07-12T02:12Z | Integration Lead |
| E-008 | browser mobile | mobile active/archive controls and order cards fit without overlap | `evidence/orders-active-mobile.jpg` | pass at 390x844 CSS viewport | 2026-07-12T02:13Z | Integration Lead |
| E-009 | browser permissions | owner sees manager-only finance/history grants and technician supplier-only grants | `evidence/settings-staff-permissions-desktop.jpg` | pass; mock data only | 2026-07-12T02:10Z | Integration Lead |
| E-010 | browser assignment | order detail exposes stable membership assignee control | `evidence/order-detail-assignee-desktop.jpg` | pass; mock assignee Hexiang | 2026-07-12T02:11Z | Integration Lead |
| E-011 | browser runtime | relevant pages render without browser console errors | in-app Browser `tab.dev.logs({ levels: ["error"] })` | pass: 0 errors | 2026-07-12T02:13Z | Integration Lead |
| E-012 | focused security tests | renamed/inactive legacy technician assignment, kiosk review, API status and authority-loss cache attack paths are covered | targeted Vitest command for order/router/API/store-shell/cache files | pass: 6 files / 72 tests | 2026-07-12T05:03+02:00 | Integration Lead |
| E-013 | independent security review | final role/object authorization, kiosk PII gate and cache revocation have no remaining S1/S2 merge blocker | read-only `security_reviewer` agent `019f53a7-e39d-7d22-9ba0-63d9db991c34` | PASS; legacy technician access fails closed until assignment migration | 2026-07-12T05:08+02:00 | Security reviewer |
| E-014 | diff hygiene | final task diff has no whitespace errors or unrecognized generated output | `git diff --check`, scoped status/stat review | pass | 2026-07-12T05:11+02:00 | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-12T01:34:32Z` `21f0959d9c` — typecheck/lint/agents:check passed; 112 targeted tests passed; linked Supabase dry-run lists exactly two pending migrations
- `2026-07-12T03:13:37Z` `6d5e3e7e03` — agents/lint/typecheck PASS；119/800 Vitest PASS；build 22 routes PASS；dry-run only two migrations；security PASS；browser screenshots and zero console errors
