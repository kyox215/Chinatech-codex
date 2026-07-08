# RepairDesk API And Data Contracts

Last verified: 2026-06-20 CEST
Scope: current API, data, server, and type contracts. No secrets included.

## 1. Request Flow

Client flow:

```txt
React client screen/form
-> src/lib/repairdesk/api.ts or feature API facade
-> /api/repairdesk/[...path]
-> src/server/api/repairdesk-router.ts
-> src/server/api/repairdesk-schemas.ts validation
-> feature service/repository
-> Supabase service-role server client or mock fallback
```

Rules:

- Client components should call `@/lib/repairdesk/api` or feature facades.
- Client components must not import `src/server/*`.
- Server dispatch validates request bodies with Zod.
- `getRequestActor` resolves auth, role, active store, and platform admin context.
- Most writes are audit-wrapped at the router or repository level.
- Supabase source is used when config exists and E2E bypass is disabled.
- Mock source is used for no-config/E2E bypass paths.

## 2. API Entry

Route file:

- `src/app/api/repairdesk/[...path]/route.ts`

Router:

- `src/server/api/repairdesk-router.ts`

Schemas:

- `src/server/api/repairdesk-schemas.ts`

Client facade:

- `src/lib/repairdesk/api.ts`

Shared types:

- `src/lib/repairdesk/types.ts`

## 3. GET Endpoints

All paths are under `/api/repairdesk/`.

| Path | Purpose |
|---|---|
| `onboarding/status` | Current user onboarding/store/platform-admin status. |
| `platform/onboarding/requests` | Platform admin onboarding approval queue. |
| `order-stats` | Aggregate repair order stats. |
| `order-workflow` | Store order workflow statuses and transitions. |
| `options` | RepairDesk options such as suppliers and technicians. |
| `inventory/stats` | Inventory aggregate stats. |
| `settings/store` | Store settings. |
| `message-templates` | Store message templates. |
| `stores/context` | Active store and available stores. |
| `stores/members` | Store members/invitations. |

## 4. POST Endpoints

### Onboarding, Platform, Stores

| Path | Purpose |
|---|---|
| `onboarding/request` | Submit create-store or join-store request. |
| `platform/onboarding/approve` | Approve onboarding request. |
| `platform/onboarding/reject` | Reject onboarding request. |
| `stores/create` | Create store. |
| `stores/switch` | Switch active store. |
| `stores/invite-member` | Invite store member. |

### Orders

| Path | Purpose |
|---|---|
| `orders/list` | List orders with filters. |
| `orders/list-page` | Paginated order list with counts. |
| `orders/create` | Create repair order. |
| `order/get` | Load order detail. |
| `order/update` | Full/legacy order update. |
| `order/patch` | Versioned partial field patch. |
| `order/finance` | Versioned finance patch. |
| `order/attachment/upload` | Upload order attachment metadata/content. |
| `order/transition` | Transition one order. |
| `order/batch-transition` | Transition multiple orders. |
| `order/payment` | Record payment. |
| `order/notification` | Record/send generic notification. |
| `order/whatsapp-notification` | Record/open WhatsApp notification flow. |
| `order/approval-request` | Send approval request. |
| `order/approval-decision` | Approve/reject quote approval flow. |

### Order Workflow

| Path | Purpose |
|---|---|
| `order-workflow/status/create` | Create workflow status. |
| `order-workflow/status/update` | Update workflow status. |
| `order-workflow/status/reorder` | Reorder workflow statuses. |
| `order-workflow/status/enabled` | Enable/disable status. |
| `order-workflow/transitions/update` | Update status transition targets. |

### Customers

| Path | Purpose |
|---|---|
| `customers/list` | List customers with filters. |
| `customers/list-page` | Paginated customer list. |
| `customers/search` | Limited customer search. |
| `customers/intake-search` | Intake search with history device candidates. |
| `customers/devices` | Customer devices. |
| `customer/get` | Customer detail. |
| `customer/create` | Create customer. |
| `customer/update` | Update customer. |
| `customer/device/upsert` | Create/update customer device. |
| `customer/device/delete` | Delete customer device. |
| `customer/tags/update` | Set customer tags. |
| `customer/followup/create` | Create customer follow-up. |
| `customer/followup/complete` | Complete customer follow-up. |
| `customer/message` | Send/log customer message. |

