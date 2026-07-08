# Memory Delta — TASK-20260620-004

## Project memory candidates

- Add permission matrix baseline as a current authoritative evidence artifact for local role/tenant facts.
- Record that no business/auth/database/secret/production changes were made.
- Record P1 role-policy risk: many order/customer write APIs have active-store context but no explicit role gate found in this scan.
- Record P1 production-readiness risk: live Supabase grants/RLS/storage/platform-admin parity remains unknown until Owner-approved remote audit.
- Record P1 audit-log minimization risk.

## Department memory candidates

- Security: add current permission matrix facts, role-policy risks, audit minimization risk, and D3/D4 approval boundaries.
- Backend: add router/repository control map and note server-side role gates must be the authority over UI-only restrictions.
- Data: add local tenant/RLS migration facts and remote parity unknown.
- QA: add need for role denial tests after Owner policy decision.
- Documentation: add this report as current permission baseline for future agents.

## Backlog candidates

- `SEC-BACKLOG-20260620-001`: Owner role-policy decision package for viewer/sales/technician/manager/owner.
- `QA-BACKLOG-20260620-001`: permission denial test plan for role-specific forbidden paths.
- `SEC-BACKLOG-20260620-002`: audit-log redaction/minimization policy.
- `DATA-BACKLOG-20260620-001`: production Supabase permission parity audit plan.

## Capability candidates

- Security review evidence improved from local code inspection and risk classification only; do not increase autonomous permission for live security or production actions.
