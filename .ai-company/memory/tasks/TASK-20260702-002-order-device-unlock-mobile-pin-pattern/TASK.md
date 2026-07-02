# TASK-20260702-002 Order Device Unlock Mobile PIN and Pattern Repair

Status: completed
Owner: Integration Lead / CEO Agent
Started: 2026-07-02T00:00:00+02:00
Completed: 2026-07-02T01:20:00+02:00
Autonomy: L2 controlled execution
Risk: R2 privacy-sensitive order data, UI/API validation, and database constraint change

## Owner Goal

Improve mobile phone password entry in orders:

- PIN mode should immediately show a numeric keyboard and be quick to enter.
- Pattern mode has visual/line alignment problems that must be fixed.
- Pattern mode must not cap usable drawing at 9 unique points; staff should be able to keep drawing a longer pattern trajectory.

## Scope

In scope:

- Shared order unlock editor UI.
- Shared order unlock model validation.
- API schema validation and mock API behavior through the existing shared normalizer.
- Supabase migration that updates the existing unlock pattern validator function.
- Focused regression tests and mobile visual evidence.

Out of scope:

- Applying the Supabase migration to production.
- Changing reveal permissions or adding unlock secrets to list, print, export, WhatsApp, SMS, or external messages.
- Broad order-detail refactors outside the unlock component.

## Constraints

- Preserve existing privacy behavior: lists/events show only method/change metadata, not plaintext PIN or pattern sequence.
- Keep the `DeviceUnlockInput` public shape compatible.
- Do not overwrite unrelated dirty worktree changes.
- Use one business-code writer in the main thread. No sub-agents were spawned because the owner requested implementation, not multi-agent execution, and available sub-agent tooling requires explicit delegation permission.

## Acceptance

- Selecting PIN focuses the input on mobile and uses numeric keyboard hints.
- PIN input stores only digits, preserves leading zeroes, and rejects invalid API payloads.
- Pattern editor and preview lines align with dot centers on mobile.
- Pattern sequence supports repeated points and more than 9 steps, with at least 4 steps and a defensive max limit.
- Database validator function matches app/API pattern rules through a new migration file.
- Focused tests, lint, typecheck, full tests, build, and mobile screenshots are recorded in `EVIDENCE.md`.
