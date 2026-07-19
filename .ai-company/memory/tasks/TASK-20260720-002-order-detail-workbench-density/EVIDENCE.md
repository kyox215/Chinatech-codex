# Evidence

- UI implementation: `src/features/orders/screens/order-detail-screen.tsx`, `src/features/orders/components/order-hero.tsx`, `src/features/orders/components/order-overview-tab.tsx`.
- Shared constraints: `src/lib/ui-patterns.ts`, `src/lib/component-patterns.ts`.
- Loading and tabs: `src/features/orders/components/order-detail-skeleton.tsx`, `src/features/orders/components/order-detail-tabs.tsx`.
- Automated layout contract: `tests/e2e/order-desktop-ui-audit.spec.ts`.
- Overview screenshot: `screenshots/TASK-20260720-002-order-detail-workbench-density/desktop-overview-1440.png`.
- Records screenshot: `screenshots/TASK-20260720-002-order-detail-workbench-density/desktop-records-1440.png`.
- Validation at checkpoint: agents config passed; full lint passed; typecheck passed; 314 Vitest files / 2046 tests passed; production build passed; Playwright layout suite 5/5 passed.
