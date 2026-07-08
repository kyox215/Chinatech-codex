---
schema_version: 1
task_id: "TASK-20260706-001-realtime-updates-execution"
status: "active"
phase: "local_slice_9g_rpc_draft_complete"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
created_at: "2026-07-06T05:58:52Z"
updated_at: "2026-07-07T11:33:50Z"
---
# TASK-20260706-001 Real-Time Updates Execution

## Owner Goal

老板要求：使用子代理，启用 DATA、SEC、QA 只读复核。设置目标并开始执行网站实时更新计划。

## Business Value

RepairDesk 多员工同时操作订单、客户、库存、设置等页面时，其他在线用户无需刷新即可看到最新状态，减少重复录入、状态误判和柜台协作延迟。

## Current Scope

In scope:

- 启用真实 DATA、SEC、QA 只读子代理复核。
- 建立本任务记忆、执行边界、验收和审批点。
- 准备可逆的本地实施方案，优先沿用现有 Next.js App Router、React Query、Supabase 架构。
- 设计 Supabase Realtime Broadcast/private channel/minimal payload 与 React Query invalidation 的集成方案。
- 明确生产 Supabase migration、Realtime RLS、部署和域名发布的审批边界。

Out of scope until explicit Owner approval:

- 执行生产 Supabase migration。
- 启用或修改生产 Realtime authorization/RLS。
- 部署、发布、推送 main、改域名或对外开放。
- 发送客户通知、WhatsApp/SMS 自动消息或外部客户沟通。
- 删除、清洗或回填生产数据。

## Risk And Autonomy

- Local planning and task-memory updates: R1/L2.
- Local code preparation without production execution: R2/L2, after sub-agent review.
- Checked-in migration draft: R2 locally, production application remains R3 and approval-gated.
- Production realtime enablement, RLS changes, deployment: R3, requires Owner approval package.

## Agenda Intake

goal: RepairDesk 网站实时更新功能从规划进入执行准备，支持多用户无刷新协作更新。
user_constraints: 使用真实子代理；DATA、SEC、QA 只读复核；开始执行计划。
decision_owner: Integration Lead / CEO Agent.
needs_web_research: yes, Supabase Realtime platform behavior is current external knowledge.
business_domains: orders, customers, inventory, settings, stores/auth, server/API, database.
technical_domains: realtime, Supabase, React Query, tenant isolation, PII, QA, migrations.
risk: medium now, high for production migration/enablement.
requires_multi_agent: yes, Owner explicitly requested sub-agents and review.
primary_department: INT.
supporting_departments: DATA, SEC, QA.
spawn_plan:
- DATA reviewer, read_only, schema/API/cache contract.
- SEC reviewer, read_only, threat model/privacy/tenant isolation.
- QA reviewer, read_only, verification matrix and visual evidence.
file_ownership_plan:
- Main thread only writes task memory and later approved local implementation files.
- Sub-agents are read-only and own no files.
allowed_change_scope:
- Current step: `.ai-company/memory/tasks/TASK-20260706-001-realtime-updates-execution/` and `.ai-company/memory/ACTIVE_CONTEXT.md`.
- Later local implementation only after review integration.
verification:
- Task-memory diff check.
- Sub-agent results reviewed and integrated.
- For code slice later: targeted tests first, then lint/typecheck/test/build where worktree allows.
stop_condition:
- Stop and request Owner approval before production migration, Realtime RLS enablement, deployment, or any irreversible action.

## Acceptance Criteria

1. Real DATA/SEC/QA sub-agents are spawned and their ids, roles, modes, and results are recorded.
2. The task record separates local reversible work from approval-gated production actions.
3. The realtime event contract avoids direct PII/secret/payment/unlock payloads.
4. The plan maps event types to React Query invalidation keys.
5. Security review identifies tenant isolation and private channel controls.
6. QA review defines two-user/two-tab verification, offline/reconnect, store switch, edit conflict, and visual evidence requirements.
7. No production migration, deployment, push, destructive command, or external communication occurs without explicit approval.

## Spawned Agents

