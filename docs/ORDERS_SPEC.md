# 工单（Repair Orders）模块完整规范

> 这是一份「单文件、可复用、可交付给 Cursor 复制改整」的工单模块说明书。
> 涵盖：业务定义、数据模型、状态机、API 契约、路由结构、UI 组件、页面布局、交互逻辑、文案、Token、动效与可访问性。
> 任何新项目想复刻本工单模块，仅需按本文件落地即可。
>
> 适用栈：**TanStack Start v1 + React 19 + Tailwind v4 + shadcn/ui + framer-motion + @tanstack/react-query**。
> 文件路径以 `src/` 为根；Token 来自 `src/styles.css`；动效来自 `src/lib/motion.ts`。

---

## 0. 目录

1. 业务定义与角色
2. 数据模型（TypeScript 类型）
3. 状态机与枚举（中文文案 + tone 映射）
4. API 契约（mock → 真实可替换）
5. 路由结构与 SEO meta
6. 通用工单组件（badges / Money / Phone）
7. 列表页 `/orders` 完整规范
8. 详情页 `/orders/$id` 完整规范
9. 新建页 `/orders/new` 完整规范
10. 设计 Token 与样式约束
11. 动效与可访问性
12. 复制改整 Checklist

---

## 1. 业务定义与角色

**工单（Repair Order）**：维修门店一次"接机 → 检测 → 报价 → 客户确认 → 维修 → 通知 → 取机/邮寄 → 完成"全过程的核心业务实体。

- **类型**：快修（`quick_repair`，门店当场修）/ 送修（`dropoff_repair`，留店或邮寄）。
- **角色**：技师（`technician_name`）、客户（`customer`）、外修供应商（`supplier`，可选）。
- **身份号**：`public_no`（对客可见的工单号，例 `RD-2025-0001`）+ `id`（内部 UUID）。
- **关联实体**：客户（1:N 设备）、设备、外修供应商、事件流、通知记录。

---

## 2. 数据模型（TypeScript）

> 文件位置：`src/lib/mock/fixtures.ts`（mock）→ 实际项目对接 Supabase/PG schema 时，字段名保持一致。

```ts
export interface Customer {
  id: string;
  name: string;
  phone_e164: string;       // +86 138 0000 0000
  phone_raw: string;
  contact_phones: string[]; // 备用联系电话
  consent_marketing: boolean;
  consent_sms: boolean;
  notes?: string;
}

export interface Device {
  id: string;
  customer_id: string;
  brand: string;            // Apple / Samsung / Huawei …
  model: string;            // iPhone 15 Pro …
  serial_or_imei: string;
  device_notes?: string;    // 外观、配件等
}

export interface Supplier {
  id: string;
  name: string;
  short_name: string;
  color: string;            // oklch(...) 用于点状标识
}

export interface FaultPriceItem {
  name: string;             // 例：屏幕总成
  price: number;            // 人民币元
  note?: string;
}

export interface RepairOrder {
  id: string;
  public_no: string;
  order_type: RepairOrderType;
  status: RepairOrderStatus;
  customer_id: string;
  device_id: string;
  issue_description: string;
  diagnosis_result?: string;
  quotation_amount: number;
  deposit_amount: number;
  balance_amount: number;
  is_paid: boolean;
  approval_status: ApprovalStatus;
  approval_sent_at?: string;
  approval_confirmed_at?: string;
  technician_name: string;
  internal_tag?: string;        // VIP / 加急 等
  warranty_text?: string;
  completed_at?: string;
  delivered_at?: string;
  pause_reason?: string;
  cancel_reason?: string;
  supplier_id?: string;         // 外修供应商
  original_order_id?: string;   // 返修来源工单
  contact_phones: string[];
  fault_prices: FaultPriceItem[];
  customer_signature?: string;  // base64 / URL
  created_at: string;
  updated_at: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type:
    | "created" | "status_changed" | "quoted"
    | "approval_sent" | "approval_result"
    | "payment" | "note" | "message_sent" | "delivered";
  payload: Record<string, unknown>;
  operator_name: string;
  created_at: string;
}

export interface MessageLog {
  id: string;
  order_id: string;
  channel: "whatsapp" | "sms";
  message_body: string;
  status: "sent" | "delivered" | "read" | "failed";
  sent_at: string;
  opened_at?: string;
}
```

> **强约束**：所有金额均为整数元（不要分），`tabular-nums` + `font-mono` 渲染；所有时间为 ISO 8601 字符串，渲染用 `toLocaleString("zh-CN")`。

