# RepairDesk 店铺重命名、关闭与永久清除计划

Last updated: 2026-07-17

Owner: Hexiang Huang / 鹤祥

Status: P0-P5 local implementation complete; production migration, flags and target action not approved

Target label from owner screenshot: china tech noto

Task: TASK-20260717-store-lifecycle-delete-rename-plan

## 1. 当前结论

本轮已经实现并本地验证完整重命名、可恢复关闭/恢复、完整导出/恢复证明和后台永久清除编排，但不直接删除截图中的店铺。

原因不是操作意愿不足，而是当前证据不足以安全执行不可逆动作：

- 用户文字中的 chinayech noto 与截图中的 china tech noto 不完全一致。
- 店铺名称不是唯一键，必须先确认不可变 store UUID、主 Owner、slug、创建时间和状态。
- 当前代码已有正式的重命名、关闭、归档、恢复 API/RPC/UI，以及不暴露给浏览器的导出和清除 worker；所有生产开关仍默认关闭，migration 尚未应用到 linked 项目。
- 现有 stores.delete() 只用于新店创建失败后的补偿回滚，不能用于已有业务店铺。
- 多个业务、支付、审计和回收协议表使用 ON DELETE RESTRICT。
- Supabase Storage 对象不会随数据库附件元数据自动删除。
- 当前只有局部业务导出，不是可恢复的完整店铺导出。
- 生产 schema、约束、RLS、Storage、备份与恢复证据必须在执行前重新验证。

推荐决策顺序：

1. 如果这是正确店铺、只是名字错误：完整重命名。
2. 如果这是误创建或重复店铺：先可恢复关闭并从普通店铺列表隐藏。
3. 只有在完整导出、保留期判断、恢复演练和第二次明确批准后，才永久清除。

禁止按店铺名称直接执行删除 SQL。

## 2. 当前系统事实

### 2.1 名称存在两个来源

- stores.name 是工作区身份名称，店铺切换器和侧边栏读取它。
- store_settings.store_name 是收据、打印、消息等客户输出资料。
- 当前设置页保存店铺名只更新 store_settings.store_name，不会改变截图中列表使用的 stores.name。
- 因此，现有设置表单不是完整工作区重命名能力。

完整重命名必须原子处理这两个来源，或明确让 Owner 选择是否同步客户输出名。

### 2.2 生命周期能力已完成本地实现

当前实现使用独立、版本化的 `store_lifecycles` 状态机表达 `active / closing / archived / purge_scheduled / purging / purge_failed / purged`，不会把店主关闭与平台 `stores.status = suspended` 混在一起。应用层已有近期 TOTP 挑战、原子重命名、关闭、归档、恢复、完整导出/恢复证明和幂等清除 worker。

Kiosk、邀请、普通 API 写入和离线回放都有 lifecycle-active 门禁；关闭会撤销邀请与 Kiosk 凭据，恢复不会让旧凭据复活。生产 migration、feature flags、备份/KMS sink、真实目标预检和不可逆二次批准仍是硬门禁。准确操作顺序以 `docs/STORE_LIFECYCLE_IMPLEMENTATION_RUNBOOK.md` 为准。

### 2.3 直接硬删除不安全

当前数据库同时存在以下依赖：

| 分类 | 示例 | 风险 |
|---|---|---|
| 核心业务 RESTRICT | 客户、设备、供应商、工单、事件、消息、库存、设置、模板、审计 | 任一目标店记录都可能阻止删除父店铺 |
| 财务与不可变记录 | 支付账本、终态操作 | 需要先满足财务终态与保留政策 |
| 法务与回收 | 回收协议、签名、证据附件 | retention_until 或 legal_hold_until 是硬阻断 |
| 自动级联控制数据 | 成员、邀请、权限、工作流、Kiosk、离线草稿 | 一旦删除会失去恢复能力 |
| 数据库外对象 | Storage、浏览器 IndexedDB、旧会话、缓存、Realtime | 删除数据库行不会自动清除 |
| 文本快照 | 平台审批或历史记录中的旧店名 | 需要决定保留、去标识化或删除规则 |

最终依赖清单必须从目标生产环境的系统目录生成，不能只依赖本地迁移文件。需要读取每个指向 stores 的 FK、实际删除动作、约束验证状态，以及每个 store_id 表的目标行数。

