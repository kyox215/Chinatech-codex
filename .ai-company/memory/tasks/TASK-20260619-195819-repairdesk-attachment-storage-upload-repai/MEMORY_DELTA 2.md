# Memory Delta — TASK-20260619-195819-repairdesk-attachment-storage-upload-repai

## Candidate project facts

- Production upload error `上传工单附件失败: Bucket not found` means Supabase Storage/schema drift should be checked first: `storage.buckets`, `public.order_attachments`, `public.inventory_attachments`, and migration `repairdesk_attachment_storage_repair`. Source: E-002 through E-004. Status: confirmed 2026-06-19. Owner: Data/Backend.
- RepairDesk attachment buckets are intentionally private: `repairdesk-order-attachments` and `repairdesk-inventory-attachments`. Upload/read should go through `@/lib/repairdesk/api` and server service-role code, not direct client Storage access. Source: E-002, E-008. Status: confirmed. Owner: Security/Backend.

## Candidate department updates

- Data: keep idempotent forward repair migrations for production drift; do not edit historical migrations to match already-deployed environments.
- Backend: use `failStorageOperation` for Supabase Storage write paths so bucket/key/permission failures remain actionable.

## Candidate decisions / ADRs

- None yet.

## Candidate lessons and capability evidence

- If Storage reports signature/JWT issues, check server `SUPABASE_SERVICE_ROLE_KEY`; if RLS/permission, check bucket/table policy posture and service-role execution. Source: `src/server/repairdesk-shared.ts` and tests.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
