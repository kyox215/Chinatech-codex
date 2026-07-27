# RepairDesk 跨设备数据一致性声明

Status: active
Owner: Architecture + Data + Security + Integration Lead
Effective: 2026-07-23
Scope: all store-scoped business reads, mutations, cache keys, Realtime events, and foreground recovery checks.

## 1. 目标与边界

数据库与 RepairDesk BFF 是唯一业务数据源。跨设备同步只传递“数据已变化”的元数据，
客户端收到信号后通过已有权限接口重新读取；不得把客户、设备、金额、解锁信息、附件路径或
任何实体内容放进 Broadcast。

同步采用两条互补路径：

1. 私有 Supabase Broadcast 是秒级快路径；
2. 店铺 + 业务域 revision 是持久兜底，订单前台每 30 秒只读取一个小版本号，版本变化才刷新。

手机或 iPad 进入后台时计时器可暂停；回到前台、恢复网络、重新订阅或切换店铺时必须执行
已有的 catch-up。30 秒是最大漏消息收敛窗口，不是业务数据轮询间隔。

`memos` 是第五个业务域，但只在当前路由为 `/memos` 且店铺上下文包含
`canReadMemos` 时订阅。备忘录页面的前台 revision 对账同样限定在该路由；离开页面后由缓存
失效和下次进入时重新读取收敛，避免为所有店铺成员常驻一个不需要的频道。
权限丢失或店铺切换会同时清除列表和按需加载的正文详情缓存。验证过的 store purge 删除 memo
或 order 数据时不得重建 domain revision 或发送事件；active 店铺的普通 order 变更仍必须递增。

## 2. 强制事件合同

允许的 Broadcast 顶层字段仅为：`schemaVersion`、`eventId`、`emittedAt`、`storeId`、
`domain`、`mutation`、`queryGroups`。主题必须为
`repairdesk:v1:store:<uuid>:<domain>`，频道必须为 private。

- 浏览器只能接收，不能发送业务 Broadcast；服务端/数据库负责发送。
- RLS 必须通过当前用户、有效店铺和有效会员验证主题，不得开放会员表给浏览器读取。
- 失败或回滚的业务事务不得产生“已成功”的版本变化。
- Broadcast 失败不得导致业务写入失败；revision 负责最终收敛。
- 客户端必须过滤当前店铺、验证事件结构、去重并合并短时间突发刷新。

## 3. 新功能接入规则

新增或修改业务写入时，开发者必须同时完成：

1. 在 `repairDeskRealtimeDomains` 选择业务域；
2. 声明受影响的 query groups，并在 `query-invalidation-map.ts` 映射到现有 query-key factory；
3. 确保成功事务会递增对应的 store/domain revision；
4. 只在成功后发送元数据事件，或由数据库触发器在事务内发送；
5. 对编辑表单保留 `expected_updated_at`/revision 等条件写保护；
6. 补充同店、跨店、重复事件、漏事件、离线恢复和敏感字段拒绝测试；
7. 更新本声明、架构文档、环境变量和发布/回滚清单。

如果数据库表没有 `store_id`，必须通过受约束外键安全解析店铺；禁止接受客户端传入任意店铺
作为版本查询范围。新业务域在完成权限、版本表、客户端映射与测试之前保持关闭。

## 4. 编辑冲突规则

实时刷新不得静默覆盖正在编辑的本机草稿。干净编辑器在服务器版本变化时自动重建基线；
存在本地未保存修改且服务器版本与编辑基线不一致时：

- 立即显示持续性冲突提示；
- 暂停普通保存；
- 用户明确“载入最新版本”后才能替换本机未保存内容；
- 金额、状态、客户、设备关联禁止自动合并；
- 服务端条件写/409 仍是最终防线。

## 5. 全店发布与回滚

本功能使用全局环境开关，2026-07-23 首次发布经 Owner 批准为所有店铺同步启用，不使用店铺
白名单。同步上线不免除门禁：必须完成 linked migration dry-run、迁移历史核对、RLS/权限核对、
Dashboard private-only、跨店订阅拒绝、真实双客户端测试、容量基线、lint/typecheck/test/build。

运行开关：

- `NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED`
- `REPAIRDESK_REALTIME_BROADCAST_ENABLED`
- `NEXT_PUBLIC_REPAIRDESK_REVISION_CHECK_ENABLED`

紧急回滚将三者设为 `0` 并重新部署。数据库回滚必须使用新的向前迁移移除业务触发器；保留
私有频道 RLS 加固和版本表，不恢复公共频道，不删除审计证据。

## 6. 观测与验收

至少观察：频道连接/重连、Broadcast 失败数、revision 检查失败率、版本变化后的刷新次数、
跨店拒绝、前端冲突提示、订单写入延迟和数据库触发器开销。任一出现 PII 载荷、跨店可读、
浏览器可发送、订单写入因 Broadcast 失败、持续刷新风暴或迁移历史冲突，立即停止发布或回滚。
