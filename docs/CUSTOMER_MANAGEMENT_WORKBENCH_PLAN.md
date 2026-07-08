# Customer Management Workbench Plan

Status: phase_3_planned
Owner: Hexiang Huang / 鹤祥
Scope: `/customers` list and `/customers/[id]` customer detail workbench
Last updated: 2026-07-05 CEST

## 0. Owner Decisions

Confirmed by Owner on 2026-07-05:

1. `1B`: 客户详情以历史订单为主轴，每条订单显示关联设备。
2. `2B`: 详情首屏优先客户资料和联系方式。
3. `3B`: 金额大字永远显示总消费，待收金额作为次级提示。
4. `4A`: 合并 tab 为 `总览 / 工单 / 设备 / 跟进 / 资料`。
5. `5A`: 第一阶段不新增设备级待办，只保留客户级/订单级待办。
6. `6A`: 第一阶段不做客户合并与重复客户处理。

## 0.1 Phase 1 Implementation Status

Implemented on 2026-07-05:

- 客户详情总览改为客户资料优先。
- 历史工单按订单为主轴展示，并在每条工单上显示关联设备、IMEI、故障、总额、定金、待收。
- 移动端客户外部卡片已压缩，移除底部“下一步”大块和重复设备标签。
- 金额主口径统一为总消费/历史报价总额，待收尾款和已收定金作为次级信息。
- `跟进` tab 合并显示客户待办、联系记录和完整操作记录。
- 订单状态判断改用工作流结案状态，取消工单不计入总消费统计。
- 设备 tab 增加空态，详情 tab 增加 `tablist/tab` 可访问性语义。

## 1. Goal

把客户管理从“客户名单”升级为“客户工作台”。

列表页只保留快速识别和进入详情所需的少量信息；打开客户后，详情页负责完整呈现客户资料、设备档案、历史订单、设备与订单关系、付款统计、联系记录和后续跟进。

维修店实际使用时，老板或员工通常不是为了看一个客户名字，而是要快速回答：

1. 这个客户是谁，怎么联系。
2. 他现在有没有正在修的机器。
3. 他以前修过哪些设备，每台设备修过什么。
4. 他有没有欠款、总共消费多少、最近一次消费是什么。
5. 下一步应该做什么：跟进维修、提醒付款、创建新工单、发送 WhatsApp、添加备注。

## 2. Current Evidence From Code

当前项目已经具备客户详情的基础能力，不需要从零开始：

- `src/features/customers/screens/customer-detail-screen.tsx`
  - 已有客户详情页。
  - 已有移动端悬浮头部。
  - 已有详情 tab：概览、设备、工单、联系、资料、待办、记录。
- `src/features/customers/components/customer-detail-panels.tsx`
  - 已有客户概览、设备档案、历史工单面板。
- `src/features/customers/components/customer-activity-panels.tsx`
  - 已有联系记录、客户资料、客户待办、操作记录。
- `src/features/customers/server/customer.repository.ts`
  - `getCustomerDetail` 已读取客户、设备、工单、联系记录、待办、标签和基础统计。
  - 查询已按 `store_id` 过滤，符合多店铺隔离方向。
- `src/lib/repairdesk/types.ts`
  - `CustomerDetail` 已包含 `customer`、`devices`、`orders`、`tags`、`interactions`、`followups`、`stats`。
  - `RepairOrder` 已包含 `device_id`、`issue_description`、`quotation_amount`、`deposit_amount`、`balance_amount`、`is_paid`。

当前缺口不是“没有数据”，而是：

1. 详情页没有把历史订单按设备归类。
2. 统计口径还偏基础，没有围绕维修店决策重新整理。
3. 列表卡片承担了过多信息，导致外层卡片拥挤。
4. 客户详情的 tab 虽然完整，但工作流优先级不够清楚。

## 3. Product Direction

### 3.1 列表页原则

列表页只做快速筛选、识别和进入详情。

每张客户卡片建议只显示：

- 客户姓名。
- 电话。
- 当前最重要状态：在修、待收款、老客户、新客户。
- 一个主金额：总消费；待收状态作为次级提示。
- 最近设备或最近工单的一行摘要。
- 进入详情入口。

不建议在列表卡片里继续塞完整设备历史、完整统计、多个长按钮。那些信息应该在详情页里看。

