# Role Policy Decision Package — L2-025

- Task: `TASK-20260619-230350-l2-025-role-policy-decision-package`
- Source baseline: `TASK-20260620-004/PERMISSION_MATRIX_BASELINE.md`
- Mode: L2 controlled execution.
- Current status: decision package only.
- Code/data changes: none.
- Decision owner: Hexiang Huang / 鹤祥, Owner / 老板.

## Approval Request

- Decision required: approve or revise the recommended RepairDesk role policy before any server authorization changes.
- Recommended option: Option A, conservative shop-operations policy.
- Default if no decision: keep current code behavior unchanged, keep P1 permission risk open, and do not implement role gates.
- Explicitly not approved by this package: production Supabase audit, RLS/grant changes, platform-admin changes, service-role scripts, deployment, data deletion, or customer communication changes.

## Current Verified Facts

- Current store roles are `owner`, `manager`, `technician`, `sales`, and `viewer`.
- Platform admin is separate from store roles.
- Store members have tenant context through `getRequestActor` and `requireStoreIdFromActor`.
- Inventory writes are currently gated to `owner`, `manager`, `technician`, and `sales`.
- Message settings/template writes, store member invite, and order workflow configuration are currently owner/manager gated.
- Platform onboarding list/approve/reject is platform-admin gated.
- Many order/customer/payment/message/attachment/approval write paths are store-context gated but do not have an explicit role gate in the current scan.
- UI labels map roles as: 店主, 经理, 技师, 销售/前台, 只读.

## Recommended Policy Principles

1. Server authorization is the source of truth; UI hiding is helpful but never sufficient.
2. `viewer` means read-only. It must not mutate orders, customers, payments, messages, attachments, inventory, settings, members, or workflow configuration.
3. `sales` means front-desk/commercial work: intake, customer data, quoting, customer communication, payment, pickup, and normal buyback/sale.
4. `technician` means repair/quality work: read assigned operational data, update technical repair progress, upload repair evidence, and record quality checks. It should not manage customer PII, payments, customer approvals, staff, settings, or bulk imports by default.
5. `manager` means daily shop administrator: all store operations except owner-only destructive/ownership actions.
6. `owner` means full store authority.
7. `platform_admin` approves platform onboarding and platform-level requests only; it does not automatically grant store business-data rights unless the same actor is also a store member.
8. Bulk, financial, staff, external-message, and destructive actions should be more restricted than ordinary read/update actions.

## Option A — Recommended Conservative Matrix

