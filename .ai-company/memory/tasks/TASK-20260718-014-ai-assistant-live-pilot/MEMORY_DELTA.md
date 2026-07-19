# Memory Delta — TASK-20260718-014-ai-assistant-live-pilot

## Candidate project facts

- **Fact:** GPT-5 nano order planning must use a versioned explicit reasoning policy; omitting effort allowed default medium reasoning to exhaust the 256-token output ceiling before a required tool call.
  - Source: E-026/E-028 and `ai-runtime-v2` candidate.
  - Status: verified live failure plus official-doc diagnosis; remediation not live-verified.
  - Owner/scope: RepairDesk AI order-text provider.
  - Review trigger: any model, reasoning, Token ceiling or provider-contract change.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- **Decision:** never mutate the meaning of `ai-runtime-v1`; keep it disabled and version the minimal-reasoning remediation as `ai-runtime-v2`.
  - Source: D4 stop checkpoint and release runbook.
  - Status: local candidate; new D4 required for production.
  - Owner/scope: Owner + Integration Lead; production AI policy.
  - Review trigger: revised D4 or model-policy migration.

## Candidate lessons and capability evidence

- Durable reservation/finalization and privacy-safe audit preserved accurate cost evidence during a provider protocol failure and allowed fail-closed rollback before canary exposure.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
