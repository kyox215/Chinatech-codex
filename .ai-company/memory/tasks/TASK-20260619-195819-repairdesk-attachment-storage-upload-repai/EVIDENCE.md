# Evidence Index — TASK-20260619-195819-repairdesk-attachment-storage-upload-repai

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T19:58:19Z | CEO-Orchestrator |
| E-002 | production SQL | required private attachment buckets exist | Supabase SQL over `storage.buckets` | `repairdesk-order-attachments` and `repairdesk-inventory-attachments` present with `public=false` | 2026-06-19T19:51:00Z | Integration Lead |
| E-003 | production SQL | attachment metadata tables exist | Supabase SQL over `information_schema.tables` | `public.order_attachments` and `public.inventory_attachments` present | 2026-06-19T19:51:00Z | Integration Lead |
| E-004 | production migration | production has forward repair migration | Supabase migration history | `repairdesk_attachment_storage_repair` version `20260619194103` | 2026-06-19T19:51:00Z | Integration Lead |
| E-005 | code | server upload errors are actionable | `src/server/repairdesk-shared.ts` | `failStorageOperation` added for bucket/key/permission failures | 2026-06-19T19:53:00Z | Integration Lead |
| E-006 | code | order upload validates file payload before Storage write | `src/features/orders/server/order.repository.ts` | size mismatch and magic-byte checks added | 2026-06-19T19:53:00Z | Integration Lead |
| E-007 | code | inventory/buyback upload reports Storage drift clearly | `src/features/inventory/server/inventory.repository.ts` | upload failure now uses `failStorageOperation` | 2026-06-19T19:53:00Z | Integration Lead |
| E-008 | migration | local forward migration documents and repairs drift | `supabase/migrations/20260619193655_repairdesk_attachment_storage_repair.sql` | idempotent bucket/table repair migration added | 2026-06-19T19:53:00Z | Integration Lead |
| E-009 | verification | static quality gates pass | `npm run typecheck`; `npm run lint` | both passed | 2026-06-19T19:53:00Z | Integration Lead |
| E-010 | verification | attachment-related tests pass | `npm run test -- src/server/tenant-guard.test.ts src/features/orders/testing/mock-api.test.ts src/features/inventory/testing/mock-api.test.ts` | 3 files, 43 tests passed | 2026-06-19T19:53:00Z | Integration Lead |
| E-011 | verification | full test suite passes | `npm run test` | 37 files, 222 tests passed | 2026-06-19T19:54:00Z | Integration Lead |
| E-012 | verification | production build passes outside sandbox | `npm run build` | Next.js build passed; sandbox-only Turbopack port-binding failure was bypassed with approved non-sandbox build | 2026-06-19T19:55:00Z | Integration Lead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
