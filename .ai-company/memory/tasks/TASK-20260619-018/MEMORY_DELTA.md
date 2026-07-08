# Memory Delta — TASK-20260619-018

## Candidate project facts

- `TASK-20260619-018` is the authority for the first stale-doc drift inventory after AI Company OS v3 adoption and duplicate cleanup.
- Active doc drift found two P1 correction targets: `docs/UI_CHECKLIST.md` route guidance and `AI智能部门管理/templates/agenda-intake.md` task-memory path guidance.
- TanStack export/planning docs in `docs/` should be treated as historical/snapshot context until archive banners or metadata clarify scope.
- Current code fact: `src/routes/` still exists with 6 files, but only `src/features/orders/screens/order-list-screen.tsx` imports `@/routes/orders.index`.
- Most docs lack owner/freshness metadata, so active-vs-archive routing remains a documentation hygiene risk.

## Candidate department updates

- Documentation department should route future doc work through `STALE_DOCUMENTATION_DRIFT_INVENTORY.md` before broad feature generation.
- Active rules remain root `AGENTS.md`, `docs/project-charter.md`, RepairOS active standards, `.ai-company/REPAIRDESK_ADOPTION.md`, and project memory.
- Use `docs/ORDERS_SPEC.md` and `docs/ORDERS_FULL_EXPORT.md` as historical export/spec material only, not current architecture guidance.

## Candidate decisions / ADRs

- Decision: L2-014 is inventory-only. Follow-up tasks may update active docs, add archive banners, and refresh metadata, but this task does not edit those source docs.
- Decision: stale doc correction should happen in small batches: active dangerous references first, then archive labels, then metadata convention.

## Candidate lessons and capability evidence

- Documentation drift audits need both text search and current code/config sampling; searching docs alone would misclassify current `src/routes` debt.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
