---
schema_version: 1
task_id: "TASK-20260705-004-role-runtime-decision-and-agent-planning"
title: "Role runtime enforcement decision gate and agent planning"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Architecture", "Data", "Product", "QA", "Security"]
created_at: "2026-07-05T10:23:48Z"
updated_at: "2026-07-05T10:41:00Z"
closed_at: "2026-07-05T10:41:00Z"
---
# Task — Role runtime enforcement decision gate and agent planning

## Owner request

Role runtime enforcement decision gate and agent planning

## Business value

Prepare the next permission-enforcement phase for independent partner stores with explicit Owner choices, read-only agent review, and a safe implementation contract before touching runtime authorization.

## Scope in

- Plan the next permission-enforcement phase after the Phase 2.2 role-policy approval package.
- Ask the Owner only the key choices that materially affect business behavior, privacy, payments, or implementation cost.
- Spawn real read-only sub-agents for Product, Architecture, Data, and Security review.
- Integrate agent findings into a single recommended implementation contract.
- Keep the next coding step limited to a safe Phase B server permission module unless the Owner chooses a broader slice.

## Scope out

- Runtime authorization code changes before Owner choice confirmation.
- Production Supabase migration, RLS/storage policy application, data backfill, deploy, or release.
- Secret handling, destructive SQL, customer communication, or support access activation.
- UI redesign or unrelated order/customer/inventory behavior changes.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Owner-facing key decisions are reduced to a small set of choices with a recommended option and implementation impact.
- [x] Real read-only sub-agents are spawned with bounded task packages and their findings are integrated before implementation.
- [x] Task memory records scope, risk, autonomy, agents, decision points, and no-production-change boundary.
- [x] No runtime authorization, production migration, deploy, destructive SQL, or secret handling occurs before Owner decisions are confirmed.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Previous phase completed role-policy package only | observed | `docs/INDEPENDENT_PARTNER_STORE_ROLE_POLICY_APPROVAL_PACKAGE.md` | use as baseline |
| Current role enum includes `sales`, not `frontdesk` | observed | `src/lib/repairdesk/types.ts` | recommend UI label only for v1 |
| Current runtime authorization is not centralized | observed | `src/server/auth-context.ts`, `src/server/api/repairdesk-router.ts` | design Phase B module first |
| Production Supabase parity remains unverified | known risk | progress docs | keep out of scope until separately approved |

## Decision and approval points

- R3 / L2: permissions, customer PII, payments, support access, and tenant privacy are affected.
- Owner decision required before runtime permission enforcement starts.
- Owner decision required before production Supabase migration/RLS/storage verification or deploy.
- Key choices to ask:
  1. First implementation slice: permission map/tests only, or route gates immediately.
  2. `sales` internal enum: keep for v1 with `前台` label, or schedule rename migration.
  3. Unlock credential visibility for technicians.
  4. Payment authority for frontdesk.
  5. Support access grant authority and export defaults.

## Work packages

1. WP-01 Intake and risk classification: create task memory and classify R3/L2.
2. WP-02 Read-only sub-agent review: Product, Architecture, Data, Security.
3. WP-03 Owner decision package: integrate findings into max five choices with recommended defaults.
4. WP-04 Await Owner choices before implementation.
5. WP-05 After approval, create the next implementation task and assign one writer only.

## Agent plan

- Product: `019f31ce-9133-7871-b257-ace89bb465c8` / Mira the 6th / read-only.
- Architecture: `019f31ce-b61b-78f0-ab75-1b353ad4199b` / Daedalus the 6th / read-only.
- Data: `019f31ce-e39b-7922-a30a-b52f17e8d577` / Gaia the 6th / read-only.
- Security: `019f31cf-08b0-7661-aeae-3fe215625981` / Cipher the 6th / read-only.
- Main thread remains Integration Lead and only writer.

## Integrated sub-agent findings

- All four read-only agents agree the first implementation slice should be Phase B1: add a server-only permission module and unit tests, without route gates, object-level checks, UI cues, database migrations, production preflight, or deploy.
- Recommended first-slice files after Owner approval: `src/server/permissions.ts` and `src/server/permissions.test.ts`.
- Keep `sales` as the v1 internal enum and display it as `前台`; any `frontdesk` enum migration is a later data/API migration.
- Phase B1 must prove default-deny behavior for unknown/null/stale roles and explicit handling for `systemActor`, platform admin without store permission, `storeRole` precedence, `sales` alias, payment authority, export/support denial, unlock/attachment defaults, manager role-grant limits, and last-owner safety contract.
- Major risks deferred to later phases: route gates for high-risk writes, payment correction/refund/override enforcement, unlock credential projection/audit, signed attachment URL authorization, server-side export endpoint, support-access schema, stable technician assignment model, and production Supabase/RLS/storage parity.
- Security blocker: runtime permission enforcement must not begin until Owner confirms the role-policy defaults or provides edits.

## Owner decision recorded

Owner selected all recommended A defaults:

1. First implementation slice: permission module and tests only; no runtime route gates.
2. Role naming: keep internal `sales` enum for v1 and display it as `前台`.
3. Frontdesk payment authority: normal collection allowed; correction/refund/override limited to manager/owner.
4. Technician unlock credentials: assigned/active repair task only, audited in later object-level phase.
5. Export/member/support authority: viewer export denied; manager manages ordinary members only; owner grants platform support and manager authority; last owner remains protected.

Implementation may proceed to a separate Phase B1 task limited to `src/server/permissions.ts` and `src/server/permissions.test.ts`.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
