# Quality Gate Report — SeaTable Safe Import Package

Generated: 2026-07-11T01:40:00+02:00

> **Historical interim snapshot — superseded.** This report records the fail-closed gate before Owner approval and production execution. The authoritative final state is the later 2026-07-11T08:08:40Z checkpoint and final handoff: 6284 rows imported, exact test-parent cleanup complete, rollback rehearsals and post-commit verification passed. It must not be read as the current production verdict.

## Verdict

- Safe import package and read-only production preflight: **PASS**.
- Production cleanup/import execution at this historical checkpoint: **FAIL / NO-GO**.

No production insert, update or delete was executed.

## Acceptance Matrix

| Acceptance | Evidence | Result |
|---|---|---|
| Deterministic batch identity | UUIDv5 unit test; target-bound manifest | PASS |
| Global public-number and entity collision check | Read-only production preflight, collision count 0 | PASS |
| Exact target tenant and owner | Active store, active owner membership and owner identity match | PASS |
| PII minimization | No raw event payload path; SMS/marketing consent false; redacted `0600` outputs | PASS |
| Test-only cleanup selection | Three demo markers plus extra-event, attachment and payment guards | PASS for preview only |
| Source data invariants | Four deposit-greater-than-quotation rows detected | FAIL for production |
| Backup and restore rehearsal | Not yet implemented or approved | FAIL for production |
| Owner cleanup approval | 13 eligible and 7 blocked orders await owner decision | FAIL for production |
| Final production authorization | `production_mutation_authorized: false` | FAIL for production |

## Executed Verification

- `npm run test`: 106 files, 715 tests passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run agents:check`: passed.
- `git diff --check`: passed.
- Actual 6284-row dry-run reproduced 3664 customers, 6284 devices/orders, EUR 334902.50 quotation, EUR 39192.51 deposits and 604 source-quality warnings.
- Read-only production preflight exited with code 2 because the fail-closed money gate detected four violations.

## Documentation Impact

| Reader | Updated authority | Result |
|---|---|---|
| Operator / Data | `docs/SEATABLE_RIPARAZIONE_WORKFLOW_PLAN.md` | CLI and safety behavior synchronized |
| Owner / Approver | `PRODUCTION_IMPORT_APPROVAL_PACKAGE.md` | Current gates and cleanup counts synchronized |
| Future agent | `TASK.md`, `EVIDENCE.md`, `HANDOFF.md`, `MEMORY_DELTA.md`, `ACTIVE_CONTEXT.md` | Resume state synchronized |

## Residual Risk

- Four money-invariant rows require correction or an explicit business decision.
- Seven demo orders have additional activity; three include attachments and cannot be treated as clean delete candidates.
- Exact-candidate backup, Storage attachment recovery and restore rehearsal remain required.
- The local-only `--apply` path is still a whole-store reset and remains prohibited for production.

## Visual Evidence

No screenshot was captured. This task is backend/data tooling, and browser-visible evidence would expose customer PII. Private redacted reports and command results are the substitute evidence.