### 3.2 详情页原则

客户详情页采用“客户工作台”结构：

1. 顶部：客户身份和当前状态。
2. 首屏：当前要处理的事情。
3. 中部：设备档案，每台设备关联历史工单。
4. 下部：统计、付款、联系记录、备注、待办。

Owner-approved direction: 以“历史订单”为主轴，而不是以“设备”为主轴。

原因：

- 老板打开客户时更常先问“以前这个客户修过什么、多少钱、有没有欠款”。
- 同一个客户可能有多台设备。
- 同一台设备可能多次维修、返修、换电池、换屏幕。
- 每条历史订单必须显示关联设备，设备档案保留为辅助入口。

## 4. Detail Page Information Architecture

### 4.1 Header: 客户身份和当前状态

显示：

- 客户姓名。
- 主电话。
- 备用电话数量。
- 首选联系通道：WhatsApp / SMS。
- 语言：中文 / Italiano / English。
- 风险状态：黑名单、勿主动联系、待付款、售后中。
- 当前下一步：跟进维修、提醒付款、新工单可复用、完善资料。

移动端：

- 顶部保持 RepairOS Floating Card。
- 主按钮：新建工单。
- 次按钮：WhatsApp / 待办 / 编辑。
- 不在头部塞完整统计，最多显示 3 个小指标：设备、工单、待办。

桌面端：

- 右侧保留客户工作栏。
- 支持从列表弹窗打开详情，关闭后回到原列表筛选状态。

### 4.2 First Screen: 客户资料与联系方式

Owner 已选择 `2B`。打开客户后第一屏优先看到：

1. 客户姓名、主电话、备用电话数量。
2. 首选联系通道和语言。
3. 联系权限、黑名单/勿主动联系状态。
4. 总消费作为主金额。
5. 待收金额作为次级提醒。
6. 最近一次工单和最近一次联系。

当前事项仍保留，但作为总览里的次级区域，不作为首屏主视觉。

示例：

```text
客户资料
- Mario Rossi / +39333...
- WhatsApp / Italiano / 备用号码 1
- 总消费 €150.00 / 待收 €75.00
- 最近工单：TEST-0019 / REALME C55 / 账户锁问题
```

### 4.3 Order-Centered History: 历史订单与设备关联

核心模块：历史工单。

每条历史工单作为一个卡片或行：

```text
R2026001
设备: APPLE iPhone 15 Pro / IMEI 350100000000000
故障: 屏幕碎裂，触摸局部失灵
金额: 总额 €80.00 / 定金 €24.00 / 待收 €56.00
状态: 检测中
```

设备关联规则：

1. 优先用 `order.device_id` 关联到 `devices.id`。
2. 如果关联不到设备档案，使用 `order.device_label` / `order.device_imei`。
3. 工单默认按最新更新时间倒序。
4. 每条工单显示设备、故障、总额、定金、待收、状态。
5. 设备档案保留在 `设备` tab，作为辅助入口。

需要新增的前端派生结构：

```ts
interface CustomerOrderWorkbenchItem {
  order: OrderListItem;
  device?: Device;
  deviceLabel: string;
  deviceImei: string;
  state: "active" | "unpaid" | "settled" | "closed";
}
```

第一阶段可以只在前端从现有 `CustomerDetail` 派生，不立即改数据库。

### 4.4 Historical Orders

历史订单仍然保留，但不作为主入口。

推荐位置：

- `工单` tab 是主入口。
- 每条订单显示关联设备。
- `设备` tab 只负责设备档案维护和复用设备新建工单。

每条历史订单需要显示：

- 工单号。
- 日期。
- 设备。
- 故障描述。
- 维修项目摘要。
- 状态。
- 总金额、定金、尾款。
- 是否已结清。
- 操作：查看工单、添加待办、复用设备新建工单。

### 4.5 Customer Statistics

统计区不要追求花哨，应该服务经营决策。

建议核心统计：

| 指标            | 用途               |
| --------------- | ------------------ |
| 总消费          | 判断客户价值       |
| 待收金额        | 判断是否需要收款   |
| 已完成工单      | 判断老客户         |
| 在修工单        | 判断当前处理压力   |
| 设备数量        | 判断设备档案完整度 |
| 最近维修时间    | 判断是否要回访     |
| 平均客单价      | 判断客户消费习惯   |
| 返修 / 售后次数 | 判断风险           |

