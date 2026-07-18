---
schema_version: 1
department: qa
status: active
owner: QA Department / Integration Lead
last_verified_at: 2026-07-18
review_trigger: relevant-task-or-quarterly-review
---

# Quality Assurance Department Memory

## Mission and boundary

Test strategy, evidence, regression, environments, fixtures, flakiness, and release quality gates.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Maintain proportional verification gates and evidence attribution.
- First priority: keep dirty-worktree and sandbox-build issues separated from code regressions.

## Verified rules and conventions

- 2026-06-19 gates passed: `agents:check`, v3 validation, lint, typecheck, unit tests, and production build outside sandbox.
- Sandboxed `npm run build` may fail with Turbopack port permission; rerun outside sandbox before classifying as code failure.
- `TASK-20260619-024` is the order-list migration pre-implementation baseline: `agents:check`, lint, typecheck, unit tests, and non-sandbox build passed; sandbox build failure was environment-specific Turbopack port binding.
- `TASK-20260619-025` verified the order-list migration with active `@/routes` source scan, Prettier check, `npm run lint`, `npm run typecheck`, `npm run test` (38 files / 225 tests during migration; 38 files / 226 tests in the final dirty-workspace rerun), and non-sandbox `npm run build`. The sandbox build failure reproduced the known Turbopack port-binding environment issue.
- `TASK-20260620-001` verified order detail manual status transition with targeted workflow/mock tests, lint, typecheck, full Vitest (38 files / 228 tests), targeted order desktop E2E across 1024/1280/1440, non-sandbox build, and agent checks.
- `TASK-20260620-002` is classification-only evidence for legacy `src/routes/*` cleanup. It does not prove deletion safety until a later deletion task runs route scans, `agents:check`, lint, typecheck, tests, and build.
- `TASK-20260620-003` is preflight-only evidence: current baseline passed route scan, `agents:check`, lint, typecheck, and `knip.json` parse. The actual deletion task still needs full tests and build after files are removed.
- `TASK-20260620-004` is permission-matrix documentation evidence only. It does not prove runtime authorization behavior until role-specific server/API denial tests are added after Owner policy decisions.
- `TASK-20260712-002-global-staff-permissions` supplies runtime role/object denial evidence and final gates: agents/lint/typecheck pass, 119 Vitest files / 800 tests pass, 22-route production build passes outside the known sandbox port restriction, linked migration dry-run lists two pending files, and desktop/mobile screenshots plus zero browser console errors are recorded.
- Dashboard priority verification must cover: ranking more than the first list page, canonical approval/exception/parts side states, actor forwarding and denial-before-read, compact DTO forbidden fields, cached-data permission revocation, true versus sampled filtered empty, navigation-only actions, long Italian text, five widths without horizontal overflow, and current 390x844/1440x900 screenshots. `TASK-20260716-001` closed these gates with 135 files / 935 full tests, 12 Dashboard E2E flows and a 22-route build.
- Orders queue regression must cover target-specific pending feedback, latest-intent wins, failure rollback/retry, offline control disabling, 320px two-column and 360px+ three-column overflow, desktop-filter retention, realtime/preload deduplication, tenant/technician projection boundaries and the 50-row effective detail cap. `TASK-20260716-002` closed these gates with 138 files / 947 tests, 10 interaction passes plus one conditional skip, 7 realtime/preload passes, build and four reviewed screenshots.
- `TASK-20260619-230350-l2-025-role-policy-decision-package` is a decision package only. Treat Option A test cases as proposed test requirements, not executed coverage.
- `TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio` is policy evidence only. It does not prove audit redaction behavior until sanitizer implementation and forbidden-field serialization tests pass.
- `TASK-20260619-232315-l2-028-require-closeout-screenshots-for-re` makes closeout visual evidence mandatory: if a task has a relevant UI, preview, browser-visible result, or task/result page, final QA evidence and Owner report must include screenshot path(s). Non-UI tasks must record a no-screenshot reason and alternate evidence.
- `TASK-20260619-232915-l2-029-enforce-real-sub-agent-spawning-for` makes real sub-agent evidence mandatory when the Owner requests departments/AI employees/sub-agents/multi-agent work. QA closeout should require spawned agent id/nickname/role/mode/result, or a concrete no-spawn reason. Department labels alone are not evidence of AI employee execution.
- If desktop E2E returns missing mock chunk errors or empty order data after code churn, check for stale local Next servers before changing feature code. Stop stale servers and rerun targeted E2E.
- E2E exists but current workflow is manual-only.
- Duplicate cleanup must be verified as a cleanup task, not inferred from review-only evidence. Use `TASK-20260619-005/DIFFERING_DUPLICATES_REVIEW.md` as the decision package, then run targeted checks after deletion.
- In the current dirty workspace, full `tools/ai_company.py validate` can be blocked by repository-wide Markdown traversal before skip filtering; classify that separately from app or docs failures.
- Batch B cleanup verification should run the targeted order workflow suite from `TASK-20260619-008`: canonical status, order workflow, task flow, side statuses, and orders mock API tests.
- `TASK-20260619-009` verified Batch B cleanup with path-level pre/post checks, `npm run agents:check`, and the targeted order workflow suite; all passed.
- `TASK-20260619-010` found that `tests/e2e/visual-overflow.spec 2.ts` contains a future attachment-inventory overflow test idea, but current source search did not verify the `附件库存` entry point. Do not merge it directly; create a real E2E task if the UI exists or is intentionally added.
- `TASK-20260619-011` created formal backlog item `QA-BACKLOG-20260619-001` for that attachment-inventory overflow E2E idea, then deleted the duplicate test file. The backlog item is not implemented coverage.
- `TASK-20260619-012` verified byte-identical cleanup with a fresh SHA-256 scan before deletion, a fresh final closeout scan, path-level exclusion of three now-different duplicates, and `npm run agents:check`.
- Duplicate cleanup closeout must use a fresh current scan, not stale inventory counts, because duplicate files can diverge after earlier tasks.
- `TASK-20260619-013` reviewed the three now-different duplicates and found all three are older/stale shadows of canonical files, not merge sources.
- `TASK-20260619-014` deleted the three reviewed duplicate files and verified the final Git-visible untracked duplicate scan reports `same=0 diff=0 missing=0 nonfiles=0`; `npm run agents:check` passed.
- `TASK-20260619-015` removed 14 confirmed empty duplicate directories, confirmed the empty-dir scan is clean, and recorded 56 generated/ignored duplicate-like output paths without deleting them.
- `TASK-20260712-002-mobile-interaction-click-reliability` adds `npm run test:e2e:interactions:mock` to the manual GitHub Actions E2E workflow. It verifies touch-center hit-testing, Sidebar/Dropdown navigation, account controls, pointer-lock release, overlay close, a representative modal handoff and primary-route overflow at 390px and 430px; WebKit remains a local Safari-like regression option through `PLAYWRIGHT_BROWSER=webkit`.
- Settings closeout requires the exact interaction command, six target widths, store/role/error/draft and
  overlay evidence, clean synthetic screenshots, and a fresh rerun after latest-main integration. An E2E
  `route.fetch` callback still running at test teardown is test-infrastructure failure and must be awaited,
  not ignored as browser noise.
