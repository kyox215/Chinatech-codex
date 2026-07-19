# Checkpoints — TASK-20260718-014-ai-assistant-live-pilot

## 2026-07-18T21:11:07Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.

## 2026-07-18 — Intake, isolation, and planning complete

- **Phase:** design gate.
- **Completed:** isolated branch/worktree, T3/R4/L1 classification, scoped PRD, staged execution plan, approval ledger, context packet, and three real read-only department reviews launched.
- **Evidence:** `TASK.md`, `PHASE_PLAN.md`, `PRD.md`, `APPROVALS.md`, `CONTEXT_PACKET.md`, `AGENT_PACKAGES.md`.
- **Decisions:** retain exact versioned low-cost model/pricing policy for the first canary; use native server-side fetch; production migration/policy/secrets/flags/deploy remain D4 gates.
- **Risks/blockers:** production budget values, store UUID, privacy acknowledgement, migration, secret upload, and activation are not yet approved.
- **Next:** integrate department findings, implement the provider and durable budget adapter, then run mocked quality gates and one synthetic live smoke.

## 2026-07-18 — Provider, governance and PG17 integration complete

- **Phase:** local implementation and verification.
- **Completed:** real Responses API adapter, strict schemas, safe dispatch errors, separate order/vision egress approvals, HMAC request/actor fingerprints, Supabase reserve/finalize/release/hold adapter, distributed actor rate limit, policy attestation, maintenance RPC/cron and service orchestration.
- **Evidence:** targeted Vitest suites; disposable PostgreSQL 17 migration/assertion run; `EVIDENCE.md` E-006/E-007.
- **Decisions:** first canary should be order text only; billable smoke must use the durable service path after D4; maintenance cron is daily because every new reserve already performs a stale sweep.
- **Risks/blockers:** exact canary store, privacy/DPA/ZDR posture, budget, isolated linked migration, Vercel secrets/flags, billable smoke, push and deploy remain D4.
- **Next:** sync docs, run full repository gates and zero-cost key/auth check, then present the exact D4 packet.

## 2026-07-18T22:23:02Z — Phase 3B local release candidate complete: native Responses API adapter, durable Supabase cost lifecycle, privacy egress gates, distributed actor rate limit, policy attestation, maintenance and D4 runbook implemented. Agents check, lint, typecheck, 303 test files/1893 tests, Webpack production build, disposable PostgreSQL 17 integration assertions, exact-key secret scan and zero-cost OpenAI model authentication passed. npm run build Turbopack remains environment-blocked only by the isolated worktree node_modules symlink. No production migration, policy, Vercel secret, flag, push, deploy or billable generation occurred.

- **Phase:** implementation
- **Completed/current state:** Phase 3B local release candidate complete: native Responses API adapter, durable Supabase cost lifecycle, privacy egress gates, distributed actor rate limit, policy attestation, maintenance and D4 runbook implemented. Agents check, lint, typecheck, 303 test files/1893 tests, Webpack production build, disposable PostgreSQL 17 integration assertions, exact-key secret scan and zero-cost OpenAI model authentication passed. npm run build Turbopack remains environment-blocked only by the isolated worktree node_modules symlink. No production migration, policy, Vercel secret, flag, push, deploy or billable generation occurred.
- **Next:** Read APPROVALS.md and docs/AI_ASSISTANT_LIVE_PILOT_RUNBOOK.md; validate final diff and task evidence; present Owner D4 packet for exact canary store, USD 50 budget, text-only data/privacy scope, isolated AI-only migration, production secrets/flags, push/deploy and observation. Stop before any production or billable action unless D4 is explicit.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator

## 2026-07-18T23:05:01Z — Owner D4 approved; release baseline rebased

- **Phase:** production release.
- **Completed/current state:** Owner explicitly approved the exact D4 packet. The isolated branch was fetched and rebased onto `origin/main@9c52a4a7`; the only conflicts were the single active-task pointer and were resolved in favor of the current AI release while preserving the completed Inventory V2 baseline. Root checkout changes remain untouched.
- **Decision:** release is R4/L1 with exact D4 authority for ChinaTech-only, non-PII staff order text, USD 50/month policy, migration `20260718223739`, Production secrets/flags, push/deploy, one durable service-path billable smoke, and 30-minute observation.
- **Boundary:** vision, draft apply, public assistant, PII egress, automatic writes, additional stores, changed budget/model, and destructive rollback remain prohibited.
- **Next:** rerun post-rebase quality/secret gates, refresh linked Supabase/Vercel preflight, then execute the serialized production runbook.

