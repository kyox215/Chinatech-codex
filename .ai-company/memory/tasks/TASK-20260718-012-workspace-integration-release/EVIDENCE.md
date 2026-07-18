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
- Full gates on the final Inventory V2 main base: lint PASS, typecheck PASS, 286 test files / 1803 tests PASS, 26-route production build PASS, `agents:check` PASS, `git diff --check` PASS.
- Settings formal E2E: 67/67 PASS after correcting stale test fixtures that hard-coded the retired tenant name and an impossible permission/capability combination. The same three original failures were reproduced on `origin/main@448c2404` before the fixture correction.
- Browser evidence used only synthetic records. Workflow progress values were nondecreasing in every order group; 390px and 1440px views had no horizontal overflow; customer-held unlock dialog stayed masked; store/print previews used the selected tenant address and contact.
- Desktop broad suite: 50/58 PASS. Seven failures are unchanged buyback/inventory dialog locators in untouched modules. The remaining 1024 order print locator failure reproduced identically on `origin/main@448c2404`; the same order audit passed at 1280/1440/1536/1600.
- During validation `origin/main` advanced to `9465ead4` with Inventory V2 commits. This branch must be rebased and revalidated before database or release actions; no stale push is allowed.

## Phase 04 production database evidence

- The six scoped commits rebased cleanly onto `origin/main@9465ead4`; eight semantic-overlap test files / 146 tests and the full quality suite passed afterward.
- Initial full linked dry-run listed `20260718175622_inventory_product_v2_foundation.sql`, `20260718181148_inventory_product_v2_identity.sql`, and the store-default migration. No SQL was applied from that view.
- To avoid either bundling Inventory V2 or creating out-of-order history, the store-default migration was finalized as `20260718150000_neutralize_store_settings_identity_defaults.sql` and released from a detached database worktree where both Inventory V2 files were absent.
- Exact pre-apply dry-run listed only `20260718150000`; apply succeeded without `--include-all`.
- Pre/post row evidence is identical: count `7`, maximum `updated_at` `2026-07-17 20:51:32.467+00`, aggregate fingerprint `9809a92b6f9a45016d0d2bbabcd93ae7`.
- Post defaults are empty text for `store_name`, `store_address`, `print_footer`, and `message_signature`; RLS/policy/ACL fingerprints, zero lifecycle jobs, zero waiting locks and zero long transactions are unchanged.
- MCP migration history includes `20260718150000`. Exact post-dry-run is up to date; full main dry-run now lists only the two separately gated Inventory V2 migrations.
- Supabase security advisor still reports existing project-wide INFO/WARN items (including RLS-with-no-policy patterns used with revoked/direct access and older mutable-search-path/permissive-policy debt). This migration introduced no object, grant, policy, or RLS change; remediation remains a separate security program.

## Visual evidence

- `screenshots/TASK-20260718-012-workspace-integration-release/ru01-orders-progress-1440.png`
- `screenshots/TASK-20260718-012-workspace-integration-release/ru01-orders-progress-390.png`
- `screenshots/TASK-20260718-012-workspace-integration-release/ru02-device-unlock-customer-held-390.png`
- `screenshots/TASK-20260718-012-workspace-integration-release/ru03-store-address-1440.png`
- `screenshots/TASK-20260718-012-workspace-integration-release/ru03-store-address-390.png`
- `screenshots/TASK-20260718-012-workspace-integration-release/ru03-print-preview-1440.png`

## Phase 05 production release evidence

- `origin/main` 由 `9465ead4` 非强制快进到业务发布 SHA `e4aee9231745de4def661b3c79400a616b2e3e55`。
- Vercel deployment `dpl_AjMLSbHA9fnA9Vytd7si9jRafkrP` 对应精确 SHA、状态 READY，并绑定 `https://chinatech.in` 与 `https://www.chinatech.in`。
- 未登录生产冒烟：`/login` 200；`/`、`/orders`、`/settings?section=store`、`/inventory/new` 均 307 到登录；`/api/repairdesk/stores/context` 401。
- Vercel 名称级环境检查未发现 Inventory V2、legacy-mutation 或 lifecycle 激活变量；默认关闭边界未改变。最近 10 分钟 error 级日志无条目。
- 回滚目标为上一 READY Web deployment `chinatech-codex-36c0kpcd7-kyox120-9295s-projects.vercel.app`；数据库 migration 为无 DML 的 forward-only default neutralization，保留 schema 并以前向修复回滚。

## Phase 06 / 07 closeout evidence

- 原 checkout 的两个领先提交经 `git cherry -v origin/main main` 均显示 `-`，证明 patch-equivalent；未重放、reset 或删除。
- `git branch --no-merged origin/main` 仍含旧 preservation/WIP 和未完成任务分支；它们被保留并按任务状态隔离，不作为本次“此前所有已完成改动”漏发证据。
- Inventory V2 的 `f7df2df8`、`7238123c`、`9465ead4` 已在本次分支基线内；其任务、runbook、截图和默认关闭契约完整。
- 在本次分支最初关闭时，生产 linked dry-run 只列出 Inventory V2 `20260718175622` 与 `20260718181148`。随后 `origin/main` 并发吸收默认关闭的 AI 成本治理提交；最终 `main@d84dae86` 只读 dry-run 精确列出 AI `20260718174042` 加上述两份 Inventory V2 migration，三份均保持未应用。
