# Evidence Index — TASK-20260718-003-safari-phone-input-fix

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-18T07:44:02Z | IntegrationLead |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-18T07:52:39Z` `e2c9c23aa7` — npx vitest run phone-keypad/customer lookup: 2 files, 5 tests passed
- `2026-07-18T07:52:39Z` `e6f4197e51` — WebKit: desktop native input + tablet virtual keypad 2/2 passed; mobile phone flows 3/3 passed
- `2026-07-18T07:52:39Z` `a687b1f340` — Chromium: desktop native input + tablet virtual keypad 2/2 passed
- `2026-07-18T07:52:39Z` `bef186a3a1` — npm run lint passed; npm run typecheck passed; npm run test passed (227 files, 1537 tests)
- `2026-07-18T07:52:39Z` `1e7a537d27` — npm run build -- --webpack passed; 24 static pages generated
- `2026-07-18T07:52:39Z` `4b76f6c0da` — screenshots/TASK-20260718-003-safari-phone-input-fix/phone-desktop-native-input-webkit.png
- `2026-07-18T07:52:39Z` `8cad75741f` — screenshots/TASK-20260718-003-safari-phone-input-fix/phone-tablet-virtual-keypad-webkit.png
- `2026-07-18T07:56:44Z` `d306b0eac2` — post-rebase npm run lint passed; npm run typecheck passed
- `2026-07-18T07:56:44Z` `a109705794` — post-rebase npm run test passed (238 files, 1579 tests)
- `2026-07-18T07:56:44Z` `dfc9cf05a7` — post-rebase npm run build -- --webpack passed
- `2026-07-18T07:56:44Z` `3e5ce4dff7` — post-rebase WebKit desktop native input + 1023px tablet virtual keypad 2/2 passed
- `2026-07-18T08:00:29Z` `96860314a5` — origin/main = 2b8b23528ae264ebce3eb7af8072903bacda8479
- `2026-07-18T08:00:29Z` `f9d3e1be02` — Vercel deployment dpl_FtLBehB6W2KmtSH4fkZXoqAxvPEp READY, target production, commit 2b8b2352
- `2026-07-18T08:00:29Z` `fba0fe7352` — curl https://chinatech.in/orders/new -> HTTP 200 at /login?next=/orders/new (expected unauthenticated flow)
