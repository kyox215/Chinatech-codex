# L2-001 Duplicate Files And Dirty Worktree Inventory

- Task: `TASK-20260619-004`
- Date: 2026-06-19
- Owner / 老板: Hexiang Huang / 鹤祥
- Scope: inventory only
- Hard boundary: no deletion, no staging, no revert, no business-code edit

## Executive Summary

This inventory found duplicate-like paths using the pattern ` 2` before a file extension or at the end of a directory name.

| Category | Count | Cleanup recommendation |
|---|---:|---|
| Git-visible duplicate files | 104 | Owner confirmation required before deletion |
| Git-visible duplicate files identical to canonical file | 72 | Safe cleanup candidates after owner confirmation |
| Git-visible duplicate files different from canonical file | 32 | Review before deciding; do not auto-delete |
| Git-visible duplicate empty directories | 14 | Safe cleanup candidates after owner confirmation |
| Ignored/generated duplicate files under `storybook-static` | 9 | Leave ignored or clean generated output separately |
| Ignored/generated duplicate empty directories under `storybook-static` | 2 | Leave ignored or clean generated output separately |
| Canonical counterpart missing | 0 | None |

Earlier project memory counted 99 duplicate files because the quick `rg --files -g '* 2.*'` scan skipped hidden `.cursor` paths and did not count duplicate directories. This inventory is more complete.

## Risk Classification

- Risk: R1 low risk for inventory-only work.
- Autonomy: L2 controlled execution.
- Destructive actions: not authorized.
- Production/data/security impact: none from inventory generation.

## Dirty Worktree Summary

### Modified Tracked Files

These are tracked files with local modifications. They are not cleanup candidates in this task.

| Area | File | Recommendation |
|---|---|---|
| Governance | `.agents/README.md` | Keep for current governance work; review in separate commit scope |
| Governance | `.agents/repairdesk-multiagent.yaml` | Keep for current governance work; review in separate commit scope |
| Governance | `AGENTS.md` | Keep for current governance work; review in separate commit scope |
| Governance | `AI智能部门管理/templates/agenda-intake.md` | Keep for current governance work; review in separate commit scope |
| Governance | `AI智能部门管理/部门化管理设计.md` | Keep for current governance work; review in separate commit scope |
| Business/UI | `src/components/ui/dialog.tsx` | Owner/author review before any cleanup or commit |
| Business/UI | `src/features/inventory/screens/inventory-screen.tsx` | Owner/author review before any cleanup or commit |
| Business/UI | `src/features/orders/components/order-hero.tsx` | Owner/author review before any cleanup or commit |
| Business/UI | `src/features/orders/screens/order-detail-screen.tsx` | Owner/author review before any cleanup or commit |
| Business/UI | `src/lib/component-patterns.ts` | Owner/author review before any cleanup or commit |
| Business/UI | `src/lib/ui-patterns.ts` | Owner/author review before any cleanup or commit |
| Business/UI | `src/routes/orders.index.tsx` | Owner/author review before any cleanup or commit |

### Other Untracked Non-Duplicate Areas

| Area | Examples | Recommendation |
|---|---|---|
| AI Company OS v3 governance package | `.ai-company/`, `.codex/`, `.agents/skills/`, `.agents/runs/2026-06-19-ai-company-os-adoption.md` | Keep; these are current governance assets unless owner rejects v3 adoption |
| Project charter/tooling | `docs/project-charter.md`, `tools/ai_company.py` | Keep; current governance/task tooling |
| Generated Python cache | `tools/__pycache__/ai_company.cpython-312.pyc` | Cleanup candidate after owner confirmation; generated artifact |
| Screenshots | `screenshots/**` | Review whether they are evidence artifacts before cleanup |

## Recommendation Categories

- `safe_after_owner_confirm`: content is identical to canonical file, or duplicate directory is empty and canonical directory exists.
- `review_before_decision`: duplicate file differs from canonical file and may contain useful unmerged work.
- `ignored_generated`: path is ignored by Git, currently under generated `storybook-static`.
- `do_not_touch_this_task`: tracked modified files and non-duplicate untracked governance assets.

