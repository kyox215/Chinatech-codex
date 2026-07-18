# Independent Review Synthesis — Phase 3A

## Real read-only agents used

| Agent | Department package | Independent output |
|---|---|---|
| `/root/phase3a_arch_api` | Architecture / API | request order, deterministic router boundary, model snapshots, deadline/Safety ID, budget gateway and test matrix |
| `/root/phase3a_data_security` | DATA / Security | atomic ledger/RPC, RLS/Grants, timezone, settlement threat model, migration and production gates |
| `/root/phase3a_product_qa_release` | Product / QA / Release | PRD/states, direct/local behavior, success thresholds, E2E/release/observation and Owner decisions |

All three were genuinely spawned read-only. They made no edits, handled no secrets, ran no live provider/production DB operation and did not push or deploy.

## Integrated findings

| Severity | Finding | Integration decision |
|---|---|---|
| P0 live blocker | process-local Map cannot enforce a multi-instance hard budget | added durable gateway and atomic migration draft; provider remains unimplemented and fails closed |
| P0 live blocker | unknown/timeout requests could bypass budget if released as zero | only provable pre-dispatch failure releases; stale/unknown settles reserved max |
| P0 live blocker | numeric budget/privacy/migration/provider approvals absent | no enabled policy, no apply, no key sync, no live variables/calls |
| P1 | deterministic bypass without general throttle can amplify DB reads | added actor/store short-window guard before deterministic planner |
| P1 | local and server vision ran in parallel, so local success saved no call | changed to local-first and skip data URL/server call only for complete conservative candidates |
| P1 | invalid images consumed provider quota before validation | moved server input validation before provider quota |
| P1 | UTC “today” resets at 01:00/02:00 Italy time | migration uses policy/store IANA timezone for day/month periods; timestamps remain UTC |
| P1 | current local OCR availability cannot support a universal 70% promise | treated 70% as calibrated supported-browser target, not dormant release gate |
| P1 | Safety ID/AbortSignal seams existed but were unused | added HMAC Safety ID, route cancellation propagation and fixed provider deadline |
| P2 | cost estimate can drift from invoice/tax/FX | label as versioned estimate in micro-USD; independent provider-side budget/reconciliation remains required |

## Deferred by design

- Client network-retry idempotency key and returned-result replay: Phase 3A server random request ID protects internal reservation retries only; public schema remains unchanged until live provider design is approved.
- Store Owner cost dashboard and visible “direct/local/provider” badges: needed before paid pilot, not required for dormant backend release.
- OpenAI SDK/provider, service-side image decoder and dependency lockfile changes: explicit D4/dependency gate.
- Phase 3B drafts, RAM, multi-identifiers and field-review persistence.

## Review outcome

- **Dormant/default-off implementation:** proceed to full quality gates.
- **Paid pilot / migration apply / real data:** BLOCKED pending Owner D4 decisions and production database gate.
