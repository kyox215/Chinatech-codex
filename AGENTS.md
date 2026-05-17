# RepairDesk Agent Instructions

Use these rules when generating or editing pages in this repository.

- Read `docs/UI_PAGE_GENERATION_DECLARATION.md` before adding pages.
- Read `docs/COMPONENT_GENERATION_DECLARATION.md` before adding reusable components.
- Import reusable layout/class declarations from `src/lib/ui-patterns.ts` and component declarations from `src/lib/component-patterns.ts`.
- Keep design tokens in `src/styles.css` as the only color source.
- Use TanStack Router files in `src/routes/`; do not add Next.js `page.tsx`, `layout.tsx`, or middleware patterns.
- Use `@/lib/repairdesk/api` for app data. Do not import `src/server/*` into client components.
- Reuse `src/components/ui/*` for controls and `src/components/orders/badges.tsx` for order status/type/money/phone rendering.
- New navigation pages must update `AppSidebar`, `AppBar` breadcrumb labels, and `CommandPalette`.
- Do not edit `src/routeTree.gen.ts`.
- Validate new UI with `npm run lint` and `npm run build`.