## Git-Visible Files Requiring Review Before Decision

These 32 files differ from their canonical counterparts.

| Duplicate path | Canonical counterpart | Recommendation |
|---|---|---|
| `.cursor/rules/00-overview 2.mdc` | `.cursor/rules/00-overview.mdc` | review_before_decision |
| `.cursor/rules/20-layout-shell 2.mdc` | `.cursor/rules/20-layout-shell.mdc` | review_before_decision |
| `.cursor/rules/30-components 2.mdc` | `.cursor/rules/30-components.mdc` | review_before_decision |
| `.cursor/rules/40-page-recipes 2.mdc` | `.cursor/rules/40-page-recipes.mdc` | review_before_decision |
| `.cursor/rules/60-stack-conventions 2.mdc` | `.cursor/rules/60-stack-conventions.mdc` | review_before_decision |
| `AI智能部门管理/部门化管理设计 2.md` | `AI智能部门管理/部门化管理设计.md` | review_before_decision |
| `docs/BUYBACK_PRICE_ENGINE_PLAN 2.md` | `docs/BUYBACK_PRICE_ENGINE_PLAN.md` | review_before_decision |
| `scripts/check-agent-rules 2.mjs` | `scripts/check-agent-rules.mjs` | review_before_decision |
| `src/features/inventory/model/inventory-workflow 2.ts` | `src/features/inventory/model/inventory-workflow.ts` | review_before_decision |
| `src/features/inventory/model/inventory-workflow.test 2.ts` | `src/features/inventory/model/inventory-workflow.test.ts` | review_before_decision |
| `src/features/inventory/server/inventory.repository 2.ts` | `src/features/inventory/server/inventory.repository.ts` | review_before_decision |
| `src/features/inventory/testing/mock-api 2.ts` | `src/features/inventory/testing/mock-api.ts` | review_before_decision |
| `src/features/inventory/testing/mock-api.test 2.ts` | `src/features/inventory/testing/mock-api.test.ts` | review_before_decision |
| `src/features/messages/model/template-renderer 2.ts` | `src/features/messages/model/template-renderer.ts` | review_before_decision |
| `src/features/orders/components/order-list-items 2.tsx` | `src/features/orders/components/order-list-items.tsx` | review_before_decision |
| `src/features/orders/forms/customer-intake-lookup 2.tsx` | `src/features/orders/forms/customer-intake-lookup.tsx` | review_before_decision |
| `src/features/orders/model/canonical-order-status 2.ts` | `src/features/orders/model/canonical-order-status.ts` | review_before_decision |
| `src/features/orders/model/canonical-order-status.test 2.ts` | `src/features/orders/model/canonical-order-status.test.ts` | review_before_decision |
| `src/features/orders/model/order-side-statuses 2.ts` | `src/features/orders/model/order-side-statuses.ts` | review_before_decision |
| `src/features/orders/model/order-side-statuses.test 2.ts` | `src/features/orders/model/order-side-statuses.test.ts` | review_before_decision |
| `src/features/orders/model/order-task-flow 2.ts` | `src/features/orders/model/order-task-flow.ts` | review_before_decision |
| `src/features/orders/model/order-task-flow.test 2.ts` | `src/features/orders/model/order-task-flow.test.ts` | review_before_decision |
| `src/features/orders/model/order-transition-reasons 2.ts` | `src/features/orders/model/order-transition-reasons.ts` | review_before_decision |
| `src/features/orders/model/order-workflow 2.ts` | `src/features/orders/model/order-workflow.ts` | review_before_decision |
| `src/features/orders/model/order-workflow.test 2.ts` | `src/features/orders/model/order-workflow.test.ts` | review_before_decision |
| `src/features/orders/screens/order-task-screen 2.tsx` | `src/features/orders/screens/order-task-screen.tsx` | review_before_decision |
| `src/server/auth-context 2.ts` | `src/server/auth-context.ts` | review_before_decision |
| `src/shared/ui/repair-os-mobile 2.tsx` | `src/shared/ui/repair-os-mobile.tsx` | review_before_decision |
| `supabase/migrations/20260611164138_order_workflow_statuses 2.sql` | `supabase/migrations/20260611164138_order_workflow_statuses.sql` | review_before_decision |
| `supabase/migrations/20260611202504_repairdesk_canonical_order_status 2.sql` | `supabase/migrations/20260611202504_repairdesk_canonical_order_status.sql` | review_before_decision |
| `supabase/migrations/20260613113000_repairdesk_order_contract_compat 2.sql` | `supabase/migrations/20260613113000_repairdesk_order_contract_compat.sql` | review_before_decision |
| `tests/e2e/visual-overflow.spec 2.ts` | `tests/e2e/visual-overflow.spec.ts` | review_before_decision |

