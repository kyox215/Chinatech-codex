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
| E-015 | Scoped Git release | exact staged-file audit, commit and push | 22 task files committed as `70d211b2574257b6843763a5fd86e6e1b5e775a3` and pushed directly to `origin/main`; no migration, dependency, Settings or Orders files | 2026-07-14T13:22Z |
| E-016 | Vercel production | deployment metadata and `vercel inspect chinatech.in` | `dpl_G9bU7J4c9baihhhRxMWAYUGsntuz` READY, target production, exact Git SHA `70d211b2`, aliases `chinatech.in` and `www.chinatech.in` | 2026-07-14T13:27Z |
| E-017 | Production HTTP and observation | domain/deployment `curl` smoke plus Vercel error and 5xx log filters | root, `/buyback?new=1` and exact deployment returned 200 with expected authenticated login redirect; no error or 5xx entries in the observation window | 2026-07-14T13:28Z |
| E-018 | Supabase read-only postcheck | MCP migration/catalog reads plus linked CLI migration list | `20260712150000` remains local-only; agreement table=false, finalize RPC=0, guided evidence columns=0, evidence bucket=0; no DB write command executed | 2026-07-14T13:30Z |
| E-019 | Production visual attempt | Chrome extension connection check and one prescribed retry | authenticated production capture blocked because the Chrome extension session was unavailable; no login bypass or production form submission attempted; sanitized local 390/1440 screenshots remain the visual evidence | 2026-07-14T13:31Z |
| E-020 | Remote/state assertion | post-push `git fetch --prune`, SHA and clean-status check | `HEAD == origin/main == 70d211b2`; isolated worktree clean before closeout documentation sync | 2026-07-14T13:31Z |
| E-021 | Closeout governance validation | `agents:check`, `ai_company.py validate`, `memory-audit`, `git diff --check` | agent rules and diff check pass; repo-wide validator still reports 12 pre-existing duplicate Agent names, and memory audit reports four older-task timestamp issues plus existing template placeholders; none is introduced or modified by this task | 2026-07-14T13:34Z |
| E-022 | Final release closeout review | read-only release reviewer after formal `close-task` | GO; TASK is closed, ACTIVE_CONTEXT is idle, diff check passes, and the only remaining action is to include the new CEO report in the docs-only closeout commit | 2026-07-14T13:41Z |

E-005 through E-009 are preserved as pre-remediation history only. E-011 through E-022 are the current implementation, release and production evidence.

Do not record access tokens, database passwords, connection strings, service-role keys, full customer PII, or identity-document content in this file.
