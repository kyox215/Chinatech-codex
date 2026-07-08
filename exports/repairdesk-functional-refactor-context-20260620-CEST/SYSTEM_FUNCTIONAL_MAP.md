# RepairDesk System Functional Map

Last verified: 2026-06-20 CEST
Scope: system functionality only. UI design and visual layout details are intentionally excluded.

## 1. Product Definition

RepairDesk is an internal operating system for Chinatech, a phone repair and electronics resale shop in Floridia, Italy. The system manages repair work, customers, devices, buyback/resale inventory, messaging, store settings, staff roles, multi-store access, and platform onboarding.

Primary users:

- Owner / manager: oversees orders, customers, payments, settings, staff, store context, inventory, and platform approvals.
- Front desk: creates repair orders, searches customers, records devices, collects deposits, sends WhatsApp/SMS messages, and handles pickup.
- Technician: checks order task pages, updates repair status, records diagnosis, parts state, and device work progress.
- Sales/buyback staff: creates buyback quotes, records inventory checks, costs, purchase evidence, and resale transactions.
- Platform admin: reviews onboarding requests and approves or rejects store creation/join requests.

## 2. Application Entrypoints

Current App Router pages:

- `/` - dashboard work overview.
- `/login` - Supabase login and post-login redirect.
- `/onboarding` - user store onboarding, create-store or join-store request.
- `/platform` - platform onboarding approval queue.
- `/orders` - repair order queue.
- `/orders/new` - create repair order.
- `/orders/[id]` - repair order detail.
- `/orders/[id]/task` - technician/task-oriented order workflow page.
- `/customers` - customer CRM list and customer creation.
- `/customers/[id]` - customer profile, devices, orders, contact history, follow-ups, messaging, and tags.
- `/inventory` - inventory and resale item management.
- `/buyback` - buyback quote and buyback record workflow.
- `/messages` - store message templates and preview.
- `/settings` - store settings, store context, staff invitations, and order workflow configuration.
- `/offline` - offline/PWA fallback page.
- `/api/repairdesk/[...path]` - single RepairDesk API route.

## 3. Authentication, Onboarding, Stores, And Roles

Business purpose:

- Ensure only logged-in staff can access the system.
- Let new users request to create a store or join an existing store.
- Let platform admins approve onboarding requests.
- Keep every business record tied to an active store.

Core capabilities:

- Login through Supabase client.
- Remember-login preference and auth persistence behavior.
- Post-login redirect based on onboarding/store status.
- Onboarding status lookup with active store, available stores, pending requests, and platform-admin flag.
- Submit onboarding request:
  - `create_store`
  - `join_store`
- Platform admin list/approve/reject onboarding requests.
- Create store.
- Switch active store.
- List store members.
- Invite store member.

Roles:

- `owner`
- `manager`
- `technician`
- `sales`
- `viewer`

Important behavior:

- API routes call `getRequestActor` before dispatch.
- Pending-store users are allowed only for onboarding/platform paths.
- Inventory write operations require one of owner, manager, technician, or sales.
- Platform approval requires platform admin.
- Store membership and active store decide what data the actor may operate on.

Main files:

- `src/features/auth/screens/login-screen.tsx`
- `src/features/auth/screens/onboarding-screen.tsx`
- `src/features/auth/model/*`
- `src/features/platform/server/platform.repository.ts`
- `src/features/stores/server/store.repository.ts`
- `src/server/auth-context.ts`
- `src/features/stores/model/store-shell-context.ts`

## 4. Dashboard

Business purpose:

- Give the owner/front desk a work summary of active repair and operational workload.

Core capabilities:

- Reads order, workflow, customer, inventory, and store context data through existing API/query layers.
- Presents work insights derived from current orders and operational state.
- Links into core modules such as orders, customers, inventory, buyback, settings, and messages.

Important behavior:

- Dashboard should remain an aggregation layer.
- It should not own business mutations or duplicate domain logic that already exists in orders/customers/inventory modules.

Main files:

- `src/app/page.tsx`
- `src/features/dashboard/screens/dashboard-screen.tsx`
- `src/features/dashboard/model/dashboard-work-insights.ts`

## 5. Repair Orders

Business purpose:

- Manage repair jobs from customer intake to final pickup/closure.

Primary pages:

- `/orders`
- `/orders/new`
- `/orders/[id]`
- `/orders/[id]/task`

Core order entities:

- Customer.
- Device.
- Repair order.
- Workflow status.
- Order events.
- Message logs.
- Attachments.
- Payment records through order balance updates/events.

### 5.1 Order List

Capabilities:

- List orders with pagination.
- Search orders.
- Filter by:
  - legacy status
  - canonical workflow status
  - exception status
  - payment status
  - parts status
  - approval flow status
  - type
  - technician
  - supplier
  - paid/unpaid
  - overdue approval/pickup/any