---

## 3. 状态机与枚举

> 文件位置：`src/lib/mock/enums.ts`。**禁止新增** `repair_order_status` 值——所有 UI/筛选都依赖闭集。

```ts
export const repairOrderStatus = [
  "new", "rework", "mail_in_progress",
  "diagnosing", "quoted", "waiting_approval",
  "parts_ordered", "parts_arrived",
  "repairing", "repaired",
  "notified", "unfixed_pickup", "waiting_pickup",
  "completed", "cancelled",
] as const;

export const repairOrderType = ["quick_repair", "dropoff_repair"] as const;
export const approvalStatus  = ["pending", "approved", "rejected"] as const;
```

### 3.1 中文文案 + tone 映射（必须严格使用）

| status | label | tone |
|---|---|---|
| new | 新建 | info |
| rework | 返修 | warn |
| mail_in_progress | 邮寄中 | info |
| diagnosing | 检测中 | progress |
| quoted | 已报价 | progress |
| waiting_approval | 待审批 | warn |
| parts_ordered | 配件已订 | progress |
| parts_arrived | 配件已到 | progress |
| repairing | 维修中 | progress |
| repaired | 已修复 | success |
| notified | 已通知 | success |
| unfixed_pickup | 未修取机 | danger |
| waiting_pickup | 待取机 | warn |
| completed | 已完成 | success |
| cancelled | 已取消 | neutral |

`order_type`：`quick_repair → 快修`、`dropoff_repair → 送修`
`approval_status`：`pending → 待审批 (warn)`、`approved → 已批准 (success)`、`rejected → 已拒绝 (danger)`

### 3.2 标签页分组（仅 UI，不是状态机本身）

```ts
export const statusGroups = {
  in_progress: ["new","rework","mail_in_progress","diagnosing","quoted",
                "parts_ordered","parts_arrived","repairing"],
  awaiting_approval: ["waiting_approval"],
  awaiting_pickup:   ["repaired","notified","waiting_pickup","unfixed_pickup"],
  completed:         ["completed"],
  cancelled:         ["cancelled"],
};
```

UI 顶部 Tab 顺序固定为：**全部 / 进行中 / 待审批 / 待取机 / 已完成 / 已取消**。

### 3.3 流转规则（推荐，但不强制阻塞）

- 任何状态都可流转到 `cancelled`。
- `completed` / `cancelled` 之后建议禁止再次流转（UI 上显示但 disabled）。
- 流转动作必写入 `OrderEvent(status_changed)`，payload `{ from, to }`。

---

## 4. API 契约

> 文件位置：`src/lib/mock/api.ts`。
> 真实化时改为 TanStack `createServerFn`（`*.functions.ts`）或 REST，**签名保持一致**。

```ts
export interface OrderListFilters {
  search?: string;                   // 工单号 / 姓名 / 电话 / IMEI / 设备
  statuses?: RepairOrderStatus[];
  types?: RepairOrderType[];
  technicians?: string[];
  supplierIds?: string[];
  paid?: "all" | "paid" | "unpaid";
}

export interface OrderListItem extends RepairOrder {
  customer_name: string;
  customer_phone: string;
  device_label: string;       // `${brand} ${model}`
  device_imei: string;
  supplier_name?: string;
  supplier_color?: string;
}

// GET  /api/orders
listOrders(filters?): Promise<OrderListItem[]>
// GET  /api/orders/[id]
getOrder(id): Promise<{ order, customer, device, supplier, events, messages }>
// POST /api/orders/[id]/transition
transitionOrder(id, to: RepairOrderStatus): Promise<{ ok: true }>
// POST /api/orders/batch-transition
batchTransition(ids[], to): Promise<{ ok: true, count }>
// POST /api/orders
createOrder(input: Partial<RepairOrder>): Promise<{ id, ...input }>
```

**列表排序**：`created_at DESC`（默认）。
**搜索匹配字段**：`public_no | customer_name | customer_phone | device_imei | device_label`，全部小写包含匹配。
**React Query Key 约定**：
- 列表：`["orders", effectiveFilters]`
- 详情：`["order", id]`

---

## 5. 路由结构

> 平铺式 file-based routing（TanStack Start 约定）。

```
src/routes/
├── orders.tsx          # /orders 布局，仅 <Outlet/>
├── orders.index.tsx    # /orders 列表
├── orders.$id.tsx      # /orders/:id 详情
└── orders.new.tsx      # /orders/new 新建
```

