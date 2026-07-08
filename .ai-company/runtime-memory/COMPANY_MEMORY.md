# COMPANY MEMORY

- Owner: Hexiang Huang / 鹤祥
- Company: Chinatech
- Version: 1
- Last verified: 2026-06-19 CEST
- Status: active

## Mission and strategic objectives

Chinatech is a local phone repair and electronics service business in Floridia, Siracusa, Italy. The business serves local customers with repair, buyback, resale, refurbished devices, accessories, screen protectors, phone cases, tablet repair, computer repair, and related electronics services.

Strategic objective for the software project: build reliable, dense, practical internal tools that reduce manual work, improve order/customer/payment/inventory records, and support the owner and staff in daily store operations.

## Organization and decision rights

- Owner / 老板: Hexiang Huang / 鹤祥.
- AI operating model: Owner gives goals and constraints; the main Codex thread acts as CEO Agent and RepairDesk Integration Lead.
- Default autonomy: L2 controlled execution.
- Owner approval required for destructive commands, production data changes, payment/permission/privacy changes, paid procurement, public customer communication, deployment/release, and major architecture or dependency shifts.

## Company-wide rules and constraints

- Chinese is the primary owner communication language.
- Italian and English may be needed for local customer, supplier, UI, or public-facing content.
- Do not store secrets, production credentials, full customer PII, or hidden reasoning in memory files.
- Business data involving customers, devices, phone numbers, repair history, payments, staff actions, and attachments is sensitive.

## Canonical terminology

- Chinatech: the business/shop.
- RepairDesk: the internal management system in this repository.
- Owner / 老板: Hexiang Huang / 鹤祥.
- AI employee: task-specific department or sub-agent working under Integration Lead control.

## Active cross-project decisions

- AI Company OS v2.0 is adopted under `.ai-company/` as the company operating system.
- RepairDesk-specific root `AGENTS.md`, `AI智能部门管理/部门化管理设计.md`, `.agents/*`, and existing architecture/UI/data/security docs remain higher authority than generic `.ai-company/*` rules.

## Known organizational risks

- Overly broad AI autonomy could affect real customer data, payments, or permissions; default to L2 and request approval for high-risk actions.
- Storing excessive customer data in prompts, logs, screenshots, or memory would violate data minimization expectations.
- Generic AI Company OS role names may duplicate RepairDesk departments unless mapped through `.ai-company/REPAIRDESK_ADOPTION.md`.

## Review triggers

- Owner changes approval boundaries or autonomy level.
- New store, external integration, messaging channel, payment flow, customer data class, or production deployment process is introduced.
- Any security, privacy, or data incident occurs.