### 2.4 当前生产证据有文档漂移

2026-07-10 的共享数据库执行计划记录迁移历史已对齐且 dry-run 无待应用迁移；较旧的 Phase 5 验证手册仍记录远端版本不匹配。执行任何生产写入前必须重新运行只读迁移历史和 schema 验证，以当前输出消除冲突。任何旧文档都不能单独作为生产删除许可。

## 3. 三个方案

| 方案 | 数据影响 | 可恢复性 | 当前可执行性 | 风险 | 适用场景 |
|---|---|---:|---:|---:|---|
| A. 完整重命名 | 不删除业务数据 | 高 | 需先实现正式能力 | R2 | 店铺真实有效，只是拼写或品牌名错误 |
| B. 可恢复关闭/归档 | 保留数据并停止业务访问 | 高 | 需先实现关闭编排 | R3 | 重复店、误建店、暂停营业 |
| C. 永久清除 | 删除业务数据和附件 | 不可恢复 | 当前绝对 No-Go | R4 | 目标精确、数据已导出、保留期结束且恢复演练通过 |

对截图中的目标，默认采用 B；如果只需修正名字，则改用 A。C 不作为第一步。

## 4. 方案 A：完整重命名

### 4.1 产品规则

- 工作区名称 stores.name 与客户输出名称 store_settings.store_name 必须在 UI 中明确区分。
- 默认修改工作区名称。
- 当客户输出名称仍等于旧工作区名称时，可以提供“同步客户输出名称”选项。
- 当客户输出名称已被单独定制时，不得静默覆盖。
- store_id、slug、store_code、Storage 路径和外部引用默认保持不变。
- 不要求全平台店名唯一，避免通过冲突提示泄露其他私有租户。
- 同一 Owner 可见范围内发现同名时提示，并用店铺码或 UUID 后缀消歧。

### 4.2 权限与接口

- 新增 store:rename，只有 primary owner 可执行。
- manager 继续可以编辑客户输出资料，但不能重命名工作区身份。
- 请求必须绑定当前 active store、精确 store UUID、expected lifecycle revision、operation id 和近期重新认证证明。
- 服务端执行 Origin/CSRF、权限、版本 CAS 与幂等校验。
- 原子更新 stores.name，以及 Owner 选择同步时的 store_settings.store_name。
- 写入不含客户 PII 的 before/after 审计。

### 4.3 缓存与显示

成功后必须刷新：

- 认证店铺上下文和 HttpOnly active-store cookie 关联的上下文。
- React Query 店铺与设置缓存。
- 侧边栏、AppBar、设置页切换器。
- 打印、消息模板预览、Kiosk 和邀请页面中允许显示的店铺名。
- Realtime 客户端的店铺身份显示。

### 4.4 回滚

重命名审计保存旧名称。发生发布问题时使用相同原子接口和新 revision 恢复旧名称，不能直接手工改一个名称表。

## 5. 方案 B：可恢复关闭/归档

### 5.1 状态模型

平台暂停与店主主动关闭是两种不同业务：

- suspended：平台风控、滥用或合作暂停。
- closing：Owner 已请求关闭，店铺进入只读与清理准备期。
- archived：普通用户不可进入，但仍可按政策导出或恢复。
- purge_scheduled：保留和恢复门禁通过，已安排清除。
- purging / purge_failed：后台任务运行或可恢复失败。
- purged：业务数据已按批准清除，仅保留最小非 PII tombstone。

为最小兼容，stores.status 可继续负责 active/suspended/deleted 的访问门，详细状态放入版本化生命周期记录；不要把 suspended、archived 与 purged 混成同一个含义。

### 5.2 关闭前预检

只读预检必须返回脱敏计数和阻断原因：

- 精确 store UUID、主 Owner、slug、创建时间、当前状态。
- 所有 Owner、成员、邀请、邀请码和加入申请。
- 客户、设备、工单、店内保管设备、未结余额、支付和终态操作。
- 库存、库存交易、供应商、导入批次、离线操作。
- 回收协议、retention、legal hold、签名和证据。
- Kiosk 设备、配对码、Token、公开会话。
- 所有附件元数据与每个 Storage 前缀的对象数、大小和哈希。
- 当前 active cookie、后台任务、Realtime 和未同步 outbox 风险。