**SEO meta**（每页必须独立）：

```ts
// orders.tsx        title: "工单 — RepairDesk" / desc: "查看、筛选与管理所有维修工单"
// orders.index.tsx  title: "工单 — RepairDesk" / desc: "查看与管理所有维修工单"
// orders.$id.tsx    title: `工单 ${params.id} — RepairDesk` / desc: "工单详情、报价、时间线与通知"
// orders.new.tsx    title: "新建工单 — RepairDesk" / desc: "录入新工单：客户、设备、故障与报价"
```

布局文件极简：

```tsx
export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [...] }),
  component: () => <Outlet />,
});
```

---

## 6. 通用工单组件

> 位置：`src/components/orders/badges.tsx`。**只输出语义 token，禁止硬编码颜色。**

### 6.1 `<Pill tone>` 内部封装（不导出）

- 形态：`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset`
- 6 种 tone 直接映射到 `bg-status-{tone}` / `text-status-{tone}-foreground` / `ring-status-{tone}-foreground/30`
- `progress`、`warn` 自带 ping 脉冲点，营造"正在发生"感

### 6.2 导出

```tsx
<StatusBadge   status={RepairOrderStatus} />
<OrderTypeBadge type={RepairOrderType} />        // 灰底中性 chip
<ApprovalBadge status={ApprovalStatus} />
<MoneyText amount={number} className?/>          // ¥ + tabular-nums + font-mono
<PhoneText value={string} />                     // 等宽，muted
```

---

## 7. 列表页 `/orders`（`orders.index.tsx`）

### 7.1 信息架构（自上而下）

```
┌─ Hero ─────────────────────────────────────────────┐
│ 面包屑：工作台 / 工单                              │
│ H1：工单（gradient-text） + 共 N 条                │
│ KpiPill x3：今日新建 / 进行中 / 未结清              │
└─────────────────────────────────────────────────────┘
┌─ Toolbar (glass-card) ─────────────────────────────┐
│ [🔍 搜索] [筛选 Sheet] [导出(桌面)]                  │
│ SegmentedTabs（layoutId 滑动指示器）  · 选中 N      │
└─────────────────────────────────────────────────────┘
┌─ List ─────────────────────────────────────────────┐
│ Desktop: <table> 10 列                              │
│ Mobile : 垂直卡片，左侧品牌渐变条 3px              │
└─────────────────────────────────────────────────────┘
┌─ Bulk action bar (sticky bottom，AnimatePresence) ─┐
└─────────────────────────────────────────────────────┘
```

### 7.2 KpiPill（小卡片）

- `glass-card` 容器；右上角 16x16 模糊径向渐变光晕（hover 增亮）
- 数字用 `<AnimatedNumber value={N}/>`，`font-display tabular-nums`
- 三个 accent 颜色（仅这里允许直接用 oklch，因为是装饰光晕）：
  - 今日新建：`oklch(0.7 0.2 285)` 紫
  - 进行中：`oklch(0.78 0.16 200)` 青
  - 未结清：`oklch(0.78 0.18 75)` 橙

### 7.3 SegmentedTabs

- 容器：`rounded-lg border bg-surface/60 backdrop-blur p-1`，**移动端横向滚动**（隐藏滚动条）
- 激活态用 `motion.span layoutId="orders-tab-indicator"`，spring `{stiffness:400, damping:32}`
- 激活背景：`linear-gradient(120deg, oklch(0.7 0.2 285 / 0.25), oklch(0.78 0.16 200 / 0.18))`，`inset 0 0 0 1px oklch(1 0 0 / 0.08)`

### 7.4 高级筛选（FiltersPanel，移动端 Sheet 右抽屉）

分组：**工单状态 / 工单类型 / 付款状态 / 技师 / 外修供应商**。
- 状态/类型/付款用 chip 切换（`border-primary bg-primary/10 text-primary` 表示激活）。
- 技师 / 供应商用 `<Checkbox>` 列表；供应商前置 `size-2.5` 圆点（用 supplier.color）。
- 顶部"重置"清空除 search 外所有；底部移动端"应用筛选"按钮。

### 7.5 桌面表格列

`☐ | 工单号 | 客户 | 设备 | 故障 | 状态 | 报价 | 技师 | 创建 | ⋯`

