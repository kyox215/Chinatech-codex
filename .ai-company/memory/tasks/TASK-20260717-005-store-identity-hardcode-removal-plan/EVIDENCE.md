# Evidence - Store Identity Hardcode Removal Plan

| ID | Evidence | Source | Finding |
|---|---|---|---|
| E-001 | Project memory | `.ai-company/memory/PROJECT_MEMORY.md` | RepairDesk direction is independent partner stores, shared DB, strict tenant isolation, settings-based differences. |
| E-002 | Independent store plan | `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PLAN.md` | Platform is not headquarters; every store is a private tenant. |
| E-003 | Progress doc | `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PROGRESS.md` | Shared database only is approved; store differences belong in settings/feature flags, not code forks. |
| E-004 | Source scan | `rg --files-with-matches ... src --glob '!**/*.test.*'` | Active source hits include login, sidebar, buyback agreement, mocks, and store identity guard. |
| E-005 | Runtime guard | `src/entities/store/model/store-output-identity.ts:84` | Non-default stores with legacy Chinatech/Floridia identity are blocked from output. |
| E-006 | Order link source | `src/features/orders/screens/order-detail-screen.tsx:374` | Order WhatsApp/approval URL currently uses `window.location.href`. |
| E-007 | Customer link source | `src/features/customers/screens/customer-detail-screen.tsx:132` | Customer message origin currently uses `window.location.origin`. |
| E-008 | WhatsApp message path | `src/features/orders/forms/notify-dialog.tsx:82` | WhatsApp body is built from `orderUrl` and then opened through `wa.me`. |
| E-009 | Login hardcoding | `src/features/auth/screens/login-screen.tsx:226` | Login page displays Chinatech name, address, and Floridia. |
| E-010 | Buyback legal hardcoding | `src/features/buyback/model/buyback-agreement.ts:3` | Buyback legal versions and text hard-code Chinatech identity. |
| E-011 | QR docs hardcoding | `docs/SCAN_SEARCH_PAYLOADS.md:20` | QR URL form still uses `https://chinatech.in/orders/{orderId}/task`. |
| E-012 | Historical migration hardcoding | `supabase/migrations/20260611001527_message_templates_settings.sql:3` | Early defaults hard-code ChinaTech/Floridia; history should not be rewritten. |

## Commands Run

- `git status --short`
- `rg -n "Chinatech|CHINATECH|ChinaTech|chinatech|Viale Vittorio Veneto|96014|Floridia|Siracusa|kyox120|www\\.chinatech|chinatech\\.in" ...`
- `rg --files-with-matches "Chinatech|CHINATECH|ChinaTech|chinatech|Viale Vittorio Veneto|96014|Floridia|Siracusa|kyox120@gmail|www\\.chinatech|chinatech\\.in" src ...`
- Targeted `sed` / `nl -ba` reads for the files listed above.

No tests were run because this is a planning-only task and no business code was changed.
