# Checkpoints

## 2026-07-03T02:22:49+02:00

- Repaired the pattern editor repeated-point behavior.
- Repeated taps on a selected point no longer append a new step or overwrite the visible number.
- Added clear start/end text and duplicate-point feedback.
- Disabled Save while the draft password is invalid.
- Changed app-level pattern rule to 4-9 unique points.
- Updated model, API schema, mock API tests, browser screenshots, lint, typecheck, order tests, build, and diff check.

## Decisions

- Use Android-style unique point rule for clarity and to avoid ambiguous start/end rendering.
- Do not add or apply a Supabase migration in this task. App/server validation now rejects duplicates; database migration would require a separate data-migration task and approval.
- Preserve unrelated dirty worktree changes.

## Risks

- Existing saved repeated trajectories, if any, may need a later data cleanup/migration decision before enforcing the same rule at database level.
- The older migration `20260702001000_order_device_unlock_pattern_trajectory.sql` still documents DB-level acceptance of repeated trajectories if applied directly; this task did not alter database files.

## Next Step

If owner requests production parity, open a separate data-migration review to update `repairdesk_valid_unlock_pattern` and decide how to handle existing repeated pattern records.