## 2026-07-18T22:53:47Z — Phase 3B local candidate reconciled against live read-only state: 7 active stores; proposed ChinaTech canary 5248dda1-2b32-46cd-8ed0-d15386a9e8ed; dormant 20260718174042 already applied with AI policy/bucket/request rows all zero. Applied migration restored unchanged; new additive 20260718223739 passes PostgreSQL 17 chain assertions and linked dry-run would push only it. Agents, lint, typecheck, focused 159 tests, full 1893 tests, exact-key scan and zero-cost OpenAI auth passed. No new production mutation, policy, Vercel secret, flag, push, deploy or billable call.

- **Phase:** implementation
- **Completed/current state:** Phase 3B local candidate reconciled against live read-only state: 7 active stores; proposed ChinaTech canary 5248dda1-2b32-46cd-8ed0-d15386a9e8ed; dormant 20260718174042 already applied with AI policy/bucket/request rows all zero. Applied migration restored unchanged; new additive 20260718223739 passes PostgreSQL 17 chain assertions and linked dry-run would push only it. Agents, lint, typecheck, focused 159 tests, full 1893 tests, exact-key scan and zero-cost OpenAI auth passed. No new production mutation, policy, Vercel secret, flag, push, deploy or billable call.
- **Next:** Present the Owner D4 packet. Proceed only after explicit approval of ChinaTech-only canary, USD 50 monthly cap, non-PII order-text external processing with vision off, new migration 20260718223739, Production secrets and flags, push/deploy, one service-path billable smoke, 30-minute observation and rollback thresholds.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator

## 2026-07-18T22:56:59Z — Verified Phase 3B candidate preserved in local commit 2619e561 on codex/ai-live-pilot-20260718. Live read-only facts remain: 7 active stores; proposed ChinaTech canary; dormant AI tables empty; linked dry-run would push only 20260718223739. No push, deployment, production mutation, secret upload, policy enablement or billable call occurred.

- **Phase:** implementation
- **Completed/current state:** Verified Phase 3B candidate preserved in local commit 2619e561 on codex/ai-live-pilot-20260718. Live read-only facts remain: 7 active stores; proposed ChinaTech canary; dormant AI tables empty; linked dry-run would push only 20260718223739. No push, deployment, production mutation, secret upload, policy enablement or billable call occurred.
- **Next:** Await explicit Owner D4 approval for ChinaTech-only canary, USD 50 monthly cap, non-PII order text with vision off, migration 20260718223739, Production secrets/flags, push/deploy, one service-path billable smoke, 30-minute observation and rollback thresholds.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator

## 2026-07-18T23:54:27Z — D4 smoke stopped; safe rollback complete; v2 remediation in progress

- **Phase:** production release stop / remediation gate.
- **Completed/current state:** rebased onto `origin/main@9c52a4a7`, reran gates, applied only `20260718223739`, verified 4 private tables/6 RPCs/RLS/grants/advisors, seeded and attested `ai-runtime-v1`, uploaded encrypted Production secrets and dormant values, pushed `main`, and deployed exact `bc5dfae3` after fixing the cron middleware path. Deployment `dpl_6DLuoHkZ6io6jjqARNPrXVDzzQSV` is READY and owns the production aliases. All AI live flags stayed off.
- **Smoke result:** the one D4-authorized non-PII service-path request reserved 308 micro-USD and settled 123 micro-USD from 399 input / 256 output Token with exactly one provider attempt. Ledger state is `succeeded`, settlement basis is `usage_reported`, Safety ID and audit are present, but the service returned `502 AI_PROVIDER_PROTOCOL_ERROR`; the audit status is `failed`.
- **Stop/rollback:** ChinaTech allowlist and live flags were never activated. `ai-runtime-v1` was changed from enabled to disabled after the stop threshold fired. No reservation remains open and no second OpenAI call occurred.
- **Root cause:** official OpenAI guidance plus the exact 256-token ceiling support that GPT-5 nano default medium reasoning exhausted `max_output_tokens=256` before producing the required function call. Browser-authenticated production UI verification is independently blocked by an explicit user site-use restriction for `www.chinatech.in`; it was not bypassed.
- **Remediation:** local `ai-runtime-v2` candidate adds only `reasoning.effort=minimal`; model, pricing, max tokens and budget remain unchanged. Agents check, lint, typecheck, focused 7 files / 47 tests, full 304 files / 1,894 tests, Webpack production build, Prettier, diff check and exact-key scan across 3,770 files all pass.
- **Decision:** the original D4 is exhausted because its one billable smoke was consumed. A new D4 is required before v2 policy insertion/enablement, Vercel policy-version mutation, a second billable smoke, ChinaTech activation or observation.
- **Next:** validate the final diff, checkpoint, commit and push only the isolated remediation branch, then present the revised D4 packet. Keep production dormant and v1 disabled.