| Department | Agent type | Mode | Agent ID | Nickname | Status |
|---|---|---|---|---|---|
| DATA | data_reviewer | read_only | 019f3601-357e-7710-bbf6-3675ef862d6e | Delta | completed: conditional |
| SEC | security_reviewer | read_only | 019f3601-689f-7f21-bdcb-fa51977bd08a | Aegis | completed: conditional local, production blocker |
| QA | qa_reviewer | read_only | 019f3601-8ea0-71e2-8661-96096729774b | Verity | completed: conditional |

## Slice 9D Spawned Agents

| Department | Agent type | Mode | Agent ID | Nickname | Status |
|---|---|---|---|---|---|
| DATA | data_reviewer | read_only | 019f3b8f-428f-7ee1-a58b-cbabb930f599 | Gaia | completed: conditional |
| SEC | security_reviewer | read_only | 019f3b8f-79a8-7aa3-a474-aee2ad373f2e | Aegis | completed: conditional |
| QA | qa_reviewer | read_only | 019f3b8f-a8f1-71f1-82bb-2e4df4ac36ff | Verity | completed: conditional |

Slice 9D integrated decision:

- Approval package may proceed as local planning/approval artifact only.
- Real network sync, production migration, deployment, push, and runner-to-server wiring remain blocked.
- Slice 9E may begin only after Owner approval and must stay local unless explicitly expanded.
- 9E blockers include server idempotency table/RLS, narrow API, HMAC/canonical request hash, transaction/RPC or reviewed equivalent lock/recovery, explicit permission assertion, customer/device relationship review, stale conflict handling, and redacted operation/audit tests.

## Integrated Decision

Accepted:

- Phase 1 uses server-origin Broadcast signals and React Query invalidation; Realtime is cache invalidation, not source of record.
- Do not use Postgres Changes for business tables in MVP.
- Do not use raw database triggers for MVP because current business writes are multi-step and would over-emit intermediate states.
- Store-domain channels must use minimal invalidation payloads with no order/customer/inventory identifiers.
- Clients must be receive-only for business Broadcast; client send requires no policy for business topics.
- Production Realtime RLS/private channel enablement remains blocked until Owner approval and validation.

Rejected or deferred:

- Raw row payload broadcasts: rejected for PII/credential/payment risk.
- Store-wide payloads with `orderId`, `customerId`, `inventoryItemId`, or `entityId`: rejected for broad-channel inference risk.
- Entity-specific realtime channels: deferred until a separate authorization design exists.
- DB trigger/outbox model: deferred until measured need.

## Local Slice 1 Result

Implemented code-only model preparation:

- `src/features/realtime/model/realtime-events.ts`
- `src/features/realtime/model/query-invalidation-map.ts`
- `src/features/realtime/model/realtime-events.test.ts`
- `src/features/realtime/model/query-invalidation-map.test.ts`

Verification:

- `npm run lint -- src/features/realtime`: passed.
- `npm run test -- src/features/realtime`: passed, 2 files / 7 tests.
- `npm run typecheck`: passed.

## Local Slice 2 Result

Implemented default-off client subscription shell:

- `src/features/realtime/api/realtime-client.ts`
- `src/features/realtime/api/use-repairdesk-realtime.ts`
- `src/features/realtime/api/realtime-client.test.ts`
- `src/features/realtime/api/use-repairdesk-realtime.test.tsx`

Updated:

- `src/features/realtime/model/realtime-events.ts` now exports `isRepairDeskRealtimeStoreId` for safe topic guards.

Behavior:

- Realtime is disabled unless `NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED === "1"`.
- Hook does not subscribe without an active store.
- Hook does not subscribe with an unsafe/non-UUID store id.
- Subscriptions use private store-domain topics.
- Unmount/store switch cleans up channels.
- Invalid, sensitive, or wrong-store payloads are ignored.

Verification:

- `npm run lint -- src/features/realtime`: passed.
- `npm run test -- src/features/realtime`: passed, 4 files / 16 tests.
- `npm run typecheck`: passed.

## Local Slice 3 Result

Implemented default-off provider wiring:

- `src/features/realtime/components/realtime-sync-provider.tsx`
- `src/features/realtime/components/realtime-sync-provider.test.tsx`

