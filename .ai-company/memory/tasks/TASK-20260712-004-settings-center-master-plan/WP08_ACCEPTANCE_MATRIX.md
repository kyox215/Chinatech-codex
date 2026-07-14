# WP-08 Acceptance Matrix

Status: **overall FAIL / production NO-GO; local implementation is conditional only**
Reviewed: 2026-07-13 CEST
Scope commit before WP08 package: `04273546`

This matrix distinguishes local mock evidence from latest-main, linked database, and production proof.
`PASS` never implies approval to push, migrate, deploy, enable a flag, or process real data.

> WP09 correction, 2026-07-14: the exact overlap was 32 paths (23 product/code plus nine memory), not 24.
> The twelve commits are now locally rebased on `origin/main@d5384e88`; main's fail-closed buyback patch
> contains the earlier tenant/legal P1. The refreshed local gate and evidence commit `e7102868` are tracked in
> `WP09_LATEST_MAIN_INTEGRATION_REPORT.md`.

## 1. Static, test, and build evidence

| Acceptance item | Result | Evidence / remaining gate |
| --- | --- | --- |
| `agents:check`, lint, typecheck, full Vitest, build | PASS at WP08 snapshot | 167 files / 1073 tests; production build generated 22/22 pages |
| Exact `npm run test:e2e:interactions:mock` | PASS locally | Final rerun passed 54 and skipped 1 existing conditional order-dialog case. A discovered route-cleanup race was fixed and focused-rechecked first |
| Dedicated order-data E2E | PASS at WP07 HEAD | 10/10 at six target widths and high-risk states |
| `git diff --check` | PASS before final checkpoint | Repeat after checkpoint/staging before commit |
| Latest `origin/main` integration gates | CONDITIONAL LOCAL PASS | Rebased to `d5384e88`; evidence commit `e7102868` passes static, 179/1179 Vitest and 22-page build, with content-identical 44-case desktop, 13-case feature-off/dashboard and six-image visual evidence |

## 2. Unit and integration acceptance

| Acceptance item | Result | Notes |
| --- | --- | --- |
| Registry order, groups, legacy query, visibility | PASS | Registry/access tests |
| Section payload, reset, dirty state, version conflict | PASS | Draft/service/router/navigation tests |
| Five role capability projections | CONDITIONAL | Server projection coverage exists; every action across all nine sections is not browser-proven |
| Store A/B query, draft, one-time values, late response | PASS at unit/component layer | Browser matrix remains incomplete |
| Field length/email/phone/URL/warranty/empty validation | PASS | Strict settings/supplier/default-warranty contracts |
| Stable 403/409/422 and object mismatch | PASS at service/router layer | Offline and 409 browser paths remain incomplete |
| Kiosk/workflow/member transaction failure has no partial write | FAIL | Atomic production contracts are not implemented/proven |
| Order-data cross-store/expiry/replay/partial/report | PASS locally | Production containment, capacity, retention, and recovery remain blocked |

## 3. E2E critical flows

| Flow | Result | Gap |
| --- | --- | --- |
| Owner/Manager/Technician/Sales/Viewer open Settings without unexpected 403 | NOT PROVEN | Full five-role × nine-section browser matrix absent |
| Nine deep links, invalid fallback, browser history | PASS | Explicit hard-refresh coverage is still limited |
| Dirty section/store/back save-discard-cancel | PASS | Rail, command palette, sidebar, store switch, history and mobile return covered |
| Save error, offline, 409, partial success | CONDITIONAL | Partial and service/router conflict covered; offline/409 E2E incomplete |
| Store A transient credential disappears on B | CONDITIONAL | Component proof exists; browser proof incomplete |
| Late A response never paints on B | CONDITIONAL | Component proof exists; browser proof incomplete |
| Member/supplier/workflow overlays close by save/cancel/Escape/navigation | CONDITIONAL | Workflow is complete; member/supplier matrix partial |
| Overlay pointer/inert/hit target/focus release | CONDITIONAL | Shared and workflow paths pass; every member/supplier overlay not enumerated |
| Long values, 50+ members, 100-row preview | CONDITIONAL | 101-row preview passes; explicit 50+ member browser scenario absent |
| Mobile recovery actions | PASS | Context and section `重新加载` are at least 44 px at 390 px |

## 4. Responsive and visual acceptance

| Item | Result | Notes |
| --- | --- | --- |
| 390/430/768/1024/1280/1440 primary Settings widths | PASS for representative sections | No page overflow in recorded suites |
| Clean overview 390 and 1440 | PASS locally | Exact 390×844 and 1440×900 captures inspected with synthetic data and no Dev indicator |
| Store/account mobile and desktop | CONDITIONAL | Core states covered; final release metadata matrix incomplete |
| Member 390 Sheet and 1280 Drawer | PASS for representative edit states | WP08 1280 Drawer inspected; historical 390 confirmation remains reference evidence |
| Workflow 390 and 1440 | PASS locally | Apply remains locked |
| Order preview 390 and desktop confirmation/partial | CONDITIONAL | Desktop preview screenshot itself is not separately recorded |
| Every section, role, error/read-only/locked state without Dev indicator | NOT PROVEN | Clean minimum evidence is improved, not exhaustive release photography |

## 5. Release blockers and decision

P0 found in WP08 review: **0**.

Open P1/release blockers:

1. Main's hard-coded feature-off contains guided-buyback evidence/signature/finalize; re-enablement remains
   an R4 legal/data/schema/storage/retention gate and must not be inferred from Settings readiness.
2. Separate push/PR approval is pending; local evidence commit `e7102868` has not been published.
3. Five-role, offline/409, cross-store late-response, complete overlay, and 50+ member E2E are incomplete.
4. Member, Kiosk, workflow, and order-data production transaction/data gates remain open.
5. Linked migration history, exact reviewed migration set, current flags, target environment, monitoring
   baseline, release owner, rollback owner, and maintenance window are unknown.
6. No Owner exception acceptance with owner and expiry exists.

Decision: WP00–WP07 local slices remain **CONDITIONAL PASS**. WP08 may package documentation and
evidence, but the master task remains `in_progress`; push, migration, deployment, flag enablement, and
production processing remain **NO-GO**.
