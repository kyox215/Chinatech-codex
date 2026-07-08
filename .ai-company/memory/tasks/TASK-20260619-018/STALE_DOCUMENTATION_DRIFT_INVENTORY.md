# Stale Documentation Drift Inventory — L2-014

- Task: `TASK-20260619-018`
- Owner: Integration Lead / CEO Agent
- Departments: INT, DOC, QA
- Collected at: 2026-06-19T21:15:48Z
- Scope: markdown documentation under `docs/`, root governance docs, `AI智能部门管理/`, `.agents/`, and `.ai-company/`; local code/config facts used only as evidence.
- Business-code impact: none.

## Executive Conclusion

The documentation set is usable but needs a staged hygiene pass before future AI employees rely on it broadly.

The highest-risk drift is not hidden in business code. It is in active-looking documentation/templates that still describe old TanStack/`src/routes` or legacy `.ai-company/runtime-memory` behavior:

1. `docs/UI_CHECKLIST.md` still tells page work to put route files in `src/routes/`, which conflicts with the current App Router rule.
2. `AI智能部门管理/templates/agenda-intake.md` still tells non-micro tasks to write memory under `.ai-company/runtime-memory/tasks/`, which conflicts with the v3 task memory rule.
3. TanStack export/spec/planning docs remain in `docs/` without a clear archive/snapshot warning, so they can be mistaken for current implementation instructions.
4. Some planning snapshots still say both dashboard and orders wrap legacy routes, but the current code scan shows only the order list still imports `@/routes/orders.index`.
5. Most `docs/*.md` files do not carry owner/freshness metadata, which makes stale-vs-active routing harder for future agents.

## Verified Local Facts

| Fact | Evidence | Classification |
|---|---|---|
| Current authoritative routing rule is Next.js App Router under `src/app/`; do not reintroduce TanStack Router/Start or Vite app entrypoints. | `AGENTS.md`; `docs/project-charter.md`; `docs/UI_PAGE_GENERATION_DECLARATION.md` | Verified |
| `src/app/` currently contains route/page files for orders, customers, inventory, buyback, messages, settings, platform, auth, and API. | `rg --files src/app src/features src/routes` | Verified |
| `src/routes/` still exists with 6 files. | `find src/routes -maxdepth 1 -type f -print | wc -l` returned `6` | Verified |
| Only `src/features/orders/screens/order-list-screen.tsx` currently imports a legacy route implementation. | `rg -n 'from "@/routes' src` | Verified |
| `package.json` has `check`, `test:e2e`, `storybook`, and `agents:check` scripts; `docs/ARCHITECTURE.md` quality-gate command names are current. | `node -e "const p=require('./package.json'); ..."`; `docs/ARCHITECTURE.md` | Verified |
| `docs/` has 22 markdown files. | `find docs -maxdepth 1 -type f ... | wc -l` | Verified |
| 21 of 22 `docs/*.md` files lack an explicit `Last verified` / `Last reviewed` / `Last updated` line. | shell metadata scan | Verified |
| 19 of 22 `docs/*.md` files lack an explicit `Owner` / `负责人` line. | shell metadata scan | Verified |

## Impact Matrix

| ID | Severity | Document / evidence | Current conflict or risk | Recommended disposition | Suggested owner |
|---|---|---|---|---|---|
| DOC-DRIFT-20260619-001 | P1 | `docs/UI_CHECKLIST.md:22` says route files are in `src/routes/` with flat dot naming. | Active UI checklist conflicts with App Router rules in `AGENTS.md`, `docs/project-charter.md`, and `docs/UI_PAGE_GENERATION_DECLARATION.md`. | Update in a follow-up doc-fix task to `src/app/*` thin route files with feature screens; preserve any still-useful SEO/nav checklist items. | DOC + FE + QA |
| DOC-DRIFT-20260619-002 | P1 | `AI智能部门管理/templates/agenda-intake.md:39` points non-micro task memory to `.ai-company/runtime-memory/tasks/<task_id>/`. | Active task template conflicts with v3 memory root `.ai-company/memory/tasks/` required by `AGENTS.md` and `AI智能部门管理/部门化管理设计.md`. | Update the template in a follow-up governance-doc fix; keep `.ai-company/runtime-memory/` as trace-only legacy. | DOC + MEM |
| DOC-DRIFT-20260619-003 | P1 | `docs/ORDERS_SPEC.md`, `docs/ORDERS_FULL_EXPORT.md` contain TanStack Start/react-router/createFileRoute setup. | These may be valid historical export artifacts, but in `docs/` they look like current implementation specs and conflict with App Router rules. | Add archive/snapshot banner or move under a future `docs/archive/` task; do not use for current route/API architecture. | DOC + FLOW + FE |
| DOC-DRIFT-20260619-004 | P1 | `docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md:199-201` says both dashboard and orders import legacy routes. Current code scan finds only `order-list-screen.tsx` imports `@/routes/orders.index`. | Planning snapshot has at least one stale code fact. | Mark as historical context or update the specific fact in a follow-up doc-fix task; current remaining debt is order list only. | DOC + ARCH |
| DOC-DRIFT-20260619-005 | P2 | `docs/DESIGN_SYSTEM.md:166` references `src/routes/index.tsx` as a dashboard example while the same doc forbids TanStack/legacy route reintroduction at lines 38-39. | Internal doc tension: design rules are current, but one example points to a legacy file. | Replace example reference with current dashboard/App Router feature-screen source in a follow-up doc task. | DOC + UX |
| DOC-DRIFT-20260619-006 | P2 | `docs/COMPONENT_GENERATION_DECLARATION.md:348` tells agents to search `src/components src/routes`. | Search advice may keep legacy route files in the normal component-discovery path. | Update to search `src/features`, `src/components`, `src/app` as appropriate; include `src/routes` only as legacy/debt lookup. | DOC + FE |
| DOC-DRIFT-20260619-007 | P2 | `docs/REFACTOR_EXECUTION_PLAN.md` references old `src/routes/orders.$id.tsx` and `src/routes/orders.new.tsx` work, with several `complete` notes. | Likely historical plan, but not labeled as archive/snapshot, so completion markers can be confused with current task status. | Label as historical execution plan and link current architecture/project memory. | DOC + ARCH |
| DOC-DRIFT-20260619-008 | P2 | `docs/GPT_PROJECT_REPLANNING_BRIEF.md` and `docs/PROJECT_REPLAN_FROM_MOBILE_MVP_V1_5.md` contain planning instructions and current-looking recommendations. | They may be useful context but should not outrank current root rules or task memory. | Add status/scope metadata or archive banner in a follow-up. | DOC + INT |
| DOC-DRIFT-20260619-009 | P2 | 21 of 22 `docs/*.md` files lack freshness metadata; 19 of 22 lack owner metadata. | Future agents cannot quickly separate active standards from historical exports. | Add a lightweight metadata convention to active docs first; archive docs get an archive banner instead of false freshness claims. | DOC |

