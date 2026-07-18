# Phase 02C — RU-03 店铺默认打印地址

状态：`completed`

## Scope

- 新店创建可选填写默认打印地址，经 schema、repository 与 provisioning 写入本租户。
- 设置页可编辑地址，打印资料预览展示地址与联系方式。
- 继续使用 fail-closed 当前租户输出身份，不回退到 Chinatech/Floridia 固定身份。
- 未来四个身份列默认值为空；不回填、不删除历史行。

## Integration decisions

- 旧分支 `f74b82cb` 只作语义参考，未 cherry-pick。
- 保留最新 main 的 `public_base_url`、lifecycle、order-cost、invite 与 AI 逻辑。
- 跳过失序 migration `20260717175731`；用 Supabase CLI 创建 `20260718183206_neutralize_store_settings_identity_defaults.sql`。
- migration 使用 5 秒 `lock_timeout`，目标表缺失时 fail closed。

## Verification

- focused Vitest：11 files / 166 tests PASS。
- `npm run lint`：PASS。
- `npm run typecheck`：PASS。
- commit：`675d2082`。
- 全量测试、build、E2E、linked dry-run/apply/post-check 在后续阶段执行。

## Rollback

- 应用代码可单独 revert `675d2082`。
- 数据库不得恢复固定身份默认值；如需撤销只能新增前向 migration，将默认值改为安全的 `DROP DEFAULT`。
