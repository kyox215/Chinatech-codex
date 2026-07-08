# Database Migration Runbook

## Before design

- Verify the real schema, migration framework, database engine/version, data
  volume, traffic pattern, replication, backup, and recovery owner.
- Identify invariants, tenant boundaries, audit requirements, and application
  versions that must coexist.

## Preferred sequence: expand → migrate → contract

### Expand

1. Add backward-compatible tables/columns/indexes.
2. Avoid long blocking operations; use online/concurrent features when supported.
3. Deploy code that can read old and new state safely.
4. Add observability and feature flags.

### Migrate

1. Use idempotent, resumable batches with durable cursors.
2. Throttle by database health and replica lag.
3. Isolate malformed rows and record counts.
4. Run invariant and reconciliation queries after each batch.
5. Keep the old path until success thresholds and observation window pass.

### Contract

1. Stop old writes and verify no old application version remains.
2. Enforce new constraints only after data validates.
3. Remove old fields/indexes in a separate approved release.
4. Retain recovery evidence and update schema documentation.

## Required evidence

- migration SQL/code review;
- execution plan or equivalent;
- representative-volume rehearsal;
- before/after row and invariant counts;
- lock/latency/replication observations;
- verified backup/restore path;
- rollback or forward-repair limits.

## Stop conditions

Stop on lock growth, error threshold, invariant mismatch, replica lag, unexpected
row counts, application errors, or inability to recover. Production execution is
a separate approval from writing migration code.
