# Evidence — TASK-20260718-012

## Intake facts

- 2026-07-18 20:03 CEST：主 checkout `main` 相对本地记录的 `origin/main` 为 ahead 2 / behind 46，且包含多任务 tracked/untracked 改动。
- 存在六份未跟踪 store lifecycle migration 候选；尚未证明可生产 apply。
- 当前活动任务原为库存 V2 规划，Owner 已批准继续，但最新指令要求先完成此前改动发布。
- 发布采用隔离工作树和单一写入者；原主工作区保持可恢复。

## Agent evidence

- `/root/release_inventory_architecture` — Architecture/Explorer, read-only, complete. Confirmed the root checkout is not a release source; identified the order-sort and device-unlock residuals; store-print must be reconstructed on latest main.
- `/root/release_data_security` — DATA/SEC, read-only, complete for Phase 01. Six lifecycle migration files match `origin/main`; linked apply is already recorded; do not reapply. Found a HIGH retry-baseline flaw that blocks future purge worker/scheduler activation while dormant schema remains safe with flags off and zero jobs. Store-print SQL semantics pass, but the old timestamp must not be inserted into history.
- `/root/release_qa_governance` — QA/Release, read-only, complete for Phase 01. Current root release is FAIL; only scoped latest-main reconstruction may proceed. Required full quality gates, browser matrices, exact SHA deployment and rollback targets are recorded.

## Git / QA / Database / Release evidence

- Fresh `git fetch --prune`: local main ahead 2 / behind 47.
- `git cherry -v origin/main main`: both local commits are patch-equivalent (`-`) and must not be replayed.
- Supabase MCP `list_migrations`: lifecycle 6, order-cost Phase 1 2 and Phase 2 6 versions are present.
- Content comparison: current lifecycle migrations/workers and scan/save implementation files match `origin/main`; many other primary-checkout differences are stale local versions, not new release content.
- `RELEASE_UNIT_MATRIX.md`: three scoped units are classified for latest-main reconstruction: order progress sorting, device unlock retention, and store print address with a new forward migration.
- Store-print direct cherry-pick is FAIL: 14 paths overlap newer main work, including `public_base_url`, lifecycle and order-cost tests. Manual semantic replay is required.
- Old `20260717175731` migration is skipped; a new migration later than linked `20260718140000` must use lock timeout, avoid DML, and fail closed if the table/columns are absent.

## Phase 02 / 03 implementation and validation

- RU-01 commit `bdffa5f8`: order queues sort by workflow progress before creation timestamp; 128 focused tests PASS.
- RU-02 commit `05de4df8`: custody transitions no longer clear cached device unlock details and customer-held mobile orders keep the authorized masked edit entry; 117 focused tests plus targeted device-custody E2E 3/3 PASS.
- RU-03 commit `675d2082`: tenant address is accepted during store creation and used by tenant print identity; forward migration `20260718150000_neutralize_store_settings_identity_defaults.sql` has a 5-second lock timeout and no row DML; 166 focused tests PASS. Its version was finalized between linked `20260718140000` and the separately gated Inventory V2 migrations to prevent out-of-order history.
- Full gates: lint PASS, typecheck PASS, 280 test files / 1786 tests PASS, production build PASS, `agents:check` PASS, `git diff --check` PASS.
- Settings formal E2E: 67/67 PASS after correcting stale test fixtures that hard-coded the retired tenant name and an impossible permission/capability combination. The same three original failures were reproduced on `origin/main@448c2404` before the fixture correction.
- Browser evidence used only synthetic records. Workflow progress values were nondecreasing in every order group; 390px and 1440px views had no horizontal overflow; customer-held unlock dialog stayed masked; store/print previews used the selected tenant address and contact.
- Desktop broad suite: 50/58 PASS. Seven failures are unchanged buyback/inventory dialog locators in untouched modules. The remaining 1024 order print locator failure reproduced identically on `origin/main@448c2404`; the same order audit passed at 1280/1440/1536/1600.
- During validation `origin/main` advanced to `9465ead4` with Inventory V2 commits. This branch must be rebased and revalidated before database or release actions; no stale push is allowed.

## Visual evidence

- `screenshots/TASK-20260718-012-workspace-integration-release/ru01-orders-progress-1440.png`
- `screenshots/TASK-20260718-012-workspace-integration-release/ru01-orders-progress-390.png`
- `screenshots/TASK-20260718-012-workspace-integration-release/ru02-device-unlock-customer-held-390.png`
- `screenshots/TASK-20260718-012-workspace-integration-release/ru03-store-address-1440.png`
- `screenshots/TASK-20260718-012-workspace-integration-release/ru03-store-address-390.png`
- `screenshots/TASK-20260718-012-workspace-integration-release/ru03-print-preview-1440.png`
