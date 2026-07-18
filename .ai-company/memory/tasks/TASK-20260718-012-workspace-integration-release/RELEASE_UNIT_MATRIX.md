# Release Unit Matrix — TASK-20260718-012

更新时间：2026-07-18 20:20 CEST

## 结论规则

- `ALREADY_RELEASED`：`origin/main` 已包含，任务证据显示已经推送/部署；数据库项还需本轮只读 live 复核，但不得重复 apply。
- `RELEASE_NOW`：本地已完成、验证通过，且最新 `origin/main` 尚未包含的最小业务切片。
- `ARCHIVE_ONLY`：只读诊断、计划、截图或任务记忆；不改变生产行为，只有在不与远端权威记录冲突且无敏感信息时才可归档。
- `HOLD`：active/conditional/proposed/rejected、破坏性能力或远端已有更安全实现；本轮不推送、不启用。

## A. 已在远端与生产关闭的改动

| Unit | Remote evidence | Database / runtime state | Decision |
|---|---|---|---|
| 扫码/拍照响应式 | `79f26552`, `53cfb8de` | 无独立新 migration | `ALREADY_RELEASED` |
| 未知故障诊断/原子报价与统一保存 | `6e511c56`, `146a3253`, `91a5d077` | `20260717213518` 已在 linked history | `ALREADY_RELEASED` |
| 门店身份硬编码移除 | `3615c78b`, `f44e95f0`, `26185fa8` | URL 迁移已在 linked history | `ALREADY_RELEASED` |
| 门店生命周期 P0–P5 | `55cb7ab5`, `0e38b063` | 六份 lifecycle migration 均在 linked history；flags 继续全关，0 jobs 待本轮复核 | `ALREADY_RELEASED`, 禁止重复 apply/启用 purge |
| 桌面小白化与新建工单布局 | `f39f9b84`, `1f643313`, `91469c64`, `002852f3` | 无新数据库写入 | `ALREADY_RELEASED` |
| 订单内部成本一期 | `fa6bf5c4`, `09b78664`, `3e969dd4` | `20260718120000/121000` 已在 linked history | `ALREADY_RELEASED` |
| 订单成本第二期 | `7d00679e`…`28819d1e`, `0f5ed6eb` | 六份 Phase 2 migration 已在 linked history；child flags 默认关闭，无回填/导出执行 | `ALREADY_RELEASED`, 禁止重复 apply |
| Safari 电话输入、桌面虚拟键盘、金额头部 | `2b8b2352`, `1fadd288`, `0c474318`, `4e51422c` | 无 migration | `ALREADY_RELEASED` |
| 邀请时间夹具与库存 Dialog | `51d5b3b9` | 无 migration | `ALREADY_RELEASED` |
| 创建工单后统一跳转详情 | `3022ba83`, `5ca3bcef` | 无 migration | `ALREADY_RELEASED` |
| AI 小助手 Phase 0–2 安全切片 | `8bef230f`, `f9b0ee8c` | 无 migration；无生产 AI/OpenAI 配置，能力 fail-closed | `ALREADY_RELEASED`; Phase 3–5 `HOLD` |
| 全局样式恢复 | `45d4b669`, `448c2404` | 无 migration | `ALREADY_RELEASED` |
| 本地 ahead 2 commits | `git cherry` 将 `94abc5fd`, `24006ea6` 标记为 `-` | 与远端 `37b7b5a3/45d4b669` patch-equivalent | 不重复推送 |

## B. 本轮已证实未发布业务切片

| Unit | Local files | Evidence | Decision |
|---|---|---|---|
| 工单列表按显示进度 1/5→5/5 排序 | `src/features/orders/model/order-list-grouping.ts`, `order-list-grouping.test.ts` | `TASK-20260718-002-order-list-progress-sorting` closed；本地 focused/full/browser/build PASS；`origin/main` comparator 尚未比较 workflow progress | `RELEASE_NOW`，需在最新 main 重放并完整复验 |
| 设备解锁信息保留残差 | `cache-sync.ts`, `cache-sync.test.ts`, 移动订单详情与离线自动保存测试 | `origin/main` 仍接受 `clear_device_unlock` 缓存补丁，且移动详情仅设备在店时显示密码编辑；现有新建工单实现已显式保留解锁信息 | `RELEASE_NOW`，只做最新 main 窄补丁，禁止复制旧订单文件 |
| 新店默认打印地址与中性数据库默认值 | 创建店铺、设置、打印预览、repository/provisioning、schema、mock parity、测试与新前向 migration | 旧候选 `f74b82cb` 本地质量 PASS，但基于旧 main；旧 `20260717175731` 时间戳落后 linked history | `RELEASE_NOW / CONDITIONAL`：按语义手工重放；创建晚于 `20260718140000` 的新 migration；exact dry-run 只含该一份才可 apply |

## C. 本地旧副本或非发布项

| Group | Examples | Reason | Decision |
|---|---|---|---|
| 与远端字节相同但本地显示 untracked | lifecycle migrations/workers、scan files、combined-save files | 本地 index 落后导致假删除/假未跟踪；内容已在 remote | 不复制、不重复提交 |
| 本地旧版本而远端已有更安全/更新实现 | AI provider、offline drafts、phone keypad、providers、store lifecycle task/runbook、order cost | 直接提交会删除远端功能或回退安全修复 | `HOLD`; 以 remote 为准 |
| active/conditional/proposed/rejected | AI Phase 3–5、跨会话总控计划、旧 release 任务 | 尚未具备独立发布闭环或已被后续 release 取代 | `HOLD` |
| 破坏性能力 | store purge scheduler/worker/真实 close/export/purge flags | 独立 R4/D4；新发现跨重试 proof baseline 缺陷 | schema 保留，能力必须关闭；另立修复/激活门禁 |
| task-only archive/screenshots | 多个本地 closed 计划/诊断目录和旧截图 | 不属于产品漏发；需先去重、脱敏并避免覆盖远端权威 task | 默认不混入业务 release；关闭阶段单独判定 |

## D. Live facts already refreshed

- `git fetch --prune` 后：本地主 checkout ahead 2 / behind 47；两个 ahead commit 均为远端 patch-equivalent。
- Supabase MCP `list_migrations`：lifecycle 6、order cost Phase 1 2、Phase 2 6 均在 linked history。
- Store-print 旧 migration `20260717175731` 不在 linked history 且早于已应用版本；禁止 `--include-all`，必须以当前时间戳重发等价 forward migration。
- 官方 Supabase changelog（2026-07-18 检查）：近期无影响本次已有 additive migration/history dry-run 的 CLI breaking change；2026-04 的新表 Data API 暴露变化强化了显式 grants + RLS 检查要求。
- 待完成：CLI exact dry-run、0 lifecycle jobs、RLS/grants/advisors、Vercel exact SHA/runtime 只读复核。

## E. Architecture choice

| Option | Result |
|---|---|
| 在旧、混合主 checkout `git add -A` | 拒绝：会回退 47 个远端提交并混入 active/obsolete 内容 |
| stash/reset 主 checkout 后同步 | 拒绝：本轮不需要破坏或重排用户恢复句柄 |
| 最新 `origin/main` 新隔离 worktree，仅重放 `RELEASE_NOW` | 采用：按排序、解锁保留、打印地址三个独立 release unit 实施和验证；最小、可追溯、可单独 revert |
