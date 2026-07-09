# Chinatech RepairDesk Project Charter

Status: active
Owner: Hexiang Huang / 鹤祥
Business: Chinatech
Version: 1
Last reviewed: 2026-06-19 CEST

## 1. Project Mission

Build and maintain a practical RepairDesk system for Chinatech, a phone repair and electronics service shop in Floridia, Siracusa, Italy. The system should help the owner and staff manage repair orders, customers, devices, payments, buyback, refurbished sales, inventory, messages, and daily store operations with reliable data and fast workflows.

## 2. Platform And Store Relationship Declaration

RepairDesk's multi-store direction is an independent-store platform model.

The platform is not a headquarters, and stores are not branches or subsidiaries of the platform. The platform provides system service, onboarding, cooperation, support controls, shared application logic, and shared schema migrations. Each store remains an independent operating entity controlled by its own store owner.

This means Store A and Store B must be treated as separate private tenants. One store must not read, search, mutate, export, infer, or administer another store's customers, orders, payments, inventory, attachments, messages, settings, staff, or business records. Platform-level roles do not receive default business-data access merely because they operate the system.

## 3. Business Goals

- Make repair intake, diagnosis, repair tracking, payment, pickup, and after-sales follow-up faster and less error-prone.
- Support Chinatech's local business: phone repair, tablet repair, computer repair, mainboard repair, software support, accessories, screen protectors, phone cases, buyback, resale, and refurbished devices.
- Keep the workflow usable for a small local store where mobile, dense, task-focused screens matter more than marketing-style pages.
- Preserve reliable records for customer communication, device history, payment status, warranty context, and staff actions.

## 4. Target Users And Stakeholders

- Owner / manager: Hexiang Huang / 鹤祥.
- Front desk staff handling customer intake, search, quoting, payment, pickup, and communication.
- Technicians handling diagnosis, parts, repair tasks, photos, notes, and completion.
- Customers indirectly affected by receipts, messages, service status, and pickup experience.

## 5. Core Scope

- Orders and repair workflow.
- Customer records and device history.
- Buyback, resale, refurbished device handling.
- Inventory and accessories.
- Payment status, deposit, balance, and warranty-related context.
- Staff task views, mobile order detail, scanning, photo capture, and dense RepairOS UI.
- Store operations, platform settings, onboarding, and future multi-store controls where already planned.

## 6. Explicit Non-Scope Unless Approved

- Unapproved production data deletion or destructive migration.
- Public customer messaging, WhatsApp/SMS/email campaigns, or legal/financial commitments without owner approval.
- Replacing the existing Next.js App Router architecture.
- Reintroducing TanStack Router/Start or Vite app entrypoints.
- Large dependency, framework, auth, payment, or database strategy shifts without a documented approval package.

## 7. Technical Constraints

- Use Next.js App Router under `src/app/`; keep route files thin.
- Keep business UI in `src/features/*`, shared helpers in `src/shared/lib`, and cross-feature rules in `src/entities/*`.
- Client components use `@/lib/repairdesk/api` or feature API facades; they must not import `src/server/*`.
- Reuse `src/components/ui/*`, existing business badges/renderers, `src/lib/ui-patterns.ts`, and `src/lib/component-patterns.ts`.
- Colors must come from `src/styles.css` design tokens.
- Mobile detail/task/workflow pages follow RepairOS Floating Card language and the mobile order detail standard.

## 8. Data, Privacy, And Compliance Boundaries

Sensitive domains include customer PII, phone numbers, repair history, device identifiers, attachments/photos, payment state, store/tenant isolation, staff actions, and supplier/import data.

Rules:

- Minimize PII in UI payloads, logs, QR payloads, screenshots, and memory files.
- Service-side checks must protect identity, store isolation, permissions, and critical business rules.
- Treat any unauthorized cross-store business-data access as a tenant-isolation failure, including platform-admin paths without explicit owner-granted support access.
- Secrets and production credentials must never be copied into docs, memory, prompts, logs, or committed files.
- Legal/compliance guidance may flag risk, but final legal decisions require appropriate human/professional review.

## 9. Autonomy And Approval

Default autonomy is L2 controlled execution.

The AI company may autonomously perform low-risk, reversible, scoped code and documentation changes. Owner approval is required for destructive commands, production database changes, payment/permission changes, secret handling, paid procurement, public release/deployment, external customer communication, and major architecture or dependency decisions.

## 10. Verification Gates

Rules-only changes should run:

```bash
npm run agents:config
npm run agents:templates
npm run agents:check
```

Code or UI changes should run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

UI work also needs relevant mobile and desktop checks, including horizontal overflow checks for target viewports when layouts, dialogs, lists, tables, task pages, or detail pages change.

## 11. Decision Principles

- The owner's latest explicit instruction is the business source of truth.
- RepairDesk-specific rules override generic AI Company OS rules.
- Use the smallest safe change that satisfies the task.
- Prefer real verification over plausible explanations.
- Ask the owner only for decisions that materially affect business outcome, cost, data, safety, legality, or approval boundaries.
