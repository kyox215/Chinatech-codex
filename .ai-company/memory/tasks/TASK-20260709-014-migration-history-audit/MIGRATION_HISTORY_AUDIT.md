# Migration History Audit

## Executive Summary

Read-only audit result for Supabase project `xluzcoduqsdvjoouqhkc`:

- Latest clean local baseline used for closeout: `origin/main` at `332b9a43`.
- Local migration files on that baseline: 45.
- Remote migration history from `supabase migration list --linked`: 20 versions.
- Local versions absent from remote history: 25.
- No production DDL, data writes, migration apply, or migration repair was run.

Do not run `include-all` or batch `migration repair --status applied`. The 25 versions are mixed: several objects already exist remotely, several are only partially covered by later repair/reconcile migrations, and a few important items are missing.

## Remote History Drift

The 25 local-only versions are:

| Version | File | Summary | Remote classification | Recommended next step |
|---|---|---|---|---|
| 20260610234427 | `buyback_resale_inventory.sql` | Buyback/resale inventory tables, staff profiles, audit logs, inventory events/transactions, RLS grants. | Appears mostly present: core inventory/staff/audit tables exist. History missing. | Do not repair blindly; compare constraints/indexes before marking applied. |
| 20260611001527 | `message_templates_settings.sql` | Store settings and message template tables plus initial seed templates. | Appears present: `store_settings` and `message_templates` exist. History missing. | Per-version schema/data diff before repair. |
| 20260611002831 | `enterprise_multi_store_foundation.sql` | Stores, memberships, invitations, store_id columns, default store membership bootstrap. | Appears present: `stores`, `store_memberships`, `store_invitations` exist. History missing. | Validate tenant constraints and bootstrap data before any repair. |
| 20260611005916 | `harden_store_tenant_constraints.sql` | Hard tenant guardrails, NOT NULL store_id, same-store FKs, unique indexes. | Partially present/missing: key tables exist, but sample same-store FK `repair_orders_customer_same_store_fkey` is missing. | Requires targeted constraint diff and lock-risk plan. |
| 20260611102805 | `repairdesk_remote_schema_compatibility.sql` | Compatibility repair for inventory/message schema expected by current app. | Appears mostly present/covered: inventory and message objects exist. History missing. | Compare columns/defaults/triggers before repair. |
| 20260611103526 | `repairdesk_message_template_legacy_sync.sql` | Trigger/function to keep legacy message template columns synchronized. | Present: function and trigger exist. History missing. | Candidate for repair only after exact definition diff. |
| 20260611125512 | `customer_list_performance.sql` | Trigram indexes and `repairdesk_customer_list_page` RPC. | Present with signature drift: RPC exists with richer filter signature than the local check expected. History missing. | Do not apply old SQL; compare function definition and decide repair/update separately. |
| 20260611202504 | `repairdesk_canonical_order_status.sql` | Canonical repair order workflow/payment/parts/notify status columns and indexes. | Partially present likely: order contract columns exist through later compatibility work; history missing. | Verify constraints/indexes and app contract before repair. |
| 20260613113000 | `repairdesk_order_contract_compat.sql` | Repair order app-contract compatibility columns, warranty/device snapshot/indexes. | Partially present likely: current contract columns appear available through later state. History missing. | Targeted diff only. |
| 20260613122452 | `order_attachments.sql` | Order attachments bucket/table/index/RLS. | Present/covered: order attachment bucket and table exist. History missing. | Compare shape because later repair migration may supersede it. |
| 20260617143000 | `inventory_attachments.sql` | Inventory attachments bucket/table/index/RLS. | Present/covered: inventory attachment bucket and table exist. History missing. | Compare shape because later repair migration may supersede it. |
| 20260618171500 | `order_approval_parts_transition.sql` | Adds workflow transition from approval to parts ordered. | Unknown/needs targeted row diff: transition table exists, but one attempted check hit remote column drift. | Inspect `order_workflow_transitions` shape before repair. |
| 20260618172000 | `repaired_workflow_status_repair.sql` | Moves repaired status into repair stage and updates affected orders. | Partially present unknown: workflow status table exists, exact row state not confirmed. | Target workflow row/data diff; avoid replaying updates blindly. |
| 20260619103000 | `order_external_repair_workflow.sql` | Adds external repair workflow rows and order status mapping. | Missing/partial: sampled `external_repair` workflow status is missing. | Candidate for targeted migration/apply after product approval and data impact review. |
| 20260619193655 | `repairdesk_attachment_storage_repair.sql` | Idempotent attachment bucket/table compatibility repair for order/inventory attachments. | Appears present/covered: buckets and tables exist. History missing. | Compare exact table shape and storage policies before repair. |
| 20260620120000 | `customer_interactions_store_id_repair.sql` | Adds/backfills `customer_interactions.store_id` and index. | Present: `customer_interactions.store_id` exists. History missing. | Candidate for repair after index/constraint verification. |
| 20260701120000 | `order_device_unlock_credentials.sql` | Adds device unlock method/value/pattern columns and validation function/checks. | Present: columns and validation function exist. History missing. | Candidate for repair only after exact constraint diff. |
| 20260704190000 | `private_store_onboarding_requests.sql` | Adds private-store onboarding request columns/constraints/indexes. | Present/covered: target owner columns exist, likely through later reconcile. History missing. | Later `20260708140001` is remote applied; compare whether this should remain unrepaired. |
| 20260704203000 | `onboarding_owner_email_routing_hardening.sql` | Lowercase owner-email routing, private join routing constraints/indexes. | Present/covered by later reconcile likely. History missing. | Treat as superseded/partial; do not apply without diff. |
| 20260704212000 | `onboarding_approved_role_and_cancel.sql` | Adds `approved_role` and prevents owner role approval. | Present/covered: `approved_role` exists. History missing. | Likely covered by remote-applied reconcile; compare before repair. |
| 20260704220843 | `store_invitations_non_owner_role.sql` | Adds `role` to store invitations and blocks owner invitation role. | Present: `store_invitations.role` exists. History missing. | Candidate for repair after constraint verification. |
| 20260704221944 | `store_invite_links.sql` | Store invite link tables, attempt table, indexes, claim RPC. | Present remotely via `20260708182631`: tables and `claim_store_invite_link` exist. | Do not apply this old version; keep `20260708182631` as remote-aligned version. |
| 20260706133632 | `repairdesk_realtime_private_broadcast_authorization.sql` | Realtime private broadcast RLS policy and grants for `realtime.messages`. | Missing: `repairdesk_realtime_store_broadcast_receive` policy is absent. | High-priority targeted apply candidate after dashboard setting and owner approval. |
| 20260707090000 | `repairdesk_offline_operations.sql` | Offline operation idempotency table for replay metadata only. | Missing: `repairdesk_offline_operations` table absent. | High-priority targeted apply candidate before offline sync release; needs secret/rollback plan. |
| 20260707110000 | `repairdesk_offline_order_sync_rpc_draft.sql` | Draft offline order create/update RPCs with transaction boundary. | Missing: offline create/update RPCs absent. | Keep as draft until owner approves offline sync server strategy, HMAC source, backup, and rollback. |

## Safe Next Step

1. Do not run include-all.
2. Split into small per-version work packages:
   - **A. Safe repair candidates:** versions where exact object definitions already match remote.
   - **B. Superseded candidates:** versions covered by later remote-applied reconcile migrations.
   - **C. Apply candidates:** missing objects such as realtime policy and offline operations/RPC, after owner approval.
   - **D. Data-update candidates:** workflow/status migrations that can change existing orders; require product/data approval and backup plan.
3. For each candidate, produce:
   - remote definition diff,
   - lock/performance risk,
   - rollback/compensation plan,
   - exact command plan,
   - owner approval boundary.

## Do Not Do

- Do not mark all 25 as applied based only on table existence.
- Do not apply workflow/data-update migrations in one batch.
- Do not apply the offline RPC draft without secret handling and replay safety approval.
- Do not apply the realtime broadcast policy until the Supabase Realtime private channel dashboard setting is confirmed.
