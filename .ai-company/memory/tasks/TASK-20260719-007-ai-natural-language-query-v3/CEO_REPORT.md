# CEO Report — AI 自然语言订单查询 V3

## Outcome

The RepairDesk assistant now executes arbitrary-date and device-series order questions through a server-owned closed-world query compiler. The reported half-year Apple 15 query resolves to the exact six-month Europe/Rome range and cannot be replaced by Samsung A12, previous-month, amount-anomaly or active-only filters invented by the model.

## User-visible behavior

- Local and model-assisted modes remain selectable; model mode is labelled as assistance rather than proof of understanding.
- Usage and processing mode share one compact collapsed row.
- Exact query scope, date field/range/timezone and condition sources are available in a collapsible disclosure.
- Interpretation can be confirmed, defaulted, corrected, clarification-required or permission-limited.
- Results expand and support permitted actions inside the sheet; only `打开订单` navigates.

## Verification and release

- Focused: 9 files / 156 tests.
- Final candidate: lint, typecheck, 311 files / 2,033 tests and Webpack production build passed.
- Core changed browser scenarios: 2/2; responsive inspection at 390/430/768/1280 with no horizontal overflow or console warning/error.
- Business release: `main@445b5e8117fd5bd8fcad33eb4ea120a5688e1816`.
- Vercel: `dpl_9e2FqCMMyfKuRiyHVHcbUzm7NVSc`, READY, exact business SHA, bound to `www.chinatech.in` and `chinatech.in`.
- Production smoke and error/fatal log scan passed without provider use or customer data.

## Boundaries and rollback

No database migration, secret/config/model/budget/allowlist change or production data write occurred. Inline AI writes remain disabled. Archive queries require explicit permission. Roll back by disabling the AI parent flag or promoting the prior READY deployment; no data rollback is needed.

## Visual evidence

- `screenshots/TASK-20260719-007-ai-natural-language-query-v3/apple-15-model-collapsed-mobile-390.png`
- `screenshots/TASK-20260719-007-ai-natural-language-query-v3/apple-15-model-collapsed-desktop-1280.jpg`
- `screenshots/TASK-20260719-007-ai-natural-language-query-v3/apple-15-scope-expanded-desktop-1280.jpg`
