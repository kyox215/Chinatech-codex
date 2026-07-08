# Legacy Routes Classification Report

- Task: `TASK-20260620-002`
- Status: classification complete, deletion not approved or performed
- Owner: Integration Lead / CEO Agent
- Scope: `src/routes/*` only, plus evidence needed for a later cleanup decision
- Collected at: 2026-06-19T22:38:53Z

## Context Packet

### Objective

Classify remaining legacy `src/routes/*` files after `TASK-20260619-025`
removed the last active `@/routes` dependency. Produce evidence and an
approval package for a later cleanup task. Do not delete files in this task.

### Hard Constraints

- Do not delete `src/routes/*` in this classification task.
- Do not modify business source code.
- Keep current Next.js App Router ownership: route files live under `src/app/`,
  page bodies under `src/features/*/screens`.
- Deletion remains a separate owner approval point because it is destructive
  source cleanup.

### Current Architecture Facts

| Fact | Evidence | Status |
|---|---|---|
| Current route layer is Next.js App Router under `src/app/*`. | `find src/app -maxdepth 3 -type f -name page.tsx -o -name layout.tsx` | verified |
| Active source outside `src/routes` has no `@/routes` or `src/routes` imports. | `rg -n "@/routes|src/routes" src --glob '!src/routes/**'` returned no output | verified |
| Six legacy route files still exist. | `find src/routes -maxdepth 1 -type f -print` | verified |
| `src/routes/orders.index.tsx` is still large and TypeScript-visible while it remains in `src/**/*.tsx`. | `wc -l src/routes/*.tsx`; `tsconfig.json` includes `src/**/*.tsx` | verified |
| Broad docs/config still mention legacy routes, mostly as historical or cleanup context. | broad `rg` over repo excluding `src/routes`, `.next`, `node_modules`, screenshots | observed |

## Inventory and Classification

| File | Lines | Current content summary | Active replacement owner | Import evidence | Classification |
|---|---:|---|---|---|---|
| `src/routes/index.tsx` | 1 | Re-exports `DashboardScreen` as default. | `src/app/page.tsx` imports `DashboardScreen` directly. | No active `@/routes` or `src/routes` import found outside `src/routes`. | delete-ready after owner approval |
| `src/routes/inventory.tsx` | 5 | Legacy wrapper returning `InventoryScreen` from feature index. | `src/app/inventory/page.tsx` imports `InventoryScreen` from `src/features/inventory/screens/inventory-screen.tsx` and adds metadata/Suspense. | No active import found. | delete-ready after owner approval |
| `src/routes/messages.tsx` | 5 | Legacy `ComingSoon` page for messages. | `src/app/messages/page.tsx` imports current `MessagesScreen`. | No active import found. | delete-ready after owner approval |
| `src/routes/orders.tsx` | 5 | Legacy layout shim returning `children`. | `src/app/orders/page.tsx`, `src/app/orders/[id]/page.tsx`, and `src/app/orders/new/page.tsx` own current order routes. | No active import found. | delete-ready after owner approval |
| `src/routes/orders.index.tsx` | 1826 | Legacy all-in-one order-list client page. | `src/features/orders/screens/order-list-screen.tsx` plus order-list components and `src/features/orders/model/order-list-export.ts`. | No active import found; `TASK-20260619-025` migrated behavior. | delete-ready after owner approval and full post-deletion code gates |
| `src/routes/settings.tsx` | 5 | Legacy `ComingSoon` page for settings. | `src/app/settings/page.tsx` imports current `SettingsScreen`. | No active import found. | delete-ready after owner approval |

## Broad Reference Findings

The broader search found references outside active runtime source:

- `docs/ORDERS_SPEC.md`, `docs/ORDERS_FULL_EXPORT.md`,
  `docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md`, and similar planning/export docs
  mention old route files. Documentation department memory already treats these
  as historical/snapshot context unless explicitly refreshed.
- `docs/ARCHITECTURE.md` currently records the intended cleanup sequence:
  preserve zero live `@/routes` imports, classify remaining files, then delete
  only through a scoped cleanup task.
- `knip.json` ignores `src/routes/**`. A later deletion task should remove this
  stale ignore entry after the directory is deleted.
- `scripts/check-agent-rules.mjs` includes `src/routes/` as a stale term to
  reject in active agent rules. That reference is a guardrail, not a runtime
  dependency.

## Options

| Option | Benefits | Costs / risks | Recommendation |
|---|---|---|---|
| A. Keep all `src/routes/*` files. | Zero deletion risk today. | Continued search/review confusion; stale `ComingSoon` pages can mislead future agents; large dead file remains typechecked. | Not recommended. |
| B. Delete all six classified files in a separate cleanup task. | Removes stale TanStack-era route surface and prevents accidental reuse. | Requires owner approval and full post-deletion validation. | Recommended. |
| C. Archive files under docs or another folder. | Preserves code snapshot in-tree. | Keeps stale implementation searchable and may reintroduce confusion. Historical docs already contain snapshots. | Not recommended unless owner explicitly wants archival source. |

## Recommended Cleanup Task

If the Owner approves deletion, run a separate L2 cleanup task with this scope:

1. Delete:
   - `src/routes/index.tsx`
   - `src/routes/inventory.tsx`
   - `src/routes/messages.tsx`
   - `src/routes/orders.tsx`
   - `src/routes/orders.index.tsx`
   - `src/routes/settings.tsx`
2. Remove `src/routes/**` from `knip.json` ignore files if the directory is gone.
3. Update `docs/ARCHITECTURE.md`, `BACKLOG.md`, `OPEN_CONFLICTS.md`, and affected
   department memories from "cleanup pending" to "cleanup completed" if gates pass.
4. Run validation:
   - `rg -n "@/routes|src/routes" src --glob '!src/routes/**'`
   - `test ! -e src/routes`
   - `npm run agents:check`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build` outside sandbox if Turbopack port binding fails inside sandbox.

## Approval Request

- Decision required: approve or reject deleting the six classified
  `src/routes/*` legacy files in a separate cleanup task.
- Recommended option: approve Option B.
- Alternatives: keep all files, or archive them as source snapshots.
- Benefits: removes stale route surface and reduces future AI employee confusion.
- Costs: requires one scoped deletion task and validation run.
- Risks: low runtime risk based on current import evidence; medium verification
  risk because the dirty worktree has unrelated changes and `orders.index.tsx`
  is a large file.
- Reversibility: Git can restore files before commit; no production data or
  deployment is touched.
- Default if no decision: keep files in place and continue treating them as
  cleanup debt. Do not edit or reuse them.

## Current Decision

No deletion is performed in `TASK-20260620-002`. All six files are classified as
delete-ready after explicit Owner approval and post-deletion validation.
