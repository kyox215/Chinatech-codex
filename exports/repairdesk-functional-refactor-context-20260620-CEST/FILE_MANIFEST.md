# RepairDesk Functional Refactor File Manifest

Last verified: 2026-06-20 CEST
Scope: source evidence used for this non-UI functional handoff.

## 1. Package Files

```txt
exports/repairdesk-functional-refactor-context-20260620-CEST/README_FOR_REFACTOR.md
exports/repairdesk-functional-refactor-context-20260620-CEST/SYSTEM_FUNCTIONAL_MAP.md
exports/repairdesk-functional-refactor-context-20260620-CEST/RUNBOOK.md
exports/repairdesk-functional-refactor-context-20260620-CEST/API_AND_DATA_CONTRACTS.md
exports/repairdesk-functional-refactor-context-20260620-CEST/REFACTOR_NOTES.md
exports/repairdesk-functional-refactor-context-20260620-CEST/FILE_MANIFEST.md
```

## 2. Project Configuration

```txt
package.json
next.config.ts
tsconfig.json
vitest.config.ts
playwright.config.ts
supabase/config.toml
.env.example
AGENTS.md
docs/ARCHITECTURE.md
```

`.env.local` exists locally but was not read or copied.

## 3. App Router

```txt
src/app/layout.tsx
src/app/providers.tsx
src/app/page.tsx
src/app/login/page.tsx
src/app/onboarding/page.tsx
src/app/platform/page.tsx
src/app/orders/page.tsx
src/app/orders/new/page.tsx
src/app/orders/[id]/page.tsx
src/app/orders/[id]/task/page.tsx
src/app/customers/page.tsx
src/app/customers/[id]/page.tsx
src/app/inventory/page.tsx
src/app/buyback/page.tsx
src/app/messages/page.tsx
src/app/settings/page.tsx
src/app/offline/page.tsx
src/app/not-found.tsx
src/app/manifest.ts
src/app/api/repairdesk/[...path]/route.ts
```

## 4. API, Server, And Shared Data Contracts

```txt
src/lib/repairdesk/api.ts
src/lib/repairdesk/types.ts
src/server/api/repairdesk-router.ts
src/server/api/repairdesk-schemas.ts
src/server/audit.ts
src/server/auth-context.ts
src/server/repairdesk-shared.ts
src/server/supabase.ts
src/server/tenant-guard.test.ts
src/server/api/repairdesk-schemas.test.ts
```

## 5. Auth, Stores, Platform

```txt
src/features/auth/screens/login-screen.tsx
src/features/auth/screens/onboarding-screen.tsx
src/features/auth/model/auth-persistence.ts
src/features/auth/model/onboarding-flow.ts
src/features/auth/model/post-login-redirect.ts
src/features/stores/api/query-keys.ts
src/features/stores/api/use-store-shell-context.ts
src/features/stores/model/store-shell-context.ts
src/features/stores/server/store.repository.ts
src/features/stores/server/store.service.ts
src/features/stores/testing/mock-api.ts
src/features/platform/api/query-keys.ts
src/features/platform/model/onboarding-queue.ts
src/features/platform/screens/platform-admin-screen.tsx
src/features/platform/server/platform.repository.ts
src/features/platform/server/platform.service.ts
```

## 6. Dashboard

```txt
src/features/dashboard/screens/dashboard-screen.tsx
src/features/dashboard/model/dashboard-work-insights.ts
```

## 7. Orders

Screens:

```txt
src/features/orders/screens/order-list-screen.tsx
src/features/orders/screens/new-order-screen.tsx
src/features/orders/screens/order-detail-screen.tsx
src/features/orders/screens/order-task-screen.tsx
```

API/server:

```txt
src/features/orders/api/index.ts
src/features/orders/api/query-keys.ts
src/features/orders/server/order.repository.ts
src/features/orders/server/order.service.ts
src/features/orders/testing/mock-api.ts
```

Forms/components with business behavior:

```txt
src/features/orders/forms/approval-request-dialog.tsx
src/features/orders/forms/cancel-dialog.tsx
src/features/orders/forms/customer-intake-lookup.tsx
src/features/orders/forms/customer-phone-lookup.tsx
src/features/orders/forms/edit-order-dialog.tsx
src/features/orders/forms/new-order-customer-device-section.tsx
src/features/orders/forms/new-order-fault-diagnosis-section.tsx
src/features/orders/forms/new-order-fields.tsx
src/features/orders/forms/new-order-quotation-section.tsx
src/features/orders/forms/new-order-submit-bar.tsx
src/features/orders/forms/notify-dialog.tsx
src/features/orders/forms/payment-dialog.tsx
src/features/orders/components/order-contact-menu.tsx
src/features/orders/components/order-detail-tabs.tsx
src/features/orders/components/order-hero.tsx
src/features/orders/components/order-list-desktop-row.tsx
src/features/orders/components/order-list-filters.tsx
src/features/orders/components/order-list-items.tsx
src/features/orders/components/order-list-print-sheet.tsx
src/features/orders/components/order-list-states.tsx
src/features/orders/components/order-overview-tab.tsx
src/features/orders/components/order-transition-reason-selector.tsx
src/features/orders/components/order-workflow-progress.tsx
src/features/orders/components/repair-order-print-sheet.tsx
```

