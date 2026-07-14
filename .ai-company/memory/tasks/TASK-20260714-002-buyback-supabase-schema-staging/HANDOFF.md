# Handoff — TASK-20260714-002-buyback-supabase-schema-staging

## Current state

- Status: closed; scoped production schema-staging PASS.
- Workspace: `/private/tmp/repairdesk-buyback-feature-off-20260714`.
- Production target: Supabase `xluzcoduqsdvjoouqhkc`.
- Applied write: dormant schema migration `20260712150000` only.
- Runtime enable, grants, Storage uploads and real finalize remain prohibited.

## Immediate next action

No action is required for this closed staging task. A future enable task must separately approve and
implement retention/cleanup, legal text, immutable agreement access, tenant-safe foreign keys, real
Storage authorization and concurrent finalize tests before granting any runtime access.

## Stop conditions

- any role receives agreement-table DML or finalize RPC EXECUTE before an approved enable migration;
- agreement rows or evidence-bucket objects appear while feature-off remains active;
- a future dry-run tries to reapply or repair `20260712150000`;
- retention/legal/cleanup gates are bypassed or the six-step sensitive UI is restored without Owner approval.
