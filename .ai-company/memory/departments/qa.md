---
schema_version: 1
department: qa
status: active
owner: QA Department / Integration Lead
last_verified_at: 2026-06-20
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

## Interfaces and dependencies

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |

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
| QA-20260620-003 | Permission matrix lacks automated role denial coverage for order/customer/payment/message mutation paths | Over-permission regressions may slip | QA + Security + Backend | after Owner role-policy approval; decision package ready | approval_pending |
| QA-20260620-004 | Audit-log minimization policy lacks runtime tests | Sensitive data could re-enter audit payloads | QA + Security + Backend | add tests with sanitizer implementation | policy_drafted |
| QA-20260620-005 | Final reports could omit visual proof for UI/task result pages | Owner cannot confirm visible outcome from text alone | QA + Documentation + Integration Lead | enforce on every task closeout | active_rule |
| QA-20260620-006 | Final reports could claim departments were used without real spawned agents | Owner may not get the AI employee operating model requested | QA + Documentation + Integration Lead | require real agent ids/results or no-spawn reason for department-requested work | active_rule |
| QA-20260710-001 | Release validation can become stale when another executor changes remote DB/Git/deploy state | A green gate may describe the wrong target state | QA + Platform + Integration Lead | require remote pre/post assertions and serialized release ownership | open |

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
