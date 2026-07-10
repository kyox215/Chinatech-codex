# 角色权限配置计划书

Last updated: 2026-07-09
Owner: 鹤祥 / Chinatech
Status: Phase B server enforcement completed; Phase C linked migration history verified aligned on 2026-07-10; Phase D1 order projection completed, Phase D2 scope/UI projection pending

## 目标

设置页中的角色配置必须变成可执行的权限系统，而不是只保存“技师/前台”等标签。每个成员进入系统后，服务端必须根据店铺角色判断：

- 可以查看哪些页面、列表、详情和附件。
- 可以编辑哪些业务字段。
- 是否能看到金额、利润、供应商、设备解锁、历史记录等敏感内容。
- 是否能执行批量操作、成员管理、设置修改、导出、退款、强制付款状态等高风险动作。

## 角色定义

| 角色 | 业务含义 | 默认权限定位 |
|---|---|---|
| 店主 `owner` | 店铺最高负责人 | 全部业务权限； owner 转移/移除仍需要额外审批 |
| 店长 `manager` | 日常运营负责人 | 大部分订单、客户、财务和设置权限；不能授予店长/店主、不能默认查看供应商成本 |
| 技师 `technician` | 维修执行人员 | 维修相关写入为主；默认不能看金额调整、客户营销、供应商、导出和成员管理 |
| 前台 `sales` | 接待/收款人员 | 接待、客户、收款、通知为主；不能调价/退款/看供应商成本/改流程 |
| 只读 `viewer` | 临时或审计查看 | 默认只读且需要对象范围；不能写入、导出或查看敏感凭据 |

## 权限域

| 权限域 | 典型动作 | 敏感级别 |
|---|---|---|
| 工作台 | 打开店铺、查看列表 | 中 |
| 工单 | 创建、编辑接待、编辑维修、单个流转、批量流转、上传照片、导出 | 高 |
| 客户 | 查看、创建、编辑、标签、消息、导出 | 高 |
| 金额 | 收款、调价、退款、强制付款状态 | 高 |
| 库存 | 创建、编辑、质检、销售、转移、报损 | 高 |
| 供应商 | 查看、选择订单供应商、管理供应商 | 高 |
| 设置 | 店铺设置、流程设置、消息模板 | 高 |
| 成员 | 邀请、停用/恢复、角色管理、权限授予、店主转移 | 高 |
| 支持访问 | 授权平台支持、查看支持审计 | 高 |
| 敏感附件 | 设备解锁信息、签名/照片附件链接 | 高 |

## 默认权限矩阵

| 动作 | 店主 | 店长 | 技师 | 前台 | 只读 |
|---|---|---|---|---|---|
| 打开店铺工作台 | 允许 | 允许 | 允许 | 允许 | 允许 |
| 查看工单列表/详情 | 允许 | 允许 | 范围内 | 允许 | 范围内 |
| 创建工单 | 允许 | 允许 | 允许 | 允许 | 禁止 |
| 编辑接待信息 | 允许 | 允许 | 范围内 | 允许 | 禁止 |
| 编辑维修诊断 | 允许 | 允许 | 允许 | 范围内 | 禁止 |
| 单个流转工单 | 允许 | 允许 | 允许 | 允许 | 禁止 |
| 批量流转工单 | 允许 | 允许 | 禁止 | 禁止 | 禁止 |
| 配置工单流程 | 允许 | 允许 | 禁止 | 禁止 | 禁止 |
| 上传工单照片 | 允许 | 允许 | 允许 | 允许 | 禁止 |
| 导出工单 | 允许 | 允许 | 禁止 | 禁止 | 禁止 |
| 查看/编辑客户 | 允许 | 允许 | 范围内 | 允许 | 范围内只读 |
| 发送客户消息 | 允许 | 允许 | 范围内审批后 | 允许 | 禁止 |
| 导出客户 | 允许 | 允许 | 禁止 | 禁止 | 禁止 |
| 收款 | 允许 | 允许 | 禁止 | 允许 | 禁止 |
| 调整金额/退款/强制付款 | 允许 | 允许 | 禁止 | 禁止 | 禁止 |
| 库存创建/编辑 | 允许 | 允许 | 允许 | 允许 | 禁止 |
| 库存质检 | 允许 | 允许 | 允许 | 禁止 | 禁止 |
| 库存销售/转移/报损 | 允许 | 允许 | 需要审批 | 需要审批 | 禁止 |
| 查看/选择/管理供应商 | 允许 | 默认禁止，可单独授权 | 默认禁止，可单独授权 | 默认禁止，可单独授权 | 禁止 |
| 店铺设置/流程/模板 | 允许 | 允许 | 禁止 | 禁止 | 禁止 |
| 邀请/停用/恢复普通成员 | 允许 | 允许 | 禁止 | 禁止 | 禁止 |
| 授予店长或供应商权限 | 允许 | 禁止 | 禁止 | 禁止 | 禁止 |
| 店主移除/转移 | 额外审批 | 禁止 | 禁止 | 禁止 | 禁止 |
| 平台支持授权 | 允许 | 禁止 | 禁止 | 禁止 | 禁止 |
| 设备解锁信息 | 允许 | 允许 | 范围内审计 | 需要审批 | 禁止 |
| 附件/签名链接 | 允许 | 允许 | 范围内审计 | 范围内审计 | 范围内审计 |

## 敏感内容展示策略

### 金额

- 前台可以收款和查看客户应付金额，但不能修改维修报价、押金、退款或强制付款状态。
- 技师默认不看收款、退款、利润和金额调整入口；如果维修步骤需要报价建议，应走“建议报价”或“待店长确认”流程。
- 店长/店主可以看金额详情和进行金额修正，必须写审计日志。