Behavior:

- Provider uses `useRepairDeskRealtime` and React Query `useQueryClient`.
- Valid same-store events invalidate mapped React Query targets.
- Invalid, sensitive, or wrong-store payloads do not invalidate.
- Provider cleans up realtime channels on unmount.
- Provider is not mounted globally and `src/app/providers.tsx` was not modified in this slice.

Verification:

- `npm run lint -- src/features/realtime`: passed.
- `npm run test -- src/features/realtime`: passed, 5 files / 20 tests.
- `npm run typecheck`: passed.

## Local Slice 4 Result

Implemented default-off app-shell mount wiring:

- `src/features/realtime/components/realtime-app-bridge.tsx`
- `src/features/realtime/components/realtime-app-bridge.test.tsx`
- `src/app/providers.tsx`

Behavior:

- `RealtimeAppBridge` reads `useStoreShellContext()` and passes the active store id to `RealtimeSyncProvider` only when the active store membership status is `active`.
- The app shell mounts `RealtimeAppBridge` only in the authenticated application branch; `/login` and `/onboarding` remain outside realtime wiring.
- Realtime remains default-off unless `NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED === "1"`.
- Tests confirm no active store means no subscription, default app-shell bridge stays off, and explicit enablement subscribes to the private store-domain topic.
- `src/app/providers.tsx` already had unrelated dirty changes before this slice; the slice only added the realtime bridge import and authenticated-branch wrapper.

Verification:

- `npm run test -- src/features/realtime`: passed, 6 files / 23 tests.
- `npm run typecheck`: passed.
- `npm run lint -- src/features/realtime src/app/providers.tsx`: passed.

## Local Slice 5A Result

Implemented default-off server Broadcast emitter infrastructure:

- `src/features/realtime/server/realtime-broadcast.ts`
- `src/features/realtime/server/realtime-broadcast.test.ts`
- `src/features/realtime/model/realtime-events.ts`
- `src/features/realtime/api/realtime-client.ts`

Behavior:

- Server Broadcast is disabled unless `REPAIRDESK_REALTIME_BROADCAST_ENABLED === "1"`.
- The emitter builds only the allowlisted realtime event fields and reuses the strict parser before sending.
- Broad store-domain events still carry no order/customer/inventory identifiers, phone, notes, unlock data, payment data, signed URLs, or raw DTOs.
- Unsafe store topics are skipped before opening a channel.
- If Supabase is not configured, the emitter skips instead of throwing.
- Send rejection/errors return a failed result but do not throw; callers can keep business mutations non-blocking.
- Channels are cleaned up through `removeChannel()` or `unsubscribe()`.
- The emitter is not yet integrated into order/customer/inventory/settings mutations.

Verification:

- `npm run test -- src/features/realtime`: passed, 7 files / 29 tests.
- `npm run typecheck`: passed.
- `npm run lint -- src/features/realtime`: passed.

## Local Slice 5B Result

Implemented narrow mutation integration for audited write paths:

- `src/server/api/repairdesk-router.ts`
- `src/features/realtime/server/realtime-broadcast.ts`
- `src/features/realtime/server/realtime-router-integration.test.ts`

Behavior:

- Existing `auditGeneric()` now accepts optional realtime metadata and queues a broadcast only after the mutation and audit log complete successfully.
- Queued broadcast uses `actor.storeId` plus static allowlisted metadata only; no request body, result DTO, entity id, amount, phone, notes, unlock data, attachment URL, or customer/order identifiers are sent.
- Integrated audited paths include order create/update/patch/finance/attachment/transition/batch transition/payment/approval decision, order workflow status/transition changes, and customer create/update.
- Broadcast queue remains default-off because the emitter requires `REPAIRDESK_REALTIME_BROADCAST_ENABLED === "1"`.
- Router integration tests confirm order create queues realtime metadata after success and does not queue when the mutation fails.
- Inventory writes, customer device/tag/followup/message writes, message template/store settings writes, and store membership/onboarding changes remain for later slices.

Verification:

- `npm run test -- src/features/realtime src/server/api/repairdesk-router.test.ts src/server/api/repairdesk-schemas.test.ts`: passed, 10 files / 45 tests.
- `npm run typecheck`: passed.
- `npm run lint -- src/features/realtime src/server/api/repairdesk-router.ts`: passed.

## Local Slice 5C Result

Extended default-off mutation broadcast coverage to direct write paths:

- `src/server/api/repairdesk-router.ts`
- `src/features/realtime/server/realtime-router-integration.test.ts`

Behavior:

- Added `runWithRealtime()` for non-audited mutation paths.
- Extended static allowlisted metadata for inventory, settings/templates, store membership/access-request changes, customer direct writes, and notification/message writes.
- Direct writes queue realtime metadata only after the underlying API call resolves successfully.
- No request body, result DTO, entity id, customer/order/inventory id, amount, phone, message body, attachment data, notes, unlock data, signed URL, or invitation token is broadcast.
- Server Broadcast remains default-off through `REPAIRDESK_REALTIME_BROADCAST_ENABLED`.
- Added router integration coverage for successful direct settings mutation broadcast.

Verification:

- `npm run test -- src/features/realtime src/server/api/repairdesk-router.test.ts src/server/api/repairdesk-schemas.test.ts`: passed, 10 files / 46 tests.
- `npm run typecheck`: passed.
- `npm run lint -- src/features/realtime src/server/api/repairdesk-router.ts`: passed.

## Local Slice 6 Result

Prepared Supabase private Realtime authorization draft and Owner approval package without applying it:

- `supabase/migrations/20260706133632_repairdesk_realtime_private_broadcast_authorization.sql`
- `.ai-company/memory/tasks/TASK-20260706-001-realtime-updates-execution/SUPABASE_REALTIME_APPROVAL_PACKAGE.md`
- `src/features/realtime/server/realtime-migration-policy.test.ts`

Behavior/proposal:

- Migration draft enables RLS on `realtime.messages`.
- Grants authenticated users `SELECT` only for Broadcast topics they are authorized to receive.
- Revokes browser `INSERT`, `UPDATE`, and `DELETE` on `realtime.messages`.
- Policy allows `realtime.topic()` only for `repairdesk:v1:store:<uuid>:(orders|customers|inventory|settings)`.
- Policy requires active `public.store_memberships` membership and active `public.stores` row.
- Migration intentionally creates no browser-client `INSERT` policy.
- Approval package records pre-apply checks, post-apply verification, rollback, and production approval boundary.

Verification:

- Supabase official Realtime Authorization and Broadcast docs reviewed via `curl -L`.
- Supabase changelog reviewed; no current Realtime authorization breaking change was identified for this migration draft.
- `env SUPABASE_TELEMETRY_DISABLED=1 supabase --version`: passed, CLI `2.101.0`.
- `env SUPABASE_TELEMETRY_DISABLED=1 supabase migration new repairdesk_realtime_private_broadcast_authorization`: created the local migration file.
- `npm run test -- src/features/realtime src/server/api/repairdesk-router.test.ts src/server/api/repairdesk-schemas.test.ts`: passed, 11 files / 47 tests.
- `npm run typecheck`: passed.
- `npm run lint -- src/features/realtime src/server/api/repairdesk-router.ts`: passed.
- `git diff --check -- src/features/realtime src/server/api/repairdesk-router.ts src/app/providers.tsx supabase/migrations/20260706133632_repairdesk_realtime_private_broadcast_authorization.sql .ai-company/memory/ACTIVE_CONTEXT.md .ai-company/memory/tasks/TASK-20260706-001-realtime-updates-execution`: passed.

Verification limitation:

- `env SUPABASE_TELEMETRY_DISABLED=1 supabase migration list --local` could not verify against a local DB because `127.0.0.1:54322` was not running/reachable. No production or remote DB was touched.

## Approval Points

- Approve checked-in Supabase migration implementation.
- Approve applying migration to production Supabase.
- Approve enabling private Realtime channels/RLS in production.
- Approve deployment/release to production.
- Approve any new paid service, plan upgrade, or rate-limit/capacity cost.

## Slice 9E-A Spawned Agents

