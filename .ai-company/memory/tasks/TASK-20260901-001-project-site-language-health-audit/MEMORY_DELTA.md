# Memory Delta — TASK-20260901-001-project-site-language-health-audit

## Candidate project facts

- Candidate: core employee locale infrastructure for exactly `zh-CN`, `it-IT`, `en` remains production-active and structurally complete; full-site translation remains partial. Source: E-005..E-011; status: verified 2026-09-01; owner: Frontend + QA; scope: employee UI; review trigger: locale/provider/root layout/catalog or customer-route changes.
- Candidate: `/r` is intentionally fixed Italian; Kiosk is also fixed-Italian by routing but currently has mixed English/Chinese customer-facing copy and must not be represented as language-complete. Source: E-009/E-019; status: verified; owner: Frontend + Product/Content; review trigger: Kiosk/public-customer work.
- Candidate: current main/production baseline is `8e349b06...`, Vercel deployment `dpl_AP6Y4eDmFgukeS4boDjDtqsNEJY3` READY. Source: E-002/E-003; status: point-in-time fact; owner: Release; review trigger: next deployment.

## Candidate department updates

- Candidate QA update: i18n release gates must include both foundational switcher and Release A/deep-domain specs in automatic Chromium/WebKit CI; environment-dependent skips cannot count as a release pass. Source: E-004/E-019; owner: QA/Release; review trigger: workflow or i18n surface changes.
- Candidate UX update: public auth errors need inline field association/focus behavior, and Kiosk fixed-Italian surfaces require one-language consistency including metadata, ARIA and fallbacks. Source: independent UX/QA reviews; owner: UX/Frontend; review trigger: auth/Kiosk work.
- Candidate Architecture update: oversized Order/router/repository modules, cross-feature imports, artifact bloat and missing error/correlation infrastructure are the highest maintainability/operability debts. Source: E-014..E-016; owner: Architecture/Platform; review trigger: related refactor or release-governance work.

## Candidate decisions / ADRs

- Candidate decision: continue language delivery as bounded domain releases rather than relabeling raw Han counts as defects or attempting one site-wide rewrite. Source: E-011/E-012/E-019; status: recommended, not implementation authorization; owner: Integration Lead; review trigger: next translation task intake.

## Candidate lessons and capability evidence

- C1 audit evidence only: three independent read-only reviews plus reproducible local and public-production checks converged without source/prod mutation. This does not grant implementation, release, migration, dependency or production authority.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
