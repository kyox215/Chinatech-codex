# Evidence Index — TASK-20260714-001-buyback-sensitive-evidence-feature-off

| ID | Gate | Evidence | Result | Collected at |
|---|---|---|---|---|
| E-001 | Owner approval | Owner replied `是 开始下一步` to the explicit feature-off + push + production verification request | approved exact scope | 2026-07-14 |
| E-002 | Git isolation | fresh worktree/branch from `origin/main@54c29e29` | clean; shared Settings workspace untouched | 2026-07-14T07:28Z |
| E-003 | Production baseline | `vercel inspect chinatech.in`; filtered production list | production drifted to READY `dpl_9Easp...`, SHA `54c29e29` | 2026-07-14T07:29Z |
| E-004 | Independent review | real read-only SEC, UX and QA subagents | upload/finalize/import/legacy gates plus four-step all-role UI contract agreed | 2026-07-14 |
| E-005 | Focused security tests | feature policy + repository + mock + router + route tests | 5 files, 62 tests passed | 2026-07-14 |
| E-006 | Browser E2E | Owner/Manager/Sales at 390x844 and 1440x900 | 6 passed; upload/finalize request counts stayed 0; no overflow | 2026-07-14 |
| E-007 | Visual evidence | `test-results/buyback-feature-off-mobile.png`, `test-results/buyback-feature-off-desktop.png` | inspected at exact 390x844 and 1440x900 | 2026-07-14 |
| E-008 | Supabase read-only preflight | linked migration list + catalog query | `20260712150000` not applied; agreement table/RPC/evidence columns/bucket all absent; remote-only `20260714004500` is unrelated order-assignment hardening | 2026-07-14 |
| E-009 | Full local gates | agents check, lint, typecheck, full Vitest, production build | passed; 131 files / 903 tests; build passed outside sandbox after expected Turbopack port restriction | 2026-07-14 |
| E-010 | First final review | independent SEC, UX/QA and release-scope reviewers | NO-GO correctly identified legacy attachment-schema incompatibility, accidental stored-marker deletion, partial-save duplicate risk and stale/misleading closed-state copy | 2026-07-14T11:30Z |
| E-011 | Remediation regression tests | repository insert, stored/inbound legacy merge, retry helper and record workflow | 6 files / 87 tests passed; ordinary stock insert omits five unmigrated columns; stored allowlisted markers preserved; inbound markers stripped; retry uses one create/transition and refreshes the remembered record | 2026-07-14T13:15Z |
| E-012 | Final local gates | agent rules, lint, typecheck, full Vitest and production build | passed; full suite 132 files / 909 tests with bounded two-worker concurrency; unrelated fixed-timeout files passed isolated; build passed | 2026-07-14T13:16Z |
| E-013 | Final browser E2E | Owner/Manager/Sales at 390x844 and 1440x900 after the last code change | 6/6 passed; no sensitive controls, attachment upload or finalize calls; no overflow; screenshots refreshed | 2026-07-14T13:17Z |
| E-014 | Final independent review | SEC and UX/QA read-only rereviews | GO; zero security blockers/majors/minors and no UI/state release blocker | 2026-07-14T13:17Z |

E-005 through E-009 are preserved as pre-remediation history only. E-011 through E-014 are the current release evidence.

Do not record access tokens, database passwords, connection strings, service-role keys, full customer PII, or identity-document content in this file.
