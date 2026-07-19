# Incident Timeline

## 2026-07-19

- 09:40 CEST — Owner supplied a second mobile Chrome screenshot showing raw RepairDesk DOM after returning to the tab.
- 09:45 CEST — Declared SEV-2 / R3 / L2; no data or security impact observed.
- 09:45 CEST — Verified current public HTML contains the first recovery guard and current production commit is `READY`.
- 09:46 CEST — Identified the remaining control gap: fallback and shell visibility still depend on author stylesheet rules and cannot repair a pre-fix document without one refresh.
- 09:58 CEST — Reproduced complete style-layer loss, added independent inline fallback/shell presentation, and passed local full gates plus Chromium/WebKit recovery tests.
- 10:02 CEST — Fast-forwarded commit `362e4c3d7624793718fa65b7c96d84fac481c61d` to `main`.
- 10:04 CEST — Vercel deployment `dpl_3A6RVWswPoUgJueqmYiqJq1jHWRR` reached `READY`; both production domains resolved to it.
- 10:07 CEST — Real production Chromium and WebKit recovery suites passed 4/4 each; mobile and desktop normal-state screenshots were captured.
- 10:08 CEST — Incident closed with no data, auth, permission, API or database changes.

## Immediate mitigation

- Refresh or close/reopen the affected mobile tab once so it loads the current root document.
- Do not force-navigate existing Service Worker clients because that can lose unsaved form work.

## Recovery target

- New documents must preserve the recovery overlay and hide business DOM even when all author stylesheet nodes are absent.

## Root cause and contributing conditions

- Primary incident evidence: the supplied screenshot lacks the first guard's recovery copy, while the then-current public HTML contained it. This is strong evidence of a pre-guard document restored from a long-lived mobile tab.
- Confirmed implementation gap: the first guard's visibility rules lived in the same author style layer whose disappearance it was expected to survive.
- Browser and network conditions can initiate style loss on any device or engine; the protection therefore lives in root HTML and is verified on Chromium and WebKit at both mobile and desktop sizes.

## Resolution and residual operation

- The recovery overlay now owns fixed, centered inline presentation and maximum stacking order.
- The business shell now owns inline `display:none`; normal verified CSS overrides it with `display:contents!important`.
- Any tab whose root document predates the guard must be refreshed or closed/reopened once. After that one-time refresh, the loaded document contains the independent protection.
- Forced navigation of existing Service Worker clients remains intentionally excluded because it could discard unsaved order or customer input.
