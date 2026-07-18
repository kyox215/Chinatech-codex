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
| P1 integration | Inventory V2 authority hydration could choose legacy before refreshed flags arrived | added a pure `wait / v2 / legacy` route decision and guarded both list and deep-link paths until store authority is stable |
| P1 integration | Inventory V2 encoded and uploaded every photo even when local recognition was sufficient | changed V2 to sequential local-first orchestration; tests prove complete local candidates perform zero encoding/server calls and incomplete candidates perform one fallback |
| P2 | cost estimate can drift from invoice/tax/FX | label as versioned estimate in micro-USD; independent provider-side budget/reconciliation remains required |

## Deferred by design

- Client network-retry idempotency key and returned-result replay: Phase 3A server random request ID protects internal reservation retries only; public schema remains unchanged until live provider design is approved.
- Store Owner cost dashboard and visible “direct/local/provider” badges: needed before paid pilot, not required for dormant backend release.
- OpenAI SDK/provider, service-side image decoder and dependency lockfile changes: explicit D4/dependency gate.
- Phase 3B drafts, RAM, multi-identifiers and field-review persistence.

## Review outcome

- **Dormant/default-off implementation on `origin/main@de5f8b49`:** Architecture/API final review reports P0=0/P1=0; full quality and focused regression gates pass. Proceed only through the dormant release path.
- **Paid pilot / migration apply / real data:** BLOCKED pending Owner D4 decisions and production database gate.
- **Residual P2:** caller cancellation is still observed as provider timeout, the short-window guard is process-local, retention cleanup is not implemented, and the repository-wide historical migration replay remains blocked by pre-existing `product_channel` drift. These do not open a path to live provider use because the provider remains fail-closed.
