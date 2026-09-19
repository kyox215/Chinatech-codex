# Evidence Index — TASK-20260917-SAMU-CUSTOMER-BALANCE

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request + isolation | 本问题独立 worktree 与 Task/Run/Context | `TASK.md`; Registry context-read | 校验通过；起始 commit e4a468c1bd6a5cae423dd857a49cc0bf7b8d6056，起始干净 | 2026-09-17 | controller |
| E-002 | source | 收款成功后保留余额、是否结清的原子一致性 | `src/features/orders/server/order.repository.ts:2140`; `supabase/migrations/20260716221119_customer_finance_v3_order_lifecycle.sql:537` | 源码：余额减本次金额；仅余额为0才置 paid；未执行数据库 | 2026-09-17 | controller |
| E-003 | source | 客户待收为全部有效工单正余额总和 | `src/features/customers/model/customer-order-state.ts:49`; 上述 migration 的 valid_order_facts / order_facts_by_customer | 排除取消、作废、删除；没有“某一单付款即客户全结清”规则 | 2026-09-17 | controller |
| E-004 | source | 同端与跨设备客户刷新映射已存在 | `src/features/orders/screens/order-detail-screen.tsx:2784`; `src/features/orders/api/cache-sync.ts:108`; `src/server/api/repairdesk-router.ts:2738`; `src/features/realtime/components/realtime-app-bridge.tsx:75` | 付款后 invalidate customers.all；广播和 revision 均覆盖 orders/customers | 2026-09-17 | controller |
| E-005 | pre-fix reproduction | 合法零押金部分收款被误判 | `src/features/customers/testing/payment-balance-diagnostic.test.ts`; Node24 Vitest | 7例中6通过，唯一业务失败为 €70 收 €5 后返回 payment_status_mismatch，预期无异常 | 2026-09-17T17:54Z | controller |
| E-006 | baseline checks | 缓存失效、跨端恢复、付款及客户SQL合同既有回归 | Vitest: cache-sync; query-invalidation-map; query-freshness-coordinator; realtime-app-bridge; realtime-sync-provider; customer-finance-migration; order-payment-migration | 7文件/51测试通过，2.65秒；静态 SQL 合同不是数据库执行证据 | 2026-09-17T17:56Z | controller |

## Reproduction notes

- 使用本仓库内合成客户/工单，未访问微信、真实支付或生产客户数据。
- 新测试最初另有搜索夹具错误：名称带数字触发现有手机号模糊匹配，`items.length=0` 断言收到其他合成客户。改为无数字的唯一合成姓名并增加付款前目标存在断言后，该夹具失败消失；未修改搜索源码或放松余额断言。
- 已通过的链路：€5全额清零并退出客户待收筛选；€70收€5余额65；同客户另一单20仍待收；过期版本不写入；幂等不重复扣款；活跃列表失效刷新；返回不活跃列表重新读取。
- 只读发现的用户反馈可能解释：部分付款、同客户其他欠款、成功后列表读取失败留旧缓存。前两项已本地验证，读取失败/恢复回归正在补充。这些均不是原案例的已证实根因。
- Node 默认为20；使用 Codex bundled Node v24.19.0，`npm ci --ignore-scripts` 按现有 lock 安装730依赖；无源码依赖/lock/env改动。

## Source feedback still needed

最小澄清：该单登记收款后，工单的“剩余待收”是否为0？刷新客户列表后是否仍显示余额？如需关联同一单，提供工单号后4位即可；不需要客户姓名、电话或支付凭证。

## Release boundary

当前为本地候选准备阶段，尚不可宣布可发布或原用户问题已解决；仍需修复后测试、独立复核及适用发布验收。生产实际付款结果和 deployed migration 未核验，未获授权读取。