## Git-Visible Identical Duplicate Files

These 72 files are byte-identical to their canonical counterparts.

| Duplicate path | Canonical counterpart | Recommendation |
|---|---|---|
| `docs/BUYBACK_RESALE_EXECUTION_PLAN 2.md` | `docs/BUYBACK_RESALE_EXECUTION_PLAN.md` | safe_after_owner_confirm |
| `docs/ENTERPRISE_MULTI_STORE_TENANCY_PLAN 2.md` | `docs/ENTERPRISE_MULTI_STORE_TENANCY_PLAN.md` | safe_after_owner_confirm |
| `docs/GPT_PROJECT_REPLANNING_BRIEF 2.md` | `docs/GPT_PROJECT_REPLANNING_BRIEF.md` | safe_after_owner_confirm |
| `docs/PROJECT_REFACTOR_CONTEXT_EXPORT 2.md` | `docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md` | safe_after_owner_confirm |
| `docs/PROJECT_REPLAN_FROM_MOBILE_MVP_V1_5 2.md` | `docs/PROJECT_REPLAN_FROM_MOBILE_MVP_V1_5.md` | safe_after_owner_confirm |
| `docs/PROJECT_UPGRADE_EXECUTION_PLAN 2.md` | `docs/PROJECT_UPGRADE_EXECUTION_PLAN.md` | safe_after_owner_confirm |
| `docs/REPAIROS_COMPACT_ARCHITECTURE 2.md` | `docs/REPAIROS_COMPACT_ARCHITECTURE.md` | safe_after_owner_confirm |
| `docs/REPAIROS_MOBILE_DETAIL_STANDARD 2.md` | `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md` | safe_after_owner_confirm |
| `docs/SEATABLE_RIPARAZIONE_WORKFLOW_PLAN 2.md` | `docs/SEATABLE_RIPARAZIONE_WORKFLOW_PLAN.md` | safe_after_owner_confirm |
| `public/sw 2.js` | `public/sw.js` | safe_after_owner_confirm |
| `scripts/ensure-owner-admin 2.ts` | `scripts/ensure-owner-admin.ts` | safe_after_owner_confirm |
| `scripts/import-seatable-riparazione 2.ts` | `scripts/import-seatable-riparazione.ts` | safe_after_owner_confirm |
| `scripts/reset-repairdesk-demo-data 2.ts` | `scripts/reset-repairdesk-demo-data.ts` | safe_after_owner_confirm |
| `src/app/buyback/page 2.tsx` | `src/app/buyback/page.tsx` | safe_after_owner_confirm |
| `src/app/login/page 2.tsx` | `src/app/login/page.tsx` | safe_after_owner_confirm |
| `src/app/manifest 2.ts` | `src/app/manifest.ts` | safe_after_owner_confirm |
| `src/app/offline/page 2.tsx` | `src/app/offline/page.tsx` | safe_after_owner_confirm |
| `src/app/onboarding/page 2.tsx` | `src/app/onboarding/page.tsx` | safe_after_owner_confirm |
| `src/app/orders/[id]/task/page 2.tsx` | `src/app/orders/[id]/task/page.tsx` | safe_after_owner_confirm |
| `src/app/platform/page 2.tsx` | `src/app/platform/page.tsx` | safe_after_owner_confirm |
| `src/components/mobile-workspace-dock 2.tsx` | `src/components/mobile-workspace-dock.tsx` | safe_after_owner_confirm |
| `src/components/pwa-service-worker 2.tsx` | `src/components/pwa-service-worker.tsx` | safe_after_owner_confirm |
| `src/components/ui/multi-select-dropdown 2.tsx` | `src/components/ui/multi-select-dropdown.tsx` | safe_after_owner_confirm |
| `src/features/buyback/index 2.ts` | `src/features/buyback/index.ts` | safe_after_owner_confirm |
| `src/features/capture/index 2.ts` | `src/features/capture/index.ts` | safe_after_owner_confirm |
| `src/features/customers/forms/customer-backup-phones-field 2.tsx` | `src/features/customers/forms/customer-backup-phones-field.tsx` | safe_after_owner_confirm |
| `src/features/customers/testing/mock-api.test 2.ts` | `src/features/customers/testing/mock-api.test.ts` | safe_after_owner_confirm |
| `src/features/inventory/api/query-keys 2.ts` | `src/features/inventory/api/query-keys.ts` | safe_after_owner_confirm |
| `src/features/inventory/import/seatable-electronics 2.ts` | `src/features/inventory/import/seatable-electronics.ts` | safe_after_owner_confirm |
| `src/features/inventory/import/seatable-electronics.test 2.ts` | `src/features/inventory/import/seatable-electronics.test.ts` | safe_after_owner_confirm |
| `src/features/inventory/server/inventory.service 2.ts` | `src/features/inventory/server/inventory.service.ts` | safe_after_owner_confirm |
| `src/features/messages/api/query-keys 2.ts` | `src/features/messages/api/query-keys.ts` | safe_after_owner_confirm |
| `src/features/messages/model/message-template-defaults 2.ts` | `src/features/messages/model/message-template-defaults.ts` | safe_after_owner_confirm |
| `src/features/messages/server/message-settings.repository 2.ts` | `src/features/messages/server/message-settings.repository.ts` | safe_after_owner_confirm |
| `src/features/messages/server/message-settings.service 2.ts` | `src/features/messages/server/message-settings.service.ts` | safe_after_owner_confirm |
| `src/features/messages/testing/mock-api 2.ts` | `src/features/messages/testing/mock-api.ts` | safe_after_owner_confirm |
| `src/features/orders/components/accessory-notes-picker 2.tsx` | `src/features/orders/components/accessory-notes-picker.tsx` | safe_after_owner_confirm |
| `src/features/orders/components/order-contact-menu 2.tsx` | `src/features/orders/components/order-contact-menu.tsx` | safe_after_owner_confirm |
| `src/features/orders/components/order-option-pickers.test 2.tsx` | `src/features/orders/components/order-option-pickers.test.tsx` | safe_after_owner_confirm |
| `src/features/orders/components/order-transition-reason-selector 2.tsx` | `src/features/orders/components/order-transition-reason-selector.tsx` | safe_after_owner_confirm |
| `src/features/orders/components/order-workflow-progress 2.tsx` | `src/features/orders/components/order-workflow-progress.tsx` | safe_after_owner_confirm |
| `src/features/orders/components/warranty-picker 2.tsx` | `src/features/orders/components/warranty-picker.tsx` | safe_after_owner_confirm |
| `src/features/orders/import/seatable-riparazione 2.ts` | `src/features/orders/import/seatable-riparazione.ts` | safe_after_owner_confirm |
| `src/features/orders/import/seatable-riparazione.test 2.ts` | `src/features/orders/import/seatable-riparazione.test.ts` | safe_after_owner_confirm |
| `src/features/orders/model/order-accessory-notes 2.ts` | `src/features/orders/model/order-accessory-notes.ts` | safe_after_owner_confirm |
| `src/features/orders/model/order-accessory-notes.test 2.ts` | `src/features/orders/model/order-accessory-notes.test.ts` | safe_after_owner_confirm |
| `src/features/orders/model/order-contact-phones 2.ts` | `src/features/orders/model/order-contact-phones.ts` | safe_after_owner_confirm |
| `src/features/orders/model/order-finance-draft 2.ts` | `src/features/orders/model/order-finance-draft.ts` | safe_after_owner_confirm |
| `src/features/orders/model/order-finance-draft.test 2.ts` | `src/features/orders/model/order-finance-draft.test.ts` | safe_after_owner_confirm |
| `src/features/orders/model/order-transition-reasons.test 2.ts` | `src/features/orders/model/order-transition-reasons.test.ts` | safe_after_owner_confirm |
| `src/features/orders/model/order-warranty 2.ts` | `src/features/orders/model/order-warranty.ts` | safe_after_owner_confirm |
| `src/features/orders/model/order-warranty.test 2.ts` | `src/features/orders/model/order-warranty.test.ts` | safe_after_owner_confirm |
| `src/server/audit 2.ts` | `src/server/audit.ts` | safe_after_owner_confirm |
| `src/server/tenant-guard.test 2.ts` | `src/server/tenant-guard.test.ts` | safe_after_owner_confirm |
| `src/shared/config/navigation 2.ts` | `src/shared/config/navigation.ts` | safe_after_owner_confirm |
| `supabase/migrations/20260610234427_buyback_resale_inventory 2.sql` | `supabase/migrations/20260610234427_buyback_resale_inventory.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260610234705_add_customer_contact_phones 2.sql` | `supabase/migrations/20260610234705_add_customer_contact_phones.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260611001527_message_templates_settings 2.sql` | `supabase/migrations/20260611001527_message_templates_settings.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260611002831_enterprise_multi_store_foundation 2.sql` | `supabase/migrations/20260611002831_enterprise_multi_store_foundation.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260611005916_harden_store_tenant_constraints 2.sql` | `supabase/migrations/20260611005916_harden_store_tenant_constraints.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260611074644_repairdesk_auth_multistore_bootstrap_safe 2.sql` | `supabase/migrations/20260611074644_repairdesk_auth_multistore_bootstrap_safe.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260611080254_platform_onboarding_approvals 2.sql` | `supabase/migrations/20260611080254_platform_onboarding_approvals.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260611102805_repairdesk_remote_schema_compatibility 2.sql` | `supabase/migrations/20260611102805_repairdesk_remote_schema_compatibility.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260611103526_repairdesk_message_template_legacy_sync 2.sql` | `supabase/migrations/20260611103526_repairdesk_message_template_legacy_sync.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260611125512_customer_list_performance 2.sql` | `supabase/migrations/20260611125512_customer_list_performance.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260611143348_order_warranty_accessory_rules 2.sql` | `supabase/migrations/20260611143348_order_warranty_accessory_rules.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260611175701_order_workflow_repaired_bucket 2.sql` | `supabase/migrations/20260611175701_order_workflow_repaired_bucket.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260613122452_order_attachments 2.sql` | `supabase/migrations/20260613122452_order_attachments.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260616141938_customer_list_v2_fast_loading 2.sql` | `supabase/migrations/20260616141938_customer_list_v2_fast_loading.sql` | safe_after_owner_confirm |
| `supabase/migrations/20260617143000_inventory_attachments 2.sql` | `supabase/migrations/20260617143000_inventory_attachments.sql` | safe_after_owner_confirm |
| `tests/e2e/app-shell.spec 2.ts` | `tests/e2e/app-shell.spec.ts` | safe_after_owner_confirm |
| `tests/ensure-owner-admin.test 2.ts` | `tests/ensure-owner-admin.test.ts` | safe_after_owner_confirm |

