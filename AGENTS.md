# RepairDesk Agent Instructions

Use these rules when generating or editing pages in this repository.

- Read `AI智能部门管理/部门化管理设计.md` before non-trivial work. Use it to classify the request, decide whether current web research is required, choose single-agent vs multi-agent execution, assign departments, set sub-agent permission mode, and define verification.
- Read `docs/UI_PAGE_GENERATION_DECLARATION.md` before adding pages.
- Read `docs/COMPONENT_GENERATION_DECLARATION.md` before adding reusable components.
- Import reusable layout/class declarations from `src/lib/ui-patterns.ts` and component declarations from `src/lib/component-patterns.ts`.
- Keep design tokens in `src/styles.css` as the only color source.
- Use Next.js App Router files in `src/app/`; keep interactive page bodies in reusable client components when needed.
- Keep `src/app/*` thin: route files should import `features/*/screens` and avoid business logic.
- Put new order/customer business UI under `src/features/*`, shared pure helpers under `src/shared/lib`, and cross-feature entity rules under `src/entities/*`.
- Read `docs/ARCHITECTURE.md` before large feature work or refactors.
- Read `docs/RESPONSIVE_DENSITY_PLAN.md` before changing layouts, tables, dialogs, lists, or mobile behavior.
- Mobile detail/task/workflow pages must follow RepairOS Floating Card language from `docs/REPAIROS_COMPACT_ARCHITECTURE.md`: use `repairOs.mobileFloatingPage`, `repairOs.mobileFloatingHeader*`, and `repairOs.mobileInfoCard` instead of hand-written fixed top bars or full-width divider headers.
- Use `@/lib/repairdesk/api` for app data. Do not import `src/server/*` into client components.
- Prefer feature query key factories such as `ordersKeys` and `customersKeys` for React Query caches.
- Reuse `src/components/ui/*` for controls and `src/components/orders/badges.tsx` for order status/type/money/phone rendering.
- New navigation pages must update `AppSidebar`, `AppBar` breadcrumb labels, and `CommandPalette`.
- Do not reintroduce TanStack Router/Start or Vite entrypoints.
- For multi-domain, high-risk, or explicitly delegated work, follow `AI智能部门管理/部门化管理设计.md`: the main thread is the Integration Lead, sub-agents are read-only by default, scoped writes must have disjoint file ownership, and final integration/verification stays in the main thread.
- When the department design file says current external knowledge is required, search the web and prefer official or primary sources. Local repository facts still come from the codebase.
- Validate new UI with `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
