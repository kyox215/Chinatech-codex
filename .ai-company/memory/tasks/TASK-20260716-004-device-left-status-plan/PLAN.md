# 新建工单“留机 / 不留机”完整实施计划

## 1. 检查结论

当前系统没有独立的“手机是否留在店里”选项。

现在页面上的两个相关概念分别是：

- `快修 / 送修`：维修服务类型；
- `留存 / 无留存`：随附物品备注，例如手机壳、SIM 卡、充电器；

它们都不能表示手机由谁保管，也不能互相推导。只在新建页增加一个开关不够，因为当前取消、完成、取机提醒、维修流转和手机密码逻辑都默认“设备已经交给门店”。

本计划采用一个独立、可审计的“设备保管状态”，并把新建、详情、取消、完成、取机、离线、打印和数据链路一起补齐。

## 2. 产品语义合同

### 2.1 推荐存储模型

```ts
type DeviceCustodyStatus = "with_shop" | "with_customer";
```

数据库列 `device_custody_status` 允许 `NULL`：

| 存储值          | 中文显示          | 含义                                                                         |
| --------------- | ----------------- | ---------------------------------------------------------------------------- |
| `with_shop`     | 已留店 / 门店保管 | 门店已接收设备并承担保管责任；设备进入经批准的外修流程后仍属于门店保管责任。 |
| `with_customer` | 未留店 / 客户持有 | 客户没有把设备交给门店，或设备已经正式归还客户。                             |
| `NULL`          | 历史未确认        | 旧订单没有可靠记录，不能猜测。新建页不可选择。                               |

界面上的“已归还客户”不再增加第三个数据库值，而是由 `with_customer + delivered_at` 推导。这样避免 `returned` 与现有 `delivered_at` 成为两套相互冲突的事实源。

初次是否留机由订单 `created` 事件保存，当前由谁保管由 `device_custody_status` 保存。因此客户后来送机、维修后归还、返修重新收机都能被记录。

### 2.2 为什么不使用其他方案

| 方案                                            | 结论   | 原因                                                                            |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| 复用 `order_type`                               | 排除   | 快修/送修是服务模式，且送修还参与外修逻辑；与是否留机是两个独立维度。           |
| 复用 `accessory_notes`                          | 排除   | “无随附物品”不等于“手机未留店”；客户可能不留手机但留下充电器。                  |
| 布尔值                                          | 不推荐 | 不能安全表达旧数据未知，后续动作和审计语义也弱。                                |
| 四态列 `in_store/not_received/returned/unknown` | 不推荐 | 把当前位置、历史质量、终态结果混在一个字段，且 `returned` 重复 `delivered_at`。 |
| nullable 两态当前保管责任                       | 推荐   | 最小兼容、支持后续收机/归还、旧数据不误标，并复用现有交付时间。                 |

### 2.3 与其他字段的独立关系

以下四种组合全部合法：

- 快修 + 已留店；
- 快修 + 未留店；
- 送修 + 已留店；
- 送修 + 未留店；

“随附物品”也保持独立。选择未留店时，如果仍填写了随附物品，页面只提示“请确认仅随附物品留店”，不得自动清空。

## 3. 新建工单设计

### 3.1 布局与文案

在“设备信息”区域、IMEI 下方增加：

```text
设备交接
[ 已留店 ]  [ 未留店（客户带回） ]
```

规则：

- 默认选中“已留店”，但必须完整可见，不能依靠隐藏默认值。
- 使用 RadioGroup 或双选择卡，不使用只有开/关含义的 Switch。
- 每个选项至少 44px 触控高度，选中状态同时使用文字、图标和边框，不能只靠颜色。
- 当前“留存”统一改名为“随附物品”；当前“类型”改为“维修类型”。
- 提交区域再次显示 `已留店` 或 `未留店` 摘要，避免员工忽略默认选择。
- 移动端沿用 RepairOS Floating Card 和现有设备卡密度；桌面端沿用现有高密度分栏，不新增占满页面的大卡。

