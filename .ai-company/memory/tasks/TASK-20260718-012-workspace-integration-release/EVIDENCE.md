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
