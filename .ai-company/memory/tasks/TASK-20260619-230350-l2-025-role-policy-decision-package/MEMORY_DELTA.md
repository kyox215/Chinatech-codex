# Memory Delta — TASK-20260619-230350-l2-025-role-policy-decision-package

## Project memory candidates

- Add `ROLE_POLICY_DECISION_PACKAGE.md` as the current Owner-approval package for RepairDesk role policy.
- Record that Option A is recommended but not approved and not implemented.
- Record that no business/auth/database/secret/production code changed.

## Department memory candidates

- Product: Option A recommended role definitions for owner/manager/sales/technician/viewer/platform admin, pending Owner approval.
- Security: viewer read-only and platform/store separation recommended; role-gate implementation must be server-side and approval-gated.
- Backend: future role-gate implementation should be staged and covered by server/API tests.
- QA: role denial test plan remains a follow-up after Owner approval.
- Documentation: decision package is policy proposal, not active implemented behavior.

## Backlog candidates

- Mark `SEC-BACKLOG-20260620-001` as decision package prepared / approval pending.
- Add implementation follow-ups only as approval-gated proposals: viewer read-only hardening, order/customer role gates, inventory/buyback fine-grain gates, store/member hardening.

## Capability candidates

- Product/security planning capability improved for local authorization policy packages only; no permission to implement or approve live auth changes.

## Candidate project facts

- None yet.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- None yet.

## Candidate lessons and capability evidence

- None yet.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