- **行 hover**：`bg-accent/30`；选中时 `bg-accent/40`，左侧 2px 品牌渐变条 `scale-y` 出现
- 工单号链接：`font-mono text-xs text-primary hover:underline`，下方 `<OrderTypeBadge>` + 内部标签 chip（warn 色）
- 故障：`max-w-[260px] truncate`
- 报价：右对齐，`<MoneyText>` + 下方 11px "已结清/未结清"
- 创建：`toLocaleDateString("zh-CN")`
- ⋯ 菜单：查看详情 / 打印 / 发送通知 / 删除（destructive）

### 7.6 移动端卡片

- `glass-card` + 左侧 3px 全高品牌渐变条
- 顶行：工单号(mono primary) + OrderTypeBadge + 右侧 StatusBadge
- 第二行：客户名 · 设备
- 第三行：电话（PhoneText）
- 故障：`line-clamp-1`
- 底行：技师 · 日期 · 报价（右对齐，font-semibold）
- 整卡 `<Link>`，`active:scale-[0.99]`

### 7.7 批量操作条（Bulk action bar）

- `<AnimatePresence>` + `selected.length > 0` 触发
- 进入：`y:80→0, opacity:0→1`，spring `{stiffness:380, damping:30}`
- 位置：`fixed bottom-20 left-0 right-0 z-30 flex justify-center` 桌面 `bottom-6`
- 内容：`glass-strong rounded-xl shadow-elevated`，包含：
  - 关闭 ✕
  - "已选 **N** 条"（N 用 gradient-text）
  - 分隔
  - 「批量流转状态」DropdownMenu，列出全部 `repairOrderStatus`，点击 `toast.success(`已将 N 条工单流转为「label」`)`
  - 「打印」outline
  - 「发送通知」品牌渐变实心按钮（`background: var(--gradient-brand)`，white 文字）

### 7.8 加载与空态

- 加载：6 条 `<Skeleton h-14>`
- 空态：居中，16x16 品牌渐变方块（含搜索图标，shadow `0 8px 28px -8px oklch(0.7 0.2 285 / 0.6)`）+ "暂无符合条件的工单" + "试试调整搜索词或重置筛选条件"

---

## 8. 详情页 `/orders/$id`（`orders.$id.tsx`）

### 8.1 整体结构

```
[Sticky Hero (glass-card, scroll-collapse)]
   面包屑「← 返回列表 / 工单详情」
   工单号 (gradient-text 2xl/3xl) + StatusBadge + OrderTypeBadge + 返修来源
   设备 · 客户 · 技师 (subtitleOpacity 跟随滚动)
   右侧：总报价 (font-display 2xl)
   行动 chip 横排（移动端横滚）：
     [流转状态 ⌄] (品牌渐变实心) [通知客户] [收款] [打印] [转库存] [⋯]

[Segmented Tabs] 概览 / 时间线 / 通知 / 附件 / 库存关联   (layoutId="order-tab-indicator")

[AnimatePresence mode="wait"] 切 Tab 内容
```

### 8.2 滚动折叠 Hero（关键交互）

```ts
const { scrollY } = useScroll();
const heroPad = useTransform(scrollY, [0, 120], [24, 10]);
const heroTitleScale = useTransform(scrollY, [0, 120], [1, 0.86]);
const subtitleOpacity = useTransform(scrollY, [0, 80], [1, 0]);
```

容器 `sticky top-[64px] z-20`。

### 8.3 概览 Tab — 五张 Card（顺序固定）

1. **客户与设备**（2 列 grid）
   - 左：客户名 + 电话（Phone 图标 + PhoneText）+ 备用联系电话 chip 列表（mono 11px）
   - 右：品牌+型号 + IMEI（mono）+ 设备备注
   - 右上「编辑」ghost 按钮

2. **故障与诊断**
   - 故障描述（必填）/ 诊断结果（未填写显灰字）/ 内部标签 chip（warn）/ 质保

3. **报价与财务**
   - 标题右侧 `<ApprovalBadge>`
   - 表格：项目 / 金额（右对齐 MoneyText） / 备注（11px muted）
   - Separator
   - 4 列 Field：总报价（font-semibold MoneyText） / 押金 / 尾款 / 结清状态（已结清带 ✅ + status-success-foreground）
   - 底部按钮：「发送审批」「收款」outline

4. **客户签名**
   - 右上按钮：未签名时"请客户签名"，已签时"重新签名"
   - 区域：`h-32 border-dashed`，已签时 `bg-surface-muted` + 文案"签名已采集"

5. **关键信息**（dl，2 列）
   - 创建时间 / 完成时间 / 交付时间 / 技师 / 外修供应商（含色点）/ 取消原因
   - 每行 `bg-surface-muted/30 px-2 py-1.5 rounded-md`，左 muted-fg 标签，右普通文字