第一阶段建议先做：

- 总消费。
- 待收金额。
- 工单数。
- 设备数。
- 在修数。
- 最近订单时间。

第二阶段再补：

- 平均客单价。
- 已收定金总额。
- 返修次数。
- 售后次数。
- 常修设备类型。

### 4.6 Payment Summary

Owner 已选择 `3B`。客户详情里的付款统计统一成：

```text
付款概览
总消费: €xxx.xx
待收尾款: €xxx.xx
已收定金: €xxx.xx
已结清工单: x
未结清工单: x
```

不要出现容易误解的“已付金额 0 + 已付押金”组合。

### 4.7 Contact And Follow-Up

联系记录和待办应该和订单/设备关联：

- 联系记录可以关联 `order_id`。
- 待办可以关联 `order_id`。
- 如果待办没有订单，则作为客户级待办。
- 设备级备注第一阶段可以先不新增字段，用订单和客户备注承接。

建议分类：

- 客户级：改电话、长期偏好、不能主动联系、VIP、黑名单。
- 设备级：某台设备长期问题、保修提醒。
- 工单级：某次维修沟通、报价、付款、取机。

## 5. Main User Flows

### Flow A: 查客户并继续处理在修工单

1. 进入 `/customers`。
2. 搜索客户姓名/电话/设备。
3. 列表卡片显示该客户 `在修 1`。
4. 点击客户。
5. 首屏显示“当前事项”。
6. 点击正在处理的工单进入 `/orders/[id]`。

### Flow B: 查客户历史维修

1. 进入客户详情。
2. 打开设备档案。
3. 找到指定设备。
4. 查看该设备历史工单：修过什么、什么时候修、金额、状态。
5. 如客户再次维修，点击“用此设备新建工单”。

### Flow C: 查欠款并收款

1. 客户详情首屏显示待收金额。
2. 点击“待收款”展开未结清工单。
3. 进入工单收款，或后续在客户详情直接发起收款。

### Flow D: 客户回访

1. 客户详情显示最近完成工单。
2. 添加待办：例如 7 天后回访问屏幕使用情况。
3. 待办显示在客户详情和客户列表筛选中。

## 6. Role And Permission Rules

本规划涉及客户 PII、电话、维修记录和付款状态，后续实现必须遵守：

1. 客户详情必须按当前 `store_id` 隔离。
2. 不允许不同店铺看到彼此客户、设备、订单、联系记录。
3. 列表和详情的统计口径必须使用同一店铺范围。
4. 前端隐藏按钮不等于权限控制，后续写操作仍需服务端校验。
5. 短期不新增导出能力，避免扩大隐私风险。

## 7. Proposed Tabs

Owner 已选择 `4A`。当前 tab 合并为：

1. `总览`
   - 客户资料与联系方式。
   - 付款概览。
   - 最近工单。
2. `工单`
   - 全部历史工单。
   - 每条工单显示关联设备。
3. `设备`
   - 设备档案。
4. `跟进`
   - 待办。
   - 联系记录。
   - 最近记录。
5. `资料`
   - 客户资料。
   - 标签。
   - 备注。

## 8. Mobile Layout Plan

### 8.1 列表页

外层客户卡片减少信息：

- 第一行：姓名 + 待收/总消费。
- 第二行：电话 + 当前状态。
- 第三行：最近设备/最近工单。
- 底部只保留一个下一步提示，不塞完整历史。

### 8.2 详情页

移动端采用单列：

1. 悬浮客户头部。
2. 客户资料与联系方式卡。
3. 付款概览卡。
4. 历史工单卡组。
5. 跟进记录。

触摸规则：

- 主操作按钮不低于 36px。
- 卡片内次操作不低于 32px。
- tab 可横向滚动但不能造成页面级横向溢出。
- 长文本最多两行，完整内容在订单详情或展开态查看。

## 9. Desktop Layout Plan

桌面端优先保持高密度：

- 列表页打开客户详情优先 Dialog。
- 左侧主内容：客户资料、付款概览、全部工单。
- 右侧工作栏：客户资料、付款摘要、快捷动作。
- 关闭弹窗后保持原列表筛选和滚动位置。