### Inventory

| Path | Purpose |
|---|---|
| `inventory/list` | List inventory items. |
| `inventory/list-page` | Paginated inventory list. |
| `inventory/get` | Inventory item detail. |
| `inventory/intake/create` | Create inventory intake. |
| `inventory/update` | Update inventory item. |
| `inventory/transition` | Transition inventory item. |
| `inventory/check` | Record inventory quality/function check. |
| `inventory/attachment/upload` | Upload inventory attachment. |
| `inventory/transaction` | Record inventory transaction. |
| `inventory/sell` | Sell inventory item. |
| `inventory/import/electronics/preview` | Preview electronics CSV import. |
| `inventory/import/electronics/apply` | Apply electronics CSV import. |

### Settings And Templates

| Path | Purpose |
|---|---|
| `settings/store/update` | Update store settings. |
| `message-template/update` | Update message template. |
| `message-template/reset` | Reset message template. |
| `message-template/preview` | Render template preview. |

## 5. Client API Facade

The public client contract is `src/lib/repairdesk/api.ts`.

Important exported functions:

- Inventory: `listInventoryItems`, `listInventoryItemsPage`, `getInventoryStats`, `getInventoryItem`, `createInventoryIntake`, `updateInventoryItem`, `transitionInventoryItem`, `recordInventoryCheck`, `uploadInventoryAttachment`, `recordInventoryTransaction`, `sellInventoryItem`, `importElectronicsCsvPreview`, `applyElectronicsCsvImport`.
- Settings/stores/platform: `getStoreSettings`, `updateStoreSettings`, `getStoreContext`, `getOnboardingStatus`, `submitOnboardingRequest`, `listPlatformOnboardingRequests`, `approveOnboardingRequest`, `rejectOnboardingRequest`, `getStoreMembers`, `createStore`, `switchStore`, `inviteStoreMember`.
- Messages: `listMessageTemplates`, `updateMessageTemplate`, `resetMessageTemplate`, `renderMessageTemplatePreview`.
- Orders: `listOrders`, `listOrdersPage`, `getOrderStats`, `listOrderWorkflow`, `createOrderWorkflowStatus`, `updateOrderWorkflowStatus`, `reorderOrderWorkflowStatuses`, `setOrderWorkflowStatusEnabled`, `updateOrderWorkflowTransitions`, `getOrder`, `transitionOrder`, `batchTransition`, `recordPayment`, `sendNotification`, `sendWhatsappNotification`, `sendApprovalRequest`, `decideOrderApproval`, `uploadOrderAttachment`, `createOrder`, `updateOrder`, `patchOrder`, `patchOrderFinance`, `getRepairDeskOptions`.
- Customers: `searchCustomers`, `searchCustomerIntakeCandidates`, `getCustomerDevices`, `listCustomers`, `listCustomersPage`, `getCustomerDetail`, `createCustomer`, `updateCustomer`, `upsertCustomerDevice`, `deleteCustomerDevice`, `setCustomerTags`, `createCustomerFollowup`, `completeCustomerFollowup`, `sendCustomerMessage`.

Refactor requirement:

- Preserve function names and response shapes until all callers and tests are migrated.
- If a breaking change is necessary, introduce a compatibility adapter first.

## 6. Core Types

Source:

- `src/lib/repairdesk/types.ts`

Major type groups:

- Customers/devices: `Customer`, `Device`, `CustomerHistoryDeviceCandidate`, `CustomerIntakeCandidate`.
- Orders: `RepairOrder`, `OrderDetail`, `OrderListItem`, `OrderListResult`, `OrderStats`, `OrderEvent`, `MessageLog`, `OrderAttachment`.
- Order workflow: `OrderWorkflowStatusCode`, `OrderExceptionStatus`, `OrderPaymentStatus`, `OrderApprovalFlowStatus`, `OrderPartsStatus`, `OrderNotifyStatus`, `OrderWorkflowStatus`, `OrderWorkflowTransition`.
- Customer CRM: `CustomerTag`, `CustomerInteraction`, `CustomerFollowup`, `CustomerListFilters`, `CustomerDetail`, customer update/create/device/follow-up/message inputs.
- Store/auth: `StaffRole`, `StoreRole`, `StoreContext`, `StoreMember`, `StoreInviteInput`, `OnboardingStatus`, `OnboardingRequest`, `AuditActor`.
- Inventory: `InventoryItemStatus`, `InventoryItem`, `InventoryListItem`, `InventoryDetail`, `InventoryQualityCheck`, `InventoryTransaction`, `InventoryEvent`, `InventoryAttachment`, inventory input types.
- Messages: `StoreSettings`, `MessageTemplate`, `MessageTemplateUpdateInput`, `MessageTemplatePreviewInput`, `MessageTemplatePreviewResult`.

