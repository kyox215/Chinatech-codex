# Memory Delta — TASK-20260718-014-ai-assistant-live-pilot

## Candidate project facts

- **Fact:** GPT-5 nano order planning must use a versioned explicit reasoning policy; omitting effort allowed default medium reasoning to exhaust the 256-token output ceiling before a required tool call.
  - Source: E-026/E-028/E-033 and production `ai-runtime-v2`.
  - Status: verified live failure, official-doc diagnosis and live v2 remediation.
  - Owner/scope: RepairDesk AI order-text provider.
  - Review trigger: any model, reasoning, Token ceiling or provider-contract change.

- **Fact:** ChinaTech-only employee order text is live under v2 with durable reserve/finalize, service-role-only governance tables, one provider attempt and a USD 50 monthly cap; Vision, PII, writes, public AI and every other store remain disabled.
  - Source: E-031–E-036 and `CEO_REPORT.md`.
  - Status: production verified for the approved single-store text slice; 24-hour follow-up pending.
  - Owner/scope: Owner + Integration Lead; ChinaTech employee order-text canary.
  - Review trigger: 24-hour review, any stop threshold, another store, Vision/PII/write/public enablement, or model/budget change.

## Candidate department updates

- Backend/Architecture: explicit reasoning is part of the versioned provider contract; deterministic/local paths remain zero-provider and paid fallback remains read-only.
- Data/Security: policy, buckets, requests and actor-rate tables remain RLS plus service-role-only; ledger/audit store aggregate metadata, not prompts/PII.
- Operations/QA: production enablement requires disabled-policy creation, attestation, one-shot HTTP/ledger/audit triple gate, exact-SHA activation and a timed observation with flags-first rollback.
- Documentation: `docs/AI_ASSISTANT_LIVE_PILOT_RUNBOOK.md` is the current runtime authority; earlier dormant statements are historical.

## Candidate decisions / ADRs

- **Decision:** never mutate the meaning of `ai-runtime-v1`; keep it disabled and version the minimal-reasoning remediation as `ai-runtime-v2`.
  - Source: D4 stop checkpoint, D4-v2 approval, E-031–E-035 and release runbook.
  - Status: approved and production verified; v2 is the only enabled policy.
  - Owner/scope: Owner + Integration Lead; production AI policy.
  - Review trigger: model-policy migration or rollback.

## Candidate lessons and capability evidence

- Durable reservation/finalization and privacy-safe audit preserved accurate cost evidence during a provider protocol failure and allowed fail-closed rollback before canary exposure.
- Candidate capability `CAP-AI-LIVE-PILOT-20260719`: C1 only. The Integration Lead executed one approved serialized R4 single-store text canary with exact gates and rollback discipline; this does not increase permission or autonomy.
- Not promoted to `LESSONS_LEARNED.md`: evidence comes from one task/release chain and should be reviewed after the 24-hour checkpoint or a second independent live-provider release.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