## 10. Implementation Phases

### Phase CUST-0: Owner Decisions

Goal: 确认几个会影响实现的业务选择。

Deliverables:

- 本规划文档。
- 功能选择问题。
- 确认后的任务目标和范围。

Exit criteria:

- Owner 确认默认方案或逐项选择。

### Phase CUST-1: Data Shape And Derived Model

Goal: 在不改数据库的前提下，把现有 `CustomerDetail` 整理成客户工作台模型。

Deliverables:

- `buildCustomerWorkbenchSummary(data)`。
- `buildCustomerOrderWorkbenchItems(data)`。
- 单元测试覆盖：
  - 历史订单关联设备。
  - 缺失设备档案时回退到订单设备快照。
  - 无设备记录的订单。
  - 付款统计。

Expected files:

- `src/features/customers/model/customer-workbench.ts`
- `src/features/customers/model/customer-workbench.test.ts`
- `src/lib/repairdesk/types.ts` if a reusable type is needed.

### Phase CUST-2: Customer Detail IA Refresh

Goal: 重排客户详情页，让打开后优先显示有用信息。

Deliverables:

- 总览首屏：客户资料联系方式 + 付款概览 + 最近工单。
- 工单 tab：全部历史订单，每条显示关联设备。
- 设备 tab：设备档案。
- 跟进 tab：待办 + 联系记录。
- 资料 tab：客户资料 + 标签。

Expected files:

- `src/features/customers/screens/customer-detail-screen.tsx`
- `src/features/customers/components/customer-detail-panels.tsx`
- `src/features/customers/components/customer-activity-panels.tsx`
- `src/features/customers/components/customer-profile-blocks.tsx`

### Phase CUST-3: Customer List Simplification

Goal: 外层客户卡片减少内容，只负责快速识别和进入详情。

Deliverables:

- 移动客户卡片压缩。
- 金额语义统一：待收优先，无待收则总消费。
- 筛选区命名和布局优化。

Expected files:

- `src/features/customers/screens/customer-list-screen.tsx`
- `src/features/customers/components/customer-list-items.tsx`
- `src/features/customers/model/customer-list.ts`

### Phase CUST-4: Follow-Up And CRM Refinement

Goal: 让客户跟进真正连接到订单和设备。

Deliverables:

- 待办可清楚显示关联订单。
- 联系记录显示关联订单。
- 支持从设备历史或历史工单快速添加待办。

Database:

- 第一阶段不改 schema。
- 如果要做设备级待办，再考虑新增 `device_id` 到 followups 或增加关联表。

### Phase CUST-5: Verification And Release Prep

Required validation:

- `npm run lint`
- `npm run typecheck`
- `npm run test -- src/features/customers`
- `npm run build`
- Browser checks:
  - `/customers` mobile 390px.
  - `/customers/[id]` mobile 390px.
  - `/customers` desktop 1440px.
- `/customers/[id]` desktop 1440px.
- Check no page-level horizontal overflow.

## 11. Feature Priority

### Must

第一阶段必须完成，才能认为客户详情工作台真正可用：

- 外层客户列表卡片减少信息，只保留进入详情前的判断信息。
- 客户详情首屏显示当前事项：在修、待收款、待办。
- 客户详情能按设备分组显示历史工单。
- 每台设备下能看出修过什么、金额、状态、是否结清。
- 付款信息统一成总金额、已收定金、待收尾款，不再出现容易误解的金额组合。
- 移动端无页面级横向溢出，关键按钮可触摸。
- 派生模型有单元测试，避免 UI 里散落统计逻辑。

### Should

第一阶段后半段或第二阶段完成：

- 合并详情 tab，减少移动端切换负担。
- 跟进页合并待办与联系记录。
- 历史工单支持从设备卡片内直接“查看工单”。
- 从设备卡片快速复用设备新建工单。
- 桌面列表打开客户详情优先保持 dialog 预览。

### Could

可以延后，不阻塞第一版：

- 平均客单价。
- 返修/售后次数统计。
- 常修设备类型。
- 设备级待办。
- 重复客户检测。
- 客户合并。

### Later

需要单独规划和权限审查：

