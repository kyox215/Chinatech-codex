# Stage 00 — Baseline and Execution Contract

Status: completed

## Goal

Freeze the latest safe baseline, verify Phase 1, define interfaces and stage gates, and preserve unrelated work before business-code writes.

## Deliverables

- Isolated branch/worktree from current `origin/main`.
- Verified Phase 1 schema, permissions, APIs, UI and production evidence.
- Product definitions for expected versus realized gross repair margin.
- Architecture/data/security/UX option review and accepted design.
- File-impact map, feature flags, migration order and rollback boundary.
- Independent read-only FLOW/UX/Architecture, DATA/SEC and QA/Release reviews.

## Validation

- `git status --short --branch` is clean before implementation.
- Phase 1 task and migration evidence exists and matches source.
- No unresolved interface or permission question changes the business result.
- Every later stage has a Markdown contract and measurable exit criteria.

## Exit criteria

- Task contract, work packages, ownership and approval boundaries are recorded.
- Architecture decision is accepted by the Integration Lead.
- A checkpoint records the exact baseline SHA and next first write.

## Accepted architecture decision

- Baseline: `origin/main@0c474318512f98827000ef6ab1755843bc9b8d8d` after the desktop
  virtual-keyboard release was serialized into `main`.
- Compatibility boundary: keep `repair_order_line_costs` as the Phase 1 current EUR
  projection and add append-only revisions. Existing order DTOs and Phase 1 cost APIs
  remain compatible.
- Cost truth: unknown is not zero; defaults and inference are estimated; manual evidence
  and confirmed purchase lots are confirmed. Historical corrections append compensating
  records instead of deleting evidence.
- Profit language: ship `预计维修毛利` and `已完工报价毛利`. Keep collections as a
  separate cash-reference metric. Do not claim refund-adjusted realized or accounting
  profit while `order_payment_ledger` only models positive collections.
- Procurement boundary: do not extend the resale-device `inventory_items` model. Use a
  private spare-part catalog, purchase lots and line allocations linked by same-store keys.
- Currency boundary: quotes, payments, the current cost projection and reports remain EUR.
  Original purchase currency and the conversion rate are immutable source snapshots.
- Backfill boundary: deployment may expose preview/apply/revert tooling, but it must not
  apply production candidates automatically. Pre-Phase-2 defaults cannot be reconstructed
  and must not be treated as confirmed history.
- Report architecture: bounded service-side aggregation first; introduce rebuildable daily
  rollups only after production volume and query-plan evidence crosses a documented threshold.
- Feature flags: profit reports, procurement, export, backfill and cost multi-currency are
  independent, exact-value `"1"`, default-off children of `REPAIRDESK_ORDER_COSTS_ENABLED`.

## Independent review record

- FLOW / UX / Architecture: `019f720b-283f-7591-9e66-408042c665b0` — accepted the
  projection-plus-ledger boundary and identified the refund-ledger naming limitation.
- DATA / SEC: `019f720b-48a1-7dc2-a6ed-567b9e099ea2` — accepted additive local work;
  required same-store keys, service-role-only RPCs, append-only audit evidence and a fresh
  recovery gate before linked apply.
- QA / Release: `019f720b-6f58-7000-81a0-d9d8163e5064` — required pgTAP behavior tests,
  cost-specific E2E screenshots, CSV-injection cases and serialized release evidence.

## Validation evidence

- Phase 1 focused baseline: 7 Vitest files / 49 tests passed.
- Isolated worktree rebased from `4e51422c` to `0c474318` after the parallel release reached
  `origin/main`; no business-code write preceded the rebase.
- All later work packages define validation, exit and rollback criteria; export and backfill
  have separate substage checkpoints.

## Open production gates

- `OPEN_CONFLICTS.md` still classifies broad production database work as NO-GO until
  migration recovery baseline, legacy-consumer review and restore proof are current.
- Production Git, DB and deployment operations require the serialized release lock and a
  fresh remote re-read immediately before writing.
- These gates do not block additive local implementation and local verification. They are a
  hard stop for Stage 07 if they remain unresolved.

## Stop conditions

- Latest remote does not contain the shipped Phase 1 foundation.
- The isolated worktree is contaminated by another task.
- A required production fact cannot be safely separated from local implementation.