所有结果只能是计数、状态和哈希，不把客户 PII 写入审批包。

### 5.3 关闭动作

- 只允许 primary owner。
- 要求 5 分钟内近期重新认证，优先 MFA/Passkey。
- 输入当前工作区名称与 UUID 后缀，确认关闭原因和冷静期。
- 使用一次性签名挑战绑定 actor、store UUID、revision 和预检摘要。
- 获取生命周期锁并冻结新增业务写入。
- 撤销待接受邀请、邀请码、邀请链接和待处理加入请求。
- 撤销 Kiosk Token、配对码、公开提交与新签名 URL。
- 断开或拒绝 Realtime、后台任务和迟到离线写入。
- 当前活动店铺关闭时，原子切换到另一个 active 店铺；没有其他店铺时清 Cookie 并进入 no-store/已关闭状态页。
- 清除当前设备的目标租户 React Query、IndexedDB、outbox、敏感 vault 和附件 staging；其他设备在下次联网时收到关闭事件并清理。
- 旧凭据在恢复后也不自动复活，邀请与 Kiosk 必须重新建立。

### 5.4 冷静期与恢复

- 默认建议 30 天冷静期；最终天数需要 Owner 与法律/会计规则确认。
- 冷静期内可以取消关闭或恢复 archived 店铺。
- 恢复必须重新检查 primary owner、生命周期 revision 和法律/平台 hold。
- 恢复业务访问不恢复已撤销的 Token、邀请或配对码。

## 6. 方案 C：永久清除

### 6.1 绝对前置门禁

以下任一不满足即停止：

1. 目标 store UUID、主 Owner、slug、状态和预检摘要已确认。
2. 店铺已完成可恢复关闭和冷静期。
3. 所有开放工单、保管设备、未结余额、支付、导入、回收流程已完成或依法归档。
4. retention_until 已到期，legal_hold_until 为空或已正式解除。
5. 已完成完整加密店铺导出和 Owner 签收。
6. 已证明数据库备份/PITR 可用。
7. 已单独备份 Storage 对象；Supabase 数据库备份不包含 Storage 文件内容。
8. 已在隔离非生产环境完成恢复演练并核对表计数、校验和与文件哈希。
9. linked migration、实际 FK、RLS、Storage policy 和 schema cache 已只读复核。
10. DATA、SECURITY、QA、RELEASE 审查通过。
11. Owner 对精确目标、计数、命令集、维护窗口和不可逆结果做第二次批准。
12. 独立执行人完成四眼复核。

Supabase 官方说明建议先识别依赖并考虑软删除；Storage 对象必须通过 Storage API 删除，不能直接删除 storage schema 行，且对象删除不可恢复。数据库备份也不包含 Storage 对象本身：

- https://supabase.com/docs/guides/database/postgres/data-deletion
- https://supabase.com/docs/guides/storage/management/delete-objects
- https://supabase.com/docs/guides/platform/backups

### 6.2 完整导出与恢复证明

导出包至少包含：

- schema 与应用版本。
- 所有目标店 store_id 表的结构化数据。
- 每张表的行数、主键摘要和校验和。
- Store、成员、角色、设置、消息模板和工作流。
- 客户、设备、工单、事件、库存、供应商、付款和回收协议。
- 审计与操作记录的批准保留版本。
- Storage bucket、对象路径、大小、内容哈希和元数据 manifest。
- 加密方式、保存位置、访问日志、保留期限和销毁日期。

恢复演练必须把导出恢复到隔离环境或新测试租户，核对计数、校验和、文件可读性和基本读取流程。共享数据库全库恢复会影响其他店铺，只能作为最后手段。

### 6.3 保留与法律门禁

Chinatech 位于意大利，永久清除前必须由 Owner 与会计/法律专业人员确认哪些资料属于会计、发票、税务、保修、争议或法律请求证据。意大利民法典第 2220 条通常要求会计记录和发票等保存十年；GDPR 第 17 条删除权也对法定义务和法律请求等情形设有例外。因此，不应把“删除店铺”理解成无条件立即清除所有财务和证据记录。

- https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=086U0772&atto.dataPubblicazioneGazzetta=1986-11-25&bloccoAggiornamentoBreadCrumb=true&classica=true&dataVigenza=&generaTabId=true&tipoDettaglio=originario
- https://eur-lex.europa.eu/eli/reg/2016/679/oj

