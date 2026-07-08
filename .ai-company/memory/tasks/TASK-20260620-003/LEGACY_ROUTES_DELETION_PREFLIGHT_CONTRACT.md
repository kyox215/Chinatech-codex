# Legacy Routes Deletion Preflight Contract

- Task: `TASK-20260620-003`
- Status: preflight contract complete, deletion not approved or performed
- Owner: Integration Lead / CEO Agent
- Scope: prepare the future deletion of classified legacy `src/routes/*` files
- Collected at: 2026-06-19T22:45:22Z

## Context Packet

### Goal

Prepare an executable cleanup contract for a later Owner-approved deletion task.
The previous classification task, `TASK-20260620-002`, classified all current
legacy `src/routes/*` files as delete-ready after approval. This task converts
that classification into a step-by-step implementation contract and baseline.

### Current Verified Facts

| Fact | Evidence | Status |
|---|---|---|
| `TASK-20260620-002` is closed and classified six files as delete-ready after approval. | `TASK-20260620-002/TASK.md`; `LEGACY_ROUTES_CLASSIFICATION_REPORT.md` | verified |
| Six legacy files still exist under `src/routes/`. | `find src/routes -maxdepth 1 -type f -print` | verified |
| Current line count is unchanged from classification: 1847 total, with `orders.index.tsx` at 1826 lines. | `wc -l src/routes/*.tsx` | verified |
| Current hashes match the classification snapshot. | `find src/routes -maxdepth 1 -type f -exec shasum -a 256 {} +` | verified |
| Active source outside `src/routes` has no `@/routes` or direct `src/routes` import. | `rg -n "@/routes|src/routes" src --glob '!src/routes/**'` returned no output | verified |
| `knip.json` still ignores `src/routes/**`. | `rg -n "src/routes" knip.json` | verified |

## Approval Boundary

This contract is not deletion approval.

Owner approval is required before any of these actions:

- Delete any file under `src/routes/`.
- Remove `src/routes/**` from `knip.json`.
- Stage, commit, push, or deploy the cleanup.

Until approval is explicit, future agents must treat `src/routes/*` as
classified cleanup candidates only.

## Exact Future File Scope

The future deletion task may delete only these files:

- `src/routes/index.tsx`
- `src/routes/inventory.tsx`
- `src/routes/messages.tsx`
- `src/routes/orders.tsx`
- `src/routes/orders.index.tsx`
- `src/routes/settings.tsx`

The future cleanup task may also edit:

- `knip.json`, only to remove `src/routes/**` from `ignoreFiles` if the
  `src/routes/` directory is removed.
- Active memory/docs that mention the cleanup status, only to move from
  "approval pending" to "deleted and validated" after gates pass.

Forbidden without a new task:

- Any `src/app/*`, `src/features/*`, `src/server/*`, API, data, UI behavior, or
  dependency change.
- Any historical doc rewrite beyond cleanup-status updates.
- Any production data, deployment, staging, commit, or push action.

## Work Packages

### WP-01 Approval Intake

- Owner: Integration Lead / CEO Agent
- Approver: Owner / Hexiang Huang
- Goal: capture explicit deletion approval and create a new cleanup task.
- Inputs: this contract, `TASK-20260620-002` classification report, current
  source scan.
- Deliverables: new task memory with approval text, file scope, rollback plan.
- Exit criteria: approval is recorded; if approval is absent, stop.

### WP-02 Pre-Deletion Fresh Baseline

- Owner: Integration Lead / CEO Agent
- Goal: prove the classification is still current immediately before deletion.
- Commands:
  - `find src/routes -maxdepth 1 -type f -print | sort`
  - `wc -l src/routes/*.tsx`
  - `find src/routes -maxdepth 1 -type f -exec shasum -a 256 {} +`
  - `rg -n "@/routes|src/routes" src --glob '!src/routes/**'`
  - `git status --short`
- Exit criteria: same six files are present, no active imports are found, and
  no conflicting workspace changes touch the cleanup scope.

### WP-03 Scoped Deletion

