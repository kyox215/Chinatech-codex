---
schema_version: 1
department: frontend
status: active
owner: Frontend Department / Integration Lead
last_verified_at: 2026-07-17
review_trigger: relevant-task-or-quarterly-review
---

# Frontend Department Memory

## Mission and boundary

Client architecture, components, forms, state, data fetching, accessibility, and browser verification.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Maintain screens/components, App Router page thinness, React Query keys, responsive behavior, and RepairOS UI composition.
- First priority: preserve zero active `@/routes` imports, avoid reuse of classified legacy `src/routes/*`, keep order detail workflow actions inline on desktop, and continue reducing oversized order modules through scoped tasks.

## Verified rules and conventions

- Navigation currently includes overview, orders, customers, buyback, inventory, settings, and platform for platform admins.
- UI should reuse `src/components/ui/*`, `src/lib/ui-patterns.ts`, and feature query key factories.
- New navigation pages must update `AppSidebar`, `AppBar`, and command palette.
- RepairOS list/management pages must not render a page-body module title block that duplicates AppBar context, such as `工作台 / 客户`, `客户管理`, or `全部 · 共 ...`; `RepairOsListScaffold` keeps desktop actions/add-ons but no longer default-renders `eyebrow/title/subtitle` in the desktop body.
- A `DropdownMenu` nested in a mobile `Sheet`/`Dialog` must use `modal={false}` when its action navigates, unmounts, or closes the outer layer in the same transition; the outer layer owns focus/pointer locking, and regression tests must assert that `document.body.style.pointerEvents` is released afterward.
- Initial store-permission hydration must not key-remount the interactive App Shell. Preserve Sidebar/AppBar/Dock state through the first stable `stores/context` snapshot; later real authority-fingerprint changes may still remount guarded children and clear sensitive query state.
- Settings Center uses nine stable section entries projected by server capabilities into editable,
  semantic read-only, locked, or unavailable states. Store switches must clear old-store drafts,
  one-time values, previews, and late responses; mobile recovery actions require at least 44px height.
- Informational progress/count chips must render as static content. Use button semantics only when a real handler exists; shared mobile menu triggers should retain a practical touch target (40px in the current RepairOS list header).
- Order detail manual status flow uses an inline desktop panel in `src/features/orders/screens/order-detail-screen.tsx`; do not reintroduce the old second desktop `状态流转` Dialog. Mobile may keep the bottom Sheet pattern for the same action list.
- Active order lists use six operational queue groups: `处理中`, `下单`, `到货`, `到货已通知`, `修好`, and `修好已通知`. Blue identifies ordering, yellow identifies arrival/arrival notification, and green identifies repaired/repaired notification; text and icons remain mandatory. Mobile renders two columns below 360px and three columns from 360px with no horizontal status scrolling; it omits the funnel and redundant selected-queue summary but retains scan and all seven choices including `全部待办`. Desktop retains its advanced filter.
- Queue changes keep the previous list visible but dimmed/inert, expose a target-specific pending indicator within 100ms, use latest-intent-wins semantics, roll back on failure with retry, and disable queue/search/scan/filter controls while offline. Workflow/options metadata uses five-minute store-scoped caches and page preload must defer to the stable workspace authority.
- Order search uses a draft/committed split with a 300ms debounce; Enter and scan submit immediately. Debounce, fetching with retained results, success totals, empty and retryable error states remain visible and are announced with `aria-live`. Result pages render non-empty status sections in queue order and show Europe/Rome intake dates plus relative age on mobile and desktop. Detail status time accepts only a real transition into the current status and otherwise labels the intake time fallback consistently.
- Guided buyback uses six explicit beginner steps with one primary action per stage. Sales stops at manager handoff; Owner/Manager gets identity capture, versioned Italian terms, white-background signature canvas and final confirmation. Oversized evidence is compressed to a 2.4MB raw-file envelope before Base64 upload; mobile and desktop flows require browser screenshots.
- Production feature-off currently supersedes that six-step projection: every role sees four beginner steps `设备 -> 报价 -> 检测 -> 保存`; seller, identity, signature, evidence, payment, receipt and finalize controls are absent from the DOM. Success copy says the record was saved, not that a transaction completed. Purchased or later records only expose historical evidence as read-only and never guide recollection.
- `TASK-20260620-001` is the current evidence for order detail status-flow UI behavior and target E2E verification.
- `TASK-20260620-002` classified the remaining legacy `src/routes/*` files as delete-ready after Owner approval. Live page bodies remain feature screens imported by `src/app/*`; do not use `src/routes/*` as a UI source.
- `TASK-20260620-003` confirms the deletion preflight baseline is green without touching App Router or feature screen files. Future deletion must not modify `src/app/*` or `src/features/*`.
- UI duplicate ` 2` files reviewed in `TASK-20260619-005` are stale snapshots and should not be merged into canonical screens/components. If the Owner wants visual assurance before cleanup, verify current canonical order card, customer intake lookup, order task screen, and RepairOS mobile shared UI before deletion.
- Dashboard does not pass status chips to `RepairOsListScaffold`. Mobile shows the two business quick starts before the priority queue; desktop uses the same two actions in the page header. Priority cards show reason/current/next/assignee/time and only navigate to task/detail. A limited sample must use full counts to distinguish true filtered empty from “present beyond this sample”. Any 401/403 hides cached priority data instead of presenting it as stale.
- Customer cards/details render `累计订单额` and `待收` from explicit valid finance facts and keep repair/payment badges orthogonal. Finance-restricted payloads omit KPI/detail values instead of fabricating €0. Order screens project server capabilities, submit changed fields only, and use accessible reason/version/idempotency terminal-action dialogs consistently on desktop and mobile.