### 3.2 选择“未留店”后的联动

- 显示提示：`设备仍由客户保管，开始检测或维修前必须先确认收机。`
- 允许保存客户、设备、故障、报价、定金、审批和订件信息。
- 手机 PIN、图案或密码输入立即清空并禁用；清空前给出明确说明，未保存草稿不得保留敏感值。
- 随附物品保持独立；有值时显示确认提示，不静默修改。
- 创建 payload 必须显式发送 `with_customer`，不能只依赖数据库默认值。

### 3.3 离线新建

- 新建离线草稿、草稿 fingerprint、恢复和同步契约都包含保管状态。
- 老版本草稿缺少字段时显示“请确认设备是否留店”；可预选兼容默认，但不能无提示提交。
- `with_customer` 草稿不得保存解锁凭据。
- 离线创建同步必须使用现有幂等键，避免重复订单。

## 4. 工单详情设计

### 4.1 共同信息架构

详情页顶部状态区和设备信息卡显示文字 Badge：

- `门店保管`；
- `客户持有（未留机）`；
- `已归还客户`；
- `历史留机状态未确认`；

设备卡增加：

- 当前保管状态；
- 最近一次交接动作及时间；
- 当前允许的主动作；
- 状态与工单流程冲突时的警告；

### 4.2 专用交接动作

不能把物理交接做成普通文本字段或无确认 Switch。详情使用专用动作：

| 当前状态        | 动作     | 结果                                                                 |
| --------------- | -------- | -------------------------------------------------------------------- |
| `with_customer` | 确认收机 | 转为 `with_shop`，写时间线。                                         |
| `with_shop`     | 确认归还 | 走正式交付/退还流程，转为 `with_customer`，按场景写 `delivered_at`。 |
| `NULL`          | 补录状态 | 选择门店保管或客户持有，必须写原因。                                 |
| 已终态          | 更正历史 | 普通编辑入口不可用；仅受审计的高权限更正流程可用。                   |

每个动作都需要：

- `expected_updated_at` 乐观版本锁；
- pending、成功、失败、无权限和版本冲突状态；
- 相同目标状态幂等，不重复写事件；
- `from`、`to`、操作者、时间、来源和可选原因；
- 成功后刷新详情、列表、队列、统计和 dashboard 缓存；

现有订单的交接动作要求在线执行。物理保管证据不得作为普通离线编辑排队，离线时显示当前缓存状态并要求恢复网络。

### 4.3 移动端

- Floating Header 的辅助状态区显示简短 Badge。
- `repairOs.mobileInfoCard` 中增加“设备交接”行。
- 点击动作打开底部 Sheet，展示当前状态、目标状态、影响说明、原因、确认和错误。
- Sheet 关闭后焦点返回触发按钮；pending 使用 `aria-busy`，结果通过 live region 可读。
- 390px 和 430px 不横向溢出，底部操作条不得遮挡 Sheet。

### 4.4 桌面端

- 详情 Hero 和“设备与故障”面板显示 Badge。
- 使用 Dialog 执行交接动作。
- 普通“编辑工单”可以只读展示状态，但真正变更必须进入专用交接 Dialog。

## 5. 完整业务规则

### 5.1 创建与收机

- 新建只能显式选择 `with_shop` 或 `with_customer`。
- `created` 事件记录初始值。
- 客户后来送机时，详情“确认收机”转为 `with_shop`，此后才允许物理维修步骤。
- 门店把设备交给授权外修方时，仍保持 `with_shop`，因为门店仍承担客户设备的保管责任；外修位置继续由现有外修状态表示。

### 5.2 工作流门禁

`with_customer` 且从未收机时：

- 允许客户/设备/故障资料、报价、客户审批、定金、订件和配件到货；
- 主任务提示改为“等待客户送机 / 确认收机”；
- 服务端禁止进入明确要求门店已接收设备的状态：`diagnosing`、`mail_in_progress`、`repairing`、`repaired`、`notified`、`waiting_pickup`、`unfixed_pickup`，以及对应 canonical `diagnosis/repair/pickup`；
- 如果报价或订件动作不依赖物理检测，可继续通过独立报价/配件能力处理，但不得伪造设备已进入检测或维修；
- UI 隐藏或禁用非法动作，服务端仍必须独立拒绝直接 API 调用；

