---
schema_version: 1
task_id: "TASK-20260705-003-role-policy-approval-package"
title: "Independent partner store role-policy approval package"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Data", "Documentation", "Product", "QA", "Security"]
created_at: "2026-07-05T08:17:06Z"
updated_at: "2026-07-05T08:29:07Z"
closed_at: "2026-07-05T08:29:07Z"
---
# Task — Independent partner store role-policy approval package

## Owner request

Independent partner store role-policy approval package

## Business value

Define an owner-approvable role and permission model for independent partner stores before runtime enforcement, reducing privacy and tenant-isolation risk without changing live permissions.

## Scope in

- Produce an owner-approvable role-policy package for independent partner stores.
- Map current code roles (`owner`, `manager`, `technician`, `sales`, `viewer`) to product roles; treat `sales` as frontdesk/reception.
- Define permissions across orders, customers, inventory, payments, messages, settings, members, invitations, support grants, exports, and unlock credentials.
- Identify high-risk decisions that require Owner approval before runtime enforcement.
- Define phased implementation, server authorization, RLS/data verification, audit, tests, rollback, and release gates.
- Update project progress docs and task memory.

## Scope out

- Runtime role enforcement.
- Production Supabase migration, RLS/storage policy application, data backfill, deploy, or release.
- Platform support-access UI implementation.
- Renaming the persisted `sales` enum to `frontdesk`; the approval package may recommend a future migration but will not change schema.
- Unrelated UI or workflow redesign.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Role matrix covers owner, manager, technician, frontdesk/current `sales`, and viewer across view/create/update/approve/cancel/export/manage actions.
- [x] High-risk permissions have explicit Owner decision points and recommended defaults.
- [x] Implementation plan maps approved permissions to server authorization, RLS, UI affordances, audit, tests, and rollback without applying production changes.
- [x] Progress docs and task memory record sub-agent review, sources, residual risks, and no-runtime-change boundary.

## Closeout evidence

- Approval package: `docs/INDEPENDENT_PARTNER_STORE_ROLE_POLICY_APPROVAL_PACKAGE.md`.
- Progress sync: `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PROGRESS.md`.
- Sub-agent review completed:
  - Product: `019f315a-c732-73f1-8992-1bb75da5136b`.
  - Security: `019f315a-f1f3-7ba0-9317-9f513176e9d1`.
  - Data: `019f315b-1f31-7a62-b9aa-ee2fd3626385`.
- `npm run lint`: passed.
- `git diff --check`: passed.

## Residual risks

- Runtime role-policy enforcement is not implemented in this task.
- Production Supabase schema/RLS/storage parity remains unverified and requires explicit Owner approval.
- `frontdesk` remains a product/UI label; v1 internal enum remains `sales`.
- Client-side exports, unlock credential reads, signed attachment URLs, and sensitive-read audit are follow-up implementation controls.
- Existing dirty worktree contains unrelated prior task changes; this task did not clean or revert them.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |

## Decision and approval points

- R3 / L2: local documentation and planning allowed.
- Owner approval required before runtime role-policy enforcement, enum/schema migration, production Supabase verification, production migration/backfill/RLS/storage changes, deploy, or support-access business-data visibility.
- Explicit Owner decisions required for manager support grants, technician unlock credential visibility, frontdesk payment authority, viewer exports, and whether to rename `sales` to `frontdesk`.

## Work packages

1. WP-01 Evidence: inspect current role types, router/service authorization, tenant isolation docs, and Supabase RLS guidance.
2. WP-02 Review: run read-only Product/Security/Data sub-agents and integrate findings.
3. WP-03 Approval package: write the role matrix, decision points, implementation plan, preflight, tests, and rollback.
4. WP-04 Docs and memory: update progress docs, record sources and reviewer output, run documentation-safe validation, checkpoint, and close.

## Agent plan

- Product reviewer: `019f315a-c732-73f1-8992-1bb75da5136b` / Iris the 6th / read-only.
- Security reviewer: `019f315a-f1f3-7ba0-9317-9f513176e9d1` / Aegis the 6th / read-only.
- Data reviewer: `019f315b-1f31-7a62-b9aa-ee2fd3626385` / Delta the 6th / read-only.
- Main thread remains single writer and final Integration Lead.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
