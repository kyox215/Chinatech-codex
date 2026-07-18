# Stage 02 — Profit Reports and Trends

Status: completed

## Goal

Deliver an Owner/authorized-Manager Profit Center with correct operational gross-margin definitions and visible data completeness.

## Scope

- Expected and realized repair gross margin, collected cash kept separate.
- Date-range summary, daily/monthly trends and order drilldown.
- Unknown/estimated/confirmed coverage, negative-margin and below-cost indicators.
- Completed/delivered, cancelled, refunded and rework rules.
- Dedicated server projection and query key; no client-side full-order aggregation.
- Thin `/finance` route plus sidebar, AppBar and command-palette navigation.
- Responsive desktop/tablet/mobile loading, empty, error, no-permission and partial-data states.

Dependency note: catalog and supplier breakdowns require the normalized parts-procurement
model from Stage 03. They are owned by Stage 03 and must re-run the Profit Center regression
after joining those dimensions; Stage 02 does not fabricate supplier facts from the existing
single supplier field.

## Delivered

- Private `repairdesk_order_profit_facts_v1` projection and bounded,
  store-timezone-aware `repairdesk_read_profit_center_rpc`.
- Separate expected quote margin, delivered quote margin and collection reference; the
  collection reference is explicitly labelled as not refund-adjusted.
- Unknown, estimated and confirmed coverage; zero is a known cost while null remains unknown.
- Cancelled order exclusion, refunded quote-margin exclusion, rework markers and negative-margin
  counts.
- Permission-gated `/finance` workspace, navigation, command search, date range, daily/monthly
  trends, accessible trend table and PII-free order drilldown.
- Synthetic mock data and screenshots for a financial page without customer PII.

## Validation

- Hand-calculated fixture reconciliation including refund/cancel/rework/zero/unknown cases.
- Permission and store-isolation tests for summary, trend and drilldown.
- Query-bound and supporting-index evidence.
- Component tests and browser checks at 390, 430, 768, 1024, 1280 and 1440 widths.
- No horizontal overflow; screenshot evidence with synthetic/non-PII data.

## Verification result

- Exact disposable PostgreSQL run: Stage 01 migration, profit fixture, Stage 02 migration and
  assertions passed with `order_cost_phase2_profit_harness_passed`.
- Reconciled fixture values: expected orders 5/eligible 4, quote €270, known cost €75, exact
  margin €115, one incomplete, one estimated, one negative; completed orders 4/eligible 3,
  exact margin €115; collection reference €110 plus one non-EUR entry.
- Focused Vitest: 5 files / 56 tests passed; permission-targeted store tests also passed.
- TypeScript and changed-file ESLint passed; `npx next build --webpack` passed. The ordinary
  Turbopack build cannot follow the isolated worktree's external `node_modules` symlink, which is
  an isolation-tooling limitation rather than an application compile failure.
- Browser checks passed at 390, 430, 768, 1024, 1280 and 1440 pixels: no error overlay, no
  console error, no horizontal overflow, key margin and incomplete-cost labels visible.
- Feature-off browser check: direct `/finance` showed the no-permission state, the finance link
  count was zero, no financial value appeared and the server log contained no profit request.
- Screenshot evidence:
  - `screenshots/stage-02-profit-center-390.png`
  - `screenshots/stage-02-profit-center-1440.png`

## Exit criteria

- Exact profit is never displayed when required cost is unknown.
- Reports distinguish expected, realized, collected and data coverage.
- Targeted tests and stage checkpoint pass.

Exit criteria satisfied on 2026-07-18. Stage 03 owns catalog/supplier dimension integration and
must re-run this stage's profit regression before it can close.
