# Customer Kiosk iPad Plan

Status: MVP foundation, staff review, and signature evidence implemented; broad migration history drift remains
Owner: Hexiang Huang / 鹤祥
Scope: Chinatech RepairDesk customer-facing iPad mode for intake forms, missing customer details, pickup confirmation, and signatures.
Last updated: 2026-07-09

## Implementation Snapshot

Implemented in the RepairDesk app:

- Store-scoped kiosk device/session types, client API methods, mock API, and server repository.
- Supabase expand-only migration for `store_kiosk_devices` and `customer_kiosk_sessions`; remote project `xluzcoduqsdvjoouqhkc` lists `20260709233000_customer_kiosk_ipad_mvp` as applied.
- Public `/kiosk` customer page with pairing code entry, queued session polling, customer fields, confirmation checkbox, optional signature canvas, and submit state.
- Public kiosk API routes: `/api/kiosk/pair`, `/api/kiosk/session`, `/api/kiosk/session/submit`.
- Settings page section for generating iPad pairing codes, listing devices, revoking devices, and viewing recent kiosk sessions.
- Staff push entry from `/orders/[id]` and `/orders/[id]/task` to send a pickup confirmation session to the active iPad.
- Public route/provider bypass so `/kiosk` is not wrapped in the staff AppShell and does not require staff login.
- Staff review/accept/return UI mutates canonical customer/order records only after staff approval.
- Accepted kiosk submissions with signatures save a private `order_attachments.kind = signature` record, set `repair_orders.customer_signature` to an attachment marker for compatibility, remove the raw signature data URL from the accepted kiosk session payload, and show signature evidence in order detail.

Still planned for later phases:

- `/orders/new` intake push that auto-fills the new order form after staff review.
- Realtime push notification instead of polling.
- Pickup-specific completion fields/workflow automation beyond attachment evidence, such as dedicated pickup confirmation payload fields and completion warnings.
- Owner-approved legal/privacy wording before production customer use.

Database note:

- `supabase db push --linked --dry-run` currently refuses a normal push because 25 historical local migrations are older than the last remote migration and would require `--include-all`. Do not run broad include-all for kiosk work.
- For the signature evidence phase, read-only remote checks confirmed `public.order_attachments`, `repair_orders.customer_signature`, the private `repairdesk-order-attachments` storage bucket, RLS, and the signature kind constraint already exist.

## 1. Executive Summary

推荐把这个功能做成 **Customer Kiosk / 客户平板模式**，不是让顾客直接使用完整商户账号。

店员仍然在手机或电脑上控制订单流程；iPad 只是一个绑定到当前店铺的受限客户设备，只能显示店员推送过去的单个任务：

- 新客户填写姓名、电话、首选联系方式和必要同意。
- 已建工单补充客户姓名、电话、备用电话、签名。
- 取机时确认设备已取走、费用/状态已知、客户签名确认。

核心原则：**员工发起，客户填写，员工审核接受，服务端落库，时间线可追溯。**

## 2. Business Goals

1. 减少前台手工录入姓名和电话号码的错误。
2. 让客户自己确认姓名、电话、签名，减少争议。
3. 店员用手机开单时，可以把缺失字段推送到柜台 iPad。
4. 取机时，店员扫码打印单二维码后，可以在 iPad 弹出取机确认和签名。
5. iPad 不暴露订单列表、客户列表、价格后台、员工设置或其他客户资料。

## 3. Current Repo Facts

已确认可复用的现有能力：

- 打印维修单已有 QR code，当前 QR 打开内部任务页：`src/features/orders/components/repair-order-print-sheet.tsx`。
- 订单详情已有客户签名 UI 占位：`src/features/orders/components/order-overview-tab.tsx`。
- 订单类型已有 `customer_signature` 字段：`src/lib/repairdesk/types.ts`。
- 订单附件支持 `signature` 类型：`src/server/api/repairdesk-schemas.ts`、`src/features/orders/server/order.repository.ts`。
- 实时同步已有按店铺私有频道广播，并且禁止在 realtime payload 里带 PII：`src/features/realtime/model/realtime-events.ts`。
- 订单状态已有 `waiting_pickup`、`unfixed_pickup`、`completed` 等取机/完成路径：`src/features/stores/server/store-provisioning.ts`。

## 4. Recommended MVP

### MVP-1: iPad Pairing And Lock Mode

新增店铺设备绑定：

