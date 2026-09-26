# Sales daily workflow release evidence

Task: `TASK-20260926-010-sales-daily-workflow`; user explicitly authorized implementation and production deployment.

## Candidate and target

- Isolated branch `codex/sales-daily-workflow`; initial base `dcd9231671d7df0f57de3b2ae981114f3e944f9d`. Canonical dirty checkout is not staged or deployed.
- GitHub `kyox215/Chinatech-codex`; application `www.chinatech.in` / Vercel project `prj_FZoMRZoHsRNALz4ahEVGaXAxHOFS`.
- Supabase `xluzcoduqsdvjoouqhkc` (ChinaTech_date), PostgreSQL 17.6. Migration is additive, no backfill or change to existing sale/payment/warranty facts.
- User scope: single-device sale, existing external fiscal register, manual exception handling; refunds and return execution deferred.

## Preflight and recovery

Read-only production preflight on 2026-09-26: sale orders 0, payment entries 0; relation sizes 57,344 / 49,152 bytes. New workflow table absent. Required membership-grant table, append-only helper and inventory-revision helper present. No production customer data read or copied.

The two existing-table indexes therefore have no business rows to scan at preflight. Migration lock timeout 5 seconds / statement timeout 60 seconds; timeout means stop and inspect, not retry without diagnosis. Empty new tables need no backfill. Migration is transactional. No production restore drill is claimed. Existing tables/functions are preserved; the recovery plan retains all new data.

Order: finish checks and independent review → create reviewed PR/preview → apply only this additive migration → verify ACL/schema → merge exact checked revision → verify Vercel READY/alias/SHA and unauthenticated endpoint boundaries. Existing sales rollout allowlist and flags remain in effect.

Application rollback: restore the immediately preceding verified production deployment while retaining additive schema. If workflow RPCs require disabling, use a reviewed recovery migration to revoke service_role execution on the three new workflow RPCs. Never drop tables or erase events. Existing sale functions retain compatibility. Stop for failed permissions/CAS, migration error, unresolved CI failure, unexpected alias/SHA, repeated route 5xx or changed transaction totals.

## Independent security/data review

Read-only reviewer `sales_release_review` examined migration, BFF/contracts, transaction/follow-up/report UI, tests and source hashes. No confirmed P0/P1 blockers. Verified service-only RPCs, authoritative active-store/member/staff authorization, same-store foreign keys, finance grants, permission before replay, CAS/lock order, immutable events, atomic revision, and Rome date semantics. Reviewer did not modify code or operate production.

Residual scope: synthetic bootstrap is not full production schema parity; deployment checks and live read-only validation remain separately required. No security exceptions accepted.

## Verification recorded before integration

- PG17: 81 pgTAP assertions pass, plus independent-session CAS and same-key races; final effects exactly one per accepted command. Migration/test hashes in `backend/source-sha256.txt`; logs retained locally in `backend/`.
- Backend contracts/repository/router: 37 focused tests passed.
- UI: 18 tests passed before additional refresh-failure regression.
- Chromium: 10 tests passed, 390/430/768/1024/1280/1440, zh/en/it, iPad orientation, deposit → balance → handover → historical receipt, and fiscal/follow-up/issue/report workflows. Synthetic screenshots in `browser/`.
- Full Vitest initial run: 5,170 passed, one 5-second timeout in existing product access test during parallel checks. That entire file was rerun unchanged: all 57 passed. No assertion or timeout relaxed.
- ESLint initial full run passed; risk coverage 34 tests passed and thresholds met.
- Final typecheck/build and post-integration checks are recorded below when completed.

## Documentation impact

- New operator/API guide: `docs/PRODUCT_SALES_DAILY_WORKFLOW.md`.
- Original sales component/release docs link to the new guide, preserving original monetary and warranty contracts.
- Database test README contains reproduction, authorization, report semantics, migration/recovery limits.
- No navigation page or dependency change; existing item list/detail entry points reused.
