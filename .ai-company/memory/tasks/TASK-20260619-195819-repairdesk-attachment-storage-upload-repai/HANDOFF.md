# Handoff / Resume — TASK-20260619-195819-repairdesk-attachment-storage-upload-repai

## Current handoff

- **Status:** complete.
- **Last verified:** 2026-06-19T20:00:00Z
- **Workspace/branch:** inspect before resuming; worktree contains unrelated pre-existing changes.
- **First action:** read `TASK.md`, `EVIDENCE.md`, and latest checkpoint, then inspect the repository.

## Summary

Order photo upload failed on production because the required Supabase Storage bucket and attachment metadata table were absent from the live project. The repair migration has been applied to production and added to local migrations. Server upload code now reports missing buckets, service-role key problems, and Storage permission failures with actionable Chinese messages.

## Key Files

- `supabase/migrations/20260619193655_repairdesk_attachment_storage_repair.sql`
- `src/server/repairdesk-shared.ts`
- `src/features/orders/server/order.repository.ts`
- `src/features/inventory/server/inventory.repository.ts`
- `src/server/tenant-guard.test.ts`

## Verification

- Supabase production SQL confirmed both private buckets and both metadata tables exist.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test -- src/server/tenant-guard.test.ts src/features/orders/testing/mock-api.test.ts src/features/inventory/testing/mock-api.test.ts` passed.
- `npm run test` passed.
- `npm run build` passed outside sandbox after sandbox-only Turbopack port-binding failure.

## Resume Notes

- Do not make buckets public.
- Do not add direct browser Storage upload policies unless a separate security review approves it.
- If production upload still fails after deployment, the next likely causes are server env service-role key mismatch, disallowed MIME type, file size mismatch, or real Storage permission denial.
