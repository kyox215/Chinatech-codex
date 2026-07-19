# Incident Statement

- Commander: IntegrationLead
- Severity: SEV-3 — authorized staff query returns an irrelevant order card; no write/data corruption and no cross-store evidence.
- Reported: 2026-07-19 around 10:58 CEST from production mobile screenshot.
- Affected flow: ChinaTech employee AI order search by device brand/model.
- Observed: input `苹果15`; result count 1; returned device `SAMSUNG A12`.
- Known safe state: assistant is read-only; result remains within current authorized store; no mutation occurred.
- Unknown: exact provider tool arguments are intentionally absent from privacy-safe audit logs.
- Working hypothesis: planner reduced the device phrase to short numeric search `15`; generic repository search allows short digits to match phone/IMEI, producing a false positive.

## Immediate containment

No production kill switch applied: impact is limited to incorrect read results, manual order search remains available, and disabling the live assistant would remove unrelated working queries. No production data or configuration will be changed during diagnosis.

## Recovery gate

Require deterministic reproduction, exact regression proving Apple-only result, no identifier fallback, full app gates and Owner approval before production release.
