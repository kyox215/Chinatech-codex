# Phase Plan — AI Assistant Phase 3B Live Pilot

## Change contract

- **Baseline:** `main@92d7cdad581fd5d00fc85001a838df8739c353bf`
- **Isolated branch:** `codex/ai-live-pilot-20260718`
- **Single writer:** main Integration Lead only; department agents are read-only.
- **Allowed production effect before D4:** none.
- **Secret rule:** values may exist only in ignored local env or an approved platform secret store; never in Git, task memory, logs, screenshots, or test fixtures.
- **Rollback unit:** live flags first, deployment second, database policy disabled third; migrations are additive and need not be destructively reversed during an incident.

## Stage 0 — Evidence and design gate

**Deliverables**

- Restore Phase 3A context and inspect current provider, services, contracts, audit, quota, factory, routes, and migration.
- Verify current OpenAI Responses API and Supabase RPC/security guidance from primary sources.
- Collect independent architecture/API, security/data, and QA/release reviews.

**Exit criteria**

- Exact scope, data flow, trust boundaries, failure semantics, and D4 approval points are recorded.
- No production state or secret has been changed except the owner-approved ignored local OpenAI key.

## Stage 1 — Provider implementation

**Deliverables**

- Native server-side OpenAI Responses API adapter with injected fetch for tests.
- `store=false`, HMAC privacy-preserving `safety_identifier`, strict JSON Schema outputs, one attempt, hard deadline, and output-token ceiling.
- Strict base URL, exact-model, MIME/size, and response-shape validation; sanitized error mapping with no raw provider payload logging.
- Order and vision response parsing through the existing Zod contracts.

**Exit criteria**

- Provider factory fails closed for every missing/mismatched setting and constructs OpenAI only for a complete approved configuration.
- Unit tests prove request privacy controls, structured output, signal propagation, usage extraction, and safe failures.

## Stage 2 — Durable cost governance

**Deliverables**

- Server-only Supabase RPC adapter for atomic reserve, finalize, provable pre-dispatch release, and conservative hold.
- Stable request UUID and HMAC request fingerprint; no prompt, image, customer text, or provider response stored in governance tables/audit.
- Service orchestration: deterministic/local paths use zero provider calls; fake uses local test quota; OpenAI uses durable reserve before dispatch and finalize after validated usage.

**Exit criteria**

- Tests cover idempotency, store/actor rejection, missing policy, all budget limits, provider timeout/429/protocol error, finalize failure, and safe audit outcomes.
- Unknown-dispatch failures never release a reservation optimistically.

## Stage 3 — Local quality and live smoke

**Deliverables**

- Targeted provider/RPC/service/route tests and migration contract tests.
- `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- One zero-cost provider key/auth connectivity check with sanitized evidence. The first billable synthetic text smoke moves behind the durable production policy D4 gate and must use the normal service path.

**Exit criteria**

- All required gates pass or the task is marked conditional with exact blockers.
- Secret scanning confirms no API key or provider body entered tracked/untracked task artifacts.

## Stage 4 — Production D4 gate

**Approval packet**

- Exact store UUID/name for the canary.
- Monthly/store/global caps and timezone.
- Pricing/model policy version and deprecation follow-up owner/date.
- Data-processing/privacy acknowledgement for order snippets and device-label images.
- Migration dry-run and post-apply metadata/RLS/grant checks.
- Vercel secret names/scopes, live flags, deployment target, observation window, rollback commands, and stop thresholds.

**Execution order after approval**

1. Refresh remote baseline and resolve scoped drift.
2. Run linked migration dry-run; preserve the already-applied `20260718174042` baseline and apply only the new `20260718223739_ai_assistant_live_provider_v1.sql` upgrade.
3. Verify migration history, functions, tables, RLS, and service-role-only grants.
4. Seed one disabled policy, verify, then enable the approved budget policy.
5. Upload platform secrets and deploy with live flags still disabled.
6. Run zero-cost provider auth and authenticated production boundary smoke; execute one billable no-PII service-path smoke only after the durable policy is enabled, then enable one-store canary.
7. Observe budget, error rate, latency, and false-positive indicators for the approved window.
8. Retain, disable, or roll back using the written thresholds.

## Stage 5 — Closeout

- Sync operational/privacy/deployment documentation and task memory.
- Capture the relevant UI flow if a canary page is reachable; otherwise record why no relevant task page can be shown and use test/deployment evidence.
- Produce a scoped commit/push/deployment report with residual risks and the model-upgrade deadline.
