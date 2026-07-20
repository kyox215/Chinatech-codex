---
schema_version: 1
task_id: "TASK-20260720-003-store-self-service-purge"
title: "空测试店铺永久删除与用户自助删除流程"
status: "active"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
departments: ["API", "DATA", "DOC", "FE", "FLOW", "QA", "SEC", "UX"]
created_at: "2026-07-20T21:04:03Z"
updated_at: "2026-07-20T23:16:39Z"
---
# Task — 空测试店铺永久删除与用户自助删除流程

## Owner request

Owner explicitly approved permanent deletion of `Chinatech siracusa` with immutable UUID
`8b0b8834-98db-47cb-9d6d-c9b9410afd9b`, and also requires a clear user-facing
store deletion workflow.

## Business value

安全移除误创建的空测试店铺，减少店铺列表干扰，并为主店主提供明确、受控、可审计的关闭与永久删除流程。

## Scope in

- Preserve the existing reversible close and restore path.
- Add a primary-owner self-service request, cancellation, cooling-off and final-confirmation flow.
- Keep destructive database and Storage deletion in the leased service worker, never in the browser.
- Add a forward-only lease-bound writer-fence path for the existing purge worker.
- Repair archived-store authorization for exact recovery-store UUID targets.
- Add internal lifecycle maintenance/worker execution with bounded, authenticated scheduling.
- Update Settings closed-store UI, API/types, tests, runbook and task evidence.
- Stage production release gates and execute only the exact approved target after all gates pass.

## Scope out

- Deleting or changing the formal `ChinaTech` store (`5248dda1-2b32-46cd-8ed0-d15386a9e8ed`).
- Name-based deletion, generic SQL cleanup, disabling writer fences, uncontrolled CASCADE, or browser-side purge.
- Weakening retention/legal holds, primary-owner checks, tenant isolation, MFA or audit controls.
- Treating a stored backup as recovery proof without an isolated restore verification.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Target all production actions by exact UUID, lifecycle revision and operation id.
- Current Owner message is the deletion-intent approval. A fresh post-proof AAL2 final confirmation remains mandatory before the irreversible boundary.
- All lifecycle flags stay off until migration, code, security, QA and disposable-store release gates pass.
- Production purge must stop on any target mismatch, residual row/object, lost lease, hold, restore-proof mismatch or other-tenant integrity change.

## Acceptance criteria

- [ ] 精确 UUID 目标店铺完成生产删除且正式 ChinaTech 店铺与其数据零影响。
- [ ] 主店主可在设置中通过明确流程关闭并在满足安全门禁后申请永久删除。
- [ ] 服务端执行店铺级授权、二次验证、幂等、导出恢复证明、审计与零残留验证。
- [ ] 移动端和桌面端流程、失败状态、重复提交与恢复路径通过测试并提供截图。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Exact deletion target | approved fact | Owner message; production UUID lookup | `8b0b8834-98db-47cb-9d6d-c9b9410afd9b` only |
| Target lifecycle | verified production fact | linked Supabase read-only query, 2026-07-20 | active, revision 1, no retention/legal hold |
| Target business data | verified production fact | full public `store_id` catalog and Storage read-only counts | zero business rows and zero Storage objects; 91 default/control rows |
| Formal store isolation target | verified production fact | linked Supabase read-only query | `ChinaTech` UUID `5248dda1-2b32-46cd-8ed0-d15386a9e8ed`; must remain unchanged |
| Lifecycle migrations | verified production fact | linked migration list | base P0-P5, contract v2 fence and AI hotfix are applied |
| Current purge executability | verified blocker | runbook, trigger and worker code | generic writer fence blocks purge worker; no runner/sink/browser flow |
| Encrypted sink and isolated restore environment | unknown/blocker | repository and environment inspection | select and approve before production purge |

## Decision and approval points

- R4 / L1 / D4: Owner approved deletion intent for the exact UUID and approved building the self-service workflow.
- Separate D4 gate remains for production migration apply, deployment/flag rollout and the post-proof irreversible final confirmation.
- Empty-store policy: 24-hour cancellable cooling period, then a second AAL2 confirmation. Non-empty stores remain on the full retention/export/platform-review path.
- Browsers may request, inspect, cancel and finally confirm; only a leased service worker may purge.

## Work packages

- WP-00: isolated latest-origin baseline, linked read-only evidence, task/risk contract.
- WP-01: forward migration for request ledger, approval binding, cancellation and lease-bound purge writer access.
- WP-02: recovery-target API/types/repository/router and bounded worker runner.
- WP-03: “已关闭与删除” primary-owner UI with complete lifecycle states.
- WP-04: PostgreSQL, unit, API, worker, browser, responsive, security and release verification.
- WP-05: staged production apply/deploy/flags, exact-target close/export/restore/final confirmation/purge/postcheck.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
