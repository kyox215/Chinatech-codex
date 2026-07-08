# Phase 2 Tenant Isolation Audit Report

Task: `TASK-20260705-001-tenant-isolation-audit`
Collected at: 2026-07-04T23:48:41Z
Conclusion: **CONDITIONAL PASS for local Phase 2 audit and safe hardening.**

This report covers local repository evidence only. It is not a production Supabase migration, RLS parity, deployment, or release approval.

## Sub-agents Used

Read-only department agents were used for independent review:

| Role | Agent ID | Output used for |
|---|---|---|
| Architecture | `019f2f79-848c-7133-be2e-2e7ca6d3ee7a` | API/repository boundary and object authorization gaps |
| Data | `019f2f79-8586-7153-aafc-d4ce8fb00a35` | schema, migration, storage, constraint, and RLS follow-ups |
| Security | `019f2f79-8630-73a1-90d5-21458a521fd9` | cross-store threat model, audit payload minimization, platform visibility |
| QA | `019f2f79-86d5-75b3-8b83-757d344a343b` | denial-test coverage and regression command plan |
| Final QA/security closeout | `019f2f82-19eb-7a63-8bf6-cd2d2a1bcee0` | final read-only diff review; integrated |

No sub-agent was allowed to edit files, stage, commit, push, deploy, inspect secrets, or access production.

## Inventory Result

Major local tenant-boundary surfaces reviewed:

- Shared router and auth context: `src/server/api/repairdesk-router.ts`, `src/server/auth-context.ts`, `src/server/tenant.ts`.
- Repair orders and order attachments: order repository/router paths and attachment storage repair migration.
- Customers, customer devices, customer tags, interactions, follow-ups, and outbound messages.
- Inventory and buyback repository/storage patterns.
- Store settings, members, onboarding requests, invitations, invite links, and platform queue.
- Platform admin surfaces and onboarding review policies.
- Audit log payloads and storage/attachment error handling.

## Safe Local Fixes Implemented

### Customers

Files:

- `src/features/customers/server/customer.repository.ts`
- `src/server/tenant-guard.test.ts`

Changes:

- `customer_followups` reads now attempt active-store filtering before legacy fallback.
- Customer device, tag, follow-up, and message writes now assert the customer belongs to the active store.
- Optional `order_id` links on customer follow-ups/messages now require the order to belong to the same customer and store.
- Store-scoped updates/deletes now use `select("id").maybeSingle()` and fail on zero-row mutation instead of silently reporting success.

Residual:

- Legacy missing-`store_id` fallbacks remain for compatibility with older local schemas. Remove or gate them before production parity can be called strict.

### Store Access Approval

Files:

- `src/features/stores/server/store.repository.ts`
- `src/features/stores/server/store.repository.test.ts`

Changes:

- `getPendingStoreAccessRequest` now filters by `review_scope = store` and active `target_store_id` in the initial read query.
- Tests assert the query includes store-scope filters before approval/rejection handling.

### Audit Logging

Files:

- `src/server/audit.ts`
- `src/server/audit.test.ts`

Changes:

- `writeAuditLog` now recursively sanitizes `before_data`, `after_data`, and `metadata`.
- Sensitive fields such as base64 payloads, signed/public URLs, storage paths, message body, phone, email, customer names, IMEI/serial, unlock data, file names, notes, request notes, and decision notes are redacted.
- Data URLs and overlong strings are summarized before persistence.
- Platform audit logs now reuse the same sanitizer for `before_data` and `after_data`.

Residual:

- Top-level audit columns such as `actor_email` and `actor_name` remain as schema-level audit metadata. Changing those requires a separate audit-retention and reporting decision.

### Final Closeout Review Follow-ups

The final read-only QA/security reviewer found no P0/P1 issues. Two low-risk P2/P3 items were addressed before closeout:

- Platform audit `before_data` and `after_data` now reuse `sanitizeAuditRecord`.
- Customer outbound-message `last_contacted_at` updates now fail on zero-row mutation instead of silently succeeding.

Remaining non-blocking test-strength gap:

- Customer repository tenant coverage is still partly static/string-guard based. Add behavior-level Supabase mock denial tests in a later hardening pass.

## Remaining Approval-Gated Risks

These are not blockers for local Phase 2 audit closeout, but they block production claims:

- Production Supabase schema, RLS, storage bucket policies, and grants remain unverified.
- Role-level mutation authorization is still incomplete across several business endpoints and needs the separately approved role-policy package.
- Client React Query keys are not fully store-scoped, so store switching can retain stale cached data until invalidation/key hardening is implemented.
- CRM `order_id` same-store foreign-key constraints and some inventory/buyback drift-path constraints need a future migration plan.
- Storage path prefix rules and attachment retention/purge policy need production runbook approval.
- Raw platform support access remains intentionally out of scope until Phase 3 owner-granted support-access design.

## Validation

Commands run in this workspace:

| Command | Result |
|---|---|
| `npm run test -- src/server/audit.test.ts src/server/tenant-guard.test.ts src/features/stores/server/store.repository.test.ts src/features/platform/server/platform.repository.test.ts src/server/api/repairdesk-router.test.ts` | Passed, 5 files / 59 tests |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run test` | Passed, 50 files / 327 tests |
| `npm run build` | Approved non-sandbox run passed; earlier sandbox run failed due known Turbopack local port permission |

## Screenshot Rule

No task screenshot was produced because this phase is backend/security/data/documentation work with no relevant UI result page. Evidence is code, tests, build output, and this task report.

## Closeout Position

Local Phase 2 can close as **CONDITIONAL PASS** after memory checkpoint.

Production rollout remains blocked until owner-approved production preflight, migration/RLS verification, storage policy verification, release runbook, and rollback plan are completed.
