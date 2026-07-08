# Byte-Identical Duplicate Cleanup Report — TASK-20260619-012

- Task: `TASK-20260619-012`
- Scope: remove currently verified byte-identical untracked ` 2` duplicate files.
- Boundary: no canonical counterpart files, business code, production data, dependencies, staging, commits, pushes, or deploys were changed.
- Status: verified cleanup.

## Executive Result

The deletion-scope SHA-256 scan found:

| Category | Count |
|---|---:|
| Current byte-identical duplicate files | 70 |
| Current now-different duplicate files in original deletion scope | 2 |
| Missing canonical counterparts | 0 |
| Non-file duplicate candidates | 0 |

The 70 byte-identical duplicate files were deleted. A final closeout scan over Git-visible untracked ` 2` files found:

| Category | Count |
|---|---:|
| Current byte-identical duplicate files | 0 |
| Current now-different duplicate files | 3 |

## Deleted Files

| # | Deleted duplicate path | Canonical counterpart |
|---:|---|---|
| 1 | `docs/BUYBACK_RESALE_EXECUTION_PLAN 2.md` | `docs/BUYBACK_RESALE_EXECUTION_PLAN.md` |
| 2 | `docs/ENTERPRISE_MULTI_STORE_TENANCY_PLAN 2.md` | `docs/ENTERPRISE_MULTI_STORE_TENANCY_PLAN.md` |
| 3 | `docs/GPT_PROJECT_REPLANNING_BRIEF 2.md` | `docs/GPT_PROJECT_REPLANNING_BRIEF.md` |
| 4 | `docs/PROJECT_REFACTOR_CONTEXT_EXPORT 2.md` | `docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md` |
| 5 | `docs/PROJECT_REPLAN_FROM_MOBILE_MVP_V1_5 2.md` | `docs/PROJECT_REPLAN_FROM_MOBILE_MVP_V1_5.md` |
| 6 | `docs/PROJECT_UPGRADE_EXECUTION_PLAN 2.md` | `docs/PROJECT_UPGRADE_EXECUTION_PLAN.md` |
| 7 | `docs/REPAIROS_COMPACT_ARCHITECTURE 2.md` | `docs/REPAIROS_COMPACT_ARCHITECTURE.md` |
| 8 | `docs/REPAIROS_MOBILE_DETAIL_STANDARD 2.md` | `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md` |
| 9 | `docs/SEATABLE_RIPARAZIONE_WORKFLOW_PLAN 2.md` | `docs/SEATABLE_RIPARAZIONE_WORKFLOW_PLAN.md` |
| 10 | `public/sw 2.js` | `public/sw.js` |
| 11 | `scripts/ensure-owner-admin 2.ts` | `scripts/ensure-owner-admin.ts` |
| 12 | `scripts/import-seatable-riparazione 2.ts` | `scripts/import-seatable-riparazione.ts` |
| 13 | `scripts/reset-repairdesk-demo-data 2.ts` | `scripts/reset-repairdesk-demo-data.ts` |
| 14 | `src/app/buyback/page 2.tsx` | `src/app/buyback/page.tsx` |
| 15 | `src/app/login/page 2.tsx` | `src/app/login/page.tsx` |
| 16 | `src/app/manifest 2.ts` | `src/app/manifest.ts` |
| 17 | `src/app/offline/page 2.tsx` | `src/app/offline/page.tsx` |
| 18 | `src/app/onboarding/page 2.tsx` | `src/app/onboarding/page.tsx` |
| 19 | `src/app/orders/[id]/task/page 2.tsx` | `src/app/orders/[id]/task/page.tsx` |
| 20 | `src/app/platform/page 2.tsx` | `src/app/platform/page.tsx` |
| 21 | `src/components/mobile-workspace-dock 2.tsx` | `src/components/mobile-workspace-dock.tsx` |
| 22 | `src/components/pwa-service-worker 2.tsx` | `src/components/pwa-service-worker.tsx` |
| 23 | `src/components/ui/multi-select-dropdown 2.tsx` | `src/components/ui/multi-select-dropdown.tsx` |
| 24 | `src/features/buyback/index 2.ts` | `src/features/buyback/index.ts` |
| 25 | `src/features/capture/index 2.ts` | `src/features/capture/index.ts` |
| 26 | `src/features/customers/forms/customer-backup-phones-field 2.tsx` | `src/features/customers/forms/customer-backup-phones-field.tsx` |
| 27 | `src/features/customers/testing/mock-api.test 2.ts` | `src/features/customers/testing/mock-api.test.ts` |
| 28 | `src/features/inventory/api/query-keys 2.ts` | `src/features/inventory/api/query-keys.ts` |
| 29 | `src/features/inventory/import/seatable-electronics 2.ts` | `src/features/inventory/import/seatable-electronics.ts` |
| 30 | `src/features/inventory/import/seatable-electronics.test 2.ts` | `src/features/inventory/import/seatable-electronics.test.ts` |
| 31 | `src/features/inventory/server/inventory.service 2.ts` | `src/features/inventory/server/inventory.service.ts` |
| 32 | `src/features/messages/api/query-keys 2.ts` | `src/features/messages/api/query-keys.ts` |
| 33 | `src/features/messages/model/message-template-defaults 2.ts` | `src/features/messages/model/message-template-defaults.ts` |
| 34 | `src/features/messages/server/message-settings.repository 2.ts` | `src/features/messages/server/message-settings.repository.ts` |
| 35 | `src/features/messages/server/message-settings.service 2.ts` | `src/features/messages/server/message-settings.service.ts` |
| 36 | `src/features/messages/testing/mock-api 2.ts` | `src/features/messages/testing/mock-api.ts` |
| 37 | `src/features/orders/components/accessory-notes-picker 2.tsx` | `src/features/orders/components/accessory-notes-picker.tsx` |
| 38 | `src/features/orders/components/order-contact-menu 2.tsx` | `src/features/orders/components/order-contact-menu.tsx` |
| 39 | `src/features/orders/components/order-option-pickers.test 2.tsx` | `src/features/orders/components/order-option-pickers.test.tsx` |
| 40 | `src/features/orders/components/order-transition-reason-selector 2.tsx` | `src/features/orders/components/order-transition-reason-selector.tsx` |
| 41 | `src/features/orders/components/order-workflow-progress 2.tsx` | `src/features/orders/components/order-workflow-progress.tsx` |
| 42 | `src/features/orders/import/seatable-riparazione 2.ts` | `src/features/orders/import/seatable-riparazione.ts` |
| 43 | `src/features/orders/import/seatable-riparazione.test 2.ts` | `src/features/orders/import/seatable-riparazione.test.ts` |
| 44 | `src/features/orders/model/order-accessory-notes 2.ts` | `src/features/orders/model/order-accessory-notes.ts` |
| 45 | `src/features/orders/model/order-accessory-notes.test 2.ts` | `src/features/orders/model/order-accessory-notes.test.ts` |
| 46 | `src/features/orders/model/order-contact-phones 2.ts` | `src/features/orders/model/order-contact-phones.ts` |
| 47 | `src/features/orders/model/order-finance-draft 2.ts` | `src/features/orders/model/order-finance-draft.ts` |
| 48 | `src/features/orders/model/order-finance-draft.test 2.ts` | `src/features/orders/model/order-finance-draft.test.ts` |
| 49 | `src/features/orders/model/order-transition-reasons.test 2.ts` | `src/features/orders/model/order-transition-reasons.test.ts` |
| 50 | `src/features/orders/model/order-warranty 2.ts` | `src/features/orders/model/order-warranty.ts` |
| 51 | `src/features/orders/model/order-warranty.test 2.ts` | `src/features/orders/model/order-warranty.test.ts` |
| 52 | `src/server/audit 2.ts` | `src/server/audit.ts` |
| 53 | `src/shared/config/navigation 2.ts` | `src/shared/config/navigation.ts` |
| 54 | `supabase/migrations/20260610234427_buyback_resale_inventory 2.sql` | `supabase/migrations/20260610234427_buyback_resale_inventory.sql` |
| 55 | `supabase/migrations/20260610234705_add_customer_contact_phones 2.sql` | `supabase/migrations/20260610234705_add_customer_contact_phones.sql` |
| 56 | `supabase/migrations/20260611001527_message_templates_settings 2.sql` | `supabase/migrations/20260611001527_message_templates_settings.sql` |
| 57 | `supabase/migrations/20260611002831_enterprise_multi_store_foundation 2.sql` | `supabase/migrations/20260611002831_enterprise_multi_store_foundation.sql` |
| 58 | `supabase/migrations/20260611005916_harden_store_tenant_constraints 2.sql` | `supabase/migrations/20260611005916_harden_store_tenant_constraints.sql` |
| 59 | `supabase/migrations/20260611074644_repairdesk_auth_multistore_bootstrap_safe 2.sql` | `supabase/migrations/20260611074644_repairdesk_auth_multistore_bootstrap_safe.sql` |
| 60 | `supabase/migrations/20260611080254_platform_onboarding_approvals 2.sql` | `supabase/migrations/20260611080254_platform_onboarding_approvals.sql` |
| 61 | `supabase/migrations/20260611102805_repairdesk_remote_schema_compatibility 2.sql` | `supabase/migrations/20260611102805_repairdesk_remote_schema_compatibility.sql` |
| 62 | `supabase/migrations/20260611103526_repairdesk_message_template_legacy_sync 2.sql` | `supabase/migrations/20260611103526_repairdesk_message_template_legacy_sync.sql` |
| 63 | `supabase/migrations/20260611125512_customer_list_performance 2.sql` | `supabase/migrations/20260611125512_customer_list_performance.sql` |
| 64 | `supabase/migrations/20260611143348_order_warranty_accessory_rules 2.sql` | `supabase/migrations/20260611143348_order_warranty_accessory_rules.sql` |
| 65 | `supabase/migrations/20260611175701_order_workflow_repaired_bucket 2.sql` | `supabase/migrations/20260611175701_order_workflow_repaired_bucket.sql` |
| 66 | `supabase/migrations/20260613122452_order_attachments 2.sql` | `supabase/migrations/20260613122452_order_attachments.sql` |
| 67 | `supabase/migrations/20260616141938_customer_list_v2_fast_loading 2.sql` | `supabase/migrations/20260616141938_customer_list_v2_fast_loading.sql` |
| 68 | `supabase/migrations/20260617143000_inventory_attachments 2.sql` | `supabase/migrations/20260617143000_inventory_attachments.sql` |
| 69 | `tests/e2e/app-shell.spec 2.ts` | `tests/e2e/app-shell.spec.ts` |
| 70 | `tests/ensure-owner-admin.test 2.ts` | `tests/ensure-owner-admin.test.ts` |