- App-shell interaction tests must wait for the first successful `stores/context` snapshot instead of `networkidle`, then verify controls against live DOM because authority and Realtime bridges may legitimately rerender. Unit coverage separately proves that first permission hydration does not unmount shell controls and later stable authority changes still reset them.
- Guided-buyback role E2E must start the dev server itself with `REPAIRDESK_E2E_BUSINESS_DESKTOP=1`; setting the flag only on Playwright leaves server actors fail-closed. `TASK-20260712-005-buyback-guided-evidence` final post-rebase gate is 12 files/152 focused tests, 127 files/883 full tests, lint/typecheck/build PASS and 10/10 guided-buyback/dashboard Playwright flows plus four reviewed screenshots.
- If the full parallel Vitest run fails only through fixed 5s timeouts in Radix/user-event tests on a constrained host, rerun the failed files in isolation and the complete suite with one worker before classifying the result as a product regression. Keep the original failure and both rerun results in evidence.
- `TASK-20260714-001-buyback-sensitive-evidence-feature-off` closes on 87 focused tests, 132 files / 909 tests with two bounded workers, agents/lint/typecheck/build, and 6/6 Owner/Manager/Sales x 390/1440 browser flows. Default-concurrency fixed-timeout failures were preserved, passed isolated, and passed inside the bounded full suite. Production proof includes exact Git/Vercel SHA, HTTP/login redirect, empty error/5xx observation and a linked Supabase no-write postcheck.
- `TASK-20260714-002-buyback-supabase-schema-staging` closes the target migration slice on 7 contract tests, PG17 UUID/Text fixtures, zero-residue anomaly failure, official CLI runner rollback proof, agents/lint/typecheck, 132 files / 910 tests, 22/22 build, exact pre/post dry-runs and delayed production ACL/empty-state observation. Full history reset remains failed at earlier migration `20260611102805`, so QA must not generalize this slice PASS to the full recovery chain.
- Customer finance/order lifecycle releases require cancellation/void aggregate parity, permission forgery, stale/idempotent/atomic terminal actions, CRM same-store/delete/null behavior, full app gates, pgTAP and desktop/mobile visual evidence. `TASK-20260716-003-customer-finance-order-correction-plan` passed 144 files / 1021 tests, pgTAP 102/102, full agents/lint/typecheck/build and 7/7 responsive Playwright checks with four redacted screenshots.
- Quote workflow releases must cover unknown intake without fake prices, reported/diagnosed/quoted separation, role and tenant denials, stale quote/version rejection, idempotent publish/send, legacy bypass denial and desktop/mobile/task visual states. `TASK-20260717-004-order-diagnosis-quote-implementation` passed lint/typecheck, 210 files / 1446 tests, Webpack and Vercel builds, four screenshots, database ACL/index/anomaly postchecks and exact-SHA runtime smoke.
- Desktop beginner releases require final-state readiness before screenshots, role-filtered navigation/commands, terminal-action selection, exact missing-field focus, true error-vs-empty behavior, and custody secret-retention regression. `TASK-20260717-008-desktop-novice-ui-implementation` passed 213 files / 1467 tests, build, 53 overflow/dialog checks, 5 order audits, 4 custody/visual checks and seven reviewed screenshots.
- Order-create navigation regression must cover both `/orders/new` and the `/orders` new-order Dialog. Each success case must assert the canonical `/orders/{id}` URL, visible page detail root, removed new-order root, and—on the list entry—no remaining detail Dialog shell. Stub only the create success response when the mock actor lacks store context; keep actual API/database completeness as a separate integration/production gate.
- Order-cost Phase 2 releases must jointly cover null versus explicit zero, estimated versus confirmed, revision immutability, quote-margin completeness, allocation/release compensation, CSV injection, historical-evidence backfill, currency snapshots, role/tenant denials and feature-off production behavior. `TASK-20260718-008-order-cost-phase2` passed 259 files / 1,669 tests, PG17 harnesses, responsive synthetic flows and PII-free production smoke; the final conclusion remains CONDITIONAL under Option B recovery acceptance.

