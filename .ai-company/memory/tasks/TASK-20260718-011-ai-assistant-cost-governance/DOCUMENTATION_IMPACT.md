# Documentation Impact Matrix — Phase 3A

| Reader | Behavior/contract changed | Authoritative update | Verification |
|---|---|---|---|
| Staff / support | exact order and complete local labels can bypass provider; manual save remains required | `docs/AI_ASSISTANT_STAFF_ORDER_ASSISTANT.md`, `docs/AI_ASSISTANT_INVENTORY_VISION.md` | focused component/service tests |
| Developers | direct/local/provider order, separate abuse/budget guards, signal/Safety ID and audit fields | `docs/AI_ASSISTANT_COST_GOVERNANCE.md`, `docs/ARCHITECTURE.md` | typecheck + focused tests |
| DATA / Security | three-table ledger, four RPCs, RLS/Grants, conservative settlement, IANA periods | migration + canonical cost governance doc | PostgreSQL 17 parse/catalog/behavior evidence |
| Ops / Release | new variables fail closed; no enabled policy/apply/key; rollback preserves manual paths | `.env.example`, `RELEASE_PLAN.md`, canonical doc | provider-factory/runtime tests; dormant release proof pending |
| QA | provider=0/local cloud=0, cost math, migration concurrency and regression matrix | `PHASE_PLAN.md`, `REVIEW_SYNTHESIS.md`, `EVIDENCE.md` | 292 files / 1841 tests, Webpack build, 6/6 staff E2E and all four inventory scenarios verified; HMR environment limitation recorded |

## No public contract change

- No change to `AiAssistantRequest`, inventory vision request, or response schemas.
- No new navigation route or public/customer assistant.
- No production database object exists until separately approved apply.
- The separately released Inventory V2 route remains intact; Phase 3A changes only gate legacy intake opening until store authority is stable and does not enable Inventory V2 flags.

## Known documentation limitations

- `OPENAI_AI_ASSISTANT_MODEL` remains a legacy placeholder in `.env.example`; live routing now uses versioned server policy and the provider is still unimplemented.
- The full historical local Supabase replay is blocked by pre-existing `inventory_items.product_channel` drift before reaching this migration; this is recorded as NOT PASSED, while the new migration itself has isolated PostgreSQL 17 evidence.
- Paid-pilot user-facing usage dashboard, reset-time copy and direct/local/provider badges are deferred and must be documented with their UI implementation.

No document contains a real key, customer PII, image, full identifier or production credential.