- 店员在设置页生成一次性配对码。
- iPad 打开 `/kiosk/pair` 输入配对码。
- 配对成功后，iPad 进入 `/kiosk` 客户模式。
- 客户模式无侧边栏、无订单列表、无客户搜索、无后台入口。
- iPad 空闲时只显示店铺名称、等待任务、语言选择。

不要把完整 Owner/Staff session 给顾客使用。iPad 应该拿一个 kiosk device token，只能访问 kiosk API。

### MVP-2: Customer Session Queue

新增一个客户任务会话层。店员从手机/电脑创建 session，iPad 只读取分配给自己的 active session。

第一版只做三种 session type：

| Type                      | 场景                                 | 结果                                         |
| ------------------------- | ------------------------------------ | -------------------------------------------- |
| `intake_contact`          | 客户到店，先让客户填基础资料         | 生成待审核客户资料，店员确认后建单或关联客户 |
| `order_contact_signature` | 店员已建工单，推送缺失姓名/电话/签名 | 更新工单客户资料和签名                       |
| `pickup_signature`        | 取机前确认取走并签字                 | 保存取机签名，允许店员完成交付               |

### MVP-3: Staff Push From Order Surfaces

新增员工入口：

- `/orders/new`: “发送到 iPad 填写客户资料”。
- `/orders/[id]`: “发送到 iPad 补充资料/签名”。
- `/orders/[id]/task`: 扫打印单 QR 后，店员点击“请求客户取机签名”。

如果店里有多台 iPad，弹出设备选择；如果只有一台，默认推送。

### MVP-4: Customer iPad Form

iPad 客户表单第一版字段：

- 姓名，必填。
- 手机号，必填，按意大利手机号做格式提示，但允许店员后续修正。
- 备用电话，可选。
- 首选联系：WhatsApp / SMS。
- 维修/取机确认勾选项，按 session type 显示。
- 签名画布，必填或可选由 session type 决定。
- 提交后显示“请把 iPad 交还工作人员”，不能继续浏览系统。

客户语言默认意大利语，可提供中文/英文切换。老板端仍用中文管理。

### MVP-5: Staff Review And Accept

客户提交后不直接覆盖关键资料。店员设备收到提示后：

- 查看客户提交内容。
- 对比当前订单/客户已有字段。
- 点击“接受并更新”或“退回重填”。
- 接受后才写入 `customers`、`repair_orders`、`order_attachments` 和 `order_events`。

这样可以避免客户乱填、重复提交、误改历史客户。

## 5. Main Workflows

### Flow A: 先让客户在 iPad 填资料，再建工单

1. 店员打开新建工单页。
2. 点击“iPad 填客户资料”。
3. 系统创建 `intake_contact` session，推送到 iPad。
4. 客户填写姓名、电话、签名/同意。
5. 店员手机/电脑收到“客户资料已提交”。
6. 店员确认后，表单自动带入新建工单；如手机号匹配已有客户，提示关联历史客户。

### Flow B: 店员已建工单，再推送缺失字段

1. 店员在手机上创建工单，先填设备、故障、报价等。
2. 发现客户姓名/电话/签名缺失。
3. 点击“发送到 iPad 补充资料”。
4. 客户在 iPad 补充字段并签名。
5. 店员审核接受，订单详情实时更新。

### Flow C: 取机签名

1. 客户出示打印单，店员用手机扫描维修单 QR。
2. 打开订单任务页。
3. 店员确认尾款、状态、配件/旧件/设备交付情况。
4. 点击“请求取机签名”。
5. iPad 弹出取机确认页，客户阅读确认并签名。
6. 店员设备收到提交结果。
7. 店员点击“完成交付”，服务端把订单流转到 `completed`，写入 `delivered_at`、签名附件和时间线事件。

## 6. Data Model Proposal

采用 expand-only 迁移，先新增表/字段，不删除旧字段。

### `store_kiosk_devices`

用途：记录已绑定的 iPad 或客户设备。

关键字段：

- `id`
- `store_id`
- `label`
- `device_token_hash`
- `status`: `active | suspended | revoked`
- `allowed_modes`: text array or jsonb
- `last_seen_at`
- `paired_by`
- `paired_at`
- `revoked_by`
- `revoked_at`
- `created_at`
- `updated_at`

约束：

- 必须按 `store_id` 隔离。
- token 只存 hash，不存明文。
- revoked device 不可再读取 session。

### `customer_kiosk_sessions`

用途：员工发起、iPad 执行的客户任务。

关键字段：

