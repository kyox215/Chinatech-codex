# Store Lifecycle P0-P5 Implementation Runbook

Last updated: 2026-07-20

## Current release boundary

P0-P5 has a verified implementation path. Its first six additive migrations were applied to linked project `xluzcoduqsdvjoouqhkc`, and implementation commit `55cb7ab5a928b67daf4856e80486f2ccec5fbd59` was fast-forward pushed to `main` on 2026-07-18. The seventh forward-only migration defines lifecycle contract v2, the database writer fence and live close-blocker recheck and is now present in production history. That generic fence exposed a mixed-scope compatibility defect in the AI usage bucket table; an eighth forward repair is locally verified and explicitly approved, but not yet production-applied. This does **not** authorize a production store mutation, worker activation or permanent purge.

| Phase | Implemented and locally verified                                                                                                                                                            | Production gate still required                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| P0    | Primary-owner-only immutable UUID preflight; PII-free row counts, financial/custody/Kiosk/invitation blockers, Storage summary, revision-bound snapshot                                     | Re-run against the exact linked project and target UUID                                                    |
| P1    | Structured order-data access reason codes and Settings explanation                                                                                                                          | Keep order-data export/apply permissions and flags unchanged unless separately approved                    |
| P2    | Recent TOTP/AAL2 challenge issuer, one-use challenge, primary-owner-only atomic full workspace rename, revision CAS, idempotency, audit, Settings UI                                        | `STORE_LIFECYCLE_MUTATIONS_ENABLED` remains off until migration and release approval                       |
| P3    | Atomic close, one-hour drain, archive finalizer, restore, invitation/Kiosk revocation, ordinary API/Kiosk/invite/offline write gates, Settings UI, and pending AI-reservation close barrier | Apply and verify the exact AI fence repair before relying on the reservation close barrier                 |
| P4    | Catalog-driven database and UUID-prefixed Storage export, deterministic DB/Storage/artifact hashes, encrypted sink contract, isolated restore comparison and durable proof                  | Select and approve the real encrypted sink/KMS, retention, access logging and isolated restore environment |
| P5    | Approval-locked schedule, leased/resumable worker, Storage-first deletion, FK ordering and cycle break, checkpoints/retry, other-tenant guard, zero residual proof and non-PII tombstone    | Purge scheduling and worker flags remain off; exact target and second irreversible approval are mandatory  |

There is deliberately no browser permanent-delete button. The browser can rename, request reversible close and restore only when the mutation flag is enabled and recent TOTP succeeds. Export and purge run through service workers.

## Migration order

Applied after linked dry-run approval, in this exact order:

1. `20260717195346_store_lifecycle_control_plane.sql`
2. `20260717195516_store_lifecycle_atomic_operations.sql`
3. `20260717195519_store_lifecycle_export_purge_framework.sql`
4. `20260717201728_store_lifecycle_transition_operations.sql`
5. `20260717201729_store_export_restore_proof.sql`
6. `20260717201730_store_purge_executor_control.sql`
7. `20260720013000_store_lifecycle_business_fence_and_close_recheck.sql`
8. `20260720065246_ai_usage_bucket_store_fence_hotfix.sql` — locally verified forward repair; not yet applied

The chain is additive until a separately approved purge job reaches its final worker steps. The sixth migration contains deletion RPCs, but they are callable only by `service_role`, require an approved/leased job and remain unreachable while purge flags are off.

## Feature flags

All flags use exact value `1`; unset, `0`, `true`, or any other value is off.

- `STORE_LIFECYCLE_ENFORCEMENT_ENABLED`: rejects ordinary browser writes for non-active lifecycle phases.
- `STORE_LIFECYCLE_MUTATIONS_ENABLED`: enables challenge, rename, close, restore, archive and export preparation application paths.
- `STORE_LIFECYCLE_EXPORT_WORKER_ENABLED`: permits the complete export/restore-proof worker.
- `STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED`: permits second-approval purge scheduling.
- `STORE_LIFECYCLE_PURGE_WORKER_ENABLED`: permits the destructive background worker.

Release order is migration first with every flag off, then application deploy with every flag off, read-only verification, **enforcement rollout**, active-store regression and closing-store rejection proof, and only then mutation rollout on a disposable test store. The application also refuses mutations unless both flags are on and the database reports lifecycle contract version 2. Export proof and purge remain separate later approvals. Never enable all flags at once.

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
- Production read-only preflight found zero open reservations, zero non-active-store reservations and zero expired reservations.
- Linked history aligns through `20260720013000`; dry-run lists only `20260720065246`. These checks do not authorize apply.

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
- The v2 generic writer fence intentionally does not include a purge-worker bypass. Keep purge scheduling and purge worker flags off until a separately reviewed forward migration adds a lease-bound bypass.
- Once a purge deletes Storage or rows, there is no business rollback. Recovery depends on the already verified encrypted export, so a production purge is always a separate R4 approval.
