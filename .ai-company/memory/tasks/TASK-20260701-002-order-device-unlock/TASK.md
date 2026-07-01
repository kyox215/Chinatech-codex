# TASK-20260701-002 Order Device Unlock Field

Status: completed
Owner: Integration Lead / CEO Agent
Started: 2026-07-01T01:04:00+02:00
Completed: 2026-07-01T01:26:39+02:00
Autonomy: L2 controlled execution
Risk: R2 privacy-sensitive order data and UI/API workflow change

## Owner Goal

Add a phone password / unlock method capability to orders, including order list summaries, new order creation, order detail display, full edit, and quick/mobile edit. Supported methods are text, PIN, and Android-style 3x3 pattern.

## Scope

In scope:
- Order data model, API schemas, mock API, Supabase-compatible migration.
- New order and edit order forms.
- Desktop list row, mobile list card, desktop detail overview, and mobile order detail.
- Validation helper and unit/API/mock regression tests.
- Privacy behavior: lists show only method summaries; details default hidden; audit payloads do not store plaintext unlock values or pattern sequences.

Out of scope:
- Applying the production database migration.
- Including unlock secrets in print, export, WhatsApp, SMS, or external messages.
- New permission/approval flow for revealing or exporting passwords.

## Agents

- Main thread: Integration Lead, single business-code writer.
- no-spawn reason: user requested implementation, not explicit multi-agent/department execution; scoped L2 change with overlapping file ownership risk, so review and QA were performed in main thread.

## Acceptance

- `CreateOrderInput`, `UpdateOrderInput`, and `PatchOrderChanges` accept `device_unlock`.
- Server and mock paths normalize text/PIN/pattern with one shared helper.
- Pattern values require 4-9 unique points in the range 1-9.
- Order list APIs/UI do not expose `device_unlock_value` or `device_unlock_pattern`.
- Detail UI defaults to hidden and reveals only after explicit click.
- New order and mobile edit support selecting and drawing/clicking a 3x3 pattern.
- Validation and screenshots are recorded in `EVIDENCE.md`.
