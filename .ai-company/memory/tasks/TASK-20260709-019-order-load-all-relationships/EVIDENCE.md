# Evidence Index — TASK-20260709-019-order-load-all-relationships

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-09T16:31:58Z | CEO-Orchestrator |
| E-002 | screenshot | production `/orders` still failed after first fix, now on `devices` | owner attached mobile screenshot | observed | 2026-07-09T16:26Z | Owner |
| E-003 | source | unqualified `device:devices(*)` and legacy supplier FK still existed in order selects | `rg -n "customer:customers\\(|device:devices\\(|supplier:suppliers\\(" src` | observed before fix | 2026-07-09T16:27Z | Codex |
| E-004 | production-schema | production has multiple FKs from `repair_orders` to customers/devices/suppliers/self | `supabase db query --linked` against `pg_constraint` | confirmed | 2026-07-09T16:28Z | Codex |
| E-005 | docs | PostgREST requires `!<fk>` disambiguation when multiple FKs exist | PostgREST Resource Embedding official docs | confirmed | 2026-07-09T16:26Z | Codex |
| E-006 | changelog | Supabase Data API grant changes do not match this relationship ambiguity symptom | Supabase changelog | reviewed | 2026-07-09T16:26Z | Codex |
| E-007 | code | order embeds now use explicit same-store relationships | `src/server/repairdesk-shared.ts`, `src/features/orders/server/order.repository.ts` | changed | 2026-07-09T16:29Z | Codex |
| E-008 | regression-test | ambiguous order embeds are rejected by tests/source scan | `src/server/repairdesk-shared.test.ts` | changed | 2026-07-09T16:29Z | Codex |
| E-009 | source-scan | non-test source has no `customer:customers(`, `device:devices(`, or `supplier:suppliers(` | `rg -n ... src --glob '!**/*.test.*'` | no matches | 2026-07-09T16:29Z | Codex |
| E-010 | targeted-test | shared select tests passed | `npm run test -- --run src/server/repairdesk-shared.test.ts` | 1 file, 5 tests passed | 2026-07-09T16:29Z | Codex |
| E-011 | typecheck | TypeScript passed | `npm run typecheck` | passed | 2026-07-09T16:29Z | Codex |
| E-012 | lint | ESLint passed | `npm run lint` | passed | 2026-07-09T16:29Z | Codex |
| E-013 | full-test | Full Vitest passed after rerun | `npm run test` | 98 files, 652 tests passed; first run had unrelated jsdom/Radix unhandled error then rerun passed | 2026-07-09T16:30Z | Codex |
| E-014 | build | Production build passed | `npm run build` rerun with sandbox escalation for Turbopack port-binding | passed | 2026-07-09T16:30Z | Codex |
| E-015 | data-api-syntax | REST/Data API select no longer returns relationship ambiguity | public-key request to `/rest/v1/repair_orders` with explicit same-store embeds | returned 401 permission denied, `hasAmbiguousRelationship=false` | 2026-07-09T16:31Z | Codex |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-09T16:33:03Z` `3cdaf329d3` — E-004 production FK query; E-009 source scan; E-010 targeted test; E-011 typecheck; E-012 lint; E-013 full test rerun; E-014 build; E-015 Data API syntax