### 8.4 时间线 Tab

- `<ol class="border-l border-border/60 pl-5 space-y-5">`
- 每事件左侧 16x16 圆点（绝对定位 `-left-[26px]`），`ring-4 ring-background`
- **首条**节点用 `var(--gradient-brand)` 实心，其它用 `oklch(0.7 0.2 285 / 0.6)`
- hover 加 `box-shadow 0 0 0 6px oklch(0.7 0.2 285 / 0.18)`
- 事件文案由 `renderEvent(type, payload)` 渲染（见 8.6）

### 8.5 通知 Tab

- 右上「发送通知」按钮 → `toast.success("已生成 WhatsApp 通知草稿")`
- 空态：`border-dashed p-8 text-center text-xs muted` "暂无通知记录"
- 列表项：`rounded-md border bg-surface-muted/40 p-3 text-xs`
  - 顶行：渠道（`whatsapp → WhatsApp`，否则"短信"） + 状态 chip（`read → status-success`，其他 → status-info）
  - 正文 `mt-1 muted`
  - 时间戳 `mt-2 text-[10px] muted/70`

### 8.6 事件文案表（`renderEvent`）

| event_type | 渲染 |
|---|---|
| `created` | `"工单创建"` |
| `status_changed` | `"状态变更：{from.label} → {to.label}"` |
| `quoted` | `"提交报价 ¥{amount}"` |
| `approval_result` | `"客户审批{approved?通过:拒绝}"` |
| `payment` | `"收款 ¥{amount}（{method}）"` |
| `message_sent` | `"已发送通知"` |
| 其它 | 原 type |

### 8.7 附件 / 库存关联 Tab

- `Card p-8 text-center muted`
- 文案分别为"附件功能即将上线。" / "暂无与该工单关联的库存记录。"

### 8.8 流转动作

- Hero「流转状态」DropdownMenu 列出所有 `repairOrderStatus`，**当前状态 disabled**
- 点击：`toast.success(`已流转为「${label}」`)` → `router.invalidate()`

---

## 9. 新建页 `/orders/new`（`orders.new.tsx`）

### 9.1 结构

```
[← 返回] 新建工单
<form>
  Section 客户信息    Grid: 客户姓名* | 手机号*(font-mono +86 占位)
  Section 设备信息    Grid: 品牌* | 型号* | IMEI(可选 mono) | 设备备注
  Section 故障与服务
     工单类型*       chip 切换：快修 / 送修
     故障描述*       Textarea rows=3
     Grid: 技师 Select | 内部标签 Input
  Section 报价（可选）
     Grid: 预估总报价(number font-mono) | 押金(number font-mono)

  [Sticky 底部] 取消(ghost) | 创建工单(primary)
</form>
```

### 9.2 内部局部组件

- `<Section title>` → `<Card class="p-4"> + h2 text-sm font-semibold + space-y-3`
- `<Grid>` → `grid gap-3 sm:grid-cols-2`
- `<FormItem label required>` → `<Label class="text-xs">{label} {required && <span class="text-destructive">*</span>}</Label> + space-y-1.5`

### 9.3 提交

```ts
e.preventDefault();
toast.success("工单已创建");
router.navigate({ to: "/orders" });
```

> 实际接入：替换为 `await createOrder(formData)`，成功后 `router.navigate` 到详情。

---

## 10. 设计 Token 与样式约束

> **铁律**：禁止在组件中写 `text-white / bg-black / text-[#xxx]` 等硬编码。一切必须走 token。
> 例外：仅 KpiPill 装饰光晕、Tab 激活背景、Hero 时间线节点这三处允许直接写 oklch（因为它们是渐变/光晕，不是语义色）。

### 10.1 必用 Token（`src/styles.css`）

| Token | 用途 |
|---|---|
| `--background / --foreground` | 页面底色 |
| `--surface / --surface-muted` | 卡内层级、表头底色 |
| `--card / --card-foreground` | Card |
| `--border` | 1px 边线（常带 `/60` `/40` 透明） |
| `--primary` | 工单号、链接、激活 chip 描边 |
| `--muted-foreground` | 次要文本 |
| `--destructive` | 删除、必填星号 |
| `--status-{neutral,info,progress,warn,success,danger}` + `-foreground` | 6 种状态色 |
| `--gradient-brand` | H1 文本渐变、KpiPill 空态图标、Hero 流转按钮、行 hover 左侧条、移动卡片左条、首条时间线节点、批量操作"发送通知" |
| `shadow-elevated` | 浮起卡片（批量操作条） |

