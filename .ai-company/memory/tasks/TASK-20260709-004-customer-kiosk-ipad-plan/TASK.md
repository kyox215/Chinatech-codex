---
schema_version: 1
task_id: TASK-20260709-004-customer-kiosk-ipad-plan
status: implemented_mvp_foundation
owner: CEO-Orchestrator
risk_level: R3
autonomy_level: L2
created_at: 2026-07-09
updated_at: 2026-07-09
---

# TASK-20260709-004 Customer Kiosk iPad Plan

## Owner Goal

Plan a RepairDesk feature where a front-desk iPad can be bound as a customer-only form/signature device. Staff can start or edit an order from phone/desktop, push customer name/phone/signature tasks to the iPad, and request pickup signature after scanning the printed order QR.

## Business Value

- Reduce manual data-entry errors for customer names and phone numbers.
- Capture clearer customer consent/signature evidence.
- Support mobile staff workflow while keeping the customer-facing iPad locked down.
- Improve pickup closure traceability.

## In Scope

- Product plan and implementation roadmap.
- Kiosk device/session model.
- Staff push flows from new order, order detail, and QR task page.
- Customer-facing iPad form/signature experience.
- Data/API/realtime/security acceptance criteria.
- Local MVP foundation implementation for device pairing, kiosk sessions, public kiosk page, settings management, and order/task push.

## Out Of Scope

- Production database migration execution.
- Production deployment.
- Final legal/privacy wording.
- Full staff review/accept/return workflow that mutates canonical customer/order records.
- `/orders/new` intake auto-fill after customer iPad submission.
- Realtime push delivery; current implementation uses polling.
- External MDM or third-party e-signature procurement.

## Classification

- Business domains: orders, customers, settings, realtime, attachments.
- Technical domains: product workflow, data model, API, frontend, security, QA.
- Risk: R3 because customer PII, signatures, device authorization, and order completion are involved.
- Autonomy: L2 for local code/docs/migration draft after owner asked to set goal, plan, complete, and push all changes. Production migration/deploy/legal copy still require explicit approval.
- Multi-agent: not spawned. Reason: current callable multi-agent tool policy only allows spawning when the user explicitly asks for sub-agents/delegation. Department review was performed by main thread using project skills and repo evidence.

## Owner Decisions

- 2026-07-09: Owner confirmed pickup signature is not mandatory for MVP completion.
- Product rule: if staff completes pickup without customer signature, show a strong warning and allow staff override; record the override/audit event.

## Deliverables

- `docs/CUSTOMER_KIOSK_IPAD_PLAN.md`
- This task memory package.
- `supabase/migrations/20260709233000_customer_kiosk_ipad_mvp.sql`
- Kiosk source under `src/features/kiosk/`, `src/app/kiosk/`, and `src/app/api/kiosk/`.
- Settings/order/task page integration for pairing and pickup-signature session push.
- Visual evidence under `screenshots/TASK-20260709-004-customer-kiosk-ipad-plan/`.

## Acceptance

- Plan covers MVP, flows, data model, API, realtime, UI states, security, phases, acceptance criteria, rollback, and owner decisions.
- Plan references existing RepairDesk capabilities instead of proposing a parallel app.
- Local implementation compiles, typechecks, tests, builds, and renders `/kiosk` without staff AppShell.
- No production database migration is applied in this task.
