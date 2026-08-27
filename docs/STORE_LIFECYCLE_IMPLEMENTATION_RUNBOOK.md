# Store Lifecycle P0-P5 Implementation Runbook

Last updated: 2026-08-27

## Current release boundary

P0-P5 has a verified implementation path. Its first six additive migrations were applied to linked project `xluzcoduqsdvjoouqhkc`, and implementation commit `55cb7ab5a928b67daf4856e80486f2ccec5fbd59` was fast-forward pushed to `main` on 2026-07-18. The seventh forward-only migration defines lifecycle contract v2, the database writer fence and live close-blocker recheck and is now present in production history. That generic fence exposed a mixed-scope compatibility defect in the AI usage bucket table; the eighth forward repair is now production-applied and passed catalog/ACL/aggregate checks, a single order-text canary and 15 minutes of observation. This does **not** authorize a production store mutation, worker activation or permanent purge.

| Phase | Implemented and locally verified                                                                                                                                                             | Production gate still required                                                                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| P0    | Primary-owner-only immutable UUID preflight; PII-free row counts, financial/custody/Kiosk/invitation blockers, Storage summary, revision-bound snapshot                                      | Re-run against the exact linked project and target UUID                                                    |
| P1    | Structured order-data access reason codes and Settings explanation                                                                                                                           | Keep order-data export/apply permissions and flags unchanged unless separately approved                    |
| P2    | Recent TOTP/AAL2 challenge issuer, one-use challenge, primary-owner-only atomic full workspace rename, revision CAS, idempotency, audit, Settings UI                                         | `STORE_LIFECYCLE_MUTATIONS_ENABLED` remains off until migration and release approval                       |
| P3    | Atomic close, one-hour drain, archive finalizer, restore, invitation/Kiosk revocation, ordinary API/Kiosk/invite/offline write gates, Settings UI, and verified AI-reservation close barrier | Keep lifecycle mutations off until separately approved; recheck reservations before any live close         |
| P4    | Catalog-driven database and UUID-prefixed Storage export, deterministic DB/Storage/artifact hashes, encrypted sink contract, isolated restore comparison and durable proof                   | Select and approve the real encrypted sink/KMS, retention, access logging and isolated restore environment |
| P5    | Approval-locked schedule, leased/resumable worker, Storage-first deletion, FK ordering and cycle break, checkpoints/retry, other-tenant guard, zero residual proof and non-PII tombstone     | Purge scheduling and worker flags remain off; exact target and second irreversible approval are mandatory  |

The browser never deletes tenant data directly. Contract v3 adds owner-facing request, status, cancellation and final-confirmation controls under **已关闭与删除**. The first AAL2 confirmation creates a server-owned request and export job, at least 24 hours remain cancellable, and a distinct fresh AAL2 confirmation is accepted only after a current preflight and isolated `restore_verified` proof. Export and destructive purge still run only through service workers.

The Settings controls are a staged browser control plane: an explicitly selected active store exposes only the recoverable close preflight, while an archived store exposes the purge request/status controls only to the system-registered primary owner. The request and final-confirm operations display and require different exact phrases derived from the authoritative UUID (including case and spaces); the browser sends only `confirmationPhrase`, never a client-supplied store-name/UUID split. The full store name and UUID remain separate read-only核对 values, copy feedback is announced without normalizing the input, and active mutation submissions lock the phrase, acknowledgement, cancel and submit controls to prevent duplicate or accidental actions. `scheduled` means the request is waiting for background safety checks and scheduling; only `completed` means deletion finished.

The read-only request/status query remains visible when purge scheduling is disabled, while creating or final-confirming a request remains capability-gated. Existing requests can still be cancelled through the guarded server path. The browser control plane is staged only: it never deletes Storage or database rows. The purge worker and every destructive adapter method now fail closed unless `repairdesk_store_lifecycle_contract_version >= 4` before claim/queue/start or any Storage API call; contract v4 is intentionally absent from the current production lineage. This local control-plane implementation does not authorize production scheduling, worker activation, Storage deletion, or database purge: the forward v4 migration, encrypted sink, isolated restore proof, independent background runner approval and a separate R4 Owner/D4 approval remain blocking production gates.

## Migration order

Applied after linked dry-run approval, in this exact order:

1. `20260717195346_store_lifecycle_control_plane.sql`
2. `20260717195516_store_lifecycle_atomic_operations.sql`
3. `20260717195519_store_lifecycle_export_purge_framework.sql`
4. `20260717201728_store_lifecycle_transition_operations.sql`
5. `20260717201729_store_export_restore_proof.sql`
6. `20260717201730_store_purge_executor_control.sql`
7. `20260720013000_store_lifecycle_business_fence_and_close_recheck.sql`
8. `20260720065246_ai_usage_bucket_store_fence_hotfix.sql` — production-applied and postchecked
9. `20260720211230_store_self_service_purge_safety.sql` — contract v3; pending production approval/apply

Contract v4 is a future forward migration and is deliberately not present in this release. Until it is independently reviewed and approved, the production worker must reject every claim/start/destructive method before any purge side effect.

The chain is additive until a separately approved purge job reaches its final worker steps. The sixth migration contains deletion RPCs; the contract-v3 forward migration adds a service-owned request ledger and lease-bound writer-fence bypass. All destructive RPCs remain `service_role` only and unreachable while purge flags are off.

## Feature flags

All flags use exact value `1`; unset, `0`, `true`, or any other value is off.

- `STORE_LIFECYCLE_ENFORCEMENT_ENABLED`: rejects ordinary browser writes for non-active lifecycle phases.
- `STORE_LIFECYCLE_MUTATIONS_ENABLED`: enables challenge, rename, close, restore, archive and export preparation application paths.
- `STORE_LIFECYCLE_EXPORT_WORKER_ENABLED`: permits the complete export/restore-proof worker.
- `STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED`: permits second-approval purge scheduling.
- `STORE_LIFECYCLE_PURGE_WORKER_ENABLED`: permits the destructive background worker.

Release order is migration first with every flag off, then application deploy with every flag off, read-only verification, **enforcement rollout**, active-store regression and closing-store rejection proof, and only then mutation rollout on a disposable test store. Rename/close/restore require contract version 2; self-service purge request/scheduling requires contract version 3. Export proof and purge remain separate later approvals. Never enable all flags at once.

## P2 rename flow

1. Settings reads `store_lifecycles` for the exact active store UUID and revision.
2. The owner completes TOTP; the server accepts only an `aal2` JWT whose TOTP AMR timestamp is within five minutes.
3. The server issues a five-minute, single-use challenge bound to actor, store UUID, revision and operation kind.
4. The RPC takes an advisory store lock, rechecks primary ownership, active lifecycle, revision and challenge.
5. It updates `stores.name`; when explicitly selected, it also updates `store_settings.store_name` for receipts/messages.
6. UUID, slug, store code and Storage prefixes do not change. An idempotent operation record and non-PII audit are written.
7. The client refreshes store context and tenant caches. Rollback is a new audited rename using the latest revision.

## P3 close, archive and restore flow

Recoverable close is blocked while preflight reports open orders, unsettled balance or shop custody. Pending invitations and open Kiosk sessions are shown as automatic close effects and are revoked inside the close transaction, rather than asking a beginner to resolve them manually. Legal/retention holds and complete Storage proof remain gates for export/purge, not for reversible close.

The owner confirms the final eight hex characters shown beside the full “店铺唯一编号”; the application sends the already-bound current workspace name for backward RPC compatibility instead of asking the user to type it again. Ordinary tenant writes take a shared per-store transaction lock. The atomic close RPC takes the exclusive lock, waits for in-flight writes, rechecks live order/balance/custody blockers, consumes the preflight-bound AAL2 challenge, moves `active -> closing`, sets an immediate access cutoff and a minimum one-hour archive time, and revokes invitations, invite links, Kiosk sessions, device tokens and pairing codes.

After migration `20260720065246`, the same exclusive lock also checks the private AI request ledger before leaving `active`. Any `state='reserved'` request, including an expired request not yet swept, returns the existing `STORE_LIFECYCLE_BLOCKED` contract with a PII-free `{"ai_usage_reserved":true}` detail and rolls back the complete close transaction. The operator must wait for finalize, pre-dispatch release or stale settlement, then repeat a fresh preflight/close attempt. The close flow must never force-delete or ignore an unresolved reservation.

During `closing` and `archived`:

- ordinary browser writes fail when lifecycle enforcement is on;
- invite claims and Kiosk public operations fail at their own server/SQL boundaries;
- offline order replay rechecks lifecycle immediately before hashing and RPC execution;
- export and purge workers enforce their own exact phase, lease, hold and proof gates.

The archive worker performs `closing -> archived` only after the drain. Restore supports `closing/archived -> active` with a new one-use challenge and revision, but never reactivates old invites, Kiosk tokens or pairing codes.

## P4 export and restore proof

The live catalog includes:

- root `stores` row scoped by `id`;
- every public base table with UUID `store_id`, including indirect-FK tables such as `order_attachments` and `order_data_batch_rows`;
- memo rollout adds `store_memos` and `store_memo_operation_receipts`; their RESTRICT dependency requires receipts before memos, and verified full purge must leave neither memo nor order revision rows recreated by DELETE triggers;
- `repairdesk_authenticated_rate_limits` is a PII-free fixed-window infrastructure table without `store_id`; it expires independently and is intentionally outside tenant export/restore/purge manifests;
- stable primary-key ordering for deterministic row hashes;
- `store_lifecycles`, but not transient challenge/preflight/operation/export/purge job tables that would make a restore self-referential.

Storage export is allowlisted to the three RepairDesk attachment/evidence buckets and only accepts paths under `<store UUID>/`. Each object records bucket, path, size, content hash and metadata hash.

The encrypted sink must return opaque durable references, a KMS/key reference without credentials, and the complete artifact SHA-256. Completion persists database, Storage and artifact hashes. A purge cannot be scheduled until an isolated restore produces exact table/object manifests, no mismatches, a `store_read` smoke check and a durable restore proof.

## P5 purge flow

1. Scheduling requires archived phase, current eligible preflight, released holds, a `restore_verified` export, recent AAL2 challenge, immutable operation ID, approval-reference hash and future `purge_after`.
2. A worker claims only due queued/retry jobs with `FOR UPDATE SKIP LOCKED` and a short renewable lease.
3. Before destructive work it rechecks phase, restore proof and holds, then records an other-tenant row-count guard hash.
4. It deletes only allowlisted UUID-prefixed Storage objects through the Storage API, checkpoints batches and proves zero objects.
5. It runs the leased database preparation step. The known buyback agreement/attachment RESTRICT cycle is broken only by nulling the target store's nullable reverse `agreement_id` edge.
6. It deletes catalog tables in child-before-parent order, using target `store_id`, bounded batches and lease renewal.
7. It proves every catalog table has zero target rows and the other-tenant guard is unchanged.
8. Completion requires the three export hashes, restore proof and zero proof, writes a non-PII tombstone, clears control-plane rows and deletes `stores` last.

Failure writes a durable failed checkpoint and moves the job to retry. A retried job may start from lifecycle `purging` without incrementing the lifecycle revision again. Storage and row deletion are idempotent, so the worker safely replays completed portions.

## Local verification evidence

The six migrations were applied in order to an isolated PostgreSQL 17 RepairDesk validation database and then to the linked production project after an exact six-file dry-run.

Observed schema checks:

- Isolated baseline: 37 deterministic export tables and 35 purge tables.
- Applied production schema: 39 export tables and 37 purge tables; dynamic discovery incorporated the newer employee-invite/order-cost store-scoped tables.
- zero unhandled public RESTRICT/NO ACTION child tables outside the purge catalog.
- the buyback agreement/attachment cycle has an explicit target-UUID cycle-break step.
- service role has only the required control-table delete grants; `anon` and `authenticated` receive no lifecycle table or function access.
- only the six-argument export completion RPC remains, and durable DB/Storage/artifact hash columns exist.
- lifecycle PL/pgSQL functions pass `plpgsql_check` with zero findings.
- a rollback-only synthetic `service_role` transaction passed `rename -> closing -> restore`, consumed all three AAL2 challenges, reached revision 4, disabled the non-owner member on close and did not reactivate that member on restore.

