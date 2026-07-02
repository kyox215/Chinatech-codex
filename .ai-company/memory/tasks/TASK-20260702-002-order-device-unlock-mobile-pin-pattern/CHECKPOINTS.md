# Checkpoints

## 2026-07-02T00:00:00+02:00 Started

- Owner approved the plan to fix mobile PIN input and pattern drawing behavior.
- Baseline task memory `TASK-20260701-002-order-device-unlock` confirmed the original privacy rules: detail-only reveal, list/event redaction, and production migration approval boundary.
- Worktree is dirty from prior unrelated work; implementation must stay scoped to unlock UI/model/API/migration/tests plus this task memory.

## 2026-07-02T01:20:00+02:00 Completed

- Updated shared unlock editor so PIN mode focuses the input, uses numeric/tel keyboard hints, and sanitizes pasted/typed values to digits while preserving leading zeroes.
- Reworked pattern editor and preview geometry so SVG lines use the same dot-center coordinates as the visual grid.
- Changed pattern semantics from 4-9 unique points to 4-128 ordered trajectory steps; repeated points are allowed after leaving and re-entering a point.
- Added migration `20260702001000_order_device_unlock_pattern_trajectory.sql` to update the existing Supabase pattern validator function without production application.
- Verified focused tests, typecheck, lint, full Vitest, production build, scoped diff check, and Playwright mobile screenshot assertions.
- Local dev server on port 3012 was stopped; `lsof -nP -iTCP:3012 -sTCP:LISTEN` returned no listener.