需要保留的数据应进入受限、去标识化或依法归档路径，而不是绕过 hold 强制删除。本计划不是法律意见。

### 6.4 清除执行顺序

永久清除由后台 service worker 执行，浏览器不能直接承担长事务：

1. 创建不可变 purge job，锁定 store UUID、revision、预检计数和批准摘要。
2. 再次冻结写入并确认无新增记录。
3. 保存最终 DB 与 Storage manifest。
4. 通过 Storage API 按受控批次删除目标 UUID 前缀对象，每批记录结果，可安全重试。
5. 验证对象为零后，按线上 FK 依赖图删除附件元数据和业务行。
6. 先删除依赖记录，最后处理 stores 控制面记录；禁止关闭约束或使用不受控 CASCADE。
7. 大数据量使用版本化批次与 checkpoint；空店可使用专用事务。
8. 保留最小、非 PII 的平台 tombstone：目标 UUID 的不可逆哈希、operation id、完成时间、批准引用和 manifest 哈希。
9. 运行零残留、零孤儿和跨租户差分验证。
10. 观察错误、拒绝访问、后台任务和备份到期传播。

清除任务必须幂等。同一 operation id 和相同 payload 返回原结果；同一 operation id 搭配不同 payload 返回冲突。部分失败进入 purge_failed/retryable，不能把数据库标记成成功。

### 6.5 加速空店清除

只有同时满足以下条件，才可缩短冷静期并使用专用空店清除流程：

- 无客户、设备、工单、事件、支付、库存、供应商和导入数据。
- 无附件元数据或 Storage 对象。
- 无 Kiosk、离线 outbox、邀请、邀请码、加入申请或后台任务。
- 无回收协议、签名、retention、legal hold、财务或终态记录。
- 只有初始化设置、默认模板、默认工作流和主 Owner membership。
- 完整预检、备份证明、精确目标确认和不可逆二次批准仍已完成。

空店清除也不能复用创建失败回滚函数；需要正式、受审计、事务化的 empty-store purge。

## 7. 实施工作包

### WP0：只读目标与线上结构预检（代码完成，目标需刷新）

- 解析当前账号可见店铺并确认目标 UUID。
- 验证目标不是默认历史店铺，也不是另一个仍在用的同名店。
- 读取生产列、FK、约束、RLS、Storage policy 和 migration list。
- 生成脱敏的表计数、Storage 数量与 hold 摘要。
- 输出 Go/No-Go，不执行 DML。

### WP1：工作区重命名 MVP（本地完成）

- 新增 store:rename 权限和 primary-owner 校验。
- 新增 schema、service、repository、router 和 client API。
- 原子更新名称双源、CAS、幂等和审计。
- 刷新上下文、缓存和所有可见名称。
- 独立发布与独立回滚。

### WP2：可恢复关闭与恢复（本地完成）

- 新增 lifecycle revision、关闭时间、归档时间、purge_after 和操作表。
- 新增关闭、取消关闭和恢复服务。
- 为所有业务 mutation、Kiosk、邀请、离线、后台任务和签名 URL 增加 active/closing gate。
- 新增设置页“店铺生命周期/危险区域”与已归档店铺页。
- 不提供浏览器直删；在“已关闭与删除”中提供申请、24 小时冷静期、取消和二次确认，实际清除仍只由后台 worker 执行。

### WP3：完整导出、保留与恢复（框架完成，真实 sink/演练待批准）

- 建立 catalog-driven 店铺导出器。
- 建立 Storage manifest、加密和访问审计。
- 建立 retention/hold 策略和 Owner 决策记录。
- 完成隔离恢复演练工具和验收报告。

### WP4：清除编排器（本地完成，生产开关关闭）

- 新增服务端 purge job、step ledger、锁、重试、取消和观测。
- 建立 Storage 与数据库依赖图。
- 新增最小 tombstone。
- 增加 empty-store 快速路径。

### WP5：目标店铺处理（未执行）

- 对 china tech noto 先执行 WP0。
- 若只是名称错误，走 WP1。
- 若确认误建，走 WP2 并观察。
- 只有 WP3/WP4 和第二次批准完成后，才走永久清除。

## 8. 预计文件范围

实施时预计涉及：