若历史数据已经出现“客户持有 + 维修中/待取机”等冲突，详情显示阻断警告，要求先核对，不自动修正。

### 5.3 取消

| 场景                      | 规则                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `with_customer`，从未收机 | 可取消；不显示“设备退还尚未确认”，不写 `delivered_at`，事件记录 `custody_outcome=never_received`。 |
| `with_shop`               | 保留当前退还流程；确认归还后转 `with_customer` 并写 `delivered_at`。                               |
| `NULL`                    | 不猜测；取消/退还前要求补录。对已有历史取消单保持保守提示，避免隐藏一台可能仍在店里的设备。        |

取消退还接口必须服务端校验保管状态，不能只靠前端隐藏按钮。

### 5.4 完成与交付

| 场景                               | `completed_at` | `delivered_at` | 保管结果                                      |
| ---------------------------------- | -------------: | -------------: | --------------------------------------------- |
| `with_shop` 正常交付               |           写入 |           写入 | 转 `with_customer`，事件 `delivered`。        |
| `with_customer` 从未收机，行政结案 |           写入 |           不写 | 保持 `with_customer`，事件 `never_received`。 |
| `NULL`                             |           阻止 |           阻止 | 先补录状态。                                  |

“未留机结案”需要专门确认文案，不能复用“已完成交付”。直接状态转换 API 也必须执行同样规则。

如同一订单进入返修并重新收机，必须写新交接事件；当前终态时间如何重置要与现有返修合同一起验证，不能静默覆盖历史交付事实。

### 5.5 取机、队列和消息

- `with_customer` 不进入待取机、取机逾期、催取机、修好待通知或“确认退还”队列。
- 任务引导不显示“通知客户取机”，而显示“等待客户送机”或“设备由客户持有”。
- 取机 WhatsApp/通知模板发送前由服务端再次校验保管状态。
- `NULL` 的旧订单暂按当前保守逻辑参与现有队列，同时显示“状态未确认”；实施后逐步人工补录，不能全量猜测。

### 5.6 手机解锁凭据

- 新建选择 `with_customer` 时禁止保存密码、PIN 或图案。
- 已有订单从 `with_shop` 转为 `with_customer` 时，确认框必须说明将清除解锁凭据，并在同一服务端操作中清除。
- 事件只记录 `credentials_cleared: true`，绝不记录原始凭据。
- 历史、导出、日志、截图和错误消息不得暴露凭据。

## 6. 数据库、API 与审计合同

### 6.1 安全迁移

禁止使用 `ADD COLUMN ... NOT NULL DEFAULT 'with_shop'`，因为它会把所有旧订单伪造成“已留店”。

推荐 expand migration：

1. 新增 nullable text 列，不设置默认值，确保旧行保持 `NULL`。
2. 添加 check constraint：值为 `NULL`、`with_shop` 或 `with_customer`。
3. 再单独设置未来默认值 `with_shop`；这只影响迁移之后省略字段的新记录，不回填旧行。
4. 新 UI 总是显式发送；数据库默认只兼容滚动发布中的旧客户端。
5. 不设置 `NOT NULL`，不新增索引，不全量回填。
6. 不修改历史 migration，只新增向前 migration；离线同步 RPC 如需扩展，使用新的 `CREATE OR REPLACE` migration。

迁移前后必须验证：列、默认值、constraint、旧行仍为 NULL、非法值为 0、RLS/grants 未变化。生产操作需 Owner 单独批准。

### 6.2 类型和请求契约

```ts
interface RepairOrder {
  device_custody_status: DeviceCustodyStatus | null;
}

interface CreateOrderInput {
  device_custody_status?: DeviceCustodyStatus; // 仅为旧客户端兼容
}

interface UpdateOrderCustodyInput {
  expected_updated_at: string;
  device_custody_status: DeviceCustodyStatus;
  reason?: string;
}
```

