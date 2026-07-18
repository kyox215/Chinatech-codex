# Department Memory Sync — TASK-20260718-012

## Changed departments

- **DATA:** recorded the exact no-DML migration apply, held Inventory V2 migrations, V2 activation ordering and lifecycle purge retry-baseline blocker.
- **Security:** recorded unchanged RLS/policy/ACL, default-off/ungranted V2 boundary and the purge retry-baseline activation stop.
- **QA:** recorded the full/focused/formal verification story and assigned the baseline-reproducible locator failures as separate debt.
- **Operations:** recorded non-force latest-main integration, exact-SHA READY deployment, rollback boundary, source-checkout preservation and V2 runbook ordering.
- **Documentation:** recorded the Inventory V2 runbook as the authority separating deployed code from production activation.

## No department-rule change

- Architecture, Product and Frontend received release evidence but no new architecture, organization mission or UI standard was approved; their existing boundaries remain unchanged.
- No permission or autonomy level changed. Production migration/RPC/flag actions remain Owner-gated.

## Cross-department contract

DATA provides an exact linked dry-run and migration manifest; Security reviews grants/RLS/feature containment; QA proves focused plus baseline-attributed regression; Operations owns serialized apply, SHA/deployment and rollback; Documentation keeps code-present versus feature-active status explicit. Any mismatch stops the release and returns to the latest verified checkpoint.