## 7. Database Domains

Migrations live in `supabase/migrations`.

Core tables and domains:

| Domain | Tables |
|---|---|
| Customers/devices | `customers`, `devices`, `customer_tags`, `customer_tag_assignments`, `customer_interactions`, `customer_followups` |
| Orders | `repair_orders`, `order_events`, `message_logs`, `order_attachments`, `order_workflow_statuses`, `order_workflow_transitions` |
| Inventory/buyback | `inventory_items`, `inventory_quality_checks`, `inventory_transactions`, `inventory_events`, `inventory_attachments` |
| Stores/staff | `stores`, `store_memberships`, `store_invitations`, `staff_profiles` |
| Platform | `platform_admins`, `onboarding_requests`, `platform_audit_logs` |
| Settings/messages | `store_settings`, `message_templates` |
| Audit | `audit_logs` |
| Suppliers/options | `suppliers` |

Important enums:

- `repair_order_status`
- `repair_order_type`
- `approval_status`
- `message_channel`
- `message_status`
- `order_event_type`
- `inventory_item_status`
- `inventory_cosmetic_grade`
- `inventory_functional_grade`
- `inventory_check_status`
- `inventory_transaction_type`
- `staff_role`
- `staff_status`
- `store_status`
- `store_plan`
- `store_membership_status`
- `platform_admin_status`
- `onboarding_request_type`
- `onboarding_request_status`

Important RPC/function:

- `repairdesk_customer_list_page_v2`
- `repairdesk_customer_list_page`
- message-template sync compatibility functions
- inventory event compatibility sync function

## 8. Storage And Attachment Contracts

Order attachment bucket constant:

- `repairdesk-order-attachments`

Inventory attachment bucket constant:

- `repairdesk-inventory-attachments`

Attachment rules:

- Order attachment kinds: `device_front`, `device_back`, `screen_on`, `fault_photo`, `signature`, `other`.
- Inventory attachment kinds include purchase, proof, device, check, sale, and other evidence types in the inventory type model.
- Allowed server MIME types include image formats and PDF.
- Max file size is 8 MB.
- Server validates file name, MIME type, base64 payload, size, magic bytes, storage path, and same-store ownership.
- Attachment metadata tables are private; direct client storage access is intentionally not the source of truth.

## 9. Server-Side Business Invariants

These must remain server-enforced after refactor:

- Actor must be authenticated for business APIs.
- Store context must be resolved for store-scoped data.
- Platform approval requires platform admin.
- Inventory writes require owner/manager/technician/sales.
- Customer search must be limited and server-side.
- Customer/device/follow-up/message mutations must assert active-store ownership.
- Order status transitions must validate configured workflow targets.
- Reason-required order transitions must enforce reason.
- Order finance/payment writes must preserve balance and concurrency semantics.
- Quote changes can reset approval flow.
- Approval decisions can only move to allowed approved/rejected target statuses.
- Attachments must be private, validated, and store-scoped.
- Imports must preview before apply and respect store context.
- Audit logs must not include secrets or excessive PII.

## 10. Query Key Factories

Feature query keys exist and should be preserved:

- `src/features/orders/api/query-keys.ts`
- `src/features/customers/api/query-keys.ts`
- `src/features/inventory/api/query-keys.ts`
- `src/features/messages/api/query-keys.ts`
- `src/features/platform/api/query-keys.ts`
- `src/features/stores/api/query-keys.ts`

Refactor requirement:

- Keep invalidation intentional. Order/customer/inventory mutations often need to invalidate detail, lists, stats, workflow, and cross-feature summaries.