- 新前端表单层把字段作为必填，并显式传值。
- 服务端缺失时兼容为 `with_shop`，非法值返回 400。
- 详情使用专用 custody mutation，不混入财务、报价或普通备注更新。
- 不把该字段加入“缺列时静默剥离并重试”的 optional write 清单；数据库未迁移时必须明确失败，防止“不留机”被悄悄丢失。

### 6.3 事件、并发与原子性

事件 payload 只包含业务事实：

```json
{
  "action": "device_custody_changed",
  "from": "with_customer",
  "to": "with_shop",
  "reason": "客户后来送机",
  "credentials_cleared": false
}
```

- 继续使用现有 `event_type: note`，不扩展数据库事件枚举。
- 使用版本锁；过期版本返回“工单已被其他人修改，请刷新后重试”。
- 首版不做乐观更新、不自动重试物理交接。
- 行更新、凭据清除和事件写入必须尽可能成为同一原子操作；若现有补偿写法不能提供足够证据完整性，升级为 store-scoped RPC，并单独做安全复核。

## 7. 权限、租户与隐私

- 创建初始状态和普通交接动作映射现有 `order:update_intake` 能力。
- Owner、Manager、Frontdesk 按现有策略执行；Technician 只在现有分配范围和能力允许时执行；Viewer 只读。
- 终态历史更正默认仅 Owner/Manager，并要求原因；是否开放给其他角色属于权限政策变化，需单独批准。
- `store_id` 始终来自服务端 actor，不接受客户端覆盖。
- 订单、交接事件、导入和缓存读取都必须保持同店隔离。
- 服务端执行枚举、状态机、权限和租户校验，不能依赖 UI 隐藏。
- 日志只记录状态、订单内部 ID、结果和耗时；不记录客户姓名、电话、IMEI、密码或图案。

## 8. 旁路和文案同步

必须检查并同步：

- 列表：设备旁显示文字 Badge；`门店保管 / 客户持有 / 未确认`，且不改变快修/送修筛选。
- 任务页、queue counts、pickup overdue、dashboard：排除客户持有的取机语义。
- 打印：增加意大利语 `Custodia del dispositivo: Negozio / Cliente / Non verificata`，与 `Accessori consegnati` 分开。
- 导出：输出稳定枚举和人类可读列；不得导出解锁秘密。
- 导入：新建可接收合法值；历史导入缺失时保持未知；更新导入空白表示不修改，显式更正必须受权限和审计约束。
- Mock、fixtures、API mock：必须与真实服务一致。
- 文档：同步 `docs/ORDERS_SPEC.md` 和行为说明，避免“留存”继续产生歧义。

订单数据导入/导出文件可能与设置中心并行任务重叠。实施前必须复核活跃任务和文件所有权；如有重叠，先完成上游集成或在独立工作树按顺序合并，禁止两个写入者同时修改同一文件。

## 9. 实施工作包

### WP-00：基线、合同与隔离

- 从实施时最新 `origin/main` 建立隔离工作树。
- 复核活跃设置/订单任务和重叠文件。
- 锁定 `with_shop / with_customer / NULL`、权限、终态、更正、返修和密码清除合同。
- 建立 before 页面证据和测试基线。

退出条件：无文件所有权冲突；数据和状态矩阵通过 INT、FLOW、DATA、SEC 复核。

### WP-01：数据与服务端基础

- 新增 expand migration、共享类型、schema、select/map、create、dedicated custody mutation、事件和版本锁。
- 修正完成、取消退还和直接状态转换的服务端规则。
- 增加权限、跨店、幂等、冲突和迁移缺失测试。

退出条件：旧订单读取为 NULL；两种新订单可往返；错误状态不能绕过服务端门禁。

### WP-02：新建工单与离线创建

