# Remaining Now-Different Duplicate Review - TASK-20260619-013

- Task: `TASK-20260619-013`
- Scope: review the three remaining Git-visible now-different ` 2` duplicate files.
- Boundary: no duplicate file, canonical file, business logic, production data, dependency, staging, commit, push, or deploy was changed.
- Status: review complete; cleanup not executed.

## Executive Result

| Duplicate path | Canonical counterpart | Classification | Rationale | Recommended next action |
|---|---|---|---|---|
| `.ai-company/README 2.md` | `.ai-company/README.md` | delete-only candidate | Duplicate is the generic AI Company OS v2 README. Canonical README is the RepairDesk Codex Native v3 README and holds the project-specific authority order. v2 content remains represented elsewhere in `.ai-company/AI_COMPANY_OS_MASTER.md`, `.ai-company/FILE_MANIFEST.md`, and legacy runtime memory. | Delete in a separate L2 cleanup task after owner/integration approval; do not merge into canonical README. |
| `src/features/orders/components/warranty-picker 2.tsx` | `src/features/orders/components/warranty-picker.tsx` | delete-only candidate | Duplicate is older and lacks the canonical `appearance?: "outlined" | "quiet"` prop and quiet styling. Current order UI call sites use `appearance="quiet"`, so the canonical file is newer and required. | Delete in a separate L2 cleanup task; do not merge duplicate content. |
| `src/server/tenant-guard.test 2.ts` | `src/server/tenant-guard.test.ts` | delete-only candidate | Duplicate is older and lacks canonical tests for `failStorageOperation` and `20260619193655_repairdesk_attachment_storage_repair.sql`. Implementation and canonical tests already cover the newer attachment-storage behavior. | Delete in a separate L2 cleanup task; do not merge duplicate content. |

## Evidence Summary

| Evidence | Result |
|---|---|
| `.ai-company/README.md` vs `.ai-company/README 2.md` | Canonical is 58 lines of RepairDesk v3 project-specific README; duplicate is 179 lines of generic v2 package README. |
| Search for v2 governance content | v2 content appears in `.ai-company/AI_COMPANY_OS_MASTER.md`, `.ai-company/FILE_MANIFEST.md`, `.ai-company/runtime-memory/*`, and task memory, so `README 2.md` is not the only source of v2 traceability. |
| `warranty-picker.tsx` diff | Canonical adds `appearance`, computes `quiet`, and applies quiet Select/Input styling; duplicate lacks these additions. |
| Warranty usage search | Current order UI uses `appearance="quiet"` in `order-overview-tab.tsx`, `new-order-customer-device-section.tsx`, and `new-order-fault-diagnosis-section.tsx`. |
| `tenant-guard.test.ts` diff | Canonical imports `failStorageOperation` and adds attachment-storage error and migration alignment tests; duplicate lacks the tests. |
| Tenant/storage search | `failStorageOperation` exists in `src/server/repairdesk-shared.ts` and is used by order and inventory attachment repositories. |

## Residual Risk

| Risk | Level | Owner | Handling |
|---|---|---|---|
| Deleting `.ai-company/README 2.md` could remove a convenient v2 overview if someone still references it manually. | P3 | Documentation + Operations | Acceptable if deleted with report link; canonical v3 README and v2 package docs remain. |
| Deleting `warranty-picker 2.tsx` or `tenant-guard.test 2.ts` without this review could look like code/test loss. | P2 | QA + Integration Lead | Use this report as cleanup evidence; canonical files contain the newer behavior. |
| Broader dirty worktree remains. | P2 | Operations + QA | Keep future cleanup path-scoped and do not stage unrelated files. |

## Recommendation

Run `L2-010` as a delete-only cleanup task for exactly these three paths:

- `.ai-company/README 2.md`
- `src/features/orders/components/warranty-picker 2.tsx`
- `src/server/tenant-guard.test 2.ts`

Suggested validation for L2-010:

- Fresh SHA-256/status check before deletion.
- Delete only the three listed paths.
- Run `npm run agents:check`.
- Optionally run targeted tests if the worktree is suitable: `npm run test -- src/server/tenant-guard.test.ts src/features/orders/components/order-option-pickers.test.tsx`.