## Interfaces and dependencies

Verified gate from `TASK-20260716-005-device-custody-status-implementation`: create/detail/cancel/complete/pickup/offline/import-export/permission/tenant cases are covered by 1087 app tests, PG17 102+42 pgTAP assertions, 3/3 responsive E2E, four screenshots, exact production metadata/ACL checks and clean runtime observation.

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |
| Finance/lifecycle release gate | Product + Frontend + Backend + Data + Security | Verify semantic parity, denial/atomicity, migration replay/postchecks and responsive states together | Treat any cross-store, partial-write, stale overwrite, finance leak or missing audit as NO-GO | TASK-20260716-003-customer-finance-order-correction-plan E-013..E-025 | verified |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| QA-20260619-001 | Dirty worktree and generated/ignored output can distort regression attribution | False positives/negatives | QA + Operations | before code work or generated-output cleanup | open |
| QA-20260619-002 | E2E is not part of PR CI | UI workflow regressions may slip | QA | 60-day roadmap | open |
| QA-20260619-003 | `tools/ai_company.py validate` traverses the full repository before skip filtering | Governance validation may hang in large/dirty worktrees | QA + Tooling | before relying on full validate for cleanup closeout | open |
| QA-20260619-004 | Attachment-inventory dialog overflow scenario exists only as proposed backlog | Useful E2E coverage is not implemented yet | QA + UX | review `QA-BACKLOG-20260619-001` when attachment-inventory UI exists or is intentionally added | backlog |
| QA-20260619-005 | Three now-different duplicate files remained after byte-identical cleanup | Deleting blindly could look like governance/test/UI loss unless tied to review evidence | QA + relevant domain reviewers | resolved by TASK-20260619-014 after TASK-20260619-013 review | closed |
| QA-20260619-006 | Dirty-worktree baseline must be preserved before order-list implementation | Later migration failures could be misattributed | QA + Integration Lead | resolved by TASK-20260619-025 post-change gates | closed |
| QA-20260620-001 | Broader `npm run test:e2e:desktop` has one unrelated `/platform` 1440px `networkidle` timeout | Full desktop E2E suite cannot be reported as fully green for this dirty workspace | QA + Platform | investigate if timeout repeats outside order-detail task | open |
| QA-20260620-002 | Classified legacy `src/routes/*` files are not yet deleted | Future search/review noise remains until deletion gates pass | QA + Architecture + Frontend | Owner-approved deletion cleanup task | preflight green; validation pending deletion |
| QA-20260620-003 | Permission matrix lacks automated role denial coverage for order/customer/payment/message mutation paths | Over-permission regressions may slip | QA + Security + Backend | resolved for the approved global role scope by TASK-20260712-002 | closed |
| QA-20260620-004 | Audit-log minimization policy lacks runtime tests | Sensitive data could re-enter audit payloads | QA + Security + Backend | add tests with sanitizer implementation | policy_drafted |
| QA-20260620-005 | Final reports could omit visual proof for UI/task result pages | Owner cannot confirm visible outcome from text alone | QA + Documentation + Integration Lead | enforce on every task closeout | active_rule |
| QA-20260620-006 | Final reports could claim departments were used without real spawned agents | Owner may not get the AI employee operating model requested | QA + Documentation + Integration Lead | require real agent ids/results or no-spawn reason for department-requested work | active_rule |
| QA-20260710-001 | Release validation can become stale when another executor changes remote DB/Git/deploy state | A green gate may describe the wrong target state | QA + Platform + Integration Lead | require remote pre/post assertions and serialized release ownership | open |
| QA-20260712-001 | Default parallel Vitest can exceed fixed 5s test timeouts in existing Radix/user-event suites under local resource contention | False regression classification | QA | review test concurrency/timeout policy in a dedicated test-infrastructure task | observed; serial full suite green |
| QA-20260713-001 | Settings five-role, offline/409, full overlay and 50+ member E2E matrix remains incomplete | Local representative green can overstate release coverage | QA + Frontend + Security | fresh post-integration gate and again before production | open |
| QA-20260717-001 | Online order create now has first-phase tests for timeout error typing, operation-status lookup, replay audit/realtime suppression, full unit suite and responsive E2E; atomic RPC cases remain uncovered | Normal-path green tests can still miss database-level partial-write classes | QA + Backend + Data + Frontend | add timeout-after-commit, concurrent submit and RPC atomicity tests in future atomic-create task | mitigated_first_phase; rpc_gate_pending |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.
- TASK-009 final gate baseline is agents/lint/typecheck PASS, 106 files/710 tests PASS, standard build PASS, strict desktop E2E 11/11 PASS and payment pgTAP 19/19 PASS.