- 增加双选控件、默认可见状态、提交摘要、随附物品改名和解锁凭据联动。
- 扩展新建离线草稿、fingerprint、同步 RPC/contract 和测试。

退出条件：在线/离线两种创建路径都显式保存状态；未留机不保存解锁秘密。

### WP-03：工单详情交接流程

- 增加移动/桌面 Badge、设备卡行、Sheet/Dialog、确认收机、确认归还、补录、版本冲突和只读状态。
- 时间线显示人类可读的 from/to 变化。
- 现有订单的交接动作保持在线执行。

退出条件：详情刷新、重新登录和并发冲突后状态一致；终态不能通过普通编辑绕过交付。

### WP-04：工作流和完整旁路

- 修正取消、完成、取机、逾期、消息、任务引导、queue classification。
- 同步列表、打印、导入导出、mock、fixtures 和文档。
- 处理状态/保管冲突警告。

退出条件：未留机订单不会出现任何虚假退还、交付或催取机证据。

### WP-05：质量、安全和视觉门禁

- 执行定向单测、repository/router 集成、offline、data roundtrip、E2E、权限和跨店测试。
- 执行 lint、typecheck、全量 test、build。
- 生成移动、平板、桌面、打印截图和溢出指标，不得包含真实客户 PII 或解锁凭据。

退出条件：全部 Must 验收通过，QA/SEC/DATA 给出可发布结论。

### WP-06：生产发布，单独批准

- linked dry-run 和 schema drift 检查。
- 先应用数据库 expand migration并验证，再部署服务端/前端。
- 用测试门店验证留机、不留机、后来收机、取消和时间线。
- 监控缺失字段、非法状态、错误退还提示和错误 pickup 分类。

退出条件：Owner 已明确批准生产操作，migration 和应用验证均有证据。

## 10. 预估影响文件

核心数据和 API：

- `supabase/migrations/<timestamp>_order_device_custody_status.sql`
- `src/lib/repairdesk/types.ts`
- `src/lib/repairdesk/api.ts`
- `src/server/api/repairdesk-schemas.ts`
- `src/server/api/repairdesk-router.ts`
- `src/server/repairdesk-shared.ts`
- `src/features/orders/server/order.repository.ts`
- `src/features/orders/server/order.service.ts`

新建、详情和模型：

