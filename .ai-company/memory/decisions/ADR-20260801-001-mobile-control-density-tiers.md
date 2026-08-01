# ADR-20260801-001 — Mobile control density tiers

- Status: accepted
- Date: 2026-08-01
- Owner: RepairDesk Integration Lead
- Task: `TASK-20260801-001-mobile-density-v2-release`

## Context

RepairDesk previously interpreted a `44×44px` touch target as a universal mobile and tablet requirement. That made every search action, status filter and inline control equally large, consuming the first screen before business content appeared. WCAG 2.2 AA Target Size (Minimum) instead requires a `24×24 CSS px` target or an accepted spacing/semantic exception; `44px` is an enhanced target, not a universal AA floor.

## Decision

Replace the global rule with semantic tiers exposed by `controlDensity` and shared component variants:

- Micro `24-28px`: low-risk embedded actions with adequate spacing.
- Dense `32px`: frequent queue, pagination and filter actions.
- Standard `36px`: ordinary toolbar and icon actions.
- Input `38px` with a real `16px` editable font.
- Primary / Danger `40-44px`: consequential, destructive or bottom-bar actions.

The `/orders` mobile workspace is the reference implementation: its expanded header is bounded to `185px`, it collapses to a constant navigation row after scrolling, and queue controls use the Dense tier. Desktop sizing and business behavior remain unchanged.

## Consequences

- Mobile pages show more business information without weakening input zoom protection.
- Tests must assert semantic target classes instead of requiring every visible control to be `44px`.
- New components must choose a tier by action consequence and frequency; they may not introduce an arbitrary global minimum.
- Historical screenshots and task evidence keep their original dimensions and are not rewritten.

## Verification

- Responsive overflow matrix: 320, 390, 430, 768, 834, 1024 and 1440 widths.
- Chromium and WebKit mobile interaction checks.
- `/orders` expanded/collapsed header and card density measurements.
- Full lint, typecheck, unit test and production build gates.