## 2026-07-19T00:01:06Z — Original D4 executed through one non-PII billable smoke: ledger settled 123 micro-USD with one attempt, but service returned AI_PROVIDER_PROTOCOL_ERROR. ChinaTech was never activated; all Production AI flags remain off; ai-runtime-v1 is disabled; no open reservation. Local ai-runtime-v2 adds explicit GPT-5 nano minimal reasoning and passes agents/lint/typecheck, focused 47 tests, full 1894 tests, Webpack build, formatting/diff and exact-key scan.

- **Phase:** implementation
- **Completed/current state:** Original D4 executed through one non-PII billable smoke: ledger settled 123 micro-USD with one attempt, but service returned AI_PROVIDER_PROTOCOL_ERROR. ChinaTech was never activated; all Production AI flags remain off; ai-runtime-v1 is disabled; no open reservation. Local ai-runtime-v2 adds explicit GPT-5 nano minimal reasoning and passes agents/lint/typecheck, focused 47 tests, full 1894 tests, Webpack build, formatting/diff and exact-key scan.
- **Next:** Validate checkpoint diff, commit and push only the isolated remediation branch. Do not deploy v2, seed/enable v2 policy, run another OpenAI generation, activate ChinaTech or begin observation until a new Owner D4 is explicit.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator

## 2026-07-19T00:04:49Z — v2 remediation pushed; revised D4 gate ready

- **Phase:** remediation approval gate.
- **Completed/current state:** final diff and memory checkpoint were validated. The versioned minimal-reasoning remediation is committed as `94133d0b` and pushed only to `origin/codex/ai-live-pilot-20260718`.
- **Production verification:** `www.chinatech.in` remains READY on `main@bc5dfae3` / deployment `dpl_6DLuoHkZ6io6jjqARNPrXVDzzQSV`. Vercel live flags are all `0`, store allowlist is absent, Production policy version remains v1, and the database v1 policy is disabled with zero open reservations.
- **Boundary:** no v2 Production env/policy mutation, second OpenAI call, canary activation or observation occurred. The owner's dirty root checkout was not edited or cleaned.
- **Next:** present and await explicit revised D4 approval.

## 2026-07-19T00:25:55Z — D4-v2 approved; serialized release resumed

- **Phase:** approved / production preflight.
- **Owner authority:** reuse the existing encrypted Production key; deploy `ai-runtime-v2`; create and verify the v2 policy; execute exactly one additional synthetic no-PII billable service-path smoke; activate ChinaTech-only staff order text only if HTTP, durable ledger, and privacy-safe audit all succeed; then observe for 30 minutes.
- **Frozen exclusions:** vision, automatic writes, public/customer assistant, PII egress, and all other stores remain disabled.
- **Risk/autonomy:** R4 / L1, serialized writes under one release lock. Any gate failure stops the release and leaves live flags off; the v2 policy is disabled if it had been enabled.
- **Isolation:** new worktree/branch `codex/ai-v2-d4-release-20260719` from remote safe candidate `3cae265e`; the dirty root checkout and older contaminated AI worktrees are read-only/out of scope.
- **Agent decision:** no new sub-agents are spawned because production secrets, database policy mutation, billable dispatch, Git push, deploy, and observation must be handled serially by the Integration Lead; prior independent reviews remain evidence only.
- **Next:** refresh Git/Supabase/Vercel baselines, create a disabled exact-copy v2 policy, deploy dormant v2, enable/attest, and run the one authorized smoke.

## 2026-07-19T00:52:23Z — v2 one-shot smoke passed; activation gate open

