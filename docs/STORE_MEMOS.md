# 店铺备忘录 V1

Status: implementation complete, release gated
Owner: RepairDesk Product + Data + Security + Integration Lead
Effective: 2026-07-27

## 功能合同

`/memos` 为当前店铺提供普通记录和待办。所有有效店铺成员可读取；viewer 只读。
owner/manager 可管理全部记录、分配员工、归档与恢复；technician/sales 可创建记录，只能修改
自己创建记录的标题/正文，且可完成或重开自己创建或分配给自己的待办，也可领取未分配待办。
员工不能撤销或抢占已有负责人。记录包含标题、正文、类型、负责人、
到期时间、完成和归档状态，不用于保存密码、支付资料、设备解锁码或不必要的客户隐私。

页面支持全文搜索、类型和负责人筛选、待处理/我的/逾期/已完成/已归档视图与分页。桌面使用紧凑
表格和 Dialog；手机、平板使用卡片与底部 Sheet。编辑器保留未保存草稿保护，并在版本变化时
阻止覆盖保存。

## HTTP API

所有端点均为 `POST /api/repairdesk/<path>`，复用现有登录、当前店铺解析、CSRF、私有响应和
错误映射。读取同样要求功能已对当前店铺开放。
拥有多个有效店铺时必须由有效 cookie 明确选择当前店铺；缺失或非法 cookie 不允许 memo
读取或写入。单店账号继续使用唯一店铺的安全回退。

| Path               | Body                                    | Result                          |
| ------------------ | --------------------------------------- | ------------------------------- |
| `memos/summary`    | `{}`                                    | 待处理、逾期、我的、已完成计数  |
| `memos/list`       | view/kind/assignee/search/page/pageSize | 无正文/内部 ID 的分页摘要与能力 |
| `memos/get`        | `{ id }`                                | 当前店铺单条记录                |
| `memos/assignees`  | `{}`                                    | 可分配的最小员工投影            |
| `memos/create`     | `{ input }`                             | mutation envelope               |
| `memos/update`     | `{ input }`                             | 更新后的记录                    |
| `memos/transition` | `{ input }`                             | 领取、完成或重开后的记录        |
| `memos/archive`    | `{ input }`                             | 归档后的记录                    |
| `memos/restore`    | `{ input }`                             | 恢复后的记录                    |

写请求必须包含 UUID `operationId`；更新、状态与归档操作还必须包含 `expectedVersion`。服务端
请求体上限为 8 KiB。数据库保存请求哈希与结果引用：相同操作号和相同载荷安全重放，不同载荷
返回冲突。mutation envelope 包含当前权威 `memo`、`replayed` 和原操作的 `appliedVersion`；重放
不会把旧快照当成当前详情。列表不返回正文、`store_id` 或 creator membership，打开详情时才读取
完整正文。分页最大 100 页，版本过期返回 HTTP 409。

BFF 对解析后的 memo 尝试调用通用 authenticated limiter：每个 SHA-256 店铺/会员 scope 每分钟
最多 120 次读取、30 次写入。写入业务验证失败也已在独立事务中计数。固定窗口行只保存 hash、
计数和时间，2 分钟过期并在后续 consume 时限量清理；不保存邮箱、姓名、memo 或店铺 UUID。

## 数据与安全

迁移 `20260727005412_store_memos_v1.sql` 新增两张 memo 业务表 `store_memos`、
`store_memo_operation_receipts`，以及不含 `store_id` 的通用基础设施表
`repairdesk_authenticated_rate_limits`。浏览器角色没有表或 RPC 权限；service role 对业务表
没有直接 INSERT/UPDATE，对 limiter 表没有任何 DML。BFF 只执行 postgres-owned、固定空
`search_path` 的 SECURITY DEFINER RPC。mutation RPC 的第一步取得生命周期同源 shared advisory
lock，再 `FOR UPDATE` 当前 membership 并重新核对 user、role、会员/店铺状态和 lifecycle active；
receipt 重放也不能绕过这些检查。审计、revision 与 Broadcast 只记录元数据，不记录
标题或正文。

两个表都带 `store_id uuid` 和生命周期 fence，能被既有动态归档、恢复、残留计数与 purge
目录发现。stores 外键和 receipt→memo 外键均为 RESTRICT，purge 必须依动态依赖顺序先删 receipt
再删 memo。普通 hard delete 被专用 trigger 拒绝；只有 lease 验证过的 purge worker 且 lifecycle
非 active 才能删除，并且 memo 与现有 order revision trigger 都不会在 full purge 中重建版本行或
发送 Broadcast。通用 limiter 没有 `store_id`，不进入租户导出/恢复/purge；其 TTL 清理独立执行。

## Realtime 与缓存

`memos` 使用私有主题 `repairdesk:v1:store:<uuid>:memos`，事件 query group 仅为
`memos.all`。只有 `/memos` 路由且 `canReadMemos=true` 时订阅；前台 revision 对账也只在该
路由执行。事件不包含 memo id、标题、正文、负责人或到期时间。店铺切换、权限变化和退出登录
会清理 `memosKeys`，防止跨租户缓存残留。

## 发布步骤

1. 保持 `REPAIRDESK_MEMOS_ENABLED=0`，核对目标环境迁移历史和备份/恢复证据。
2. 对 linked 数据库执行迁移 dry-run；核对三表、约束、索引、RLS、service-role grants、RPC、
   lifecycle fence、revision 和 private topic 策略。
3. 在非生产环境验证跨店读取/写入拒绝、viewer 写入拒绝、平台管理员无会员拒绝、重复请求、
   版本冲突、领取竞争、归档恢复、离线恢复和双客户端刷新。
4. 运行 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 与相关浏览器流程。
5. 先部署兼容迁移，再部署应用；设置 `REPAIRDESK_MEMOS_ENABLED=1`，仅把批准店铺 UUID 加入
   `REPAIRDESK_MEMOS_STORE_ALLOWLIST`。先单店观察，再逐店扩展，不接受 `*`。
6. 观察 403/409/422/429、RPC 延迟、receipt 增长、revision/Broadcast 失败、频道重连与前端
   冲突提示；发现跨店、越权或敏感载荷立即停用。

## 回滚

最快回滚是把 `REPAIRDESK_MEMOS_ENABLED=0` 并重新部署；导航、读取、写入和 memo Realtime
都会 fail closed，数据仍保留。随后可回滚到上一应用版本。数据库对象保持原位，禁止通过 down
migration 删除业务表、receipt 或审计证据。若触发器或 RPC 必须撤回，使用新的向前迁移禁用/替换，并在
修复后重新验证动态 lifecycle 与恢复流程。