| Department | Agent type | Mode | Agent ID | Nickname | Status |
|---|---|---|---|---|---|
| DATA | data_reviewer | read_only | 019f3bee-fa1b-7b31-a69d-1b2fa468687b | Index | completed: conditional |
| SEC | security_reviewer | read_only | 019f3bef-1f84-7c72-bc45-02285b980c53 | Sentinel | completed: conditional |
| QA | qa_reviewer | read_only | 019f3bef-4760-75a2-a5a9-5dbad73465eb | Gauge | completed: fail before implementation, findings integrated |

## Local Slice 9E-A Result

Implemented local-only offline sync contract preparation:

- `src/features/offline/server/offline-sync-contract.ts`
- `src/features/offline/server/offline-sync-contract.test.ts`
- `supabase/migrations/20260707090000_repairdesk_offline_operations.sql`

Behavior:

- Added strict offline order create/update DTOs that reject unknown/high-risk fields before hashing or any future write.
- Added explicit customer/device relationship plan shapes so future sync cannot auto-link only by phone/name fallback.
- Added canonical JSON and HMAC-SHA256 request hash helper for idempotency.
- Added replay decision helper for same-key replay, different-payload conflict, blocked/conflict/failed rows, and stale `started` recovery classification.
- Added stable server result-code mapping to local runner outcomes.
- Added permission assertion helpers using the existing server permission matrix for `order:create`, `order:update_intake`, and `order:update_repair`.
- Added operation metadata safety guard to reject sensitive keys such as phone, email, IMEI/serial, unlock/PIN/password/pattern, storage path, signed URL, message body, payment, status/workflow, role/member, and attachment fields.
- Added local migration draft for `public.repairdesk_offline_operations` with server-only RLS/grants, unique operation key, HMAC hash check, status/result checks, minimal response summary, and retention marker.

Verification:

- `npm run test -- src/features/offline/server/offline-sync-contract.test.ts`: passed, 1 file / 14 tests.
- `npm run test -- src/features/offline/model src/features/offline/server/offline-sync-contract.test.ts src/server/api/repairdesk-schemas.test.ts src/server/permissions.test.ts src/server/api/repairdesk-router.test.ts`: passed, 9 files / 89 tests.
- `npm run typecheck`: passed.
- `npm run lint -- src/features/offline/server/offline-sync-contract.ts src/features/offline/server/offline-sync-contract.test.ts`: passed.
- `npm run test`: passed, 73 files / 465 tests.
- `npm run build`: sandbox run failed due Turbopack port-binding permission error; escalated rerun passed.
- `git diff --check -- src/features/offline/server/offline-sync-contract.ts src/features/offline/server/offline-sync-contract.test.ts supabase/migrations/20260707090000_repairdesk_offline_operations.sql`: passed.

Current boundary:

- No real `offline/orders/create` or `offline/orders/update` route was added.
- No business writes, production migration, Supabase dry-run against linked project, deployment, push, feature flag enablement, runner-to-server wiring, realtime invalidation from offline sync, Sensitive Vault value sync, attachment upload, payment/message/status automation, or customer-facing sync occurred.

Next:

- Slice 9F should first choose the real write strategy. Preferred path is RPC/transaction-first; service-layer lock/recovery needs another review before implementation.
- Then add a local-only narrow offline sync service/router draft with tests for object ownership, same-store customer/device resolution, stale `baseUpdatedAt`, duplicate-customer `needs_review`, stable generic error codes, and redacted audit metadata.

## Slice 9F-A Spawned Agents

| Department | Agent type | Mode | Agent ID | Nickname | Status |
|---|---|---|---|---|---|
| DATA | data_reviewer | read_only | 019f3c28-6261-7922-a82c-7acec1defb4d | Gaia | completed: conditional |
| SEC | security_reviewer | read_only | 019f3c28-639f-7d73-aefb-f77254d6debd | Cipher | completed: conditional |
| QA | qa_reviewer | read_only | 019f3c28-6586-7fb0-a012-ee47b3a0d3f5 | Verity | completed: conditional |

## Local Slice 9F-A Result

Implemented local-only offline sync service contract:

- `src/features/offline/server/offline-sync-service.ts`
- `src/features/offline/server/offline-sync-service.test.ts`
- `src/features/offline/server/offline-sync-contract.ts`
- `src/features/offline/server/offline-sync-contract.test.ts`

Behavior:

- Added a service/coordinator with injected ports for operation claim/finalize, create relationship validation, update target validation, and business write execution.
- Kept the service unmounted and unregistered; no router path, no production API, no Supabase call, no runner network wiring.
- Service computes HMAC request hash after strict schema parsing, claims an operation key, maps same-payload replay and different-payload conflict, completes operation rows through the injected port, and returns stable local runner outcomes.
- Service rejects viewer/no-store/system actors before operation claim, derives update permission from server-side target preflight scope, and maps internal failures to generic `retryable_error`.
- Audit metadata is allowlisted to operation id/type/hash/result and target id only.
- Static tests prove the service does not import broad order APIs, router wrappers, Supabase clients, realtime broadcast, network APIs, or `auditGeneric`.
- Removed `parts_supplier_id` from the first offline update allowlist because supplier mutation is not in 9F-A scope.

Verification:

- `npm run test -- src/features/offline/server/offline-sync-service.test.ts`: passed, 1 file / 13 tests.
- `npm run test -- src/features/offline/server/offline-sync-contract.test.ts src/features/offline/server/offline-sync-service.test.ts`: passed, 2 files / 27 tests.
- `npm run test -- src/features/offline/server/offline-sync-contract.test.ts src/features/offline/server/offline-sync-service.test.ts src/features/offline/model/offline-outbox-sync-runner.test.ts src/server/api/repairdesk-router.test.ts`: passed, 4 files / 40 tests.
- `npm run typecheck`: passed.
- `npm run lint -- src/features/offline/server/offline-sync-contract.ts src/features/offline/server/offline-sync-contract.test.ts src/features/offline/server/offline-sync-service.ts src/features/offline/server/offline-sync-service.test.ts`: passed.
- `npm run test`: passed, 74 files / 478 tests.
- `npm run build`: sandbox run failed due Turbopack port-binding permission error; escalated rerun passed after a temporary Next build lock cleared.
- `git diff --check -- .ai-company/memory/ACTIVE_CONTEXT.md .ai-company/memory/tasks/TASK-20260706-001-realtime-updates-execution src/features/offline/server supabase/migrations/20260707090000_repairdesk_offline_operations.sql`: passed.

Current boundary:

- No real offline route, business write, production migration, Supabase dry-run against linked project, deployment, push, feature flag enablement, runner-to-server wiring, realtime invalidation from offline sync, Sensitive Vault value sync, attachment upload, payment/message/status automation, or customer-facing sync occurred.
- Real business writes remain blocked until RPC/transaction-first implementation or separately reviewed lock/recovery strategy exists.

Next:

- Slice 9G should produce a local un-applied RPC/transaction design/draft, including operation row claim/finalize, customer/device/order/event atomicity, stale `started` recovery, rollback behavior, and audit/operation redaction tests.

## Slice 9G Spawned Agents

| Department | Agent type | Mode | Agent ID | Nickname | Status |
|---|---|---|---|---|---|
| DATA | data_reviewer | read_only | 019f3c50-69f4-72a1-94fa-06d507ca8543 | Delta | completed: initial block before RPC draft; findings integrated |
| SEC | security_reviewer | read_only | 019f3c50-6b12-7d83-b1ec-5697da19983b | Aegis | completed: initial block before RPC draft; findings integrated |
| QA | qa_reviewer | read_only | 019f3c50-6bf1-7d10-8915-347b0cecb3e2 | Probe | completed: initial block before RPC draft; findings integrated |

## Local Slice 9G Result

Implemented local-only, un-applied offline order sync RPC/transaction draft and tightened operation metadata persistence:

- `supabase/migrations/20260707110000_repairdesk_offline_order_sync_rpc_draft.sql`
- `src/features/offline/server/offline-sync-rpc-draft.test.ts`
- `supabase/migrations/20260707090000_repairdesk_offline_operations.sql`
- `src/features/offline/server/offline-sync-contract.ts`
- `src/features/offline/server/offline-sync-contract.test.ts`
- `src/features/offline/server/offline-sync-service.ts`
- `src/features/offline/server/offline-sync-service.test.ts`

