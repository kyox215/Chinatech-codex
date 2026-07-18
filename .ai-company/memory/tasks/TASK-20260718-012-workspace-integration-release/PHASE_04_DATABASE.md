# Phase 04 — Supabase 精确预检与应用

状态：`completed — scoped migration PASS / Inventory V2 migrations held`

## Gate

- [x] Supabase CLI `2.101.0` 可用；CLI 提示 `2.109.1` 可升级，本次未改变工具版本。
- [x] linked history 通过 MCP 与 CLI 双重核对；应用前远端最后版本为 `20260718140000`。
- [x] 应用前记录 7 行数据聚合指纹、最大更新时间、默认值、RLS、policy/ACL、锁与长事务；无行 DML，因此使用精确前后快照和旧默认值作为恢复证据。
- [x] 完整 dry-run 首次显示 Inventory V2 两份加店铺默认值一份，因此停止且未写入。
- [x] 店铺默认值迁移定版为 `20260718150000`；隔离数据库发布工作树 dry-run 只显示这一份，全程未使用 `--include-all`。
- [x] 只 apply `20260718150000_neutralize_store_settings_identity_defaults.sql`；未执行 store purge、删除、恢复或 Inventory V2 migration。
- [x] 应用后 migration history 包含 `20260718150000`；四列默认值均为 `''::text`，7 行 fingerprint `9809a92b6f9a45016d0d2bbabcd93ae7` 与 `max(updated_at)` 不变。
- [x] RLS、policy/ACL fingerprints 不变；无等待锁/长事务；export/purge jobs 仍为 0；legacy custody unlock-clear constraint 为 0。
- [x] 精确发布视图 post-dry-run 为 up to date；完整主线 post-dry-run 仅剩 `20260718175622`、`20260718181148` 两份 Inventory V2 migration。

## Exit condition

本次店铺默认值数据库门禁 PASS。Inventory V2 生产 migration、RPC grant 与单店灰度属于独立 D4 门禁，保持未应用；V1 和默认关闭 flags 不变。
