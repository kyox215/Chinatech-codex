---
schema_version: 1
department: frontend
status: active
owner: Frontend Department / Integration Lead
last_verified_at: 2026-07-19
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
- In the AI assistant, processing mode and today's model usage share one default-collapsed composer row that keeps the current mode and compact request/limit usage visible. Its disclosure must remain keyboard-operable and preserve the selected mode; expanded content carries the local/model choices plus privacy and charging meaning. Interpretation status is separate from processing mode, while exact applied scope/date/timezone/source lives in its own compact disclosure. Result-card body expansion never navigates—only the explicit `打开订单` link may leave the conversation.
- Order detail manual status flow uses an inline desktop panel in `src/features/orders/screens/order-detail-screen.tsx`; do not reintroduce the old second desktop `状态流转` Dialog. Mobile may keep the bottom Sheet pattern for the same action list.
- Online new-order success uses one canonical destination: both `/orders/new` and the `/orders` new-order Dialog navigate to `/orders/{id}` after cache invalidation. The list Dialog must close without opening a second detail Dialog in the same transition.
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
- Unknown order intake uses an explicit reported/unknown choice and does not fabricate a fault-price row. Desktop detail, mobile detail and task page reuse one diagnosis/quote workspace; the preview is bound to the latest quoted event UUID. Opening `wa.me` is client-only, and only the separate employee confirmation action records sent state.
- Desktop beginner pages use a read-first hierarchy: at most one recommended action is visually primary, list rows avoid inline responsibility/supplier mutation, missing-field chips focus the exact control, and error states never reuse true-empty copy. Navigation and command shortcuts must share the same permission/role projection.
- Global recovery must keep business DOM hidden until both the CSS marker and React runtime handshake are ready. The Service Worker fallback is a standalone no-Next document; it uses the fixed probe and one-per-60-second reload boundary, preserves all unrelated browser state and exposes a 44px manual recovery action.
- Inventory V2 label assistance is an optional one-photo progressive path: local same-origin barcode/OCR Workers produce masked, validated and selectable identifier candidates; IMEI outranks EAN as the default phone identifier. Applying candidates never overwrites manual fields or a manual primary identifier, and scan/manual next remains available during offline, timeout, cancellation or cloud pending states.

- `TASK-20260720-001-customer-simple-workbench` production-verifies the beginner customer workbench: four URL-backed list groups, five stable detail groups, sidebar-aware fixed controls below `lg`, and page clamping only after real data replaces placeholder data.

## Interfaces and dependencies

`TASK-20260718-008-order-cost-phase2` verifies the cost UI boundary: authorized management gets
Phase 1 internal cost beside customer quote and store default costs; Phase 2 profit/export,
procurement, backfill and currency components are capability-driven and do not mount when their
independent child flags are off. Low-permission behavior remains the pre-cost UI with no cost copy.

Verified custody contract: Frontend keeps repair type, accessories, custody and unlock credentials independent. New order begins with no custody selection and requires an explicit choice; switching to/from customer-held preserves the entered unlock method/value; detail changes use a dedicated online Sheet/Dialog action with version and reason where required.