Behavior:

- Added local approval draft RPC functions for offline order create and update. Draft functions are service-role only, use fixed `search_path`, claim operation rows by scoped idempotency key, lock rows with `for update`, and keep operation claim, business write, order event, and operation finalization in one database function body.
- Order create draft supports explicit existing/new customer and explicit existing/new customer device relationship plans, checks same-store ownership, blocks duplicate same-store customer phones as `needs_review`, and finalizes only minimal non-PII response summary.
- Order update draft is restricted to order text/warranty fields, checks optimistic `baseUpdatedAt`, blocks device master updates as deferred, and writes an order event.
- Operation ledger migration now constrains `response_summary` to `serverOrderId`, `publicNo`, `updatedAt`, and `resultCode` only, and constrains `error_code` to a stable allowlist.
- Service layer now parses and allowlists executor-provided `responseSummary` and `errorCode` before completing an operation; unsafe executor outputs fail closed as `retryable_error`.
- RPC draft remains un-applied and is not wired to any route, runner, Supabase client, feature flag, production database, deployment, or customer-visible workflow.

Verification:

- `npm run test -- src/features/offline/server/offline-sync-contract.test.ts src/features/offline/server/offline-sync-service.test.ts src/features/offline/server/offline-sync-rpc-draft.test.ts`: passed, 3 files / 35 tests.
- `npm run test -- src/features/offline/server/offline-sync-contract.test.ts src/features/offline/server/offline-sync-service.test.ts src/features/offline/server/offline-sync-rpc-draft.test.ts src/features/offline/model/offline-outbox-sync-runner.test.ts src/server/api/repairdesk-router.test.ts`: passed, 5 files / 48 tests.
- `npm run typecheck`: passed.
- `npx eslint src/features/offline/server/offline-sync-contract.ts src/features/offline/server/offline-sync-contract.test.ts src/features/offline/server/offline-sync-service.ts src/features/offline/server/offline-sync-service.test.ts src/features/offline/server/offline-sync-rpc-draft.test.ts`: passed.
- `git diff --check -- src/features/offline/server/offline-sync-contract.ts src/features/offline/server/offline-sync-contract.test.ts src/features/offline/server/offline-sync-service.ts src/features/offline/server/offline-sync-service.test.ts src/features/offline/server/offline-sync-rpc-draft.test.ts supabase/migrations/20260707090000_repairdesk_offline_operations.sql supabase/migrations/20260707110000_repairdesk_offline_order_sync_rpc_draft.sql`: passed.
- `npm run build`: sandbox run failed due Turbopack process/port permission error; approved escalated rerun passed.

Verification limitations:

- `npm run test` full suite currently fails in unrelated `src/features/platform/server/platform.repository.test.ts` email-verification expectations: 75 files passed, 1 failed, 492 passed / 5 failed tests.
- `npm run lint` full suite currently fails on unrelated Prettier formatting in `src/features/platform/server/platform.repository.test.ts` and `src/features/stores/server/store.repository.test.ts`.
- No local or linked Supabase migration apply/dry-run was run for Slice 9G.

Current boundary:

- No production migration, linked Supabase dry-run, deployment, push, route exposure, runner-to-server wiring, realtime invalidation from offline sync, Sensitive Vault value sync, attachment upload, payment/message/status automation, or customer-facing sync occurred.
- The RPC draft is a review artifact under `supabase/migrations/`; applying it to any database requires Owner approval, release plan, backup/restore plan, and DATA/SEC/QA re-review.

Next:

- Slice 9H should add the route/port integration plan or implementation only if it remains local and default-off, and should stop before any real network sync.
- Before production, run a real local Supabase migration rehearsal or owner-approved linked dry-run, test transaction rollback against a database, and resolve unrelated full-suite test/lint failures.

## Slice 9H-A Spawned Agents

