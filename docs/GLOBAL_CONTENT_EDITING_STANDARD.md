# Global content editing standard

Status: **active — Owner selected A, 2026-09-06**. This is the shared interaction authority for the bounded global compact-edit rollout. Historical M16 and inventory release records remain preserved; this document grants no data, permission or production authority.

## Interaction contract

- Tap the visible content or current value to edit. Keep the underlying page geometry and scroll position stable. Give empty values a clear accessible entry.
- Below 1024px use a compact bottom editor. At desktop widths preserve the existing Dialog, anchored Popover or independent workspace. `DialogContent` / `SheetContent` opt in with `mobileEditor`; defaults, capture, filter, print and consequential dialogs remain separate.
- Presentation changes through CSS do not remount an open editor on resize. Draft state belongs to one opening and entity/store, not each query refresh.
- Existing single-value mutations (assignee, supplier) close only after success. Pending prevents duplicate choice; failure retains the open selection surface. Existing draft-only choices remain draft-only.
- Related fields and finance retain explicit Save/Cancel. Escape, X and backdrop pass through the pending/dirty guard. Discard confirmation is an inline step within the same modal, defaults to Continue editing and restores focus. Never convert every field to autosave.
- Finance and device-unlock sessions freeze `updated_at` at opening and checks the existing conflict contract before save. Unsaved quotes cannot feed workflow, payment or WhatsApp actions. Preserve capability checks, version handoff, finance redaction and voided-state rules.
- Real inputs are at least 16px on compact screens. Primary save/cancel actions remain at least 44px. The approved dense repair-category variant is **four columns × three rows, 33px per whole-cell trigger and 4px row gaps = 107px**. The icon, label and arrow form one target; this explicit variant does not weaken inventory selector or capture targets.
- Use short zh/it/en labels with full accessible names. Tabs are equal width in the compact order header, with Details / Device photos / History, keyboard navigation and per-group scroll memory.
- Photos follow the existing **append-only** attachment API. A tile captures an additional image; separate numbered view controls expose every grouped image. Do not imply replacement or deletion. Upload failure retains the current image in memory until retry or cancel.

## Coverage and workflow exceptions

| Surface / source | Disposition | Preserved behavior |
| --- | --- | --- |
| Mobile order detail, `order-detail-screen.tsx` | Migrated | Direct assignee/supplier, grouped customer/device editing, stable finance editor, frozen version, three groups, append-only photo tiles |
| Order customer/device editor, `order-identity-editor.tsx` | Migrated | Existing `buildOrderEditSavePlan` / sequential version contract; intake capability for identity/accessories, repair capability for device notes; explicit Save/Cancel |
| Order fault editor | Already conforming | Existing session, conflict/reload/discard, desktop workspace embedding and mobile Sheet |
| Device unlock | Migrated session guard | Sensitive draft stays in memory; frozen opening version/conflict check, original repair permission and validation |
| New-order and detail quotation, `fault-diagnosis-picker.tsx` | Migrated compact variant | Same-category repair replacement, inspection multi-select mutually exclusive with repair, clear, identity/price/note retention; no pricing-mode change |
| Customer edit/tags/device/followup dialogs | Migrated | CSS bottom presentation; stable entity session; dirty dismissal and failed draft retention |
| Customer detail identity | Migrated direct trigger | Phone links remain separate; existing full grouped customer form remains authoritative |
| Customer device view → edit | Already single-modal handoff | View closes before edit opens; device history/creation remain dedicated flows |
| Settings supplier/member/workflow-status and store rename | Migrated presentation/direct supplier summary | Existing conflict, unsaved guard, sensitive member save and rename challenge remain |
| Ordinary settings forms | Already conforming full-form workflow | Directly editable fields with grouped Save; no extra summary or autosave |
| Current `/buyback`, `transparent-buyback-screen.tsx` | Already conforming full-form workflow | One existing bottom workspace with direct fields, quote validation, recovery/version and calculations |
| Legacy `buyback-quote-workspace.tsx` estimate summaries | Migrated compatibility entry | Direct summary enters a stable layer inside its own workspace; no nested Sheet or pricing change |
| Memo content editor | Already conforming | Mobile Sheet / desktop Dialog; existing draft and keyboard behavior |
| `inventory-selectable-field.tsx` | Already conforming | Mobile Sheet / desktop Popover, independent touch/mouse behavior |
| Inventory intake/edit routes | Purposeful full-form workflow | Independent desktop/mobile layout and original field validation; not an omitted summary editor |
| Order creation/lookup, scanner, camera, checkout/payment confirmation, print, workflow/approval | Purposeful workflows | Keep dedicated capture/confirmation/process semantics; no blanket modal conversion |

The table records the finite audited business surfaces above. It is not a claim that every historical component, every admin route or every old prototype has been converted. Screenshot and test evidence belong to TASK-20260906-002.

## Reuse and validation

Use existing `componentOverlay` slots and tokens from `src/styles.css`. Keep business open/draft/save/guard ownership in its feature. `useCompactEditorSession` is for in-memory grouped editing; do not use it to change persistence protocols or sensitive-data retention.

Validate representative 320/390/430/768 compact and 1024/1440 desktop surfaces, zh/it/en labels, keyboard/Escape/focus, long lists and last fields, dirty/error/pending/conflict/readonly states. Check a compressed available height separately from a real device keyboard test. Record the actual limits of screenshots and synthetic APIs.