### 历史记录

- 店主/店长可以查看完整客户历史和工单历史。
- 前台可以查看客户接待必要历史，例如设备、问题、近期工单状态；不默认展示利润、供应商成本、内部敏感备注。
- 技师只看分配给自己或当前维修范围内的历史，重点是设备问题、诊断、照片和维修记录。
- 只读角色必须是范围内只读；不得成为“全店所有敏感历史”入口。

### 供应商和成本

- 供应商、采购成本、订单供应商选择默认只给店主。
- 店主可单独授予 `supplier:read`、`supplier:assign`、`supplier:manage`。
- 授权表必须启用 RLS，普通客户端不能直接读写，通过服务端校验后写入。

### 设备解锁和附件

- PIN、密码、图案、签名链接、照片签名 URL 等属于高敏感信息。
- 技师只有在范围满足时读取，并记录审计。
- 前台读取解锁信息需要更高审批或后续独立流程；不得默认开放。

## 服务端执行原则

- UI 可以隐藏按钮，但真正的权限必须在 API/Repository 层执行。
- 所有高风险动作必须使用统一权限矩阵，不允许在单个页面里临时判断角色字符串。
- 拒绝策略采用 fail-closed：没有明确允许即禁止。
- 系统 actor 默认不绕过权限，除非测试/维护上下文显式声明。
- 高风险动作写审计日志，至少包括 actor、store_id、action、entity_type、entity_id、时间和输入摘要。

## 数据库策略

- 继续使用单一共享数据库和 `store_id` 隔离。
- 新增或已有授权表必须：
  - 启用 RLS。
  - 撤销 `anon` / `authenticated` 直接表权限。
  - 只允许 service role 通过服务端业务逻辑写入。
  - 使用唯一索引避免同一成员重复有效授权。
- 本阶段使用 `store_member_permission_grants` 管理供应商权限授权。
- 生产数据库应用不能只凭本地 migration 文件存在来认定完成；必须先通过 `docs/SHARED_DB_TENANT_ONBOARDING_EXECUTION_PLAN.md` 的 Database Application Gate。
- 2026-07-10 read-only CLI recheck: `supabase migration list --linked` shows local and remote history aligned through `20260709235000`, and `supabase db push --linked --dry-run --include-all` reports remote database up to date.

## 分阶段计划

### Phase A: 权限模型

已完成：

- 新增 server-only 权限矩阵。
- 定义角色、动作、效果：`allow`、`deny`、`scoped`、`elevated`。
- 为供应商权限保留显式 grant 机制。

### Phase B: 服务端入口强制

本次执行：

- 批量流转独立为 `order:batch_transition`，只允许店主/店长。
- 订单附件上传使用 `order:photo_upload`。
- 订单通知、WhatsApp 通知、审批请求使用 `customer:message`。
- 成员供应商权限修改使用 `member:grant_manager`。
- 补充单元测试覆盖新增拦截点。

### Phase C: 数据库落地

当前状态：

- `supabase/migrations/20260709235000_supplier_permission_grants.sql` 已存在，用于 `store_member_permission_grants`。
- 2026-07-10 linked recheck 显示 migration history 已对齐，latest remote version 为 `20260709235000`。
- `supabase db push --linked --dry-run --include-all` 当前为 no-op/up to date；无需从本任务重新执行生产 apply。

后续生产数据库执行条件仍然保留：

- Pending migration 列表只包含 owner-approved production candidates。
- `supabase db push --linked --dry-run` 输出符合预期。
- 备份/恢复、回滚/前滚、PostgREST schema reload、验证查询和观察窗口都已记录。

### Phase D: 字段级脱敏与范围查询

当前状态：

- Phase D1 已完成订单列表/订单详情第一批服务端投影：供应商、客户联系方式、金额、解锁信息、消息、事件 payload、附件 URL 对受限角色脱敏。
- Phase D2 仍需完成 UI 脱敏展示、对象级技师/只读 scope 与审计、客户详情/历史记录更完整投影。

### Phase E: 设置页可视化配置

后续执行：

- 在设置页成员管理中展示角色说明和敏感权限摘要。
- 店主可以授予供应商相关细粒度权限。
- 高风险权限变更显示确认弹窗和审计提示。

## 验收清单

- [x] 权限矩阵测试覆盖所有角色/动作。
- [x] 关键 API 写入入口均有服务端权限检查。
- [x] 供应商授权 migration 已进入 linked migration history；2026-07-10 dry-run 为 up to date。
- [x] 技师、前台、只读成员无法执行被禁止动作。
- [ ] 金额、历史、供应商、解锁信息的字段级脱敏进入后续 Phase D 任务并完成响应级测试。当前状态：Phase D1 订单投影完成；Phase D2 scope/UI/客户历史仍待完成。
- [x] 发布前完成 lint/typecheck/test/build。

## 2026-07-10 客户读取接线状态

- `customers/list`、`customers/list-page`、`customers/search` 使用 `customer:list`。
- `customer/get`、`customers/devices`、`customers/intake-search` 使用 `customer:detail`；intake 返回设备/历史信息，不能按普通最小列表处理。
- owner、manager、sales 保持允许；technician、viewer 在没有稳定工单分配 scope 时返回 403，并且 repository 不执行。
- 当前供应商细粒度 grant 不能被解释成通用客户授权。未来若恢复技师有限客户检索，应新增专用最小 DTO 和稳定 user-id/assignment 范围，不能将 `scopeSatisfied` 固定为 true。
- linked 安全顾问另发现 17 张旧表无 RLS 且直接授权浏览器角色。该生产风险属于独立 Critical containment；在确认旧客户端消费者前禁止批量启用 RLS 或撤权，以免造成未知旧系统中断。
