# Checkpoints

## 2026-07-10T21:54:36Z - Task started

- **Phase:** implementation setup.
- **Classification:** T3 / R3 / L2.
- **Owner approval:** implement the approved plan and push the completed scoped change to `main`.
- **Reserved actions:** no production Supabase migration apply, Dashboard setting change or production environment toggle without separate approval.
- **Workspace control:** isolated worktree based on latest `origin/main`; original dirty checkout preserved.
- **Next:** implement Query Freshness Coordinator and its race-condition tests.

## 2026-07-10T22:38:51Z - Implementation and browser evidence complete

- **Phase:** independent review and final gate rerun.
- **Implemented:** query-group/store epochs, event deduplication and batching, stale preload rejection, mutation rollback guards, reconnect/focus recovery, auth-before-subscribe with retry, shared query options, bounded idle preload, cancellation-first store switch/sign-out, no-store API responses, and compact sync UI.
- **Targeted evidence:** Realtime auth/provider tests pass; coordinator/preload/tenant/API cache tests pass; Playwright coordination suite passes 2/2 at 1440x900 and 390x844.
- **Earlier full gates:** lint, typecheck, 110 Vitest files / 743 tests, and non-sandbox production build passed before the final auth-retry/docs/public-export edits; these gates must be rerun before commit.
- **Visual evidence:** `test-results/realtime-preload-coordinat-bbc36-es-it-during-SPA-navigation-chromium/desktop-customer-warm-navigation.png` and `test-results/realtime-preload-coordinat-ba4cf--in-the-mobile-order-header-chromium/mobile-order-realtime-state.png`.
- **Production boundary:** Realtime migration, Dashboard private-only change, and production flags remain unapplied/default-off; preload is independently rollbackable.
- **Tool note:** `tools/ai_company.py checkpoint` could not run because the available Python lacks `tomllib`; this checkpoint and `ACTIVE_CONTEXT.md` were updated manually with the same required fields.
- **Open review:** read-only Security, QA, and Release reviewers are running against the current diff.
- **Next:** integrate reviewer findings, rerun all gates, update closeout evidence, then scoped commit and push `main`.

## 2026-07-10T22:48:36Z - Final gates passed; ready to push

- **Phase:** release execution.
- **Reviewer outcome:** Security found no code blocker; Release required final gates and code-only scope; QA's browser-evidence blocker was resolved by running the gated suite with the required controlled env.
- **Defect fixed during review:** order/customer/inventory list queries now wait for `activeStoreId`, eliminating the initial unscoped duplicate request; tenant switching also cancels `storesKeys.context` before replacement.
- **Final gates:** lint passed; typecheck passed; 110 Vitest files / 747 tests passed; Agent rule/config/template checks passed; production build passed with 22 static pages; controlled Playwright passed 2/2.
- **Browser proof:** the order queue request count is exactly one; customer preload count is exactly one and remains one after SPA navigation; 390px mobile layout has one visible compact sync state and no page overflow.
- **Scope proof:** no Supabase migration, Dashboard change, production environment update, deployment, or production data operation is included.
- **Next:** fetch latest `origin/main`, resolve only if remote advanced, commit scoped files, push `HEAD:main`, and verify remote hash.