## Capability and tool notes

| Agent/Skill | Current evidence | Capability | Permission | Limitation |
|---|---|---|---|---|
| TBD | none | C0/C1 | task-specific | not evaluated |

## Memory change log

| Date | Change | Source/task | Author/reviewer | Status |
|---|---|---|---|---|
| 2026-06-19 | Initial RepairDesk QA baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-06-19 | Added duplicate cleanup verification boundary and validator traversal limitation | TASK-20260619-005 | Integration Lead | active |
| 2026-06-19 | Added Batch B cleanup targeted test gate | TASK-20260619-008 | Integration Lead | active |
| 2026-06-19 | Confirmed Batch B cleanup gate passed after deleting 12 stale duplicates | TASK-20260619-009 | Integration Lead | active |
| 2026-06-19 | Reviewed Batch C E2E duplicate and captured attachment-inventory overflow backlog idea | TASK-20260619-010 | Integration Lead | active |
| 2026-06-19 | Added `QA-BACKLOG-20260619-001` and removed Batch C duplicate E2E file | TASK-20260619-011 | Integration Lead | active |
| 2026-06-19 | Added fresh-scan requirement for duplicate cleanup and recorded byte-identical cleanup verification | TASK-20260619-012 | Integration Lead | active |
| 2026-06-19 | Classified remaining now-different duplicates as delete-only candidates with diff/search evidence | TASK-20260619-013 | Integration Lead | active |
| 2026-06-19 | Verified final Git-visible duplicate-file scan is clean after deleting reviewed duplicates | TASK-20260619-014 | Integration Lead | active |
| 2026-06-19 | Verified empty duplicate directory cleanup and separated generated-output inventory from source facts | TASK-20260619-015 | Integration Lead | active |
| 2026-06-19 | Established order-list migration baseline gates and classified sandbox build failure as environment-specific | TASK-20260619-024 | Integration Lead | active |
| 2026-06-19 | Verified L2-021 order-list migration with source scan, lint, typecheck, full tests, and non-sandbox build | TASK-20260619-025 | Integration Lead | active |
| 2026-06-20 | Verified order detail manual status transition and recorded stale-server E2E diagnostic lesson | TASK-20260620-001 | Integration Lead | active |
| 2026-06-20 | Recorded classification-only gate for future legacy route deletion | TASK-20260620-002 | Integration Lead | active |
| 2026-06-20 | Recorded deletion preflight green baseline and future full-gate requirement | TASK-20260620-003 | Integration Lead | active |
| 2026-06-20 | Recorded permission-matrix evidence boundary and need for future role denial tests | TASK-20260620-004 | Integration Lead | active |
| 2026-06-20 | Added proposed role denial test groups from the role-policy decision package | TASK-20260619-230350-l2-025-role-policy-decision-package | Integration Lead | proposed |
| 2026-06-20 | Recorded audit-log policy as non-runtime evidence and added future forbidden-field serialization test need | TASK-20260619-231154-l2-027-audit-log-redaction-and-minimizatio | Integration Lead | policy_drafted |
| 2026-06-20 | Added mandatory screenshot/no-screenshot evidence rule for task closeout | TASK-20260619-232315-l2-028-require-closeout-screenshots-for-re | Integration Lead | active_rule |
| 2026-06-20 | Added real sub-agent evidence gate for Owner-requested department/AI employee work | TASK-20260619-232915-l2-029-enforce-real-sub-agent-spawning-for | Integration Lead | active_rule |
| 2026-07-10 | Recorded full TASK-009 quality gate and remote-state serialization risk | TASK-20260710-009 | Integration Lead | active |
| 2026-07-12 | Recorded final global staff-permission regression, build, migration dry-run and visual evidence gates | TASK-20260712-002-global-staff-permissions | Integration Lead + QA/security reviewers | active |
| 2026-07-12 | Added mobile interaction workflow gate, pointer-lock evidence contract, and timeout-classification rule | TASK-20260712-002-mobile-interaction-click-reliability | Integration Lead | active |
| 2026-07-13 | Added guided-buyback security/full/browser gate and server-side E2E actor-environment lesson | TASK-20260712-005-buyback-guided-evidence | Integration Lead + security reviewer | active |
| 2026-07-14 | Verified feature-off server/UI containment, bounded full-suite classification and exact production/no-write release evidence | TASK-20260714-001-buyback-sensitive-evidence-feature-off | Integration Lead + SEC/UX/QA reviewers | active |
| 2026-07-14 | Verified dormant migration fixtures, atomicity, full code gates and production post-apply empty/revoked state | TASK-20260714-002-buyback-supabase-schema-staging | Integration Lead + DATA/SEC/REL reviewers | scoped_verified |
| 2026-07-16 | Recorded Dashboard priority authorization, truth-state, responsive, privacy, full-suite and visual evidence matrix | TASK-20260716-001-dashboard-handoff-priority | Integration Lead + QA/SEC/UX reviewers | active |
| 2026-07-16 | Recorded Orders queue loading/race/offline, bounded-query, realtime/preload, full-suite and responsive visual gates | TASK-20260716-002-orders-mobile-filter-loading-plan | Integration Lead + QA/SEC/UX reviewers | active |
| 2026-07-16 | Recorded customer finance/lifecycle SQL, permission, atomicity, full-suite, responsive and production postcheck matrix | TASK-20260716-003-customer-finance-order-correction-plan | Integration Lead + QA/DATA/SEC/UX reviewers | active |
| 2026-07-13 | Recorded Settings exact interaction/screenshot/post-integration gates and remaining matrix gaps | TASK-20260712-004-settings-center-master-plan | Integration Lead + WP08 QA reviewer | conditional |
| 2026-07-17 | Closed the device-custody regression, SQL state-machine, responsive visual and production postcheck matrix | TASK-20260716-005-device-custody-status-implementation | Integration Lead + QA/SEC/DATA reviewers | scoped_verified |
| 2026-07-17 | Added online order-create ambiguous-success and idempotency recovery test matrix | TASK-20260717-163954-task | Integration Lead + API/Data reviewer | proposed_gate |
| 2026-07-17 | Verified first-phase order-create recovery with focused tests, full Vitest, build, mobile E2E, overflow E2E and screenshots | TASK-20260717-165957-task | Integration Lead | verified_local |
| 2026-07-17 | Closed unknown-intake/quote regression, permission, atomicity, responsive visual and production release matrix | TASK-20260717-004-order-diagnosis-quote-implementation | Integration Lead + QA/DATA/SEC/UX reviewers | scoped_verified |
| 2026-07-17 | Verified novice desktop hierarchy, terminal/permission/custody regressions, final-state screenshots and no-migration release gate | TASK-20260717-008-desktop-novice-ui-implementation | Integration Lead + QA/FLOW/DATA reviewers | scoped_verified |
| 2026-07-17 | Verified employee invite new/existing delivery, same-origin confirmation, atomic denial matrix, 217/1484 full tests, build and desktop/mobile screenshots | TASK-20260717-employee-invite-registration | Integration Lead + QA/SEC/FLOW reviewers | scoped_verified |
| 2026-07-18 | Added and executed two-entry order-create canonical navigation regression with full app gates and production deployment smoke | TASK-20260718-095500-order-create-navigation-release | Integration Lead | production_verified |
| 2026-07-18 | Closed the full order-cost Phase 2 functional/security/migration/release matrix with dormant production observation and an explicit recovery exception | TASK-20260718-008-order-cost-phase2 | Integration Lead + QA/DATA/SEC reviewers | conditional_scoped_verified |