- 客户导出。
- 客户批量营销。
- 跨店铺客户共享。
- 自动发送回访 WhatsApp。
- 设备级 CRM 标签。

## 12. Implementation Contract After Owner Approval

如果老板确认默认方案或给出选项，下一步实施不直接改 UI，而是按以下顺序执行。

### WP-01 Derived Model

- Owner: Integration Lead / FE single writer
- Goal: 把 `CustomerDetail` 派生为客户工作台模型。
- Files:
  - `src/features/customers/model/customer-workbench.ts`
  - `src/features/customers/model/customer-workbench.test.ts`
- Output:
  - `buildCustomerWorkbenchSummary(data)`
  - `groupCustomerOrdersByDevice(data)`
  - payment summary helper
  - current matters helper
- Validation:
  - `npm run test -- src/features/customers/model/customer-workbench.test.ts`
- Exit:
  - 测试覆盖设备分组、未知设备、待收款、当前事项。

### WP-02 Detail IA Refresh

- Owner: FE single writer
- Goal: 用派生模型重排客户详情。
- Files:
  - `src/features/customers/screens/customer-detail-screen.tsx`
  - `src/features/customers/components/customer-detail-panels.tsx`
  - `src/features/customers/components/customer-profile-blocks.tsx`
  - `src/features/customers/components/customer-activity-panels.tsx`
- Output:
  - 总览首屏。
  - 设备分组历史。
  - 付款概览。
  - 合并后的跟进页。
- Validation:
  - `npm run test -- src/features/customers`
  - mobile and desktop browser screenshot.
- Exit:
  - `/customers/[id]` 移动端能一屏看到当前事项并继续下钻。

### WP-03 List Simplification

- Owner: FE single writer
- Goal: 外层卡片减少信息。
- Files:
  - `src/features/customers/screens/customer-list-screen.tsx`
  - `src/features/customers/components/customer-list-items.tsx`
  - `src/features/customers/model/customer-list.ts`
- Output:
  - 更轻量的移动客户卡片。
  - 金额语义统一。
  - 入口指向详情工作台。
- Validation:
  - `/customers` mobile 390px screenshot.
  - no horizontal overflow.

### WP-04 Review And Gates

- Product review:
  - 检查当前事项、设备历史、付款统计是否符合维修店实际。
- UX review:
  - 检查移动端触摸、密度、tab、空状态、错误状态。
- Data/security review:
  - 检查没有绕过 `store_id` 隔离，没有新增未审计 PII 暴露面。
- QA gates:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
  - browser screenshots for `/customers` and `/customers/[id]`

Pause conditions:

- 需要新增数据库字段。
- 需要客户合并。
- 需要自动发送 WhatsApp。
- 需要改变权限/导出策略。

## 13. Acceptance Criteria

### Product

- 打开客户后，第一屏能看出当前是否需要处理。
- 可以按设备查看历史维修。
- 可以看出每台设备修过什么、金额多少、是否结清。
- 可以从客户详情快速进入新建工单、历史工单、WhatsApp、待办。

### UI

- 移动端客户详情不横向溢出。
- 卡片层级清楚，列表不再承担过多详情信息。
- 详情 tab 数量减少或更符合工作流。
- 触摸区域足够大。

### Data

- 所有数据按当前店铺隔离。
- 设备与订单关联逻辑对缺失设备记录有兜底。
- 付款统计口径清楚，不把待收/已付/定金混淆。

### Tests

- 客户工作台模型有单元测试。
- 客户详情基本渲染路径有现有测试或新增测试覆盖。
- 服务器数据读取继续通过已有客户 repository 测试。

## 14. Decisions Needed

请老板确认以下选项。默认推荐全部选 A。

### Q1. 客户详情主轴

B. 以历史订单为主轴，每条订单显示设备。Owner selected.
A. 以设备为主轴，设备下面显示历史订单。Original recommendation.
C. 两者都做，但第一阶段工作量更大。

### Q2. 详情首屏优先显示

B. 客户资料 + 联系方式优先。Owner selected.
A. 当前事项 + 待收款 + 在修工单。Original recommendation.
C. 统计报表优先。

### Q3. 金额大字显示逻辑

B. 永远显示总消费，再用小字显示待收。Owner selected.
A. 有待收时显示 `待收 €xx`，无待收时显示 `总消费 €xx`。Original recommendation.
C. 永远显示最近订单金额。

