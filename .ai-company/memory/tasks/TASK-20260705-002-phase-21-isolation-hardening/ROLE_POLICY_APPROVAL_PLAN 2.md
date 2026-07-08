# Role Policy Approval Plan

Status: draft, not implemented in runtime.

## Decision Boundary

This task does not change live role behavior. Runtime enforcement should start only after the Owner approves the final role matrix because a wrong policy can block store owners or expose private partner-store data.

## Recommended Role Matrix

| Role | Intended scope | Allowed by default | Needs explicit restriction |
|---|---|---|---|
| owner | Independent store owner | Full store business data, members, settings, invitations, support grants, export, lifecycle decisions | Cannot be granted by join request or public invite link |
| manager | Trusted store operator | Orders, customers, inventory, messages, workflow settings, supplier markings, staff queue review | No owner transfer, store deletion, billing/plan ownership, platform support grant unless owner delegates |
| technician | Repair worker | Assigned/all repair orders, diagnostics, repair notes, photos, device unlock viewing when needed | No member management, store settings, customer export, payment collection override, bulk data export |
| frontdesk | Reception and sales counter | Create/update customers and orders, intake, quote capture, payment collection, pickup status, customer messaging | No workflow settings, member management, private support grant, destructive customer/order actions |
| viewer | Read-only collaborator | Read business records needed for cooperation | No mutation, no exports by default, no credential/unlock viewing unless separately approved |

## Implementation Package After Approval

1. Define a single permission map in a shared server module, for example `src/server/permissions.ts`.
2. Add route-level authorization checks in `src/server/api/repairdesk-router.ts`.
3. Add repository/service-level object checks for high-risk mutation paths so direct server calls cannot bypass route checks.
4. Add UI affordance checks only as a convenience layer, never as the only enforcement.
5. Add tests for each role across create/update/delete/export/support-grant paths.
6. Add a rollback flag or conservative fallback that preserves owner access if role data is missing.

## Required Owner Decisions

- Whether `manager` may grant time-limited platform support access, or owner-only.
- Whether `technician` can see phone unlock credentials by default.
- Whether `frontdesk` can mark payments as collected without manager/owner review.
- Whether `viewer` can export customer/order data.

## Production Gate

Before production release, verify:

- Existing store memberships have valid non-null roles.
- At least one active owner exists for every active store.
- Join requests and invite links cannot create `owner`.
- Permission failures show user-facing Chinese messages without leaking store or customer identifiers.
