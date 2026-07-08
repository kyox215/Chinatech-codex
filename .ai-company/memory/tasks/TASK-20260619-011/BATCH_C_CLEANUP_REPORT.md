# Batch C Cleanup Report — TASK-20260619-011

- Task: `TASK-20260619-011`
- Scope: preserve the useful Batch C E2E idea, then delete the two reviewed Batch C duplicate files.
- Boundary: no canonical scripts, canonical E2E tests, business code, staging, commit, push, deploy, or production data were changed.
- Status: verified cleanup.

## Executive Result

The attachment-inventory dialog overflow test idea was preserved as formal backlog item `QA-BACKLOG-20260619-001` in `.ai-company/memory/BACKLOG.md`.

After preserving that idea, both Batch C duplicate files were deleted:

| Deleted path | Basis |
|---|---|
| `scripts/check-agent-rules 2.mjs` | `TASK-20260619-010` classified it as delete-only because canonical checks are modular and current. |
| `tests/e2e/visual-overflow.spec 2.ts` | `TASK-20260619-010` classified it as salvage-first; the only useful idea was extracted into backlog before deletion. |

## Backlog Entry

| Backlog ID | Title | Owner | Status |
|---|---|---|---|
| `QA-BACKLOG-20260619-001` | Add attachment-inventory dialog overflow E2E coverage | QA + UX | proposed |

This backlog item should be reviewed only when the attachment-inventory UI exists or is intentionally added. The stale duplicate test should not be copied directly.

## Verification

| Gate | Result |
|---|---|
| Pre-cleanup Batch C status | both target files existed and were `??` untracked. |
| Backlog preservation | `.ai-company/memory/BACKLOG.md` contains `QA-BACKLOG-20260619-001` with evidence, owner, status, and trigger. |
| Delete operation | `apply_patch` deleted exactly the two Batch C paths. |
| Post-cleanup Batch C status | `git status --short -- <Batch C paths>` returned no output; both `test ! -e` checks passed. |
| Canonical boundary | canonical script/test paths were not edited by this task; `scripts/agents/check-agent-config.mjs` retained its pre-existing modification. |
| Governance check | `npm run agents:check` passed. |

## Residual Risks

| Risk | Level | Owner | Follow-up |
|---|---|---|---|
| Backlog item is not implemented. | P2 | QA + UX | Implement only when attachment-inventory UI exists or is intentionally added. |
| Remaining duplicate-like files outside Batch C still exist. | P2 | Operations + QA | Continue staged cleanup with explicit path lists. |
| Active context currently points to a separate UI audit task. | P2 | Memory + Integration Lead | Resume or close that task separately; do not conflate with duplicate cleanup. |