## Active-vs-Archive Routing

| Bucket | Documents | Rule for future agents |
|---|---|---|
| Active authority | `AGENTS.md`, `docs/project-charter.md`, `docs/UI_PAGE_GENERATION_DECLARATION.md`, `docs/COMPONENT_GENERATION_DECLARATION.md`, `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md`, `docs/RESPONSIVE_DENSITY_PLAN.md`, `docs/ARCHITECTURE.md`, `.ai-company/REPAIRDESK_ADOPTION.md`, `.ai-company/memory/PROJECT_MEMORY.md` | Use as current rules, but fix the listed drift items before broad feature work. |
| Active but needs correction | `docs/UI_CHECKLIST.md`, `AI智能部门管理/templates/agenda-intake.md`, `docs/DESIGN_SYSTEM.md`, `docs/COMPONENT_GENERATION_DECLARATION.md` | Do not blindly follow stale `src/routes` / `runtime-memory` references. Apply root rules until corrected. |
| Historical/export/snapshot candidate | `docs/ORDERS_SPEC.md`, `docs/ORDERS_FULL_EXPORT.md`, `docs/REFACTOR_EXECUTION_PLAN.md`, `docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md`, `docs/GPT_PROJECT_REPLANNING_BRIEF.md`, `docs/PROJECT_REPLAN_FROM_MOBILE_MVP_V1_5.md` | Use for context only; never override current App Router, v3 memory, or RepairOS standards. |

## Facts, Assumptions, Conflicts, Unknowns

| Item | Classification | Evidence | Disposition |
|---|---|---|---|
| App Router is the current target. | Verified fact | `AGENTS.md`, `docs/project-charter.md`, `src/app/*` | Active rule |
| Legacy `src/routes` is not fully deleted. | Verified fact | 6 files in `src/routes/` | Architecture debt, not a reason to reintroduce legacy routing |
| `docs/UI_CHECKLIST.md` is currently unsafe for route guidance. | Verified conflict | line 22 vs root rules | P1 doc fix |
| `AI智能部门管理/templates/agenda-intake.md` is unsafe for task-memory path guidance. | Verified conflict | line 39 vs v3 memory rule | P1 doc fix |
| TanStack export docs may still be useful as historical reconstruction material. | Assumption | document titles and content indicate export/spec use | Preserve until owner-approved archive/label task |
| Which docs should be moved versus banner-labeled is not decided. | Unknown | no docs archive policy found in current active docs | Decide in follow-up |

## Recommended L2 Follow-up Tasks

| Task candidate | Scope | Acceptance evidence |
|---|---|---|
| L2-015 Active doc fix batch A | Update `docs/UI_CHECKLIST.md` and `AI智能部门管理/templates/agenda-intake.md` only. | `rg 'src/routes/|runtime-memory/tasks'` no longer hits those active docs; `npm run agents:check` passes. |
| L2-016 Archive banner pass | Add archive/snapshot banners to TanStack export/planning docs without deleting content. | Each archive candidate declares status, scope, owner, and "do not override current App Router/v3 memory rules". |
| L2-017 Documentation metadata convention | Add a lightweight owner/freshness convention to active docs. | Active authority docs expose owner/status/last-reviewed metadata; archive docs are explicitly labeled. |
| L2-018 Legacy route migration plan refresh | Refresh the route-migration plan to current fact: only order list still imports `@/routes/orders.index`. | Code search evidence and updated architecture/backlog record. |

## Non-actions In This Task

- No business code was changed.
- No doc body was rewritten except this task report and memory synchronization.
- No files were deleted, moved, staged, committed, pushed, deployed, or released.
- No production/Supabase/Vercel state was queried or changed.