- Show workflow counts.
- Export visible/listed order data to CSV.
- Print order list or order-related output through print components.
- Transition single order.
- Batch transition multiple orders.
- Open order detail from the queue.

Server APIs:

- `orders/list`
- `orders/list-page`
- `order-stats`
- `order-workflow`
- `order/transition`
- `order/batch-transition`
- `options`

Important guards:

- Transitions are validated server-side.
- Configured workflow targets must be enabled.
- Reason-required transitions must include a valid reason.
- Batch transition returns count and should not silently pretend all records changed if guards reject.

### 5.2 New Order

Capabilities:

- Search existing customers by name/phone.
- Intake-specific search can return exact customer match and history device candidates.
- Reuse customer history device or create new device snapshot.
- Create customer/device/order in one flow.
- Record:
  - order type
  - selected initial status
  - customer name and phones
  - device brand/model/IMEI/notes
  - issue description
  - diagnosis result
  - quotation amount
  - deposit amount
  - fault price items
  - warranty text/months
  - accessory notes
  - technician
  - supplier
  - internal tag
  - approval state
  - signature
- Initial status is resolved from configured workflow statuses, not hard-coded only in the UI.

Server APIs:

- `orders/create`
- `customers/search`
- `customers/intake-search`
- `customers/devices`
- `options`
- `order-workflow`

Important guards:

- Customer phone uniqueness is checked server-side.
- Order status must resolve to an allowed configured create status.
- Money fields are normalized server-side.
- Existing customer and contact phone data must be merged carefully.

### 5.3 Order Detail

Capabilities:

- Load full order detail: order, customer, device, supplier/options, events, messages, attachments.
- Edit customer display fields on the order.
- Edit device fields and device snapshot.
- Edit issue description and diagnosis result.
- Edit accessory notes.
- Edit warranty text/months with reason tracking.
- Edit finance fields:
  - quotation amount
  - deposit amount
  - balance amount
  - fault price items
- Record payment with method and amount.
- Decide customer approval:
  - approved
  - rejected
- Send approval request.
- Send generic notification.
- Send WhatsApp notification using templates and optional transition target.
- Upload order attachments.
- Show timeline/events.
- Print repair order sheets.
- Transition status.

Server APIs:

- `order/get`
- `order/update`
- `order/patch`
- `order/finance`
- `order/payment`
- `order/approval-request`
- `order/approval-decision`
- `order/notification`
- `order/whatsapp-notification`
- `order/attachment/upload`
- `order/transition`

Important guards:

- `expected_updated_at` is used for versioned writes/payment-style concurrency.
- Payment cannot exceed valid balance rules.
- Quote/finance changes may reset approval flow when relevant quote fields changed.
- Approval approved/rejected targets are constrained.
- Transition events and message events must be recorded.
- Attachments require allowed kind, MIME type, size, base64 data, magic-byte validation, private storage metadata, and same-store relation.
- Customer ownership/rebinding is not silently changed by editing display fields.

### 5.4 Order Task Mode

Capabilities:

- Load an order and workflow.
- Calculate stage guidance from canonical order workflow.
- Show next workflow actions for the current status.
- Require and collect transition reason when the target status requires one.
- Update order status from technician/task flow.

Server APIs:

- `order/get`
- `order-workflow`
- `order/transition`

Important guards:

- Task page is not a separate state machine; it uses the same server transition rules as order detail/list.
- Reason-required transitions must remain enforced server-side.

### 5.5 Order Workflow Configuration

Capabilities:

- List workflow statuses and transitions.
- Create workflow status.
- Update workflow status label, short label, tone, bucket, enabled state, filter visibility, create allowance, default create status.
- Reorder workflow statuses.
- Enable/disable status.
- Update transition targets from one status to others.

Server APIs:

- `order-workflow`
- `order-workflow/status/create`
- `order-workflow/status/update`
- `order-workflow/status/reorder`
- `order-workflow/status/enabled`
- `order-workflow/transitions/update`

Important guards:

- Status code format is validated.
- System/default status behavior must remain safe.
- Workflow status and transition records are store-scoped.
- Order list, new order, detail, and task pages all depend on this workflow contract.

## 6. Customer CRM

Business purpose:

- Maintain customer identity, devices, repair history, contact history, marketing preferences, follow-up tasks, and customer messaging.

Primary pages:

- `/customers`
- `/customers/[id]`

### 6.1 Customer List And Search

Capabilities:

- Server-side paginated customer list.
- Search by customer name/phone/contact phone.
- Filters for customer work state, marketing state, tags, and follow-up/work context.
- Customer preview/detail loading.
- Create customer.
- Page range and active filter count calculations.

Server APIs:

- `customers/list`
- `customers/list-page`
- `customers/search`
- `customer/get`
- `customer/create`

Important guards:

- Search must stay server-side and limited; do not load full PII lists into the client and filter there.
- List uses fast RPC fallback logic when available.
- Store isolation applies to customer rows and related stats.

### 6.2 Customer Detail

Capabilities:

- Load profile, devices, orders, interactions, follow-ups, tags, and stats.
- Update customer:
  - name
  - phone
  - backup/contact phones
  - email
  - language
  - preferred channel
  - SMS/marketing consent
  - notes
  - marketing notes
  - blacklist state
- Upsert customer device.
- Delete customer device.
- Set customer tags.
- Create follow-up.
- Complete follow-up.
- Send customer message and record interaction.

Server APIs:

- `customer/get`
- `customer/update`
- `customer/device/upsert`
- `customer/device/delete`
- `customer/tags/update`
- `customer/followup/create`
- `customer/followup/complete`
- `customer/message`

Important guards:

- Customer phone availability is checked server-side.
- Customer/device/follow-up/tag mutations must assert the target customer belongs to the active store.
- Customer messages should record interaction history.
- Customer interactions require `store_id`; a repair migration exists for environments where this column was missing historically.

## 7. Inventory And Resale

Business purpose:

- Track second-hand electronics from intake, evaluation, purchase, data wipe, refurbishment, listing, reservation, sale, cancellation, return, or recycling.

Primary page:

- `/inventory`

Statuses:

- `intake`
- `evaluating`
- `offer_made`
- `purchased`
- `data_wipe`
- `refurbishing`
- `ready_for_sale`
- `listed`
- `reserved`
- `sold`
- `cancelled`
- `returned`
- `recycled`

Core capabilities:

- List inventory with filters and pagination.
- Load inventory stats.
- Load item detail with checks, transactions, events, and attachments.
- Create intake item.
- Update item fields.
- Transition item status.
- Record quality/functional checks.
- Upload inventory attachments.
- Record transaction:
  - buyback payment
  - sale payment
  - refund
  - repair cost
  - fee
  - adjustment
- Sell inventory item.
- Preview SeaTable/electronics CSV import.
- Apply SeaTable/electronics CSV import.

Server APIs:

- `inventory/list`
- `inventory/list-page`
- `inventory/stats`
- `inventory/get`
- `inventory/intake/create`
- `inventory/update`
- `inventory/transition`
- `inventory/check`
- `inventory/attachment/upload`
- `inventory/transaction`
- `inventory/sell`
- `inventory/import/electronics/preview`
- `inventory/import/electronics/apply`

Important guards:

- Inventory writes require owner, manager, technician, or sales role.
- Status transitions are constrained by inventory workflow rules.
- Buyback purchase evidence and required checks are enforced before purchase-style transitions.
- Inventory attachments use private storage metadata and same-store foreign keys.
- Import preview must avoid exposing raw sensitive CSV values in warnings.
- Financial summaries must include purchase, repair costs, fees, refunds, sale, and margin-related data.

## 8. Buyback

Business purpose:

- Help staff quote and record second-hand phone/electronics buybacks, then hand accepted records into inventory.

Primary page:

- `/buyback`

Core capabilities:

- Guided buyback quote draft.
- Apple/iPhone price guide based quote calculation.
- Device condition, storage, battery, screen/body state, signature, document, and function-test factors.
- Function test groups and required inspection checks.
- Market price and deduction calculation.
- Create or transition linked inventory intake record.
- Show buyback record workflow based on inventory item status and transactions.

Data relationship:

- Buyback is implemented as a business workflow around inventory records and payloads, not a separate top-level database domain with its own independent final sale system.
- Accepted buyback records become inventory items and continue through inventory statuses.

Main files:

- `src/features/buyback/model/buyback-quote.ts`
- `src/features/buyback/model/apple-price-guide.ts`
- `src/features/buyback/model/buyback-record-workflow.ts`
- `src/features/buyback/components/buyback-quote-workspace.tsx`
- `src/features/buyback/screens/buyback-screen.tsx`

Important guards:

- Buyback quote logic must not be lost when inventory code is refactored.
- Purchase evidence, checks, transactions, and state transitions are enforced in inventory repository logic.
- Repair cost must be included in resale profitability calculations.

## 9. Messages And Templates

Business purpose:

- Provide store-specific WhatsApp/SMS message templates for orders and customers.

Primary pages:

- `/messages`
- settings sections that edit store settings used by templates

Core capabilities:

- Load store settings.
- Update store settings.
- List message templates.
- Update template.
- Reset template to default.
- Render template preview with variables.
- Send order/customer messages through manual WhatsApp/SMS style flows and store logs.

Template domains/channels/languages:

- Domain: `order`, `customer`.
- Channel: `whatsapp`, `sms`.
- Language: `it`, `zh`, `en`.

Server APIs:

- `settings/store`
- `settings/store/update`
- `message-templates`
- `message-template/update`
- `message-template/reset`
- `message-template/preview`
- `order/notification`
- `order/whatsapp-notification`
- `order/approval-request`
- `customer/message`

Important guards:

- Sending WhatsApp messages should open/send through user-controlled flow where applicable and record message logs.
- Template preview is a server/client contract; variables must render consistently.
- Message logs must avoid storing unnecessary sensitive data beyond business need.

## 10. Store Settings

Business purpose:

- Configure store identity and default operational rules.

Primary page:

- `/settings`

Core capabilities:

- Load store settings.
- Update store name, address, phone, WhatsApp, email.
- Configure default inventory warranty months.
- Configure default order warranty months.
- Configure order workflow statuses/transitions.
- Create/switch store.
- Invite staff/member.
- View store members.

Server APIs:

- `settings/store`
- `settings/store/update`
- `stores/context`
- `stores/create`
- `stores/switch`
- `stores/members`
- `stores/invite-member`
- order workflow APIs listed in the orders section

Important guards:

- Store settings are store-scoped after multi-store foundation.
- Store switching invalidates current cached data.
- Staff invitation role must be sanitized.
- Member management requires sufficient role.

## 11. Platform Administration

Business purpose:

- Let a platform admin approve or reject onboarding requests before a user can create or join a store.

Primary page:

- `/platform`

Core capabilities:

- List onboarding requests.
- Approve request.
- Reject request.
- Create store on approval for create-store requests.
- Add membership on approval for join-store requests.
- Write platform audit logs.

Server APIs:

- `platform/onboarding/requests`
- `platform/onboarding/approve`
- `platform/onboarding/reject`
- `onboarding/status`

Important guards:

- Only platform admins may approve/reject.
- Request status must be pending before action.
- Store slug uniqueness is handled server-side.
- Approval writes staff profile and store membership records.

## 12. Capture, Attachments, Barcode, And Camera

Business purpose:

- Support repair and inventory evidence capture.

Core capabilities:

- Attachment draft rules.
- Barcode parsing.
- Camera capture sheet.
- Barcode scanner sheet.
- Order attachment upload.
- Inventory attachment upload.

Attachment limits:

- Accepts images and PDF-like configured types through client rules.
- Server side allows constrained MIME types and max 8 MB for order/inventory attachments.
- Server validates magic bytes and stores private metadata.

Main files:

- `src/features/capture/model/attachment-rules.ts`
- `src/features/capture/model/barcode-parser.ts`
- `src/features/capture/components/*`
- `src/features/orders/server/order.repository.ts`
- `src/features/inventory/server/inventory.repository.ts`

## 13. SeaTable Imports

Business purpose:

- Import legacy/operational data from SeaTable-style CSV files.

Order import:

- `src/features/orders/import/seatable-riparazione.ts`
- `scripts/import-seatable-riparazione.ts`

Inventory/electronics import:

- `src/features/inventory/import/seatable-electronics.ts`
- API preview/apply endpoints under inventory import.

Important behavior:

- Preview before apply.
- Map legacy statuses into current statuses.
- Import warnings should be structured.
- Apply must respect active store and avoid leaking raw sensitive values in UI/reporting.

## 14. Audit, Tenant Isolation, And Privacy

Core behavior:

- Most write APIs use `auditGeneric` in the API router or feature-specific repository event logs.
- `writeAuditLog` records actor, action, entity type, entity id, before/after/metadata when available.
- Supabase direct client access is not used for business writes from browser components.
- Service-role operations are server-side only.
- Direct table access from anon/authenticated is revoked for core business tables; service role is granted.
- Store-level data isolation is implemented through `store_id`, actor context, repository filters, and server assertions.

Sensitive data classes:

- Customer names, phones, email, notes, contact history.
- Device IMEI/serials.
- Order issue descriptions, diagnosis, attachments, signatures.
- Inventory purchase/sale costs and documents.
- Staff emails and roles.
- Supabase keys and service-role credentials.

Refactor warning:

- Never move service-role logic into client components.
- Never expose full customer lists or private attachments to the browser without server filtering.
- Never treat UI-disabled buttons as business enforcement.

## 15. Mock And E2E Fallback

Core behavior:

- API source uses Supabase implementation when Supabase config exists and E2E auth bypass is not enabled.
- Otherwise it imports `src/lib/mock/api`.
- Mock source fills selected APIs for local/demo behavior and can throw for unsupported platform flows.

Important files:

- `src/lib/mock/api.ts`
- `src/lib/mock/enums.ts`
- `src/lib/mock/fixtures.ts`
- `src/features/*/testing/mock-api.ts`
- `src/shared/lib/e2e-auth-bypass.ts`

Refactor warning:

- Mock contracts must stay aligned with `src/lib/repairdesk/api.ts`, Zod schemas, and real services.