| Provides / consumes          | Counterparty | Contract                                                                                           | Failure handling                                                                                           | Evidence                                                              | Status   |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| TBD                          | TBD          | TBD                                                                                                | TBD                                                                                                        | —                                                                     | unknown  |
| Customer/order UI projection | Backend      | Render explicit finance facts and server capabilities; never infer role or missing finance as zero | Hide restricted values/actions; surface stale/retryable terminal errors without optimistic partial success | TASK-20260716-003-customer-finance-order-correction-plan E-016..E-020 | verified |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID              | Risk/debt/question                                                                                                                                                                              | Impact                                                                                      | Owner                        | Target/review                                                                         | Status                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------- | --------------------- |
| FE-20260619-001 | `src/routes/orders.index.tsx` was live through order-list screen                                                                                                                                | UI refactor risk                                                                            | Frontend + Architecture      | resolved by TASK-20260619-025                                                         | closed                |
| FE-20260619-002 | Duplicate `* 2.*` component/screen files exist                                                                                                                                                  | Search/import/tooling noise                                                                 | Frontend + QA                | duplicate cleanup task                                                                | open                  |
| FE-20260619-003 | Stale UI duplicates may be mistaken for alternate approved designs                                                                                                                              | UI consistency risk                                                                         | Frontend + Design            | before deleting or reusing UI duplicates                                              | open                  |
| FE-20260620-001 | Order detail screen remains large and contains both desktop/mobile transition surfaces                                                                                                          | Review cost and regression risk                                                             | Frontend + QA                | future order detail split task                                                        | open                  |
| FE-20260713-002 | `buyback-quote-workspace.tsx` now owns a large multi-step workflow and client image-compression helper                                                                                          | Review and regression cost                                                                  | Frontend + Architecture + QA | split by step/upload model in a dedicated refactor after behavior stabilizes          | open                  |
| FE-20260713-001 | Settings five-role/error/50+ member browser matrix is incomplete                                                                                                                                | UI behavior may drift outside representative scenarios                                      | Frontend + QA                | after every latest-main integration and before production                             | open                  |
| FE-20260717-001 | New-order submit previously exposed only a disabled “创建中…” button while waiting; first-phase recovery now shows pending/confirming/uncertain messages and blocks repeat submit after timeout | Desktop/mobile duplicate-submit risk is reduced, but full atomic create is still outside UI | Frontend + UX + Backend + QA | keep operation-status recovery; future atomic-create task must preserve equivalent UX | mitigated_first_phase |
| FE-20260719-002 | Physical iPhone background/BFCache/natural network-switch timing is not directly automated                                                                                                      | Device-specific delayed recovery could differ from WebKit production simulation             | Frontend + QA + Operations   | next real-device observation; `OPS-BACKLOG-20260719-002`                              | monitoring            |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.

## Capability and tool notes

| Agent/Skill | Current evidence | Capability | Permission    | Limitation    |
| ----------- | ---------------- | ---------- | ------------- | ------------- |
| TBD         | none             | C0/C1      | task-specific | not evaluated |

## Memory change log