| Department | Agent type | Mode | Agent ID | Nickname | Status |
|---|---|---|---|---|---|
| DATA | data_reviewer | read_only | 019f3c69-ca76-75f1-84ce-676a0d39ed68 | Gaia the 2nd | completed: blockers integrated |
| SEC | security_reviewer | read_only | 019f3c69-cb99-7460-93f7-eb9b34ea471e | Aegis the 2nd | completed: blockers integrated |
| QA | qa_reviewer | read_only | 019f3c69-cc94-77b0-aa32-b5c3db6be7b4 | Verity the 2nd | completed: blockers integrated |

## Local Slice 9H-A Result

Completed a local database-backed RPC rehearsal for the offline order sync transaction draft.

Files updated:

- `supabase/migrations/20260707110000_repairdesk_offline_order_sync_rpc_draft.sql`
- `src/features/offline/server/offline-sync-contract.ts`
- `src/features/offline/server/offline-sync-contract.test.ts`
- `src/features/offline/server/offline-sync-rpc-draft.test.ts`

Behavior hardened:

- Fixed the fresh operation claim guard so a newly claimed `started` operation can enter business writes; only pre-existing fresh `started` rows return `retryable_error`.
- Required active store membership, active staff profile, active store status, and non-viewer role inside both RPC functions.
- Moved update `baseUpdatedAt` casting into the handled transaction block and finalizes invalid timestamps as `blocked_operation` / `invalid_payload`.
- Removed offline deposit/payment collection from the first RPC subset; create writes `unpaid`, `deposit_amount = 0`, `is_paid = false`, and `balance_amount = quotation_amount`.
- Aligned offline `warranty_months` validation to the DB check presets: `0`, `3`, `6`, `12`, `24`.
- Added terminal replay handling for `conflict`, `blocked`, and `failed` operations so they do not re-enter business writes.
- Removed `operation_id` from order event payloads to avoid spreading operation identifiers into order history.

Local DB rehearsal:

- A full local Supabase start using the complete repo migration set was attempted on isolated 554xx ports and failed before Slice 9H-A RPC at historical migration `20260611102805_repairdesk_remote_schema_compatibility.sql`: `inventory_items.product_channel` does not exist in the clean local baseline.
- To keep 9H-A focused, a DB-only Supabase harness was started under `/private/tmp/repairdesk-rpc-harness-9h` on port `55522`, with all non-DB services excluded.
- The harness created a minimal schema, loaded the current RPC draft, and executed DB assertions for create, idempotent replay, hash conflict, cross-store denial, update, stale version, invalid timestamp block, blocked terminal replay, transaction rollback on event failure, failed terminal replay, service-role-only execute grants, and sensitive data non-persistence.
- Harness result: passed; operation counts were `succeeded=2`, `blocked=3`, `conflict=1`, `failed=1`, `repair_orders=1`, `order_events=2`.
- The temporary harness was stopped after evidence collection.

Verification:

- `npm run test -- src/features/offline/server/offline-sync-contract.test.ts src/features/offline/server/offline-sync-service.test.ts src/features/offline/server/offline-sync-rpc-draft.test.ts`: passed, 3 files / 39 tests.
- `npx eslint src/features/offline/server/offline-sync-contract.ts src/features/offline/server/offline-sync-contract.test.ts src/features/offline/server/offline-sync-service.ts src/features/offline/server/offline-sync-service.test.ts src/features/offline/server/offline-sync-rpc-draft.test.ts`: passed.
- `npm run typecheck`: passed.
- Local DB-only RPC function creation: passed.
- Local DB-only RPC business assertions: passed.
- Local DB-only RPC grants: `service_role=true`, `authenticated=false`, `anon=false` for create and update.

Current boundary:

- No production migration, linked Supabase dry-run, deployment, push, route exposure, runner-to-server wiring, realtime invalidation from offline sync, Sensitive Vault value sync, attachment upload, payment/message/status automation, or customer-facing sync occurred.
- The RPC draft remains local and un-applied. The DB-only harness proves function logic against a minimal local schema, not the complete project migration chain.

Next:

- Resolve or isolate the historical clean-local migration blocker before claiming full local Supabase migration rehearsal.
- Then continue to Slice 9H-B: local default-off route/port integration plan or implementation, still stopping before real network sync or customer-visible behavior.