Models/import:

```txt
src/features/orders/model/canonical-order-status.ts
src/features/orders/model/edit-order-form.ts
src/features/orders/model/new-order-form.ts
src/features/orders/model/order-accessory-notes.ts
src/features/orders/model/order-contact-phones.ts
src/features/orders/model/order-fault-description.ts
src/features/orders/model/order-finance-draft.ts
src/features/orders/model/order-italian.ts
src/features/orders/model/order-list-export.ts
src/features/orders/model/order-message-templates.ts
src/features/orders/model/order-side-statuses.ts
src/features/orders/model/order-tags.ts
src/features/orders/model/order-task-flow.ts
src/features/orders/model/order-transition-reasons.ts
src/features/orders/model/order-warranty.ts
src/features/orders/model/order-workflow.ts
src/features/orders/import/seatable-riparazione.ts
```

## 8. Customers

```txt
src/features/customers/api/index.ts
src/features/customers/api/query-keys.ts
src/features/customers/screens/customer-list-screen.tsx
src/features/customers/screens/customer-detail-screen.tsx
src/features/customers/server/customer.repository.ts
src/features/customers/server/customer.service.ts
src/features/customers/testing/mock-api.ts
src/features/customers/model/customer-list.ts
src/features/customers/forms/customer-backup-phones-field.tsx
src/features/customers/forms/customer-device-dialog.tsx
src/features/customers/forms/customer-edit-dialog.tsx
src/features/customers/forms/customer-followup-dialog.tsx
src/features/customers/forms/customer-form-dialog.tsx
src/features/customers/forms/customer-message-dialog.tsx
src/features/customers/forms/customer-tags-dialog.tsx
src/features/customers/components/customer-activity-panels.tsx
src/features/customers/components/customer-detail-panels.tsx
src/features/customers/components/customer-detail-tabs.tsx
src/features/customers/components/customer-hero.tsx
src/features/customers/components/customer-list-items.tsx
src/features/customers/components/customer-profile-blocks.tsx
```

## 9. Inventory And Buyback

Inventory:

```txt
src/features/inventory/api/query-keys.ts
src/features/inventory/screens/inventory-screen.tsx
src/features/inventory/server/inventory.repository.ts
src/features/inventory/server/inventory.service.ts
src/features/inventory/testing/mock-api.ts
src/features/inventory/model/inventory-buyback-summary.ts
src/features/inventory/model/inventory-workflow.ts
src/features/inventory/import/seatable-electronics.ts
```

Buyback:

```txt
src/features/buyback/screens/buyback-screen.tsx
src/features/buyback/components/buyback-quote-workspace.tsx
src/features/buyback/model/apple-price-guide.ts
src/features/buyback/model/buyback-quote.ts
src/features/buyback/model/buyback-record-workflow.ts
```

## 10. Messages And Settings

```txt
src/features/messages/api/query-keys.ts
src/features/messages/screens/messages-screen.tsx
src/features/messages/server/message-settings.repository.ts
src/features/messages/server/message-settings.service.ts
src/features/messages/testing/mock-api.ts
src/features/messages/model/message-template-defaults.ts
src/features/messages/model/template-renderer.ts
src/features/settings/screens/settings-screen.tsx
src/features/settings/model/store-settings-readiness.ts
```

## 11. Capture And Shared Business Helpers

```txt
src/features/capture/components/attachment-draft-panel.tsx
src/features/capture/components/barcode-scanner-sheet.tsx
src/features/capture/components/camera-capture-sheet.tsx
src/features/capture/model/attachment-rules.ts
src/features/capture/model/barcode-parser.ts
src/entities/order/model/order-calculations.test.ts
src/shared/lib/phone.ts
src/shared/lib/e2e-auth-bypass.ts
src/shared/config/routes.ts
src/shared/config/navigation.ts
```

## 12. Supabase Migrations

