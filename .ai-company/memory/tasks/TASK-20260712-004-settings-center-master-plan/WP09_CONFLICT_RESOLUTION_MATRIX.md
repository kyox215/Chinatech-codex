# WP-09 Conflict Resolution Matrix

Prepared: 2026-07-14 CEST
Target: `origin/main@d5384e88ca1e974d0aa58156728eb29092a7d7ff`
Source: `codex/settings-center-v2-20260712@d1b4dcaf0af34a881bf877efa3e45934a1bb7b73`

## Corrected overlap facts

- Exact common changed paths: 32.
- Product/code paths: 23.
- Project-memory paths: nine.
- Paths with manual conflict markers during ordered cherry-pick: 16.
- After `origin/main` advanced, the ordered rebase required five conflict files across two commits:
  `ACTIVE_CONTEXT.md`, buyback workspace/screen, inventory repository, and inventory mock tests. Reapplying
  the evidence stash also conflicted in the rewritten buyback E2E and was resolved to the new four-step
  quote-only suite, not the obsolete six-step sensitive flow.
- The final documentation-only `d5384e88` sync required ten rebase conflict files plus two stash conflict
  files, all under `.ai-company/memory/`. Each resolution preserved the current production buyback
  containment authority and the Settings local-candidate/release boundary; no product code conflicted.
- The WP08 count of 24 represented the 23 product/code paths plus `ACTIVE_CONTEXT.md`; it did not include
  the final eight global/department memory paths added by the WP08 package.

## Manually resolved product/code paths

| Path | Current-main invariant | Settings invariant | Integrated decision | Evidence |
| --- | --- | --- | --- | --- |
| `src/features/buyback/components/buyback-quote-workspace.tsx` | Sensitive flow hard-coded off; four-step quote/evaluation/save; no seller/evidence/payment/signature/finalize controls | Tenant output identity blocks/brands WhatsApp | Preserve feature-off and permission aliases; add required `storeIdentity` only for quote/WhatsApp output | feature-off policy/router/repository tests plus guided-buyback 6-case E2E |
| `src/features/buyback/screens/buyback-screen.tsx` | Sensitive flow closed and history read-only | Resolve active-store output identity | Pass role capabilities and `storeIdentity`; compile-time feature-off keeps capture/finalize unreachable | Typecheck plus buyback targeted tests |
| `src/features/orders/screens/order-list-screen.tsx` | Callback-ref mobile header cleanup, grouped search, current queue behavior | Customer-output recovery query/UI | Keep callback-ref implementation and remove the obsolete duplicate `mobileHeaderRef` effect while retaining output recovery | Orders 11 files / 131 tests |
| `src/features/inventory/screens/inventory-screen.tsx` | Quality-check `expected_updated_at` CAS | Tenant default-warranty label and optional input semantics | Keep `checkInput(formData, expectedUpdatedAt)` and add `inventoryWarrantyLabel` | Typecheck plus inventory tests |
| `src/features/inventory/testing/mock-api.ts` | Buyback nonzero-cost bypass rejection and evidence behavior | Actor-scoped default warranty snapshot | Keep buyback guard; accept `actor`; read store default only when warranty is omitted; preserve explicit zero | Inventory mock/default tests |
| `src/features/inventory/server/inventory.repository.ts` | Server deny, stored legacy-marker preservation and ordinary attachment compatibility | Store-default warranty resolver | Preserve `ForbiddenError`/feature-off guards and both warranty imports/paths | repository feature-off and warranty tests |
| `src/features/inventory/testing/mock-api.test.ts` | Guided-buyback feature-off/evidence coverage | Store-default snapshot/explicit-zero coverage | Union imports and both test groups | focused inventory/mock tests |
| `src/server/api/repairdesk-schemas.test.ts` | Quality-check CAS and guided-buyback schema coverage | Intake/sell/update/default-warranty schemas | Union all schema imports/tests | API/schema 5 files / 83 tests |
| `src/features/orders/testing/mock-api.test.ts` | Cancelled-device return and active/archive grouping coverage | Store-bound/custom-status workflow coverage | Keep both helpers and both test families | Orders 11 files / 131 tests |

## Manually resolved memory paths

| Path family | Decision |
| --- | --- |
| `.ai-company/memory/ACTIVE_CONTEXT.md` | Follow the resumed Settings task during ordered replay; update to WP09 after integration |
| `CAPABILITY_REGISTRY.md`, `MEMORY_INDEX.md` | Preserve both guided-buyback and Settings entries |
| `departments/{backend,data,frontend,qa,security}.md` | Preserve current-main order/buyback lessons and Settings release boundaries; rename the colliding Settings backend risk to `BE-20260713-003` |

## Auto-merged shared contracts reviewed explicitly

- Buyback quote model/tests, inventory repository, order hero/overview/detail/repository/mock, shared mock API.
- `src/lib/repairdesk/{api,api.test,types}.ts`.
- RepairDesk Router and schemas.
- Final source patch file set: 272/272 paths represented; no extra or missing source paths according to the
  independent architecture review.

## Stop conditions

- Any future rebase that weakens the hard-coded guided-buyback feature-off or Settings output identity is a blocker.
- Any future conflict that opens Kiosk/order-data flags, workflow Apply, or member production writes is a blocker.
- Database, push/PR, deploy and production actions remain outside this matrix and require separate approval.