- Owner: Integration Lead / CEO Agent
- Goal: remove only the approved legacy route files.
- File scope:
  - `src/routes/index.tsx`
  - `src/routes/inventory.tsx`
  - `src/routes/messages.tsx`
  - `src/routes/orders.tsx`
  - `src/routes/orders.index.tsx`
  - `src/routes/settings.tsx`
- Exit criteria: `test ! -e src/routes` passes or the directory contains no
  files. If any unapproved file exists in `src/routes`, stop and reclassify.

### WP-04 Tooling Cleanup

- Owner: Integration Lead / CEO Agent
- Goal: remove stale unused-file ignore entry after the route directory is gone.
- File scope:
  - `knip.json`
- Expected edit: remove `"src/routes/**"` from `ignoreFiles` only after
  `src/routes/` has been deleted.
- Exit criteria: `knip.json` remains valid JSON and no longer carries a stale
  ignore entry for a deleted directory.

### WP-05 Validation

- Owner: QA + Integration Lead
- Goal: prove deletion did not break active source or governance.
- Minimum commands:
  - `rg -n "@/routes|src/routes" src --glob '!src/routes/**'`
  - `test ! -e src/routes`
  - `node -e 'JSON.parse(require("fs").readFileSync("knip.json","utf8")); console.log("knip json ok")'`
  - `npm run agents:check`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
- Build note: if sandboxed build fails with Turbopack port-binding permission,
  rerun the same build outside sandbox before classifying it as code failure.
- Exit criteria: all required gates pass, or failures are proven unrelated and
  explicitly recorded with owner decision.

### WP-06 Memory and Closeout

- Owner: Integration Lead / CEO Agent
- Goal: update formal memory only after deletion validation.
- Files:
  - `.ai-company/memory/PROJECT_MEMORY.md`
  - `.ai-company/memory/BACKLOG.md`
  - `.ai-company/memory/OPEN_CONFLICTS.md`
  - `.ai-company/memory/departments/architecture.md`
  - `.ai-company/memory/departments/frontend.md`
  - `.ai-company/memory/departments/qa.md`
  - `.ai-company/memory/departments/documentation.md`
  - `docs/ARCHITECTURE.md`
- Exit criteria: memory says "deleted and validated" only after gates pass.

## Test and Evidence Matrix

| Requirement | Evidence in future deletion task |
|---|---|
| Approval captured | Owner approval text in `TASK.md` / `EVIDENCE.md` |
| Exact files deleted | `git diff --name-status src/routes knip.json` |
| No accidental source changes | `git status --short` and scoped diff |
| No active legacy imports | `rg -n "@/routes|src/routes" src --glob '!src/routes/**'` returns no matches |
| Directory gone | `test ! -e src/routes` |
| `knip.json` valid | Node JSON parse command |
| Governance valid | `npm run agents:check` |
| App static quality | `npm run lint`; `npm run typecheck` |
| Runtime/unit coverage | `npm run test` |
| Production build | `npm run build` |

## Rollback Plan

Before commit, rollback is simple:

1. Restore only the deleted/edited cleanup files from Git.
2. Re-run the active route reference scan.
3. Record rollback reason in the task checkpoint.

If the repo is not clean or files are untracked, stop and ask for integration
direction before using broad restore commands.

## Stop Conditions

Stop before deletion if:

- Owner approval is not explicit.
- Any active source import of `@/routes` or `src/routes` appears.
- `src/routes/` contains files outside the six approved paths.
- `git status --short` shows unexpected changes to the cleanup scope.
- Fresh baseline commands disagree with the classification.

Stop after deletion if:

- `npm run lint`, `npm run typecheck`, `npm run test`, or `npm run build` fails
  and the failure cannot be isolated as pre-existing/unrelated.
- `knip.json` becomes invalid.
- Any route/import scan reintroduces `@/routes` usage.

## Current Decision

No deletion is performed in `TASK-20260620-003`. The next executable step is an
Owner decision: approve or reject starting a separate L2 cleanup task using this
contract.