### 10.2 样式工具类

| 类 | 何处用 |
|---|---|
| `glass-card` | Hero、Toolbar、KpiPill、Desktop 表格容器、Mobile 卡片 |
| `glass-strong` | 批量操作条 |
| `gradient-text` | H1、详情页工单号、批量数量 |
| `font-display` | H1、KPI 数字、Hero 工单号、总报价 |
| `font-mono tabular-nums` | 金额、电话、IMEI |

### 10.3 字号/间距

- 页面容器：列表 `max-w-7xl px-4 md:px-6 lg:px-8 pt-6`；详情 `max-w-4xl px-4 md:px-6 pb-12 pt-4`；新建 `max-w-3xl px-3 sm:px-6 py-4`
- Card 内边距 `p-5`（详情）/ `p-4`（新建）/ `p-3`（移动卡片）
- 状态 chip 高度通过 `text-xs px-1.5 py-0.5` 控制，不要改大

---

## 11. 动效与可访问性

### 11.1 framer-motion 约定

```ts
import { fadeUp, stagger } from "@/lib/motion";
```

- 列表/卡片入场：`variants={stagger(0.025~0.05)}` 父 + `variants={fadeUp}` 子
- Tab 切换：`<AnimatePresence mode="wait">` 包裹，子加 `key={tab}` + `exit={{ opacity:0, y:-4 }}`
- Tab 激活滑块：`motion.span layoutId="orders-tab-indicator"`（列表）/ `"order-tab-indicator"`（详情），spring `{stiffness:400, damping:32}`
- 批量操作条：spring `{stiffness:380, damping:30}`
- KpiPill hover：`whileHover={{ y: -2 }}`
- 滚动折叠 Hero：`useScroll + useTransform`（详情专用）

### 11.2 可访问性

- Sheet 必须有 `<SheetHeader><SheetTitle class="sr-only">筛选</SheetTitle></SheetHeader>`
- 所有图标按钮（`size-icon`）需 `aria-label` 或可见文字
- 状态 chip 文字必须可见，**不要只用颜色传达**（已用文字 + 色点 + ping 三重编码）
- `prefers-reduced-motion`：framer-motion 全局已遵循，不要再加额外动画

---

## 12. 复制改整 Checklist（交付 Cursor 时勾选）

- [ ] 复制 `src/lib/mock/{enums.ts, fixtures.ts, api.ts}`
- [ ] 复制 `src/components/orders/badges.tsx`
- [ ] 复制 4 个路由文件 `orders.tsx / orders.index.tsx / orders.$id.tsx / orders.new.tsx`
- [ ] 确认 `src/styles.css` 含全部 `--status-*` / `--gradient-brand` / `--surface*` / `--shadow-elevated` token
- [ ] 确认依赖：`@tanstack/react-router @tanstack/react-query framer-motion lucide-react sonner`
- [ ] 确认 shadcn 已生成：`button input checkbox sheet dropdown-menu card select label textarea separator scroll-area skeleton`
- [ ] 确认存在：`@/components/animated-number`、`@/lib/motion`（导出 `fadeUp`、`stagger`）、`@/lib/utils`（`cn`）
- [ ] 顶层 `<Toaster />`（sonner）已挂载
- [ ] 侧栏新增「工单」入口，路由 `/orders`
- [ ] 全部状态文案与 §3.1 表格 1:1
- [ ] 列表 6 个 Tab 顺序、批量操作条按钮顺序与 §7 一致
- [ ] 详情五张 Card 顺序、滚动折叠 Hero 与 §8 一致
- [ ] 真实化 API 时仅替换 `src/lib/mock/api.ts`，**保持函数签名、Query Key、返回结构不变**
- [ ] 所有金额渲染走 `<MoneyText>`，电话走 `<PhoneText>`，状态走 `<StatusBadge>`，类型走 `<OrderTypeBadge>`，审批走 `<ApprovalBadge>`
- [ ] 没有硬编码颜色（除 §10 三处装饰例外）
- [ ] 每个路由都设置独立的 `head().meta`（title + description）

---

> **复制后第一件事**：运行 `pnpm dev` → 打开 `/orders` → 切换 6 个 Tab → 任意工单点进详情 → 切换 5 个 Tab → 触发流转/通知 toast → 移动端 viewport 验证抽屉筛选与批量操作条。全部通过即视为对齐成功。