Final local quality evidence:

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test -- --run`: 238 files and 1578 tests passed on latest `origin/main` integration.
- `npm run build`: passed; 24/24 static pages generated.
- `npm audit --omit=dev --json`: 0 production vulnerabilities.
- mobile Settings Playwright flow: passed at 390x844, with no horizontal overflow; evidence is `screenshots/store-lifecycle-actions-mobile.png`.

AI fence forward-repair evidence (`TASK-20260720-006`):

- PostgreSQL 17 applied the two existing AI governance migrations and `20260720065246` twice, then passed real order/vision reserve, finalize, release, stale settlement, global identity and lifecycle assertions.
- Two database sessions covered both lock orders: reserve-first kept lifecycle `active/revision 1` and rejected close; close-first committed `closing/revision 2` and rejected reserve with no global/store/actor/request half-write.
- Production preflight found zero open reservations, zero non-active-store reservations and zero expired reservations.
- Owner approved and linked apply added exactly `20260720065246`; both expected trigger bindings, function ACLs, RLS and browser grants passed postcheck, and the final dry-run reports the remote database is up to date.
- One non-PII order-text canary returned HTTP 200 with one provider attempt and `130 micro-USD` settlement; 15 minutes / 16 polls remained at zero open, bad, cross-store, reserved, overrun and runtime-error thresholds.

The disposable validation database and transaction script were removed after the rollback proof.

Production post-apply checks: 7 stores / 7 active lifecycle rows / 0 missing; 0 lifecycle tables without RLS; 0 browser table or function grants; 26 lifecycle functions; 1 initialization trigger; 0 export/purge jobs; 0 non-UUID purge `store_id` tables; 0 unhandled RESTRICT/NO ACTION edges; linked public-schema error-level lint passed.

## Linked release checks

Before any production apply:

1. Confirm the exact Supabase project ref and current Git commit/branch.
2. Compare linked migration history and run a linked dry-run.
3. Review the seven existing lifecycle migration-history entries plus the exact new repair, grants, RLS, trigger coverage and function owners.
4. For the AI compatibility repair, confirm `reserved=0`, non-active-store `reserved=0` and expired `reserved=0`; obtain Owner approval for exactly `20260720065246`, then apply without changing lifecycle or AI flags.
5. Verify the AI usage-bucket trigger is bound to `repairdesk_enforce_ai_usage_bucket_store_write`, the lifecycle transition trigger is bound to `repairdesk_block_store_transition_with_reserved_ai_usage`, and neither trigger function is executable by `anon` or `authenticated`.
6. Apply other lifecycle changes with all lifecycle flags off.
7. Verify lifecycle backfill:

```sql
select phase, count(*) from public.store_lifecycles group by phase;

select count(*) as stores_without_lifecycle
from public.stores store_row
left join public.store_lifecycles lifecycle on lifecycle.store_id = store_row.id
where lifecycle.store_id is null;
```

8. Confirm `anon`/`authenticated` have no control-table grants and lifecycle/purge RPC execution is `service_role` only.
9. Enable enforcement first and exercise browser GET/POST, direct database, invite, Kiosk, offline and background rejection paths while mutations remain off.
10. Only after enforcement proof, enable mutations on a disposable non-production store and run P0, rename, close, context switch, unknown-result lookup and restore.
11. Configure and test a real encrypted sink and isolated restore before enabling export proof for a real target.
12. Require a new exact Owner approval before scheduling any purge.

## Target warning

The earlier read-only preflight for the label `china tech noto` used a UUID ending `5311` and found open orders, an unsettled balance and a device in shop custody. Those values are time-sensitive and cannot be reused for `ChinaTech`, `Chinatech siracusa`, or any other screenshot label. A future action must start from a fresh UUID-bound preflight.

## Rollback and incident rules

- With flags off, the additive schema may remain dormant; do not drop it during an incident.
- Rename rollback is a forward audited rename.
- Close/archive rollback is the formal restore RPC; revoked credentials are reissued, never revived.
- Stop export/purge workers by turning off their exact flags and preserve job/checkpoint evidence.
- Contract v3 adds the missing bypass, bound to the exact store UUID, job UUID, worker ID, destructive-step marker and unexpired lease. The current application guard requires contract v4 because the existing v3 completion path is incompatible with the retained purge-request ledger (`ON DELETE RESTRICT`) and there is no independent D4 background-runner approval. Keep purge scheduling and worker flags off until a forward v4 migration, application code, disposable-store proof, sink/restore review and independent D4 approval have all passed.
- Once a purge deletes Storage or rows, there is no business rollback. Recovery depends on the already verified encrypted export, so a production purge is always a separate R4 approval.