```txt
supabase/migrations/20260213234620_remote_baseline.sql
supabase/migrations/20260517143000_repairdesk_schema.sql
supabase/migrations/20260518150000_add_eur_currency.sql
supabase/migrations/20260518170000_customer_crm.sql
supabase/migrations/20260610120648_order_accessory_notes.sql
supabase/migrations/20260610234427_buyback_resale_inventory.sql
supabase/migrations/20260610234705_add_customer_contact_phones.sql
supabase/migrations/20260611001527_message_templates_settings.sql
supabase/migrations/20260611002831_enterprise_multi_store_foundation.sql
supabase/migrations/20260611005916_harden_store_tenant_constraints.sql
supabase/migrations/20260611074644_repairdesk_auth_multistore_bootstrap_safe.sql
supabase/migrations/20260611080254_platform_onboarding_approvals.sql
supabase/migrations/20260611102805_repairdesk_remote_schema_compatibility.sql
supabase/migrations/20260611103526_repairdesk_message_template_legacy_sync.sql
supabase/migrations/20260611125512_customer_list_performance.sql
supabase/migrations/20260611143348_order_warranty_accessory_rules.sql
supabase/migrations/20260611164138_order_workflow_statuses.sql
supabase/migrations/20260611175701_order_workflow_repaired_bucket.sql
supabase/migrations/20260611202504_repairdesk_canonical_order_status.sql
supabase/migrations/20260613113000_repairdesk_order_contract_compat.sql
supabase/migrations/20260613122452_order_attachments.sql
supabase/migrations/20260616141938_customer_list_v2_fast_loading.sql
supabase/migrations/20260617143000_inventory_attachments.sql
supabase/migrations/20260618171500_order_approval_parts_transition.sql
supabase/migrations/20260618172000_repaired_workflow_status_repair.sql
supabase/migrations/20260619103000_order_external_repair_workflow.sql
supabase/migrations/20260619193655_repairdesk_attachment_storage_repair.sql
supabase/migrations/20260620120000_customer_interactions_store_id_repair.sql
```

## 13. Tests

Representative test files:

```txt
src/features/auth/model/auth-persistence.test.ts
src/features/auth/model/onboarding-flow.test.ts
src/features/auth/model/post-login-redirect.test.ts
src/features/buyback/model/apple-price-guide.test.ts
src/features/buyback/model/buyback-quote.test.ts
src/features/buyback/model/buyback-record-workflow.test.ts
src/features/capture/model/attachment-rules.test.ts
src/features/capture/model/barcode-parser.test.ts
src/features/customers/model/customer-list.test.ts
src/features/customers/testing/mock-api.test.ts
src/features/dashboard/model/dashboard-work-insights.test.ts
src/features/inventory/import/seatable-electronics.test.ts
src/features/inventory/model/inventory-buyback-summary.test.ts
src/features/inventory/model/inventory-workflow.test.ts
src/features/inventory/testing/mock-api.test.ts
src/features/messages/model/template-renderer.test.ts
src/features/orders/components/order-option-pickers.test.tsx
src/features/orders/import/seatable-riparazione.test.ts
src/features/orders/model/canonical-order-status.test.ts
src/features/orders/model/order-accessory-notes.test.ts
src/features/orders/model/order-fault-description.test.ts
src/features/orders/model/order-finance-draft.test.ts
src/features/orders/model/order-list-export.test.ts
src/features/orders/model/order-message-templates.test.ts
src/features/orders/model/order-side-statuses.test.ts
src/features/orders/model/order-tags.test.ts
src/features/orders/model/order-task-flow.test.ts
src/features/orders/model/order-transition-reasons.test.ts
src/features/orders/model/order-warranty.test.ts
src/features/orders/model/order-workflow.test.ts
src/features/orders/testing/mock-api.test.ts
src/features/platform/model/onboarding-queue.test.ts
src/features/settings/model/store-settings-readiness.test.ts
src/features/stores/model/store-shell-context.test.ts
src/server/api/repairdesk-schemas.test.ts
src/server/tenant-guard.test.ts
src/shared/lib/phone.test.ts
tests/e2e/app-shell.spec.ts
tests/e2e/business-desktop-overflow.spec.ts
tests/e2e/order-desktop-ui-audit.spec.ts
tests/e2e/repairdesk-smoke.spec.ts
tests/e2e/visual-overflow.spec.ts
tests/ensure-owner-admin.test.ts
```

## 14. Scripts And Tools

```txt
scripts/seed-supabase.ts
scripts/reset-repairdesk-demo-data.ts
scripts/ensure-owner-admin.ts
scripts/import-seatable-riparazione.ts
scripts/check-agent-rules.mjs
scripts/agents/check-agent-config.mjs
scripts/agents/check-agent-templates.mjs
tools/ai_company.py
```
