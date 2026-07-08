# Evidence Index — TASK-20260619-200747-repairdesk-project-health-check-and-fix-ca

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T20:07:47Z | CEO-Orchestrator |
| E-002 | worktree | repo has broad dirty state and untracked files | `git status --short` | many modified files plus untracked `.ai-company/`, `.codex/`, duplicate `* 2.*` files, and migration/task memory files | 2026-06-19T20:09:00Z | Integration Lead |
| E-003 | duplicate inventory | duplicate-like files remain | `find . ... -name '* 2.*'` excluding `node_modules`, `.next`, `storybook-static` | 76 files | 2026-06-19T20:13:00Z | Integration Lead |
| E-004 | governance gate | agent rules are healthy | `npm run agents:check` | passed | 2026-06-19T20:09:00Z | Integration Lead |
| E-005 | static gate | lint passes | `npm run lint` | passed after resolving formatting state and adding dev-origin config | 2026-06-19T20:17:00Z | Integration Lead |
| E-006 | static gate | typecheck passes | `npm run typecheck` | passed | 2026-06-19T20:17:00Z | Integration Lead |
| E-007 | test gate | full unit/integration suite passes | `npm run test` | 37 files, 222 tests passed | 2026-06-19T20:10:00Z | Integration Lead |
| E-008 | build gate | production build passes outside sandbox | `npm run build` | passed; sandbox-only Turbopack port-binding failure remains an environment limitation | 2026-06-19T20:17:00Z | Integration Lead |
| E-009 | e2e gate | Playwright smoke/overflow tests pass | `npm run test:e2e` | 10 passed, 11 skipped by test configuration; Next HMR cross-origin warning removed after config fix | 2026-06-19T20:18:00Z | Integration Lead |
| E-010 | dependency hygiene | knip reports cleanup candidates | `npm run knip` | failed with unused files, duplicate `* 2.*` files, `recharts` unused dependency, and `ws` unlisted dependency | 2026-06-19T20:13:00Z | Integration Lead |
| E-011 | architecture debt | orders list still uses legacy routes implementation | `src/features/orders/screens/order-list-screen.tsx` | imports `@/routes/orders.index` | 2026-06-19T20:15:00Z | Integration Lead |
| E-012 | code size | several modules are large and hard to review safely | `wc -l` | order detail 3162 lines, buyback workspace 2323 lines, order overview 1727 lines, API schema/router 818/670 lines | 2026-06-19T20:15:00Z | Integration Lead |
| E-013 | safe fix | local e2e dev origin warning fixed | `next.config.ts` | `allowedDevOrigins: ["127.0.0.1"]` added | 2026-06-19T20:17:00Z | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