| Action group | Owner | Manager | Sales / front desk | Technician | Viewer | Platform admin | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| Switch active store | yes | yes | yes | yes | yes | no | Only if actor is active member of target store. |
| Read dashboard/options/basic store context | yes | yes | yes | yes | yes | no | Platform admin can read platform context, not store data unless member. |
| Read order list/detail | yes | yes | yes | yes | yes | no | Viewer read may expose PII; accept only if Owner wants viewer to see operational data. |
| Create repair order | yes | yes | yes | no by default | no | no | Owner may allow technician order creation as Alternative B. |
| Edit customer profile / phone / device ownership | yes | yes | yes | no | no | no | Technician can view needed data but not maintain PII. |
| Add repair notes / diagnosis / technical status | yes | yes | limited | yes | no | no | Sales limited to front-desk notes; technician owns repair progress. |
| Upload order repair/intake attachments | yes | yes | yes | yes | no | no | Attachment audit and PII minimization still required. |
| Manual order status transition | yes | yes | limited | limited | no | no | Manager/owner all; sales for intake/quote/pickup; technician for diagnosis/repair stages. |
| Batch order transition | yes | yes | no | no | no | no | Batch operations have higher blast radius. |
| Quote / finance edit | yes | yes | yes | no | no | no | Quote changes can reset customer approval. |
| Record payment / pickup balance | yes | yes | yes | no | no | no | Payment actions require commercial accountability. |
| Send customer notification / WhatsApp | yes | yes | yes | no by default | no | no | Technician messaging can be added later as templated repair updates if desired. |
| Send approval request / record customer decision | yes | yes | yes | no | no | no | Customer-facing commitment and workflow impact. |
| Customer follow-up create/complete | yes | yes | yes | limited | no | no | Technician only for repair-related follow-up if field-level support exists. |
| Inventory read | yes | yes | yes | yes | yes | no | Viewer read-only. |
| Inventory single-item intake/update/check/attachment | yes | yes | yes | yes | no | no | Matches much of current inventory write intent, but viewer denied. |
| Inventory sell / buyback payment / inventory transaction | yes | yes | yes | no by default | no | no | Financial inventory action. |
| Inventory bulk CSV import apply | yes | yes | no | no | no | no | Bulk mutation; preview may be owner/manager/sales if useful. |
| Store settings update | yes | yes | no | no | no | no | Current code already owner/manager gated. |
| Message template update/reset | yes | yes | no | no | no | no | Current code already owner/manager gated. |
| Message template preview | yes | yes | yes | yes | yes | no | Read-only preview unless it sends messages. |
| Order workflow status/transition config | yes | yes | no | no | no | no | Current code already owner/manager gated. |
| List members/invitations | yes | yes | no | no | no | no | Current code allows any active store member; recommended tighten. |
| Invite member | yes | yes | no | no | no | no | Current code already owner/manager gated; owner role cannot be invited. |
| Create store directly | no by default | no | no | no | no | platform approval only | Prefer onboarding request plus platform-admin approval. |
| Approve/reject onboarding | no | no | no | no | no | yes | Platform admin only. |
| Read audit logs | yes | yes | no | no | no | platform logs only | No current broad claim about UI/API availability. |
| Export full PII / destructive delete | owner only | no by default | no | no | no | no | Future actions; must be separately designed. |

## Role-Specific Summary

### Owner / 店主

- Full store authority.
- Can approve high-risk exceptions, manage members, settings, workflow, templates, financial operations, and sensitive exports/deletes when those features exist.
- Still needs separate platform-admin status for platform-level onboarding queues.

### Manager / 经理

- Runs daily store operations.
- Can manage non-owner staff invitations, settings, templates, workflow, finance/payment, inventory, order/customer operations, and message sending.
- Should not transfer ownership, run destructive data deletion, or perform production/platform operations by default.

### Sales / 前台/销售

- Owns customer-facing commercial flow: customer intake, order creation, quote, payment, pickup, customer messages, approval requests, and ordinary buyback/sale.
- Can do single-item inventory intake/update/sell.
- Should not manage staff, settings, workflow configuration, message templates, bulk imports, destructive actions, or platform onboarding.

### Technician / 技师/维修员工

- Owns repair execution: read assigned order/customer context, update diagnosis/repair progress, upload repair photos, record quality checks, and update repair-stage statuses.
- Should not edit customer PII, record payments, issue customer approval decisions, change quotes/finance, send customer-facing messages by default, manage staff/settings/workflow/templates, or run bulk imports.
- Open owner decision: whether technicians should be allowed to create full repair orders in a small-shop workflow. Recommended default is no until field-level permissions exist.

### Viewer / 只读

- Read-only role.
- May switch between stores where it is already a member and read allowed store views.
- Must not perform any mutation or customer-facing action.
- Open owner decision: whether viewer can see full customer PII or only reduced operational views. Current API likely returns full read payloads, so field-level read minimization is a separate follow-up.

### Platform Admin

- Approves/rejects platform onboarding and store creation/join requests.
- Does not automatically read or mutate store business data unless also a store member.
- Live platform-admin membership remains unverified until owner-approved remote audit.

## Option B — Operationally Flexible Small-Shop Policy

Use this if Chinatech wants fewer permission prompts and technicians/front-desk often perform each other's work.

- Keep `owner` and `manager` as full store admins.
- Allow `sales` and `technician` to create orders, update orders, transition statuses, upload attachments, and perform single-item inventory actions.
- Deny `viewer` all writes.
- Restrict only finance/payment, customer messaging, approval decisions, settings, members, workflow config, and bulk imports to owner/manager/sales.