### Q4. 是否合并 tab

A. 合并为 `总览 / 工单 / 设备 / 跟进 / 资料`。Owner selected.
B. 保留现有 7 个 tab。
C. 移动端合并，桌面端保留更多 tab。

### Q5. 设备级待办

A. 第一阶段不新增设备级待办，只用订单级/客户级待办。推荐。
B. 现在就新增设备级待办，需要 schema 评估。
C. 先只在 UI 上显示，后端以后补。

### Q6. 客户合并与重复客户

A. 先不做合并，只把详情工作台做好。推荐。
B. 同期规划重复客户检测，但不自动合并。
C. 同期实现客户合并，这会扩大风险和测试范围。

## 15. Progress

### 2026-07-05 Phase 1 Implemented

- Added customer workbench derived model and tests.
- Refreshed customer detail overview to profile-first and order-centered history.
- Simplified mobile outer customer cards so the list is an entry point, not the full record.
- Merged followups, messages, and timeline under `跟进`.
- Unified money semantics around total spend / deposit / unpaid balance.

### 2026-07-05 Phase 2 Implemented

- Added device-centered derived statistics from existing customer detail data.
- Customer detail `设备` tab now shows each device with repair count, total amount, unpaid amount, warranty label, latest order, and active repair count.
- Cancelled orders are classified as closed before unpaid checks, so cancelled balances do not pollute customer/device statistics.
- Validation passed: customer tests, typecheck, lint, and production build.

## 16. Recommended Next Step

Owner confirmed on 2026-07-05: Phase 3 mobile device detail should use **Option A: bottom sheet**, not an independent route.

下一阶段做 `客户详情工作台 Phase 3：设备详情底部 Sheet + 删除保护`：

1. 设备卡主体点击打开接近全屏的移动端底部 Sheet，不跳转独立详情页。
2. Sheet 展示该设备身份、统计、全部关联历史工单、当前风险和下一步动作。
3. 有历史工单的设备禁止硬删除；Phase 3 只做删除保护和提示，不做真实归档字段。
4. 无历史工单的设备可删除，但必须二次确认，并继续依赖服务端权限和关联校验。

暂不建议优先做客户合并或自动营销，因为它们会引入权限、隐私和误操作风险。当前最有价值的是把“打开客户后能看懂设备历史”继续做扎实。

## 17. Phase 3 Plan: Device Detail Bottom Sheet

### 17.1 Scope

Phase 3 只做客户详情里的设备下钻，不做数据库迁移，不做客户合并，不做自动营销。

In scope:

- `/customers/[id]` 的 `设备` tab。
- 点击设备卡主体打开移动端底部 Sheet。
- 复用 `buildCustomerDeviceWorkbenchItems(data)` 的设备统计和关联订单。
- 展示设备身份、历史工单、金额、待收、售后、在修风险。
- 删除按钮根据关联工单数量调整为安全状态。
- 补模型/组件/浏览器验证。

Out of scope:

- 真实设备归档字段。
- 设备级待办。
- 设备级 CRM 标签。
- 设备照片/附件聚合。
- 客户合并与重复客户处理。
- 自动 WhatsApp 回访或批量营销。

### 17.2 User Stories

- 老板：打开某台设备，判断这台设备是否高价值或高风险，例如修过几次、是否欠款、是否还在修、是否售后中。
- 前台：接待客户时快速确认是不是这台机器，并继续打开工单、收款或用此设备新建工单。
- 技师：维修前查看历史故障和维修记录，避免重复诊断或漏看返修线索。

### 17.3 Bottom Sheet Layout

Mobile sheet should be close to full-screen:

1. Header:
   - Drag handle.
   - 设备品牌型号。
   - IMEI / 序列号。
   - 最多 2 个关键状态 badge：`在修 N`、`待收 €X`、`无 IMEI`。
2. Summary grid:
   - 维修次数。
   - 总金额。
   - 待收。
   - 售后。
3. History list:
   - 工单号。
   - 状态。
   - 日期。
   - 故障一行。
   - 总额、定金、待收。
   - 取消工单保留在历史中，但弱化显示，不计入主统计。
