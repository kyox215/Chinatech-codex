---
schema_version: 1
current_task_id: "TASK-20260706-001-realtime-updates-execution"
status: "active"
phase: "local_slice_9f_service_contract_complete"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
last_checkpoint_at: "2026-07-07T10:47:09Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**TASK-20260706-001-realtime-updates-execution**

## Current state

Slice 9F-A local offline sync service contract is complete after DATA/SEC/QA read-only review. Added `src/features/offline/server/offline-sync-service.ts` and tests, exported 9E contract types, and removed `parts_supplier_id` from the first offline update allowlist. The new service is local-only and uses injected ports for operation claim/finalize, relationship validation, update target validation, and business write execution. It does not register router paths, import Supabase, call broad online order APIs, use `auditGeneric`, queue realtime, or wire runner network sync. Verification passed: service tests 1 file / 13 tests, contract+service tests 2 files / 27 tests, targeted regression 4 files / 40 tests, full `npm run test` 74 files / 478 tests, `npm run typecheck`, scoped lint, diff check, and `npm run build` after escalated rerun. No real offline route, business write, production migration, deploy, push, feature flag enablement, or customer-facing sync.

## Blocking decisions

- Production outbox sync, server idempotency schema application, Supabase migrations, deploy, push, Sensitive Vault value storage, attachment staging/upload, mobile quick-action autosave, WhatsApp/SMS/payment/status automation, realtime invalidation from offline sync, and any destructive or customer-facing offline operation remain approval-gated or not implemented.
- Full Slice 9 network sync remains blocked until Owner approval plus RPC/transaction-first implementation or separately reviewed lock/recovery strategy, actual operation table persistence, real narrow offline sync routes, role/store/object ownership checks against database rows, customer/device relationship resolver, duplicate-customer review, stale conflict handling, generic error response mapping, redacted audit logging, and relationship/conflict/security tests are implemented and verified.
- Do not reuse broad online `orders/create`, `order/update`, or `order/patch` as the offline sync API.

## Next action

Plan Slice 9G. Preferred path: produce the RPC/transaction design and local SQL/RPC draft, or stop for Owner approval before database implementation. If implemented locally, keep it un-applied and cover operation row claim/finalize, customer/device/order/event atomicity, stale `started` recovery, rollback behavior, and no raw audit/operation payloads. Keep runner-to-server sync, production migration, deploy, push, Sensitive Vault value sync, attachments, realtime invalidation, payment/message/status automation, and customer-facing sync disabled.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260706-001-realtime-updates-execution/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