## Git-Visible Empty Duplicate Directories

These 14 directories are empty, have canonical counterparts, and are cleanup candidates after owner confirmation.

| Duplicate directory | Canonical counterpart | Recommendation |
|---|---|---|
| `public/icons 2` | `public/icons` | safe_after_owner_confirm |
| `src/features/auth/model 2` | `src/features/auth/model` | safe_after_owner_confirm |
| `src/features/auth/screens 2` | `src/features/auth/screens` | safe_after_owner_confirm |
| `src/features/buyback/components 2` | `src/features/buyback/components` | safe_after_owner_confirm |
| `src/features/buyback/model 2` | `src/features/buyback/model` | safe_after_owner_confirm |
| `src/features/buyback/screens 2` | `src/features/buyback/screens` | safe_after_owner_confirm |
| `src/features/capture/components 2` | `src/features/capture/components` | safe_after_owner_confirm |
| `src/features/capture/model 2` | `src/features/capture/model` | safe_after_owner_confirm |
| `src/features/platform/api 2` | `src/features/platform/api` | safe_after_owner_confirm |
| `src/features/platform/screens 2` | `src/features/platform/screens` | safe_after_owner_confirm |
| `src/features/platform/server 2` | `src/features/platform/server` | safe_after_owner_confirm |
| `src/features/stores/api 2` | `src/features/stores/api` | safe_after_owner_confirm |
| `src/features/stores/server 2` | `src/features/stores/server` | safe_after_owner_confirm |
| `src/features/stores/testing 2` | `src/features/stores/testing` | safe_after_owner_confirm |