## Interfaces and dependencies

Verified cross-department contract from `TASK-20260716-005-device-custody-status-implementation`: Frontend keeps repair type, accessories and device custody independent; new order visibly defaults to `with_shop` but sends an explicit choice, customer-held clears/hides unlock input, and detail changes use a dedicated online Sheet/Dialog action with version and reason where required.

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |
| Customer/order UI projection | Backend | Render explicit finance facts and server capabilities; never infer role or missing finance as zero | Hide restricted values/actions; surface stale/retryable terminal errors without optimistic partial success | TASK-20260716-003-customer-finance-order-correction-plan E-016..E-020 | verified |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| FE-20260619-001 | `src/routes/orders.index.tsx` was live through order-list screen | UI refactor risk | Frontend + Architecture | resolved by TASK-20260619-025 | closed |
| FE-20260619-002 | Duplicate `* 2.*` component/screen files exist | Search/import/tooling noise | Frontend + QA | duplicate cleanup task | open |
| FE-20260619-003 | Stale UI duplicates may be mistaken for alternate approved designs | UI consistency risk | Frontend + Design | before deleting or reusing UI duplicates | open |
| FE-20260620-001 | Order detail screen remains large and contains both desktop/mobile transition surfaces | Review cost and regression risk | Frontend + QA | future order detail split task | open |
| FE-20260713-002 | `buyback-quote-workspace.tsx` now owns a large multi-step workflow and client image-compression helper | Review and regression cost | Frontend + Architecture + QA | split by step/upload model in a dedicated refactor after behavior stabilizes | open |
| FE-20260713-001 | Settings five-role/error/50+ member browser matrix is incomplete | UI behavior may drift outside representative scenarios | Frontend + QA | after every latest-main integration and before production | open |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.

## Capability and tool notes

| Agent/Skill | Current evidence | Capability | Permission | Limitation |
|---|---|---|---|---|
| TBD | none | C0/C1 | task-specific | not evaluated |

## Memory change log

| Date | Change | Source/task | Author/reviewer | Status |
|---|---|---|---|---|
| 2026-06-19 | Initial RepairDesk frontend baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-06-19 | Added stale UI duplicate cleanup boundary | TASK-20260619-005 | Integration Lead | active |
| 2026-06-20 | Recorded inline desktop order-detail status transition panel and target E2E proof | TASK-20260620-001 | Integration Lead | active |
| 2026-06-20 | Recorded legacy `src/routes/*` delete-ready classification and no-reuse frontend boundary | TASK-20260620-002 | Integration Lead | active |
| 2026-06-20 | Recorded legacy route deletion preflight boundary: delete only classified files after approval | TASK-20260620-003 | Integration Lead | active |
| 2026-07-07 | Recorded RepairOS list/management page rule removing duplicate page-body module title blocks | TASK-20260707-005 | Integration Lead | active |
| 2026-07-12 | Recorded verified nested mobile modality, pointer-lock regression, and control-semantics rules | TASK-20260712-002-mobile-interaction-click-reliability | Integration Lead | active |
| 2026-07-12 | Added initial authority-hydration shell-stability rule while preserving later permission-change reset | TASK-20260712-002-mobile-interaction-click-reliability | Integration Lead | active |
| 2026-07-13 | Added active custody queue groups and responsive list contract | TASK-20260712-005-order-custody-archive | Integration Lead | active |
| 2026-07-13 | Replaced custody buckets with six explicit active stages and a non-scrolling two-column mobile selector | TASK-20260713-001-order-active-status-homepage | Integration Lead + UX/QA reviewers | active |
| 2026-07-13 | Added debounced order-search feedback, grouped result sections and consistent intake/status date presentation | TASK-20260713-002-order-search-grouped-results | Integration Lead | active |
| 2026-07-13 | Added verified six-step buyback, role handoff, legal/signature and bounded evidence-upload UI | TASK-20260712-005-buyback-guided-evidence | Integration Lead + UX/security reviewers | active |
| 2026-07-14 | Projected the production feature-off as a four-step all-role quote-only UI with historical evidence read-only | TASK-20260714-001-buyback-sensitive-evidence-feature-off | Integration Lead + UX/QA reviewers | active |
| 2026-07-16 | Added Dashboard quick-start, handoff card, truthful filtered-sample and permission-revocation UI rules | TASK-20260716-001-dashboard-handoff-priority | Integration Lead + UX/QA reviewers | active |
| 2026-07-16 | Superseded fixed two-column Orders selector with compact responsive queues and explicit pending/error/offline/latest-intent states | TASK-20260716-002-orders-mobile-filter-loading-plan | Integration Lead + UX/QA reviewers | active |
| 2026-07-16 | Added explicit customer finance labels, dual repair/payment states and capability-driven terminal-action UI | TASK-20260716-003-customer-finance-order-correction-plan | Integration Lead + UX/QA reviewers | active |
| 2026-07-13 | Recorded nine-section Settings capability, store-bound transient, touch-target and visual-evidence contracts | TASK-20260712-004-settings-center-master-plan | Integration Lead + WP08 reviewers | local_verified |
