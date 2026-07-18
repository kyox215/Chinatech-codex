# Stage 02 — Profit Reports and Trends

Status: in_progress

## Goal

Deliver an Owner/authorized-Manager Profit Center with correct operational gross-margin definitions and visible data completeness.

## Scope

- Expected and realized repair gross margin, collected cash kept separate.
- Date-range summary, daily/monthly trends, category/supplier breakdown and order drilldown.
- Unknown/estimated/confirmed coverage, negative-margin and below-cost indicators.
- Completed/delivered, cancelled, refunded and rework rules.
- Dedicated server projection and query key; no client-side full-order aggregation.
- Thin `/profit` route plus sidebar, AppBar and command-palette navigation.
- Responsive desktop/tablet/mobile loading, empty, error, no-permission and partial-data states.

## Validation

- Hand-calculated fixture reconciliation including refund/cancel/rework/zero/unknown cases.
- Permission and store-isolation tests for summary, trend and drilldown.
- Query-bound and performance-plan evidence.
- Component tests and browser checks at 390, 430, 768, 1024, 1280 and 1440 widths.
- No horizontal overflow; screenshot evidence with synthetic/non-PII data.

## Exit criteria

- Exact profit is never displayed when required cost is unknown.
- Reports distinguish expected, realized, collected and data coverage.
- Targeted tests and stage checkpoint pass.
