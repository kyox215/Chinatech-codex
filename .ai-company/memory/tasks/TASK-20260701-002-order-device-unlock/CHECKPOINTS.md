# Checkpoints

## 2026-07-01T01:26:39+02:00 Completed

- Added `src/features/orders/model/device-unlock.ts` as the shared validation/normalization boundary.
- Added database-compatible nullable fields and constraints through a Supabase migration file.
- Wired create, update, and patch flows through server and mock APIs.
- Added reusable UI components for unlock editor, hidden detail viewer, and list badge.
- Wired desktop/mobile list, new order, full edit, desktop detail, and mobile detail sheet.
- Verified full lint/typecheck/test/build and captured UI evidence.

## Follow-up

- Apply the Supabase migration only after Owner approval.
- If the business later wants unlock secrets in print/export/messages, require a separate privacy approval design.
