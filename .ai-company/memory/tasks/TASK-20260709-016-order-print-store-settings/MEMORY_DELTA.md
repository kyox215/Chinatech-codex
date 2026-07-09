# Memory Delta — TASK-20260709-016

- Order print sheets should build store identity through `src/features/print/model/store-print-profile.ts` rather than hard-coding store display strings in order components.
- First version of per-store order printing requires no database migration because `public.store_settings` already has store identity/contact/footer fields.