- **Production version:** `main@ec134a42`; Vercel deployment `dpl_2BzBqbpx9bWJwBYQhYEKMVmdW4hA` is READY on both production aliases with all live flags still off during smoke.
- **Policy:** `ai-runtime-v2` was copied exactly from disabled v1 except version/timestamps, then enabled atomically only after `policy_ready` attestation; open reservations were zero.
- **Billable authority consumed:** exactly one new provider dispatch occurred through `handleRepairDeskPost("ai/order/turn")` with synthetic no-PII text and no retry. Earlier local Node 20/runner failures occurred before service dispatch and were proven by unchanged ledger/audit counts.
- **Triple gate:** HTTP 200; ledger `succeeded`, `usage_reported`, one provider attempt, 399 input / 60 output Token, 44 micro-USD, no open reservation; audit `succeeded`, provider `openai`, v2 policy, `settled`, Safety ID present and no error code.
- **Isolation check:** total durable requests 2, vision requests 0, other-store requests 0. The response body was reduced to kind/counts; no order cards or customer data were printed or persisted in task evidence.
- **Decision:** D4-v2 activation condition is satisfied. Configure only the ChinaTech allowlist plus master/order-text flags; keep vision, draft apply, public/customer assistant and all other stores off, then start the 30-minute observation after the activation deployment is READY.

## 2026-07-19T01:36:00Z — D4-v2 ChinaTech text-only release passed 30-minute observation; conditional closeout

- **Release identity:** `origin/main@152caa1ce5e415d464e0cfc73674ae4cda3cfa6a`; Vercel production deployment `dpl_946N6xMftqrRpKTzGmnDBmbjrR2y` is READY on `www.chinatech.in` and `chinatech.in`; errors-only build and scoped AI runtime error checks are clean.
- **Activation boundary:** only ChinaTech `5248dda1-2b32-46cd-8ed0-d15386a9e8ed`, master flag and employee order-read flag are active. Vision, draft apply, public/customer assistant, PII egress and all other stores remain disabled. Maintenance is active as a safety control.
- **Observation:** READY at `2026-07-19T00:58:50.334Z`; continuous read-only polling ended at `2026-07-19T01:28:56.132Z`. No stop threshold fired. Final aggregate at `01:30:41Z`: v2 enabled, v1 disabled, one enabled policy, 2 requests/2 attempts/167 microUSD, open=0, bad=0, overrun=0, vision=0, other-store=0, scoped runtime errors=0.
- **Triple-gate preservation:** v2 smoke remains HTTP 200; ledger match=1 and audit match=1 for request `735769a5-8b17-47cc-9828-036368392539`; exactly one v2 provider attempt and 44 microUSD.
- **Security:** all four AI tables have RLS; client-role table grants=0 and service-role grants=12. Advisor INFO for no RLS policy is intentional for service-only tables. Existing unrelated project WARN findings remain out of scope and are not presented as fixed.
- **Traffic limitation:** no employee request arrived during the 30-minute activation window. Idle production stability and boundary integrity passed; the actual service path is proven by the pre-activation v2 one-shot.
- **Visual limitation:** authenticated production browser evidence remains blocked by the explicit `www.chinatech.in` restriction. It was not bypassed; synthetic task screenshots plus deploy/HTTP/ledger/audit evidence are retained.
- **Agent decision:** no new sub-agents were spawned because the R4 production sequence required one serialized Integration Lead; prior independent reviews remain evidence.
- **Closeout:** approved D4-v2 slice is conditionally closed. Integration Lead owns a read-only 24-hour follow-up. Vision, PII, automatic writes, public assistant, another store or model/budget changes require a new R4/D4 task.

## 2026-07-19T01:46:28Z — D4-v2 ChinaTech employee order-text is live on main@152caa1c. The no-PII v2 one-shot passed HTTP, ledger and audit with one 44-microUSD attempt; the full 30-minute observation ended with zero open, bad, overrun, Vision, cross-store or scoped runtime-error counts. Vision, PII, writes, public AI and other stores remain off.

- **Phase:** implementation
- **Completed/current state:** D4-v2 ChinaTech employee order-text is live on main@152caa1c. The no-PII v2 one-shot passed HTTP, ledger and audit with one 44-microUSD attempt; the full 30-minute observation ended with zero open, bad, overrun, Vision, cross-store or scoped runtime-error counts. Vision, PII, writes, public AI and other stores remain off.
- **Next:** At or after 2026-07-20T00:58:50Z, perform one read-only 24-hour policy, ledger, audit and Vercel runtime review without another provider smoke. Any expansion requires a new R4/D4 task.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
