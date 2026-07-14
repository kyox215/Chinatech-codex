---
schema_version: 1
task_id: "TASK-20260714-001-buyback-sensitive-evidence-feature-off"
title: "回收身份证与签名采集生产关闭补丁"
status: "closed"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2_execution_with_D4_owner_approval"
owner: "鹤祥"
decision_owner: "RepairDesk Integration Lead"
departments: ["INT", "FLOW", "UX", "FE", "API", "SEC", "QA", "DOC"]
created_at: "2026-07-14T07:29:38Z"
updated_at: "2026-07-14T13:40:23Z"
closed_at: "2026-07-14T13:40:23Z"
---
# Task — 回收身份证与签名采集生产关闭补丁

## Owner authorization

- Owner replied `是 开始下一步` to the explicit request to implement a server-side restricted-evidence feature-off patch, verify it, push `main`, and verify production.
- This approval covers the scoped code/UI/tests/docs commit, `main` push, resulting Vercel deployment, smoke checks, logs, and screenshots.
- It does not authorize Supabase migration apply/repair, destructive SQL, production customer-data writes, deletion of existing evidence, or activation of identity/signature capture.

## Goal and business value

Restore a safe default-deny production boundary while the guided-buyback database migration and privacy lifecycle remain blocked. Staff may continue non-sensitive quote/evaluation work, but the application must not accept or guide identity-document/signature collection or finalize a sensitive buyback transaction.

## Verified starting state

- Clean worktree `/private/tmp/repairdesk-buyback-feature-off-20260714` is based on `origin/main@54c29e2993ec5e0273e24ab4ef6ec302affc4a0f`.
- Shared Settings workspace remains dirty and untouched.
- Production drifted back to READY deployment `dpl_9EaspReoYUU4AMQh3R6gKbP4Kv86`, SHA `54c29e29`, through normal Vercel main auto-assignment.
- Linked Supabase still lacks the new buyback finalize migration/RPC; no database write is permitted in this task.

## In scope

- Server-side default-deny enforcement for buyback identity-document and signature evidence uploads.
- Server-side default-deny enforcement for guided buyback finalize/legacy import paths that would persist or complete restricted evidence.
- A clear mobile/desktop UI closed state that removes sensitive inputs/uploads and tells staff what remains available.
- Focused security/API/UI tests, full project gates, sanitized screenshots, commit, push to `main`, Vercel readiness/HTTP/log verification.
- Task/release documentation and checkpoint updates.

## Out of scope

- Applying any Supabase migration or altering migration history.
- Deleting or exporting existing customer evidence.
- Choosing legal basis, retention duration, purge/legal-hold policy, or re-enabling evidence capture.
- Rolling back 147 unrelated commits to the historical pre-evidence deployment.
- Unrelated Settings, Orders, permissions, dependency, architecture, or formatting work.

## Acceptance criteria

- [x] Server rejects buyback `id_front`, `id_back`, and `signature` upload attempts even if a client bypasses the UI.
- [x] Server rejects buyback finalize and legacy evidence-import attempts while the feature is off.
- [x] Non-buyback inventory attachments remain compatible and unaffected.
- [x] Buyback quote/evaluation remains usable as four steps `设备 -> 报价 -> 检测 -> 保存`, with no seller, evidence, payment, signature or finalize controls in the DOM.
- [x] Closed state works at mobile and desktop widths without page overflow and uses existing RepairOS tokens/patterns.
- [x] Focused tests cover allowed/denied, permission/tenant and error-message boundaries.
- [x] Stored allowlisted evidence metadata is preserved during quote updates while new client-supplied evidence markers are stripped.
- [x] Partial save retries reuse and refresh the same quote record instead of creating a duplicate.
- [x] `npm run agents:check`, `npm run lint`, `npm run typecheck`, the full 909-test suite, and `npm run build` pass. The full suite used `--maxWorkers=2` because the host's default concurrency repeatedly pushed unrelated legacy UI tests past their fixed 5-second timeout; the timed-out files also passed in isolated reruns.
- [x] Sanitized mobile and desktop screenshots captured.
- [x] Scoped commit `70d211b2` pushed to `main`; Vercel production deployment `dpl_G9bU7J4c9baihhhRxMWAYUGsntuz` is READY at the exact code SHA; HTTP smoke and short error/5xx observation pass.
- [x] Supabase migration history/data remain unchanged; the guided-evidence migration is still local-only and the production agreement table/RPC/evidence columns/bucket remain absent.

## Execution plan

1. Rehydrate prior containment evidence and inspect current API/UI call paths.
2. Integrate independent SEC, UX and QA read-only recommendations.
3. Implement a single source of truth for the feature-off state, with server enforcement first and UI projection second.
4. Run focused tests, then full project gates and browser verification.
5. Review the exact diff, commit and push the scoped branch to `main` only if all hard gates pass.
6. Verify Vercel SHA/alias/HTTP/logs, observe, checkpoint and close.

## Change contract

- One writer: main thread / Integration Lead.
- Allowed: buyback UI/model, inventory/buyback server/router/schema tests, minimal operator/release docs, this task memory.
- Forbidden: migrations, package/dependency changes, unrelated Orders/Settings code, shared dirty worktree, destructive commands.
- No client-only enforcement; server rejection is authoritative.
- No feature-on environment fallback in this patch. Re-enablement requires a separately reviewed task and explicit Owner decision.

## Verification and evidence matrix

| Acceptance | Evidence |
|---|---|
| Server default deny | focused router/repository tests and independent SEC review |
| Non-buyback compatibility | focused API/repository regression tests |
| Clear closed UI | component/model test plus mobile/desktop browser screenshots |
| No DB mutation | command audit and linked migration-history postcheck |
| Release | commit/SHA, Vercel inspect/list/logs and HTTP smoke |

## Rollback

- Before push: discard only this isolated task branch; never touch shared dirty files.
- The prior READY deployment `dpl_BcH547bnCUBohDSxneWT7J16Vds4` is not security-equivalent because it exposes the sensitive flow. Do not describe it as a safe rollback.
- For a buyback-only UI regression with server deny intact, prefer a forward fix or temporarily stop using `/buyback`. If server deny regresses, stop the buyback flow and incident-forward-fix; use the prior deployment only for a severe whole-system outage with explicit acknowledgement that it reopens the evidence risk.
- If server default-deny tests fail, stop before commit/push.

## Agent plan

- Main thread / INT: sole code writer, integrator, commit/push/deploy verifier.
- SEC reviewer: read-only trust-boundary and bypass review.
- UX reviewer: read-only closed-state mobile/desktop specification.
- QA reviewer: read-only regression and release-gate matrix.

## Visual evidence

UI is affected. Sanitized `/buyback?new=1` closed-state screenshots were captured at 390x844 and 1440x900 under ignored `test-results/`, with no real customer PII or evidence content. Production authenticated-page capture was not possible because the ChatGPT Chrome Extension session was unavailable; HTTP, exact-deployment, log and local browser evidence are recorded instead, and no production form was submitted.