- src/lib/repairdesk/types.ts
- src/server/permissions.ts 及权限测试
- src/server/api/repairdesk-schemas.ts
- src/server/api/repairdesk-router.ts 及路由测试
- src/features/stores/server/store.service.ts
- src/features/stores/server/store.repository.ts 及测试
- src/features/stores/server/primary-store-owner.ts
- src/lib/repairdesk/api.ts
- src/features/settings/sections/store-settings-section.tsx
- 店铺上下文、缓存、Realtime、Kiosk、邀请与离线模块
- additive Supabase migration、RLS、service-role-only RPC、operation/tombstone 表
- 只读预检 SQL、清除 runbook、恢复演练与发布文档

新公共表必须显式配置 grants 与 RLS，不能依赖默认暴露：

- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- https://supabase.com/docs/guides/database/postgres/row-level-security

## 9. 测试与验收

### 9.1 重命名

- primary owner 成功；manager、staff、platform support 与跨店请求拒绝。
- 空白、超长、Unicode、大小写和并发版本冲突验证。
- 名称双源原子更新；不同步选项不会覆盖定制客户输出名。
- slug、store_id、store_code 与 Storage 路径不变。
- 重复 operation id 不产生重复审计或重复写入。
- 侧边栏、AppBar、设置、打印、消息、Kiosk 与邀请页面不显示旧缓存名。
- 可通过正式接口恢复旧名称。

### 9.2 关闭与恢复

- 所有业务新增/修改在 closing 后服务端失败关闭。
- Kiosk、邀请、Cookie、Realtime、签名 URL、后台任务和离线迟到写入失效。
- 当前店铺安全切换；没有其他店铺时进入 no-store 状态。
- 其他店铺的行数、缓存、成员和页面完全不变。
- 冷静期内可恢复，但旧 Token、配对和邀请不会复活。
- 并发请求、重复请求、失败重试与审计通过。

### 9.3 永久清除

- 实际线上 catalog 覆盖每个 store_id 表、FK、view、function、job 和 bucket。
- retention、legal hold、支付、终态和保管设备门禁生效。
- Storage 对象与数据库元数据双向清零，无孤儿。
- 目标店所有批准删除的行归零，平台 tombstone 存在且无客户 PII。
- 其他店铺前后差分计数与校验和不变。
- 清除 worker 可从每个失败 checkpoint 恢复。
- 备份到期与后续销毁传播已记录。

## 10. 发布、回滚与观察

- 所有迁移先本地验证，再 linked dry-run；生产 apply 需要精确命令批准。
- 先发布权限、状态 gate 和只读预检，再发布 UI。
- WP1、WP2、WP3、WP4 独立发布，禁止一次性上线全部生命周期能力。
- 重命名可前向恢复旧名。
- 关闭可在冷静期恢复，但凭据重新签发。
- 永久清除无业务回滚，只能依赖已演练的恢复或前向修复；因此必须单独批准。
- 生产观察至少覆盖拒绝率、生命周期 job、Storage 清除错误、跨店异常、旧会话和后台任务。

## 11. Owner 决策包

当前可以安全选择：

- A：只读核查目标店铺，确认后完整重命名。还需要提供新名称。
- B：只读核查目标店铺，确认是误建后实施“关闭并隐藏”能力。推荐默认。
- C：规划最终永久清除，但现在不执行；待导出、保留、恢复与二次批准后再决定。

任何生产动作前，Integration Lead 必须给 Owner 一份最终确认包，包含：

- 精确 store UUID 与名称。
- 当前状态和主 Owner。
- 各类数据与 Storage 的脱敏计数。
- 阻断项和 retention/hold。
- 影响、可恢复性和其他店铺不受影响的证据。
- 精确命令/API、维护窗口、执行人和审查人。
- 回滚或恢复方案。
- Owner 需要输入的确认短语。

## 12. 2026-07-17 B 只读预检结果

Owner 选择 B 后，已对 Supabase 项目 `ChinaTech_date` 执行只读预检；未执行 DML、DDL、迁移、状态修改、删除、部署或推送。

目标店铺已确认：

- UUID: `84d5fdc1-ab9d-464f-a166-29649cc15311`
- store_code: `CHINAT-730829`
- name: `china tech noto`
- slug: `china-tech-noto-91efd4f2`
- status: `active`
- created_at: `2026-07-08 18:18:27.614+00`
- memberships_total: 1
- owner_memberships: 1
- invitations_total: 0
- customer_facing_store_name: `china tech noto`