| Date       | Change                                                                                                                                                  | Source/task                                              | Author/reviewer                              | Status                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- | --------------------------- |
| 2026-06-19 | Initial RepairDesk frontend baseline synchronized                                                                                                       | TASK-20260619-003                                        | Integration Lead                             | active                      |
| 2026-06-19 | Added stale UI duplicate cleanup boundary                                                                                                               | TASK-20260619-005                                        | Integration Lead                             | active                      |
| 2026-06-20 | Recorded inline desktop order-detail status transition panel and target E2E proof                                                                       | TASK-20260620-001                                        | Integration Lead                             | active                      |
| 2026-06-20 | Recorded legacy `src/routes/*` delete-ready classification and no-reuse frontend boundary                                                               | TASK-20260620-002                                        | Integration Lead                             | active                      |
| 2026-06-20 | Recorded legacy route deletion preflight boundary: delete only classified files after approval                                                          | TASK-20260620-003                                        | Integration Lead                             | active                      |
| 2026-07-07 | Recorded RepairOS list/management page rule removing duplicate page-body module title blocks                                                            | TASK-20260707-005                                        | Integration Lead                             | active                      |
| 2026-07-12 | Recorded verified nested mobile modality, pointer-lock regression, and control-semantics rules                                                          | TASK-20260712-002-mobile-interaction-click-reliability   | Integration Lead                             | active                      |
| 2026-07-12 | Added initial authority-hydration shell-stability rule while preserving later permission-change reset                                                   | TASK-20260712-002-mobile-interaction-click-reliability   | Integration Lead                             | active                      |
| 2026-07-13 | Added active custody queue groups and responsive list contract                                                                                          | TASK-20260712-005-order-custody-archive                  | Integration Lead                             | active                      |
| 2026-07-13 | Replaced custody buckets with six explicit active stages and a non-scrolling two-column mobile selector                                                 | TASK-20260713-001-order-active-status-homepage           | Integration Lead + UX/QA reviewers           | active                      |
| 2026-07-13 | Added debounced order-search feedback, grouped result sections and consistent intake/status date presentation                                           | TASK-20260713-002-order-search-grouped-results           | Integration Lead                             | active                      |
| 2026-07-13 | Added verified six-step buyback, role handoff, legal/signature and bounded evidence-upload UI                                                           | TASK-20260712-005-buyback-guided-evidence                | Integration Lead + UX/security reviewers     | active                      |
| 2026-07-14 | Projected the production feature-off as a four-step all-role quote-only UI with historical evidence read-only                                           | TASK-20260714-001-buyback-sensitive-evidence-feature-off | Integration Lead + UX/QA reviewers           | active                      |
| 2026-07-16 | Added Dashboard quick-start, handoff card, truthful filtered-sample and permission-revocation UI rules                                                  | TASK-20260716-001-dashboard-handoff-priority             | Integration Lead + UX/QA reviewers           | active                      |
| 2026-07-16 | Superseded fixed two-column Orders selector with compact responsive queues and explicit pending/error/offline/latest-intent states                      | TASK-20260716-002-orders-mobile-filter-loading-plan      | Integration Lead + UX/QA reviewers           | active                      |
| 2026-07-16 | Added explicit customer finance labels, dual repair/payment states and capability-driven terminal-action UI                                             | TASK-20260716-003-customer-finance-order-correction-plan | Integration Lead + UX/QA reviewers           | active                      |
| 2026-07-13 | Recorded nine-section Settings capability, store-bound transient, touch-target and visual-evidence contracts                                            | TASK-20260712-004-settings-center-master-plan            | Integration Lead + WP08 reviewers            | local_verified              |
| 2026-07-17 | Recorded shared desktop/mobile order-create pending and ambiguous-success recovery gap                                                                  | TASK-20260717-163954-task                                | Integration Lead                             | verified_debt               |
| 2026-07-17 | Added first-phase online create recovery UX: operation id, confirming/uncertain state, repeat-submit block and desktop/mobile screenshots               | TASK-20260717-165957-task                                | Integration Lead                             | mitigated_first_phase       |
| 2026-07-17 | Added explicit unknown intake and reusable responsive diagnosis/quote/confirmed-send UI contract                                                        | TASK-20260717-004-order-diagnosis-quote-implementation   | Integration Lead + FLOW/UX/QA reviewers      | active                      |
| 2026-07-17 | Added read-first desktop hierarchy, exact missing-field focus, shared shortcut permissions and custody credential retention                             | TASK-20260717-008-desktop-novice-ui-implementation       | Integration Lead + UX/QA reviewers           | verified                    |
| 2026-07-18 | Recorded canonical order-create success navigation for both page and list-Dialog entry points                                                           | TASK-20260718-095500-order-create-navigation-release     | Integration Lead                             | production_verified         |
| 2026-07-18 | Recorded responsive cost/profit/procurement/backfill/currency UI and production dormant-state behavior                                                  | TASK-20260718-008-order-cost-phase2                      | Integration Lead + UX/QA reviewers           | scoped_verified_option_b    |
| 2026-07-19 | Released independent default-collapsed usage and processing disclosures with persistent mode meaning, keyboard semantics and 390px/desktop visual proof | TASK-20260719-005-ai-search-accuracy-collapsible-ui      | Integration Lead + UX/Frontend reviewer      | production_verified         |
| 2026-07-19 | Superseded the two-disclosure layout with one compact mode/usage row and released inline non-navigating order cards with an explicit order link         | TASK-20260719-006-ai-natural-language-order-actions      | Integration Lead + UX/Frontend reviewer      | production_verified         |
| 2026-07-19 | Added collapsible exact query scope, distinct interpretation states, one zero-result state and partial-result clarity while preserving inline cards     | TASK-20260719-007-ai-natural-language-query-v3           | Integration Lead + UX/Frontend reviewer      | production_verified         |
| 2026-07-19 | Released CSS/runtime double readiness, dependency-free SW recovery shell and bounded manual/automatic mobile recovery with production responsive proof  | TASK-20260719-007-fast-app-recovery                      | Integration Lead + Architecture/QA reviewers | production_verified_bounded |
| 2026-07-20 | Released four customer list groups, five detail groups, URL restoration and sidebar-aware fixed mobile/tablet controls with six-width responsive proof  | TASK-20260720-001-customer-simple-workbench              | Integration Lead + FLOW/UX/QA reviewers      | production_verified         |
| 2026-07-23 | Added cold-start lazy mounts, home cross-domain preload suppression and exact single/batch print disabled reasons with recovery entries                 | TASK-20260723-004-startup-bootstrap-print-implementation | Integration Lead + QA reviewer               | local_verified              |
| 2026-07-26 | Added searchable brand/model and responsive RAM/storage/color selectors; physical finishes require name, bordered swatch and non-color selected state   | TASK-20260726-002-eu-phone-catalog                       | Integration Lead + UX/QA reviewers           | production_verified         |