## Preserved Now-Different Duplicates

These three files are not safe for blind cleanup because they now differ from canonical counterparts:

| Duplicate path | Canonical counterpart | Next action |
|---|---|---|
| `.ai-company/README 2.md` | `.ai-company/README.md` | Review governance-package duplicate before delete/merge decision. |
| `src/features/orders/components/warranty-picker 2.tsx` | `src/features/orders/components/warranty-picker.tsx` | Review before delete/merge decision. |
| `src/server/tenant-guard.test 2.ts` | `src/server/tenant-guard.test.ts` | Review before delete/merge decision. |

## Verification

| Gate | Result |
|---|---|
| Fresh pre-cleanup deletion-scope scan | `same=70 diff=2 missing=0 nonfiles=0`. |
| Delete operation | `apply_patch` deleted exactly the 70 byte-identical paths. |
| Final closeout Git-visible scan | `same=0 diff=3 missing=0 nonfiles=0`. |
| Excluded files | `.ai-company/README 2.md`, `warranty-picker 2.tsx`, and `tenant-guard.test 2.ts` remain for separate review. |
| Governance check | `npm run agents:check` passed. |

## Residual Risks

| Risk | Level | Owner | Follow-up |
|---|---|---|---|
| Three now-different duplicate files remain. | P2 | QA + relevant domain reviewers | Run a separate L2 review before deleting or merging. |
| Empty duplicate directories remain from L2-001. | P2 | Operations | Clean in a separate directory cleanup task if still present. |
| Ignored/generated duplicate-like `storybook-static` output may remain. | P3 | Operations | Clean generated output separately if needed. |
