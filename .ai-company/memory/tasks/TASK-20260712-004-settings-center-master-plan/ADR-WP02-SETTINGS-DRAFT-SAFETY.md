# ADR-WP02: 分组设置草稿、版本冲突与全局离页保护

- Status: accepted
- Date: 2026-07-12
- Decision owners: Owner / RepairDesk Integration Lead
- Related task: TASK-20260712-004-settings-center-master-plan / WP-02
- Supersedes: none

## Context

当前设置页以一份全量草稿更新 `store_settings`。请求 schema 允许额外字段并执行数值强制转换，数据库更新只按 `store_id` 过滤；后台刷新或另一会话的保存可能被静默覆盖。页面内 Link、应用侧栏、命令面板、移动快捷入口、店铺切换和浏览器历史也没有统一的未保存保护。

现有 `store_settings.updated_at` 可作为乐观并发版本。WP-02 不改变数据库 schema、权限角色语义或生产数据。

## Decision drivers

- 店铺隔离与权限检查必须先于对象上下文和版本判断。
- 每次只保存当前设置分组，不让旧草稿覆盖其他分组的新值。
- 后台刷新不得覆盖本地脏草稿；冲突必须显式可恢复。
- 所有应用内导航和店铺切换共享同一离页保护；硬刷新只使用浏览器原生提示。
- 方案必须可在当前分支内回滚，且不需要数据库迁移。

## Considered options

### Option A — 分组请求、原子 CAS、共享 NavigationGuardProvider

公开请求使用严格的 `section` 判别联合，只携带当前分组字段、`expectedStoreId` 与 `expectedUpdatedAt`。服务端从认证 actor 解析真实店铺，仓储更新同时匹配 `store_id` 和 `updated_at`。设置草稿按分组记录 base/value/conflict；应用 Provider 统一拦截 Link、命令式跳转、店铺切换和浏览器历史。

### Option B — SettingsScreen 局部提示、继续全量更新

只在设置 rail/返回按钮中提示，继续把整份草稿发送到服务端。实现较少，但 AppSidebar、CommandPalette、移动快捷入口、店铺切换和历史导航可绕过；全量更新仍会覆盖其他分组的新值。

### Option C — 字段变更后自动保存

省去显式保存和离页提示，但会增加请求、误操作写入和离线失败复杂度，且无法消除并发覆盖，和当前设置中心的显式提交交互不一致。

## Decision

采用 Option A。

### Public update contract

`StoreSettingsSectionUpdateRequest` 是三类严格联合：

- `store`: 店铺名、地址、邮箱、电话、WhatsApp。
- `notifications`: 打印页脚、客户消息签名。
- `rules`: 维修默认质保月数、库存默认保修月数；质保文本由服务端派生。

共同字段为 `expectedStoreId` 和 `expectedUpdatedAt`。`expectedStoreId` 只用于发现客户端上下文变化，授权店铺始终来自 actor。

稳定失败协议：

- `SETTINGS_STORE_CONTEXT_CHANGED` / HTTP 409
- `SETTINGS_VERSION_CONFLICT` / HTTP 409
- `SETTINGS_VALIDATION_FAILED` / HTTP 422，并可带 `fieldErrors`
- `FORBIDDEN` / HTTP 403

### Repository and side effects

更新顺序为权限检查、严格解析、actor 店铺与 expected store 比对、读取当前值、版本比对、按 `store_id + updated_at` 原子更新、审计、Realtime。只把当前分组列写入 update。CAS 返回空行时报告版本冲突，不做审计和 Realtime。

当前审计写入与设置更新不在同一数据库事务内；WP-02 记录这一残余风险，不宣称事务原子性。

### Draft and navigation interfaces

- 分组草稿保存 `storeId`、`baseUpdatedAt`、`base`、`value`、`conflict` 和 `lastSavedAt`。
- 后台数据变化时：干净分组吸收新值；脏分组保留输入；同分组服务端变化标记冲突。用户显式选择重建基线后执行 `base/local/server` 三方字段合并：未在本地修改的字段吸收服务器值，本地修改字段继续保留，且不会自动提交。
- 保存只提交当前分组。成功后当前分组清洁，其他脏分组保留并基于新版本继续工作。
- 409 不强制覆盖；用户只能比较后重试、放弃本地修改或取消离页。
- `NavigationGuardProvider` 暴露守卫注册和 `runGuardedTransition`。应用内 Link 由共享 capture 处理；命令式导航和店铺切换显式调用该 API；浏览器历史使用可逆的索引恢复；硬刷新使用 `beforeunload`。
- 离页对话框固定提供“保存并继续 / 放弃修改 / 取消”，一次只允许一个 pending transition。同一来源的多个脏设置分组会按当前可见分组优先依次保存或一次全部放弃；多个独立来源会继续提示，直到全部处理完才执行原导航。
- 店铺设置三个分组和账号显示名称分别注册守卫；空账号名属于“脏但无效”，保存并离开会被阻止并把焦点送回输入框。

## Consequences

### Positive

- 防止跨分组和并发静默覆盖。
- 一套保护覆盖设置 rail、总览卡、返回入口、侧栏、命令面板、移动快捷入口、店铺切换及浏览器历史。
- 无 schema migration，数据库回滚边界小。
- 错误码、字段错误和冲突状态可被 UI 与自动化稳定识别。

### Negative / trade-offs

- Provider 需要维护浏览器 history 索引，并为命令式入口显式接入。
- 审计与业务更新仍非数据库事务。
- 旧客户端的全量 `{ input }` 请求会被严格 schema 拒绝；本分支必须同步前后端后再发布。

## Risks and mitigations

- 浏览器历史被重复触发：使用 pending lock、恢复事件抑制标记和单次 bypass。
- 店铺切换期间应用旧响应：请求、响应、query cache 和 active scope 四重校验继续保留。
- 后台刷新覆盖输入：草稿 reconcile 只自动替换干净分组。
- 双击保存：mutation pending 与共享保存 Promise 共同去重。
- 验证错误不可定位：服务端返回字段路径，UI 聚焦首个无效字段并使用 `aria-live` 宣告。
- 多个草稿只处理一个后看似无响应：设置来源内部处理全部脏分组，Provider 在独立来源之间继续同一个 pending transition。

## Validation plan

- 合同、草稿/reconcile、仓储 CAS、服务、router/error envelope、API client 单元测试。
- Provider/对话框测试覆盖保存、放弃、取消、pending lock、Link、命令式跳转和 beforeunload。
- SettingsScreen 测试覆盖分组保存、三方合并、多个脏分组的顺序保存/失败/全部放弃、账号名称、后台刷新、店铺切换失败和双击去重。
- E2E 覆盖桌面 rail、总览、移动/平板返回、AppSidebar、CommandPalette、MobileWorkspaceDock、ScanSearch、店铺切换、back/forward 及六视口无横向溢出。
- 完成后运行 agents、lint、typecheck、全量 tests、设置 E2E 和 build。

## Migration and rollback

迁移顺序：先加入纯类型/草稿模型和测试，再切换 server CAS 与错误协议，然后接入 UI 保存状态和 Provider，最后覆盖各导航入口。无数据库迁移或回填。

发布前所有调用端必须与严格请求协议同批交付。若验证失败，回滚 WP-02 本地提交即可恢复旧接口；WP-00/WP-01 不受影响。任何生产发布或 main 推送仍需 Owner 明确批准。

## Revisit conditions

- 设置与审计需要数据库事务一致性。
- Next.js 提供正式的 App Router navigation blocking API。
- 设置域扩展为多行/多资源事务或需要离线草稿持久化。