脱敏业务计数显示该店不是空店：

| 表 | 行数 |
|---|---:|
| order_workflow_transitions | 47 |
| order_workflow_statuses | 15 |
| message_templates | 9 |
| audit_logs | 8 |
| order_events | 3 |
| customers | 2 |
| devices | 2 |
| repair_orders | 2 |
| order_payment_ledger | 1 |
| store_memberships | 1 |
| store_settings | 1 |

维修单状态摘要：

| order_id_prefix | status | workflow_status | payment_status | device_custody_status | 未结余额 |
|---|---|---|---|---|---:|
| 4b7fd227 | new | intake | partial | null | 20.00 |
| 74323fe6 | new | intake | paid | with_shop | 0.00 |

Storage 只读候选查询未发现包含目标 UUID、slug 或 store_code 的对象路径；这不等于完整 Storage 导出证明，只能作为当前候选路径计数。

当前 Go/No-Go：

- 关闭隐藏：NO-GO，除非先处理 2 个 `new/intake` 维修单、`20.00` 未结余额和 `with_shop` 设备保管风险。
- 快速空店清除：NO-GO，因为已有客户、设备、维修单、支付账本和审计/事件记录。
- 永久删除：NO-GO，仍需要导出、保留期/legal hold、恢复演练、Storage manifest 和二次精确批准。
- 推荐下一步：先把这 2 个维修单业务处理完，或由 Owner 明确确认它们是测试数据并批准专门的测试数据处理方案；随后再实施 WP2 可恢复关闭/归档能力。

## 13. 本轮边界

初始计划轮次只交付计划和只读审查。Owner 选择 B 后，本文件增加了生产只读预检结果。

- 已连接生产 Supabase 做只读预检；未修改生产 Supabase。
- 未重命名、关闭或删除任何店铺。
- 未执行写入 SQL、迁移、部署、提交或推送。
- 未处理或记录截图中的账号邮箱等个人信息。
- 没有新增 UI，因此无相关任务结果页面可截图；用户提供的截图只作为目标标签线索，不能作为删除授权或唯一目标证明。

## 14. 2026-07-17 设置截图补充诊断

新截图显示当前账号可见 `ChinaTech` 与 `Chinatech siracusa` 两个店铺，当前选择后者；两者均显示“店主”成员角色。该截图没有提供不可变 store UUID，也不能证明当前账号是两个店铺的 `stores.owner_user_id` 主创建者。因此，本节不把其中任一店铺视为已批准删除目标，既有 `china tech noto` 预检结果也不能套用到这两个名称。

“工单数据”显示“当前账号无法访问此设置”不表示工单丢失。当前能力由以下条件共同决定：

1. `ORDER_DATA_EXPORT_ENABLED` 必须精确等于 `1`。
2. 当前 actor 必须是非系统账号，拥有明确选择的 active store。
3. 当前 membership 必须是 active owner。
4. `stores.owner_user_id` 必须等于当前 actor id。
5. `stores.status` 必须是 active。

其中任一条件失败，前端都会把卡片锁定；当前 UI 把“功能未开放”“非主店主”和“能力读取失败”合并显示为同一句话。仓库运营指南目前明确要求生产 `ORDER_DATA_EXPORT_ENABLED=0` 与 `ORDER_DATA_APPLY_ENABLED=0`，所以截图最可能是预期的发布门禁，而不是权限数据损坏。若未来只批准导出，可以单独评估 Export 开关；Apply 必须继续保持关闭，直到现有导入门禁全部通过。

建议先实施一个 P0 文案与诊断修复：Store Context 返回结构化的工单数据可用性原因，设置页分别显示“功能暂未开放”“仅当前店铺创建者可访问”“请重新选择店铺”和“仅开放导出/预览，应用仍关闭”。服务端端点和数据库 RPC 的 primary-owner 校验不得放宽。

针对新截图中的两个店铺，删除/关闭前应分别执行新的只读预检：确认 UUID、owner_user_id、状态、开放工单、未结余额、店内保管设备、支付、回收协议、附件与 Storage manifest。只有通过该预检，才能判断应走完整重命名、可恢复关闭还是永久清除路线。
