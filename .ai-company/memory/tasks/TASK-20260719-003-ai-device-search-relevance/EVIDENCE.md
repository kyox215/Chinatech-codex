# Evidence

| ID | Evidence | Status |
|---|---|---|
| E-001 | Owner production screenshot: `苹果15` returned `SAMSUNG A12` | verified |
| E-002 | `filterOrders`: generic `search` checks public number, customer, phone, IMEI and device label with one substring | verified |
| E-003 | `phoneMatches`: any digit length greater than zero can match normalized phone substring | verified |
| E-004 | Privacy-safe AI audit intentionally does not retain provider tool arguments | verified; exact live argument unknown |
| E-005 | `npm run typecheck` | passed |
| E-006 | Focused Vitest: 8 files / 159 tests | passed |
| E-007 | `npm run lint` | passed |
| E-008 | Final full Vitest: 306 files / 1951 tests | passed |
| E-009 | `npm run build -- --webpack` after network permission for existing Google Fonts | passed; production compile and 26 static pages generated |
| E-010 | 390×844 in-app browser exact input `苹果15`: 10 total, 8 visible Apple iPhone 15 cards, Samsung A12 absent, scrollWidth=clientWidth=390 | passed |
| E-011 | Targeted Playwright `mobile Apple 15 query excludes unrelated Samsung device results` | passed, 1/1 |
| E-012 | `screenshots/TASK-20260719-003-ai-device-search-relevance/apple-15-mobile-390.png` | verified visual evidence |

## Build environment note

The default Turbopack build cannot accept this isolated worktree's external `node_modules` symlink. Webpack production build passed after allowing network access for the repository's existing Google Fonts. This is an isolation-tooling limitation, not a source compile failure.

## Security and release conclusion

- Device queries now compare only with the authorized order's `device_label`; customer phone, contact phones, IMEI, public number and customer name are excluded from this path.
- Generic search behavior and all tenant/actor/view gates remain unchanged.
- No schema migration, dependency, secret, environment, production data or configuration change exists in this candidate.
- Exact production provider tool arguments for the reported request remain unknown by privacy design; the code-level false-positive path is closed by deterministic routing plus repository isolation.
- Production push/deploy remains unapproved for this task.