Benefit: smaller implementation change and less chance of blocking daily work.
Risk: technician role remains broad for order mutation and may touch customer/customer-facing workflow more than least privilege requires.

## Option C — Strict Least-Privilege Policy

Use this only if the system is moving toward more staff separation or external employees.

- `viewer`: reduced read-only, ideally field-level PII masking.
- `technician`: only assigned repair tasks, technical notes, repair photos, and repair-stage status transitions.
- `sales`: customer intake, quote, payment, pickup, customer communication.
- `manager`: approvals, exceptions, bulk operations, workflow/settings.
- `owner`: destructive/export/ownership.

Benefit: strongest privacy and accountability posture.
Risk: requires more UI/API refactor, field-level gates, assignment-aware rules, and more tests before it is comfortable in daily shop use.

## Recommended Owner Decision

Approve Option A as the target policy, with one explicit choice:

| Question | Recommended answer | Why |
|---|---|---|
| Can technicians create full repair orders? | No for first implementation | Order creation often includes customer PII, quote, deposit, and customer-facing commitments. |
| Can viewers see full customer/order PII? | Temporarily yes for read-only, then revisit masking | Current API read payloads are not field-minimized; hiding PII is a separate project. |
| Can sales apply bulk inventory import? | No | Bulk import can change many inventory/payment records. |
| Can platform admin inspect store business data without membership? | No | Platform authority and store tenancy should remain separate. |
| Should direct `stores/create` remain self-service? | No for production | Prefer onboarding request plus platform-admin approval. |

## Implementation Boundaries After Approval

Do not implement the entire matrix in one large change. Use staged L2 tasks after Owner approval:

1. `L2-026` permission denial test plan: define route-level allowed/denied cases by role.
2. `L2-030` viewer read-only hardening: deny viewer mutations across router paths and add tests.
3. `L2-031` order/customer role gates: gate customer mutations, order finance/payment/message/approval, and batch transitions.
4. `L2-032` inventory and buyback fine-grain gates: separate single-item technical actions from finance/bulk import/sale actions.
5. `L2-033` member roster and store creation hardening: restrict roster listing and direct store creation according to Owner decision.
6. `L2-034` field-level technician/sales order action split: implement target-status and field-level checks if Option A is approved.
7. `L2-027` audit-log redaction/minimization policy remains separate and should run before production/customer-visible expansion.

Each implementation task must include server-side tests. UI hiding can be added for ergonomics, but it must not be the only control.

## Test Plan Candidate

Minimum role-denial test groups after approval:

- `viewer` denied: order create/update/finance/payment/transition/batch/attachment/notification/approval; customer create/update/device/tag/followup/message; inventory writes; settings/template/member/workflow writes.
- `technician` allowed: repair-stage transition, technical note/update if implemented, order/inventory attachment, inventory quality check.
- `technician` denied: payment, finance quote, approval decision/request, customer PII edit, customer message, member/settings/template/workflow, bulk import.
- `sales` allowed: customer/order intake, quote/finance, payment, customer message, approval request/decision, pickup, single-item buyback/sell.
- `sales` denied: staff/settings/template/workflow, bulk import by default, platform onboarding.
- `manager` allowed: all daily store operations except owner-only destructive/export/ownership.
- `platform_admin` allowed: platform onboarding only; denied store business mutations without store membership.
- Tenant guard: every allowed and denied path must still require active store context and must not fall back to default store in real repositories.

## Acceptance Criteria For Future Implementation

- Server-side authorization map exists close to router/service boundaries and is covered by tests.
- Every denied mutation returns a clear forbidden response without changing data.
- Audit logs record denied/allowed sensitive attempts where appropriate without storing sensitive request bodies.
- Role labels in UI match server behavior.
- Existing owner/manager workflows remain green.
- No production, migration, or service-role action occurs without explicit approval.

## Decision Status

- This package recommends Option A.
- Owner approval is pending.
- Until approval, do not change auth behavior.