- `id`
- `store_id`
- `device_id`
- `order_id` nullable
- `customer_id` nullable
- `session_type`: `intake_contact | order_contact_signature | pickup_signature`
- `status`: `queued | active | submitted | accepted | returned | cancelled | expired`
- `requested_by`
- `accepted_by`
- `expires_at`
- `request_payload` jsonb
- `submission_payload` jsonb
- `submission_version`
- `submitted_at`
- `accepted_at`
- `cancelled_at`
- `created_at`
- `updated_at`

约束：

- 同一 device 同时最多一个 `queued/active/submitted` session。
- session 过期后不能提交。
- `pickup_signature` 必须绑定 `order_id`。
- 接受提交时必须重新服务端校验订单归属、状态和当前店铺。

### Order Pickup Signature Fields

第一版可复用 `order_attachments.kind = signature` 保存签名图片，同时新增最少字段增强取机证据：

- `pickup_signature_attachment_id`
- `pickup_signed_at`
- `pickup_confirmed_by`
- `pickup_confirmation_payload` jsonb

不要只把签名保存到 `repair_orders.customer_signature` 文本字段；该字段可保留作兼容摘要。

## 7. API And Realtime Design

### Staff API

通过现有 RepairDesk API/router 增加员工接口：

- `kiosk.devices.list`
- `kiosk.devices.pair`
- `kiosk.devices.revoke`
- `kiosk.sessions.create`
- `kiosk.sessions.cancel`
- `kiosk.sessions.acceptSubmission`
- `kiosk.sessions.returnForCorrection`

权限：

- `orders.manage` 可给订单发起客户 session。
- `settings.manage` 或 owner/manager 可绑定/撤销 iPad。
- 服务端必须校验 store membership、order store_id、device store_id。

### Kiosk API

单独提供受限接口，不复用员工 API：

- `GET /api/kiosk/session`
- `POST /api/kiosk/session/submit`
- `POST /api/kiosk/heartbeat`

Kiosk API 只允许：

- 读取当前 device 被分配的 active session。
- 提交当前 session 的表单。
- 上报在线状态。

禁止：

- 读取订单列表。
- 搜索客户。
- 读取其他订单详情。
- 修改订单状态。
- 查看价格、内部备注、解锁密码、完整历史。

### Realtime

建议新增 realtime domain `kiosk`，或新增 kiosk 专用私有频道：

- Staff 设备订阅：订单/客户/cache invalidation + kiosk session updates。
- Kiosk 设备订阅：只收到“有新 session / session cancelled / session accepted”的无 PII 信号。

Realtime payload 只能包含 `eventId`、`storeId`、`deviceId`、`sessionId`、`mutation`、`queryGroups` 这类低敏标识；客户姓名、电话、签名、订单号不要放进广播正文。

## 8. UI Specification

### iPad `/kiosk`

状态：

- 未配对：输入配对码。
- 已配对无任务：等待页面，显示店铺名和“请等待工作人员操作”。
- 有任务：全屏表单。
- 提交中：禁用按钮，显示提交状态。
- 提交完成：显示交还工作人员。
- 退回重填：显示原因，只允许修改指定字段。
- 过期/取消：显示“请联系工作人员重新发起”。
- 离线：保留当前表单但不允许最终提交，提示联网。

设计：

- iPad 横竖屏都可用。
- 大按钮、大输入框、签名区域高度足够。
- 不出现导航栏、设置、后台入口。
- 表单标题用客户能理解的意大利语；必要时提供中文/英文切换。

### Staff Controls

新建工单页：

- “客户在 iPad 填写”
- “发送当前缺失字段”
- “收到提交，点击检查”

订单详情页：

- 签名区块按钮从占位改为真实动作。
- 显示签名状态、提交时间、设备名、员工确认人。
- 有“重新请求签名”和“查看签名证据”。

设置页：

- “客户 iPad 设备”
- 设备列表：名称、状态、最后在线、当前 session、撤销绑定。
- 生成配对码。

## 9. State Machine

Session state:

```text
queued -> active -> submitted -> accepted
queued -> cancelled
active -> cancelled
active -> expired
submitted -> returned -> active
submitted -> cancelled
submitted -> accepted
```

Rules:

- `accepted` 后不可再提交。
- `cancelled/expired` 后不可恢复，只能新建 session。
- `submitted` 状态必须由员工审核，不能自动写入关键字段。
- `pickup_signature.accepted` 在 MVP 中不是完成交付的硬性前置条件；没有签名时必须强提醒并记录员工继续完成的动作。
- 最终 `completed` 仍由员工触发，不能由 iPad 客户提交自动完成。