## Ignored / Generated Duplicate-Like Paths

These are ignored by Git and currently under `storybook-static`. They should not affect source control, but can be removed by regenerating/cleaning build output if the owner wants.

| Path | Recommendation |
|---|---|
| `storybook-static/favicon 2.svg` | ignored_generated |
| `storybook-static/iframe 2.html` | ignored_generated |
| `storybook-static/index 2.html` | ignored_generated |
| `storybook-static/index 2.json` | ignored_generated |
| `storybook-static/nunito-sans-bold 2.woff2` | ignored_generated |
| `storybook-static/nunito-sans-bold-italic 2.woff2` | ignored_generated |
| `storybook-static/nunito-sans-italic 2.woff2` | ignored_generated |
| `storybook-static/nunito-sans-regular 2.woff2` | ignored_generated |
| `storybook-static/vite-inject-mocker-entry 2.js` | ignored_generated |
| `storybook-static/assets 2` | ignored_generated |
| `storybook-static/sb-common-assets 2` | ignored_generated |

## Counts By Top-Level Area

This table covers Git-visible duplicate files only.

| Area | Total | Same | Different |
|---|---:|---:|---:|
| `.cursor` | 5 | 0 | 5 |
| `AI智能部门管理` | 1 | 0 | 1 |
| `docs` | 10 | 9 | 1 |
| `public` | 1 | 1 | 0 |
| `scripts` | 4 | 3 | 1 |
| `src` | 62 | 42 | 20 |
| `supabase` | 18 | 15 | 3 |
| `tests` | 3 | 2 | 1 |

## Cleanup Plan For Owner Approval

Recommended order if the owner approves cleanup later:

1. Do not touch tracked modified files yet.
2. Review the 32 `review_before_decision` files with file diffs against canonical counterparts.
3. After the owner confirms, remove the 72 identical duplicate files and 14 empty duplicate directories.
4. Treat `storybook-static` duplicate-like paths as generated-output cleanup, not source cleanup.
5. Run `npm run agents:check`, `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`, `npm run typecheck`, and optionally `npm run lint` after any actual deletion task.

## Assumptions And Unknowns

| Item | Type | Note |
|---|---|---|
| Canonical counterpart | assumption | The path with ` 2` removed is treated as canonical because every duplicate has an existing counterpart. |
| Content equality | verified | SHA-256 content comparison was used for files. |
| Business value of different duplicates | unknown | Different duplicates may contain old, experimental, or useful unmerged work. They require review. |
| Authorship of tracked business/UI modifications | unknown | This inventory records them but does not attribute or alter them. |
