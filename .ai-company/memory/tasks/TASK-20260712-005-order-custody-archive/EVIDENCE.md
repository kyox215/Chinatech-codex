# Evidence Index — TASK-20260712-005-order-custody-archive

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-12T14:06:14Z | 鹤祥 |
| E-002 | data audit | ChinaTech SeaTable import had 51 deterministic mismatches | linked read-only audit; `production-audit.sql` | 42 repaired-notified, 4 mail-in, 5 cancelled notification/custody rows | 2026-07-12 | INT/DATA |
| E-003 | backup | production repair has a minimal before-image | `/tmp/repairdesk-order-custody-archive-audit-backup-20260712.json` | mode 600; SHA-256 `69ccb3f7a1ac25e62eec495c054c67183d974caca97eb95dfe6162cc12533cd9` | 2026-07-12 | INT |
| E-004 | rollback rehearsal | patch and selective restore both roll back cleanly | forced transaction failures plus independent post-check | 51 mismatches and 0 patch events after patch rehearsal; 51/51 repaired and 51 events preserved after restore rehearsal | 2026-07-12 | INT/DATA |
| E-005 | production apply | exact target-store repair committed | batch `order-custody-archive-20260712-v1`; `production-state-summary.sql` | 51/51 rows match; 51 audit events; 0 active notification/delivery mismatches; 0 other-store events | 2026-07-12 | INT |
| E-006 | data boundary | production repair did not alter customer, device, amount, payment, attachment or other-store data | guarded update field list and post-apply verification | passed | 2026-07-12 | INT/DATA |
| E-007 | focused tests | importer, archive invariant, queue classifier and repository writes | Vitest focused run | 4 files, 50 tests passed | 2026-07-12T22:42:22Z | INT |
| E-008 | full tests | complete unit/integration suite | `npx vitest run --maxWorkers=1 --testTimeout=20000` | 121 files, 818 tests passed | 2026-07-12T22:42:34Z | INT |
| E-009 | static gates | governance, formatting, lint and TypeScript | `npm run agents:check`; `npm run lint`; `npm run typecheck` | passed | 2026-07-12 | INT |
| E-010 | production build | Next.js production bundle and routes | `npm run build` outside restricted port sandbox | passed; 22 static pages generated | 2026-07-12 | INT |
| E-011 | desktop visual | default active queue and work-group counts render without overlap | `orders-desktop-queue.png` at 1280x720 | passed | 2026-07-12 | INT |
| E-012 | mobile visual | responsive queue labels and cards fit at 390x844 | `orders-mobile-queue.png` | no horizontal overflow; no browser console errors | 2026-07-12 | INT |
| E-013 | interaction | queue tabs change the actual result set | local mock browser verification | `待交付` returned 12; `需核对` returned 6 | 2026-07-12 | INT |
| E-014 | independent review | state matrix, data boundaries and security risks reviewed | PRODUCT, DATA and SECURITY read-only subagents | required findings incorporated; residuals documented below | 2026-07-12 | INT |
| E-015 | QA accountability | independent QA retry did not return within two bounded waits | read-only QA subagent `019f58af-b354-70d1-9bf8-cb89787ba712` | closed while running; no result claimed; main-thread full gates and browser checks remain the QA evidence | 2026-07-12 | INT |
| E-016 | release | verified task implementation reached `main` | commit `1d03770982451c7627abff984474fe686d268695`; `git push origin HEAD:main` | remote advanced `a76852f6..1d037709` | 2026-07-12T23:45Z | INT |
| E-017 | governance closeout | task-specific agent rules remain valid; broad historical validator has unrelated debt | `npm run agents:check`; bundled Python 3.12 `tools/ai_company.py validate` | task checks passed; broad validator reported 12 pre-existing duplicate Agent names outside this task | 2026-07-12T23:49Z | INT |

## Residual risks

- Normal order status update and timeline insertion are still two database writes. The order update now uses `updated_at` optimistic concurrency, but a future RPC migration should make the update plus event atomic. Owner: DATA/API; trigger: next workflow migration.
- Exact archived-order search intentionally remains available for single-order lookup while archive browsing and aggregate totals remain restricted. Assignment and tenant checks must stay covered whenever search permissions change. Owner: SEC/API; trigger: permission-policy change.
- The minimal backup is a local release artifact, not a repository file. Retain it until the owner confirms the production result, then destroy it under the data-retention SOP.

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-12T23:17:16Z` `40cd1a2a00` — .ai-company/memory/tasks/TASK-20260712-005-order-custody-archive/EVIDENCE.md
- `2026-07-12T23:41:42Z` `40cd1a2a00` — .ai-company/memory/tasks/TASK-20260712-005-order-custody-archive/EVIDENCE.md
- `2026-07-12T23:48:17Z` `40cd1a2a00` — .ai-company/memory/tasks/TASK-20260712-005-order-custody-archive/EVIDENCE.md