## 10. Security And Privacy Requirements

风险等级建议：R3。原因是该功能涉及客户 PII、签名、设备绑定、订单状态和取机证明。

必须满足：

- iPad 使用 kiosk token，不使用完整员工 session 给顾客操作。
- Kiosk token 可撤销、可轮换、只存 hash。
- 所有写入服务端校验 store_id、device_id、session_id、order_id。
- 客户提交只进入 pending/submitted，员工审核后才正式更新订单。
- 签名图片走现有附件存储规则，避免 base64 长文本塞进普通日志或 realtime。
- Realtime 不广播姓名、电话、IMEI、签名、订单号、内部备注、解锁密码。
- 所有接受/取消/退回/完成交付写入 `order_events` 或 audit trail。
- 客户模式页面不显示其他客户资料。
- 法律/隐私文案需要店铺正式确认；开发阶段不要擅自写成最终法律承诺。

## 11. Implementation Phases

### Phase 0: Product Lock

Deliverables:

- 确认 MVP 字段。
- 确认 iPad 第一版只绑定一台还是支持多台。
- 确认客户显示语言默认意大利语。
- 采用已确认规则：取机签名不作为 `completed` 的硬性前置条件；缺签名时强提醒并记录员工继续完成。

### Phase 1: Schema And Server Contract

Deliverables:

- 新增 kiosk device/session 表。
- 新增取机签名证据字段。
- 增加 server schemas、repository、permission guards。
- 增加测试覆盖 token、store isolation、session state machine。

### Phase 2: Staff Device Management

Deliverables:

- 设置页设备列表。
- 生成配对码。
- 撤销设备。
- 设备在线/最后在线显示。

### Phase 3: Kiosk App

Deliverables:

- `/kiosk/pair`
- `/kiosk`
- 表单、签名画布、提交状态、退回重填。
- Kiosk API 和 heartbeat。

### Phase 4: Order Integration

Deliverables:

- 新建工单页推送客户资料。
- 订单详情页推送补充资料/签名。
- QR 任务页推送取机签名。
- Staff 审核接受提交。
- 写入 customer/order/signature/event。

### Phase 5: Verification And Release

Deliverables:

- Unit tests: model/state/validation。
- API tests: auth, store isolation, expired/cancelled sessions, duplicate submit。
- Realtime tests: no PII payload, correct invalidation。
- UI tests: iPad viewport, mobile staff flow, desktop settings flow。
- E2E: create order -> push to iPad -> customer submit -> staff accept -> pickup signature -> complete。
- Security review and data migration dry-run before production.

## 12. Acceptance Criteria

1. iPad 配对后只能看到 kiosk 页面，不能访问订单/客户后台。
2. 店员可以从新建工单页推送客户资料填写任务。
3. 店员可以从订单详情页推送补充资料和签名任务。
4. 店员扫码打印单 QR 后，可以请求取机签名。
5. 客户提交后，店员必须审核接受，系统才更新订单/客户资料。
6. 取机签名保存为附件证据，并在订单时间线显示。
7. Realtime 更新不泄露客户姓名、电话、IMEI、签名或订单号。
8. 设备撤销后，iPad 不能继续读取或提交 session。
9. 过期、取消、重复提交、离线、无权限都有明确 UI 状态。
10. 生产迁移前有 dry-run、回滚说明和截图/测试证据。

## 13. Rollback Plan

MVP 使用新增表和新增字段，回滚以功能开关为主：

- 关闭 kiosk 入口和员工推送按钮。
- 保留已采集签名和 session 记录作为审计证据。
- 不删除历史数据。
- 若 API 有问题，先禁用 session 创建，已提交但未接受的 session 保持 submitted/cancelled。
- 数据库 contract 阶段不做字段删除；删除只允许在未来单独批准的清理任务中执行。

## 14. Owner Decisions

已确认决定：

1. 取机签名在 MVP 中不是必须项。
2. 如果完成交付时没有取机签名，系统必须弹出强提醒，员工仍可继续完成。
3. 员工无签名继续完成时，应写入订单时间线或审计记录，保留“未签名但员工确认交付”的事实。

默认推荐仍保留：

1. 第一版支持一台 iPad，数据模型保留多台能力。
2. 客户端默认意大利语，右上角可切换中文/英文。
3. 客户提交后必须员工审核接受，不自动覆盖订单。
4. 不接入外部签名/法律身份服务；先使用店内签名确认和附件证据。
5. 稳定运行后，可再评估是否把取机签名改成必填。
