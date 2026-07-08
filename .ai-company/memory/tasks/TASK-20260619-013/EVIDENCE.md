# Evidence Index — TASK-20260619-013

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-06-19T20:42:05Z | Integration Lead / CEO Agent |
| E-002 | upstream evidence | L2-008 final scan identified the three residual now-different duplicates | `.ai-company/memory/tasks/TASK-20260619-012/EVIDENCE.md` E-009 | `same=0 diff=3 missing=0 nonfiles=0` | 2026-06-19T20:42:51Z | Integration Lead / CEO Agent |
| E-003 | diff | `.ai-company/README 2.md` is generic v2 README content, not RepairDesk v3 project README | `diff -u .ai-company/README.md .ai-company/README\ 2.md`; `wc -l` | canonical 58 lines; duplicate 179 lines; major content replacement | 2026-06-19T20:42:51Z | Integration Lead / CEO Agent |
| E-004 | search | v2 README content has other traceability sources | `rg -n "v2.0|Memory & Capability Edition|README 2" .ai-company docs AGENTS.md` | v2 content appears in `AI_COMPANY_OS_MASTER.md`, `FILE_MANIFEST.md`, runtime memory, and task memory | 2026-06-19T20:42:51Z | Integration Lead / CEO Agent |
| E-005 | diff | `warranty-picker 2.tsx` lacks canonical quiet appearance support | `diff -u src/features/orders/components/warranty-picker.tsx src/features/orders/components/warranty-picker\ 2.tsx` | duplicate lacks `appearance`, `quiet`, and quiet Select/Input classes | 2026-06-19T20:42:51Z | Integration Lead / CEO Agent |
| E-006 | search | canonical `WarrantyPicker` quiet appearance is used by current UI | `rg -n "appearance=|appearance\\?:|quiet|WarrantyPicker" src/features/orders src/features/customers src/components` | current call sites pass `appearance="quiet"` and canonical file defines the prop | 2026-06-19T20:42:51Z | Integration Lead / CEO Agent |
| E-007 | diff | `tenant-guard.test 2.ts` lacks canonical attachment-storage tests | `diff -u src/server/tenant-guard.test.ts src/server/tenant-guard.test\ 2.ts` | duplicate lacks `failStorageOperation` import/tests and attachment storage repair migration test | 2026-06-19T20:42:51Z | Integration Lead / CEO Agent |
| E-008 | search | attachment storage behavior tested in canonical file maps to current implementation | `rg -n "failStorageOperation|repairdesk_attachment_storage_repair|SUPABASE_SERVICE_ROLE_KEY|附件存储未初始化" src/server supabase/migrations src/features` | implementation and usages exist in server/shared, order repository, inventory repository, and canonical test | 2026-06-19T20:42:51Z | Integration Lead / CEO Agent |
| E-009 | report | all three residual duplicates are classified | `REMAINING_DIFFERING_DUPLICATES_REVIEW.md` | all three classified as delete-only candidates for a later cleanup task | 2026-06-19T20:42:51Z | Integration Lead / CEO Agent |
| E-010 | validation | governance checks pass after report and memory updates | `npm run agents:check` | passed: Agent config, template, and rule checks passed | 2026-06-19T20:45:19Z | Integration Lead / CEO Agent |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
