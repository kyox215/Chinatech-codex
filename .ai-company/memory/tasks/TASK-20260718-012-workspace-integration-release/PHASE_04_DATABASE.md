# Phase 04 — Supabase 精确预检与应用

状态：`pending`

## Gate

- [ ] 当前 Supabase CLI/官方变更信息已核对。
- [ ] linked migration history 与本地文件一一对齐。
- [ ] backup/restore、兼容性、锁、RLS、grant、函数执行权限和 post-check 已批准。
- [ ] 使用精确 linked dry-run；禁止 `--include-all`。
- [ ] 只 apply 审批矩阵中的迁移，禁止真实 store purge/删除/恢复数据写入。
- [ ] apply 后验证 migration history、schema、RLS、grants、RPC 和关键只读/安全 smoke。

## Exit condition

数据库门禁 PASS；无批准或不可逆项保持未应用并记录原因。

