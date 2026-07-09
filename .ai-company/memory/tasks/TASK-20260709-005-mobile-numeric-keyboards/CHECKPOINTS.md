# Checkpoints

## 2026-07-09 02:07 CEST

Status: verified_ready_to_commit

Completed:

- Added shared mobile input helpers for decimal, telephone, and IMEI keyboard hints.
- Replaced order money fields with text inputs using decimal keyboard hints.
- Added phone keyboard hints to customer phone lookup components.
- Added numeric keyboard hints to IMEI manual input fields.
- Added unit and E2E coverage.
- Generated mobile new-order screenshot evidence.

Validation:

- lint passed.
- typecheck passed.
- targeted Vitest passed.
- full Vitest passed.
- build passed outside sandbox.
- mobile input E2E passed.

Open Risks:

- Native mobile keyboard layout is controlled by Safari/Chrome and cannot be captured directly in Playwright screenshots.
- `ACTIVE_CONTEXT 3.md` is an unrelated untracked old context copy and should not be staged for this task.

Next:

- Stage only this task's files.
- Commit and push `main`.