4. Sticky action bar:
   - 默认主按钮：`新建工单`。
   - 有在修工单：主按钮优先 `查看在修`。
   - 有欠款：提供 `查看欠款` 或进入对应工单。
   - 次按钮：`编辑设备`。
   - 危险操作：只在无历史工单时显示 `删除`，且必须二次确认。

### 17.4 Data Rules

- 设备详情 Sheet 继续纯前端派生，不新增数据库字段。
- 关联规则：`device.id === order.device_id`。
- 无法匹配到设备档案的历史工单仍留在 `工单` tab，通过 `order.device_label / order.device_imei` 兜底，不挂到某个设备 Sheet。
- 取消工单：
  - 显示在历史列表。
  - 不计入维修次数。
  - 不计入总金额。
  - 不计入待收。
  - 不作为售后来源。
- 店铺隔离仍由现有 `getCustomerDetail` 和服务端 store scope 负责；Sheet 不新增跨店铺查询。

### 17.5 Delete And Archive Rules

- 设备无关联工单：
  - 允许删除。
  - 必须二次确认。
  - 删除后刷新客户详情和客户列表缓存。
- 设备有任意关联工单：
  - 禁止硬删除。
  - 前端显示说明：`已有工单记录，不能删除，可编辑设备资料。`
  - 服务端继续强校验，不能只靠前端隐藏按钮。
- 设备有在修或未结清工单：
  - 显示更强风险提示。
  - 引导先处理工单或付款。
- 真实归档进入 Phase 4：
  - 需要 `devices.archived_at`、`archived_by`、`archive_reason` 等字段。
  - 不在 Phase 3 做假归档。
  - 不允许级联删除历史工单。

### 17.6 Work Packages

#### WP-3.1 Sheet State And Trigger

- Add selected device state in `CustomerDetailScreen` or device panel boundary.
- Device card body opens the sheet.
- Card inner actions must not accidentally trigger sheet open.
- Close returns to original customer detail tab and scroll context.

#### WP-3.2 Device Sheet Component

- Create a reusable customer device sheet component under `src/features/customers/components`.
- Reuse `CustomerDeviceWorkbenchItem`.
- Render header, 2x2 summary, history rows, empty state, and sticky actions.
- Keep mobile density high but touch targets large enough.

#### WP-3.3 Delete Protection

- Use `item.orderItems.length` to decide UI state.
- If linked orders exist, hide/disable delete and show reason.
- If no linked orders exist, show confirmation before calling delete.
- Keep existing server-side delete guard.

#### WP-3.4 Tests And Verification

- Unit tests:
  - Device sheet data includes only matching device orders.
  - Cancelled orders display but do not pollute statistics.
  - Empty device has delete-enabled state.
  - Linked-order device has delete-blocked state.
- Browser screenshots:
  - 390px device tab before open.
  - 390px sheet default state.
  - 390px sheet with no history.
  - 390px sheet with active repair or unpaid amount.
  - 390px delete confirmation / delete blocked state.
  - 430px safe-area and sticky action bar.

### 17.7 Acceptance Criteria

- Given customer detail is on `设备`, when a user taps a device card body, then a bottom Sheet opens without route navigation.
- Given the device has linked orders, when the Sheet opens, then orders are shown newest first with status, issue, date, total, deposit, and unpaid amount.
- Given the device has cancelled orders, when viewing Sheet totals, then cancelled orders are visible in history but excluded from repair count, total, unpaid, and warranty source.
- Given the device has active orders, when the Sheet opens, then `在修 N` is visible and the primary action leads to active order handling.
- Given the device has unpaid amount, when the Sheet opens, then unpaid amount is visible and can be traced to the related order.
- Given the device has no linked orders, when user deletes, then confirmation is required before API call.
- Given the device has linked orders, when user looks for deletion, then hard delete is blocked with a clear reason.
- Given a 390px mobile viewport, when scrolling the Sheet, then there is no horizontal overflow and sticky action bar does not cover the final content.

### 17.8 Pause Conditions

Pause and ask owner before implementation continues if any of these become necessary:

- Delete devices with historical orders.
- Cascade delete or detach historical repair orders.
- Make `repair_orders.device_id` nullable.
- Add production database migration for archive.
- Touch production Supabase data.
- Add automated customer messaging from the device Sheet.
