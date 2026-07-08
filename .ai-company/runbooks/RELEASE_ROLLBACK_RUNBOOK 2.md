# Release and Rollback Runbook

## Release readiness

- Task acceptance, QA, security, data, and documentation gates are complete.
- Artifact version/digest and target environment are explicit.
- Configuration and secrets are present through approved channels.
- Dependencies, quotas, capacity, monitoring, support, and incident owner are ready.
- Rollback/forward-repair is rehearsed or its limits are formally accepted.

## Progressive delivery

1. Deploy to preview/non-production and verify critical journeys.
2. Release to internal/canary cohort.
3. Observe technical and business indicators for a defined window.
4. Increase exposure only when thresholds pass.
5. Keep feature flags and old compatibility path until confidence is sufficient.

## Health indicators

Include, as applicable: error rate, latency, saturation, queue depth, data
invariants, authorization failures, payment/transaction success, user completion,
customer support volume, and external dependency health.

## Rollback decision

Rollback or halt when thresholds are exceeded, the target artifact/environment is
wrong, data integrity is uncertain, or monitoring is unavailable. Do not continue
merely to finish the rollout.

## After release

- Verify real end-to-end behavior and audit logs.
- Record artifact, operator, approval, start/end time, cohort, metrics, incidents,
  migrations, and rollback status.
- Update release/platform memory and close the task only after observation.
