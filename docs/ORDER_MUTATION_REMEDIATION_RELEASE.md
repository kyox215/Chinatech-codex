# 订单功能修复发布说明

范围：承接 2026-09-07 订单审计 O-01 至 O-06，连同桌面金额键盘修复。历史问题与原始验证见 [订单审计](ORDER_FUNCTION_AUDIT_2026-09-07.md)。

## 行为合同

- 普通编辑、快速编辑和财务编辑通过同一个数据库事务提交订单、关联客户、事件、审计和操作回执。任一步失败，整笔回滚。
- 报价下限包含初始定金、付款分类账以及兼容历史订单的已付金额；报价不得低于已收金额。编辑不得代替退款或有付款历史的定金纠正。
- 相同操作人、订单、原版本和请求内容得到稳定保存标识，网络重试可重放；显式标识对应不同内容时拒绝。回执不保存客户或设备敏感字段。
- 新建必须携带 UUID 操作标识，创建与状态恢复只使用数据库权威操作表，并限定当前店铺和操作人。
- 停用状态不再出现在下一步或批量目标中。批量部分失败保留失败订单，显示安全原因并仅重试失败项；整体失败保留选择并提供本地化提示。
- 启用屏幕数字键盘后仍可用电脑键盘输入金额，支持数字、小数点/逗号、退格、Delete、Enter 和 Escape；Safari 鼠标点击后仍保留正确输入焦点。

## 数据库变更与发布顺序

新增 [前向迁移](../supabase/migrations/20260907231616_20260907215255_order_mutations_atomic_v3.sql)：订单编辑回执表和 `repairdesk_mutate_order_v3`。文件版本与生产迁移登记的 `20260907231616` 对齐，名称保留原候选标识；不回填历史业务数据，不删除订单或分类账，不变更客户端数据库权限。

已只读确认当前生产项目 `xluzcoduqsdvjoouqhkc` 尚无该新函数。GitHub main 连接 Vercel 生产部署，因此应用调用与数据库扩展必须按以下顺序发布：

1. 完成候选代码、SQL 回滚/权限/幂等测试和独立安全审查。
2. 由获明确授权的操作者确认当前迁移历史、可恢复备份和迁移窗口，仅应用本次前向迁移。
3. 核验新表 RLS、函数签名、空 `search_path`、仅 service-role 执行权限和 PostgREST 可见性。
4. 推送已验收提交到 main，让既有部署流程发布，并检查 CI 与部署结果。
5. 用无业务写入的检查确认页面与服务可用；真实收款、客户修改或故障注入不得作为生产冒烟测试。

缺少新函数时应用返回 `ORDER_MUTATION_MIGRATION_REQUIRED`，不回退到存在部分提交风险的旧写入。该拒绝机制不等同于完成上线，不能据此跳过数据库先行要求。

## 回滚与观测

迁移采用新增表和函数；回滚应用时保留回执和审计证据。不要删除操作回执，也不要自动恢复旧的不安全财务写路径。函数缺陷使用新的前向迁移修复，必要时暂停相关编辑。

观察保存事务失败、版本冲突、报价低于已收、幂等冲突及批量失败比例；只记录错误代码、计数和无敏感信息的操作标识。不得记录完整请求或客户、IMEI、解锁内容。

## 验证环境

- 本地 Node 22.12.0，候选基线 `71c3eff3`，独立 worktree。
- PostgreSQL 17.6 本任务独占容器，`network none`、无外部端口；只复制同项目 schema 并使用合成数据。
- 本地 clone 的原始宽泛 ACL 与源码声明不同；测试基线按已提交付款/创建迁移恢复 ACL 后，付款 19/19、创建 21/21 通过。线上只读目录核验现有相关 RPC 的 anon/authenticated 执行权限均为 false，此处不把本地 clone 的宽泛 ACL 当作生产缺陷。
- 9 张订单相关表的线上与本地列类型、空值规则逐列一致；未读取生产业务行。
- 本次新迁移、最终自动化测试、浏览器截图与独立审查结果在任务 Evidence 记录；未完成项不得记为通过。

## 2026-09-07 第二阶段验证状态

已实现并验证 O-01 至 O-06 和实体键盘修复；本地候选尚未发布。独立 Terra/max 数据审查追加的定金纠正历史与电话并发边界也已修正。

- Node 22：全仓 lint / typecheck / agents:check 通过，lint 有 1 条基线已有 warning；最终测试 530 文件 / 4,682 项通过，build 30/30 页面生成。
- 第一次全仓测试发现 3 个测试 fixture 兼容问题与 1 次无关用例并行超时；fixture 已修复，原超时用例未修改且定向通过，最终 maxWorkers=4 全仓重跑通过。
- 隔离 PostgreSQL：最终原子订单测试 51/51；真实双连接同时把不同客户改成相同号码，一方成功，另一方等待共享锁后返回 customer_phone_conflict，只有一条回执且失败方客户不变。
- Chromium 16/16、WebKit 16/16：金额输入覆盖六宽度，批量部分失败、权限失败、网络失败与重试均有截图。全部使用模拟业务数据，拦截写请求。
- [桌面金额输入](../screenshots/TASK-20260907-006-orders-keyboard-audit/chromium-1440-virtual.png)、[手机金额输入](../screenshots/TASK-20260907-006-orders-keyboard-audit/chromium-390-virtual.png)、[批量部分失败桌面](../screenshots/TASK-20260907-007-orders-full-remediation/bulk-partial-1440.png)、[平板](../screenshots/TASK-20260907-007-orders-full-remediation/bulk-partial-768.png)、[手机](../screenshots/TASK-20260907-007-orders-full-remediation/bulk-partial-390.png)。

## 2026-09-08 回执清理授权与闭合验证

老板已明确批准新回执表在受限清理路径中使用 `service_role DELETE`。实现只在 `repairdesk_order_mutation_operations` 上增加该权限，并附加两个既有门店生命周期门禁：`repairdesk_enforce_active_store_write()` 与 `repairdesk_enforce_verified_memo_purge_delete()`。浏览器角色仍没有读取、修改或删除权限，`service_role` 也没有 UPDATE 或 TRUNCATE 权限；普通删除、伪造 GUC、跨店、错误 worker、非 service JWT 与过期租约都会被拒绝。

- [生命周期验收](../supabase/tests/order_mutation_receipt_lifecycle.sql) 使用合成数据和事务回滚，22/22 通过；唯一允许的删除是经真实 `repairdesk_purge_store_table_batch_v3_rpc` 走已验证租约的目标门店回执批次。
- 原子订单 SQL 验收 51/51 通过，确认新 ACL 与既有幂等、事务、财务和状态规则一起生效。
- 独立数据/安全 delta 审查结论为 PASS：权限仅限本表，两个门禁均已覆盖，没有未解决发布阻塞。
- 集成候选在 Node 22.12.0 通过 lint、typecheck、agents:check、530 个测试文件 / 4,685 项、构建 30/30 页面，以及受控模拟环境中 Chromium 与 WebKit 各 16/16 的订单键盘与批量恢复测试。lint 仍只有既有的一条 React ref warning。

生产项目已成功应用这条前向迁移，登记为 `20260907231616 / 20260907215255_order_mutations_atomic_v3`。只读核验确认新回执表为空、RLS 已启用、仅 `service_role` 具备受触发器约束的 SELECT/INSERT/DELETE，浏览器角色没有读取或删除权；两个清理门禁和 invoker、空 `search_path` 的 RPC 均已存在。迁移没有回填或删除订单、客户、付款或回执业务数据。接下来仅需推送 main 并检查既有部署流程；如需调整，使用后续前向迁移保留审计证据。
