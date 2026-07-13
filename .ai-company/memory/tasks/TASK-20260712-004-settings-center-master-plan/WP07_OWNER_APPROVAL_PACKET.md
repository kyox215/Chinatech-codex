# WP-07 Owner Approval Packet — Production Apply and Retention

Status: decision_required_before_release
Prepared: 2026-07-13 CEST
Scope: future production enablement only

This packet records blocked decisions. It does not request or imply approval to run a migration,
touch production data, enable a flag, push, or deploy.

## Decision 1 — Initial workflow and warranty semantics

The existing batch Apply RPC hardcodes `status = new`, `workflow_status = intake`, and a six-month
warranty. Normal order creation uses runtime status configuration and the current store default.
Warranty changes also need reason/actor/timestamp audit fields.

Owner decision needed:

- approve one authoritative creation/default-warranty contract for both normal and imported orders;
- approve required audit metadata and customer-facing warranty behavior;
- approve an additive migration/RPC revision only after historical compatibility evidence.

Recommended default: keep Apply off and make the RPC reuse the same server-side resolver used by
normal order creation rather than copying constants into SQL.

## Decision 2 — Maximum Apply size

Parsing/preview supports 10,000 orders and 50,000 repair items locally, but that is not proof that one
production transaction can safely apply 10,000 rows.

Owner decision needed:

- choose a lower synchronous cap after database load testing; or
- approve a resumable background-job architecture with per-batch progress, idempotency, cancellation,
  monitoring, and recovery.

Recommended default: start with a measured lower synchronous cap and reject larger files until a
separate background workflow is designed.

## Decision 3 — Retention and deletion operations

Preview expiry prevents later Apply but does not delete staged PII on a clock. Current cleanup runs
only when another preview is created.

Owner/legal/data decisions needed:

- retention duration for preview rows, batch metadata, audit summaries, and exported files;
- scheduler and execution owner;
- monitoring, alert thresholds, manual retry, and deletion evidence;
- GDPR/user-facing wording and exceptional legal-hold behavior.

Recommended default: no production upload until an explicit scheduler, daily failure alert, bounded
retry, and operator verification query are approved and tested.

## Decision 3A — Upload and resource governance

The application rejects an XLSX after parsing when `file.size` is over 4 MB and bounds ZIP contents,
rows, and cells. The HTTP route only performs an early rejection when a trustworthy
`Content-Length` is present; chunked or missing-length requests still reach `request.formData()`.
Repeated primary-owner requests can also consume shared CPU, memory, database, and cleanup capacity.

Owner/platform decisions needed:

- choose and verify a streaming body hard limit at the actual production ingress;
- define per-user/per-store rate, concurrency, daily-volume, timeout, and observability controls;
- define safe cleanup and status repair for abandoned `building` export batches.

Recommended default: keep export/preview disabled until the deployed ingress and application have
measured hard limits and alerts; do not treat the browser file check as a server resource boundary.

## Decision 4 — Bulk-write impact and recovery evidence

The current preview lists target fields and the existing rollback function is conflict-aware, but
the Settings UI does not expose a reviewed before/after contract for every write.

Owner decision needed:

- minimum before/after evidence required before confirmation;
- whether new-order recovery remains manual or needs an approved reversible state;
- who may run rollback, how it is audited, and when customer communication is required.

Recommended default: retain primary-owner-only access and require a downloadable impact report plus
an audited rollback runbook before Apply can be enabled.

The future database revision must also stage the batch header and all rows atomically. A row-insert
failure must not leave a `previewed` batch that contains only the earlier chunks.

## Decision 5 — Release authorization

After Decisions 1–4 are implemented and independently reviewed, a separate release approval must
authorize the exact migration, linked dry-run/apply/post-check, environment flags, production smoke,
observability window, rollback trigger, push, and deployment.

Until then:

- `ORDER_DATA_EXPORT_ENABLED` remains default-off and may be evaluated separately from Apply;
- `ORDER_DATA_APPLY_ENABLED` remains `0` in every real environment;
- local screenshots and mock E2E are UI evidence only, not production database proof.