- `src/features/orders/model/new-order-form.ts`
- 可新增 `src/features/orders/model/order-device-custody.ts`
- `src/features/orders/forms/new-order-quotation-section.tsx` 或对应设备信息组件
- `src/features/orders/screens/new-order-screen.tsx`
- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/components/order-overview-tab.tsx`
- `src/features/orders/model/edit-order-form.ts`

离线和旁路：

- `src/features/orders/model/new-order-offline-draft.ts`
- `src/features/orders/model/edit-order-offline-draft.ts`
- `src/features/offline/model/offline-order-service.ts`
- `src/features/offline/server/offline-sync-contract.ts`
- `src/features/orders/model/order-task-flow.ts`
- `src/features/orders/model/order-simple-flow.ts`
- `src/features/orders/model/order-queue-classification.ts`
- `src/features/orders/components/repair-order-print-sheet.tsx`
- `src/features/orders/model/order-data-contract.ts`
- `src/features/orders/server/order-data-export.service.ts`
- `src/features/orders/server/order-data-import-normalizer.ts`
- `src/features/orders/testing/mock-api.ts`
- `src/lib/mock/fixtures.ts`
- `docs/ORDERS_SPEC.md`

对应的 `.test.ts(x)`、router/repository/data/offline tests 和新的 E2E 同步新增或更新。

## 11. 验收测试矩阵

### 11.1 Given / When / Then

1. 打开新建工单时，“已留店”可见且已选中，payload 显式包含 `with_shop`。
2. 选择“未留店”后创建成功，详情、列表和时间线均显示客户持有。
3. 选择“未留店”会清除未保存解锁凭据，payload 和离线草稿不包含秘密。
4. 随附物品选择“无”不改变保管状态；填写随附物品也不自动改变保管状态。
5. 客户后来送机，确认收机后转为门店保管并记录操作者和时间。
6. 两人并发操作时，旧版本被拒绝且不覆盖新数据。
7. Viewer 可看但不能改；跨店和越权技师无法读写。
8. 客户持有时，直接调用检测、维修、外修或取机状态接口被服务端拒绝。
9. 从未留机的取消单不显示退还提示，不写 `delivered_at`。
10. 门店保管的取消单仍要求确认退还，确认后写交付时间并转客户持有。
11. 从未留机的行政结案只写 `completed_at`，事件记录 `never_received`。
12. 门店保管的正常完成写 `completed_at + delivered_at`，事件记录 `delivered`。
13. 旧订单显示“历史未确认”，不被默认映射为门店保管。
14. 客户持有的订单不进入待取机、取机逾期或催取机消息。
15. 旧客户端省略字段仍按兼容默认创建；新客户端永远显式传值。
16. 导入导出、打印和 mock 往返一致，非法枚举被拒绝。

### 11.2 建议命令门禁

定向覆盖至少包括：

```text
new-order form/offline draft tests
repairdesk schema/router tests
order repository/mock API tests
order data import/export roundtrip tests
device custody E2E flow
visual overflow tests
```

全量门禁：

```text
npm run agents:check
npm run lint
npm run typecheck
npm run test
npm run build
```

### 11.3 浏览器与截图

- 390×844：新建未留机、移动详情、取消后无退还提示。
- 430×932：长文案、Sheet、键盘和错误状态。
- 768×1024：平板布局切换。
- 1024×768：桌面新建和详情动作。
- 1280×800：高密度新建、列表 Badge。
- 1440×900：详情、时间线和打印预览。

所有尺寸要求 `scrollWidth <= innerWidth`、无控制台错误、状态不只靠颜色、保存刷新后一致。截图必须使用测试数据并遮蔽 PII/IMEI/解锁信息。

## 12. 发布和回滚

发布顺序：

1. 最新 main 隔离工作树完成实现与全门禁。
2. 检查生产 migration drift 和表规模；本规划没有生产证据，不能提前宣称安全。
3. Owner 批准后执行 linked dry-run。
4. 先应用 nullable expand migration。
5. 验证列、默认、constraint、旧行 NULL、非法值、RLS/grants。
6. 再部署服务端与前端，缩短旧客户端只能使用默认值的窗口。
7. 测试门店完成两种创建、后来收机、取消、完成和时间线验证。
8. 观察错误率和错误队列分类后再关闭任务。

回滚：

- 应用异常时回滚应用版本，保留新增 nullable 列和已写数据。
- 必要时通过 forward-fix 撤销未来默认值；不自动删列、不清空、不把旧数据批量改成门店保管。
- 旧 API/读取路径在生产证据稳定前保留兼容能力。

## 13. 风险、默认决定和批准边界

主要风险：

- 旧数据无法从快修/送修、状态或随附物品可靠推断。
- 当前完成会无条件写 `delivered_at`，取消会无条件提示退还，属于必须先修的 P0 逻辑。
- 手机解锁凭据与实物保管变化相连，必须原子清除且不可进入事件日志。
- 导入导出可能与设置中心任务重叠，必须重新确认单一写入者。
- 若未来要把交接事件作为法律争议证据，普通行更新 + 补偿事件可能不够，需要事务 RPC 和更强审计。

计划默认决定：

- 新单默认、但明显显示“已留店”。
- 历史订单保留 `NULL`，不批量回填。
- 采用当前保管责任，不采用不可变的“初次是否留机”布尔。
- 未留机可以报价、收定金和订件，但不能伪造已经检测、维修或待取机。
- 详情交接在线执行；历史更正默认 Owner/Manager。

批准边界：

- 本计划本身已完成，不代表业务代码已实施。
- Owner 说“开始”后，可执行本地、可逆的 WP-00 至 WP-05。
- 生产 migration、deploy、破坏性回填、角色权限扩张仍需明确批准。
