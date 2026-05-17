# 工单模块（Orders）— 完整复刻清单

> 用途：把这份文件交给 Cursor，即可在任意 TanStack Start + shadcn/ui + Tailwind v4 + framer-motion 项目里 **1:1 复刻**当前工单模块的设计与逻辑。
> 本文档包含：依赖、文件树、所有源码（原样）、设计 Token 依赖、动画规范、状态机与 API 约定、复刻 Checklist。

---

## 1. 技术依赖

```bash
bun add @tanstack/react-router @tanstack/react-start @tanstack/react-query \
        framer-motion lucide-react sonner clsx tailwind-merge class-variance-authority
# shadcn/ui 组件（已生成）
#   button input checkbox sheet dropdown-menu skeleton scroll-area separator
#   card label textarea select
```

Tailwind v4，使用 `src/styles.css` 的语义 Token（见 §6）。

---

## 2. 文件树

```
src/
├── routes/
│   ├── orders.tsx              # 父布局（仅 Outlet + meta）
│   ├── orders.index.tsx        # 列表页 /orders
│   ├── orders.$id.tsx          # 详情页 /orders/:id
│   └── orders.new.tsx          # 新建页 /orders/new
├── components/
│   ├── orders/
│   │   └── badges.tsx          # StatusBadge / OrderTypeBadge / ApprovalBadge / MoneyText / PhoneText
│   └── animated-number.tsx     # 数字滚动动画
├── lib/
│   ├── motion.ts               # fadeUp / stagger / scaleIn / pageTransition
│   ├── utils.ts                # cn()
│   └── mock/
│       ├── enums.ts            # 状态枚举 + 文案 + tone 映射
│       ├── fixtures.ts         # 客户/设备/供应商/工单/事件/消息 mock
│       └── api.ts              # listOrders / getOrder / transitionOrder ...
```

---

## 3. 路由（TanStack Start 扁平化文件路由）

| File                       | Path             | 作用                       |
| -------------------------- | ---------------- | -------------------------- |
| `src/routes/orders.tsx`    | `/orders` layout | 仅渲染 `<Outlet />` + meta |
| `src/routes/orders.index.tsx` | `/orders`     | 工单列表                   |
| `src/routes/orders.$id.tsx`   | `/orders/:id` | 工单详情                   |
| `src/routes/orders.new.tsx`   | `/orders/new` | 新建工单                   |

链接示例：`<Link to="/orders/$id" params={{ id: o.id }}>`

---

## 4. 状态机（15 态 + tone 映射）

文案与色调来自 `src/lib/mock/enums.ts`：

| status              | 中文     | tone      |
| ------------------- | -------- | --------- |
| `new`               | 新建     | info      |
| `rework`            | 返修     | warn      |
| `mail_in_progress`  | 邮寄中   | info      |
| `diagnosing`        | 检测中   | progress  |
| `quoted`            | 已报价   | progress  |
| `waiting_approval`  | 待审批   | warn      |
| `parts_ordered`     | 配件已订 | progress  |
| `parts_arrived`     | 配件已到 | progress  |
| `repairing`         | 维修中   | progress  |
| `repaired`          | 已修复   | success   |
| `notified`          | 已通知   | success   |
| `unfixed_pickup`    | 未修取机 | danger    |
| `waiting_pickup`    | 待取机   | warn      |
| `completed`         | 已完成   | success   |
| `cancelled`         | 已取消   | neutral   |

`progress` / `warn` 自带 ping 脉冲点（活体提示）。

Tab 分组（仅 UI）：`in_progress / awaiting_approval / awaiting_pickup / completed / cancelled`。

---

## 5. API 约定（mock 层签名）

```ts
listOrders(filters: OrderListFilters): Promise<OrderListItem[]>
getOrder(id: string): Promise<{ order, customer, device, supplier, events, messages }>
transitionOrder(id: string, to: RepairOrderStatus): Promise<{ ok: true }>
batchTransition(ids: string[], to: RepairOrderStatus): Promise<{ ok: true; count }>
createOrder(input: Partial<RepairOrder>): Promise<RepairOrder>

interface OrderListFilters {
  search?: string;
  statuses?: RepairOrderStatus[];
  types?: RepairOrderType[];
  technicians?: string[];
  supplierIds?: string[];
  paid?: "all" | "paid" | "unpaid";
}
```

接入真实后端时，把 `src/lib/mock/api.ts` 内函数体替换成 `fetch()` 即可，签名与返回结构保持不变。

---

## 6. 设计 Token 依赖（src/styles.css 必备）

工单页直接消费下列 Token，缺一不可：

- 颜色：`--background --foreground --primary --primary-foreground --muted-foreground --accent --border --destructive`
- 表面层：`--surface --surface-muted`
- 状态色（每种含 `bg / fg`）：
  `--status-neutral / --status-info / --status-progress / --status-warn / --status-success / --status-danger`
  对应 Tailwind 类：`bg-status-{tone}` `text-status-{tone}-foreground`
- 品牌渐变：`--gradient-brand`（紫→青）
- 工具类（`@layer utilities` 中）：
  - `.glass-card` — 实色卡片（rounded-xl + border + bg-card + shadow-sm）
  - `.glass-strong` — 浮动条（更深底色 + shadow-elevated）
  - `.gradient-text` — `background-clip: text` + `--gradient-brand`
  - `.shadow-elevated`

> 严禁在工单组件内写 `bg-white / text-black / #xxx`，全部走 Token。

---

## 7. 动画规范（src/lib/motion.ts）

- 入场缓动：`ease = [0.22, 1, 0.36, 1]`
- `fadeUp`：opacity 0→1 + y 8→0，0.35s
- `stagger(gap)`：列表/网格统一交错入场
- 详情 Hero 滚动塌缩：`useScroll` + `useTransform` 把 `paddingTop / scale / opacity` 与 `scrollY` 绑定
- Tab 指示器：`layoutId="orders-tab-indicator"` / `"order-tab-indicator"`，spring(400, 32)
- 批量条进出：spring(380, 30)，从 `y:80` 弹入

---

## 8. 完整源码（按文件列出，原样可粘贴）

### 8.1 `src/lib/motion.ts`

```ts
import type { Variants, Transition } from "framer-motion";

export const ease: Transition["ease"] = [0.22, 1, 0.36, 1];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.25, ease } },
};

export const stagger = (gap = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: 0.05 } },
});

export const cardHover = {
  rest: { y: 0, transition: { duration: 0.2, ease } },
  hover: { y: -2, transition: { duration: 0.2, ease } },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.2, ease } },
};
```

### 8.2 `src/components/animated-number.tsx`

```tsx
import { useEffect } from "react";
import { animate, useMotionValue, useTransform } from "framer-motion";
import { motion } from "framer-motion";

export function AnimatedNumber({
  value,
  duration = 1.1,
  format = (n) => Math.round(n).toLocaleString("zh-CN"),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const out = useTransform(mv, (v) => format(v));

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [value, duration, mv]);

  return <motion.span className={className}>{out}</motion.span>;
}
```

### 8.3 `src/lib/mock/enums.ts`

```ts
export const repairOrderStatus = [
  "new","rework","mail_in_progress","diagnosing","quoted","waiting_approval",
  "parts_ordered","parts_arrived","repairing","repaired","notified",
  "unfixed_pickup","waiting_pickup","completed","cancelled",
] as const;
export type RepairOrderStatus = (typeof repairOrderStatus)[number];

export const repairOrderType = ["quick_repair", "dropoff_repair"] as const;
export type RepairOrderType = (typeof repairOrderType)[number];

export const approvalStatus = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof approvalStatus)[number];

type StatusTone = "neutral" | "info" | "progress" | "warn" | "success" | "danger";

export const statusMeta: Record<RepairOrderStatus, { label: string; tone: StatusTone }> = {
  new: { label: "新建", tone: "info" },
  rework: { label: "返修", tone: "warn" },
  mail_in_progress: { label: "邮寄中", tone: "info" },
  diagnosing: { label: "检测中", tone: "progress" },
  quoted: { label: "已报价", tone: "progress" },
  waiting_approval: { label: "待审批", tone: "warn" },
  parts_ordered: { label: "配件已订", tone: "progress" },
  parts_arrived: { label: "配件已到", tone: "progress" },
  repairing: { label: "维修中", tone: "progress" },
  repaired: { label: "已修复", tone: "success" },
  notified: { label: "已通知", tone: "success" },
  unfixed_pickup: { label: "未修取机", tone: "danger" },
  waiting_pickup: { label: "待取机", tone: "warn" },
  completed: { label: "已完成", tone: "success" },
  cancelled: { label: "已取消", tone: "neutral" },
};

export const orderTypeMeta: Record<RepairOrderType, { label: string }> = {
  quick_repair: { label: "快修" },
  dropoff_repair: { label: "送修" },
};

export const approvalMeta: Record<ApprovalStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "待审批", tone: "warn" },
  approved: { label: "已批准", tone: "success" },
  rejected: { label: "已拒绝", tone: "danger" },
};

export const statusGroups = {
  in_progress: ["new","rework","mail_in_progress","diagnosing","quoted","parts_ordered","parts_arrived","repairing"] as RepairOrderStatus[],
  awaiting_approval: ["waiting_approval"] as RepairOrderStatus[],
  awaiting_pickup: ["repaired","notified","waiting_pickup","unfixed_pickup"] as RepairOrderStatus[],
  completed: ["completed"] as RepairOrderStatus[],
  cancelled: ["cancelled"] as RepairOrderStatus[],
};
```

### 8.4 `src/lib/mock/fixtures.ts`

```ts
import {
  repairOrderStatus,
  type ApprovalStatus,
  type RepairOrderStatus,
  type RepairOrderType,
} from "./enums";

export interface Customer {
  id: string;
  name: string;
  phone_e164: string;
  phone_raw: string;
  contact_phones: string[];
  consent_marketing: boolean;
  consent_sms: boolean;
  notes?: string;
}

export interface Device {
  id: string;
  customer_id: string;
  brand: string;
  model: string;
  serial_or_imei: string;
  device_notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  short_name: string;
  color: string;
}

export interface FaultPriceItem {
  name: string;
  price: number;
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
  internal_tag?: string;
  warranty_text?: string;
  completed_at?: string;
  delivered_at?: string;
  pause_reason?: string;
  cancel_reason?: string;
  supplier_id?: string;
  original_order_id?: string;
  contact_phones: string[];
  fault_prices: FaultPriceItem[];
  customer_signature?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type:
    | "created" | "status_changed" | "quoted" | "approval_sent"
    | "approval_result" | "payment" | "note" | "message_sent" | "delivered";
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

const technicians = ["陈师傅", "李工", "王师傅", "周工", "黄师傅"];
const brands = [
  ["Apple", ["iPhone 15 Pro", "iPhone 14", "iPhone 13", "iPhone SE", "iPad Air"]],
  ["Samsung", ["Galaxy S24", "Galaxy S23 Ultra", "Galaxy A54", "Galaxy Z Flip5"]],
  ["Huawei", ["Mate 60 Pro", "P60", "Nova 11"]],
  ["Xiaomi", ["14 Pro", "13", "Redmi K70"]],
  ["OPPO", ["Find X7", "Reno 11"]],
] as const;
const issues = [
  "屏幕碎裂，触摸局部失灵","进水开机黑屏","电池续航严重下降，需更换电池",
  "充电口接触不良","后摄无法对焦","听筒无声","Face ID 失效",
  "主板无法开机，疑似电源 IC","扬声器破音","无法识别 SIM 卡",
];

export const suppliers: Supplier[] = [
  { id: "sup_1", name: "华强北维修中心", short_name: "华强北", color: "#6366f1" },
  { id: "sup_2", name: "速达主板维修", short_name: "速达", color: "#10b981" },
  { id: "sup_3", name: "深修苹果服务商", short_name: "深修", color: "#f59e0b" },
];

const customerNames = [
  "张伟","王芳","李娜","刘洋","陈静","杨帆","赵敏","孙磊",
  "周雪","吴桐","郑凯","钱进","冯莉","蒋欣","许文","韩梅",
  "曹杰","邓超","彭程","宋佳",
];

function pad(n: number, width = 4) { return n.toString().padStart(width, "0"); }
function rand<T>(arr: readonly T[], i: number): T { return arr[i % arr.length]; }

export const customers: Customer[] = customerNames.map((name, i) => {
  const tail = pad(13800000000 + i * 137, 11);
  return {
    id: `cus_${i + 1}`,
    name,
    phone_raw: tail,
    phone_e164: `+86${tail}`,
    contact_phones: i % 5 === 0 ? [`+86${pad(13900000000 + i, 11)}`] : [],
    consent_marketing: i % 3 !== 0,
    consent_sms: true,
  };
});

export const devices: Device[] = [];
customers.forEach((c, i) => {
  const [brand, models] = rand(brands, i);
  devices.push({
    id: `dev_${i + 1}`,
    customer_id: c.id,
    brand,
    model: rand(models, i),
    serial_or_imei: `35${pad(100000000000 + i * 7919, 13)}`,
    device_notes: i % 4 === 0 ? "外壳有划痕" : undefined,
  });
});

const baseDate = new Date("2026-05-01T09:00:00+08:00").getTime();

export const orders: RepairOrder[] = Array.from({ length: 48 }).map((_, i) => {
  const customer = customers[i % customers.length];
  const device = devices[i % devices.length];
  const status: RepairOrderStatus = repairOrderStatus[i % repairOrderStatus.length];
  const type: RepairOrderType = i % 4 === 0 ? "dropoff_repair" : "quick_repair";
  const quotation = 80 + (i % 12) * 95;
  const deposit = i % 3 === 0 ? Math.round(quotation * 0.3) : 0;
  const isPaid = ["completed", "notified", "waiting_pickup"].includes(status) && i % 2 === 0;
  const created = new Date(baseDate - i * 3600_000 * 5).toISOString();
  const approval: ApprovalStatus =
    status === "waiting_approval"
      ? "pending"
      : ["quoted","parts_ordered","parts_arrived","repairing","repaired","notified","waiting_pickup","completed"].includes(status)
        ? "approved"
        : "pending";

  const fault_prices: FaultPriceItem[] = [
    { name: "屏幕总成", price: Math.round(quotation * 0.7), note: "原厂品质" },
  ];
  if (i % 2 === 0) fault_prices.push({ name: "人工", price: Math.round(quotation * 0.3) });

  return {
    id: `ord_${i + 1}`,
    public_no: `R${pad(2026000 + i + 1, 7)}`,
    order_type: type,
    status,
    customer_id: customer.id,
    device_id: device.id,
    issue_description: rand(issues, i),
    diagnosis_result: i % 3 === 0 ? "屏幕需更换，主板正常" : undefined,
    quotation_amount: quotation,
    deposit_amount: deposit,
    balance_amount: quotation - deposit - (isPaid ? quotation - deposit : 0),
    is_paid: isPaid,
    approval_status: approval,
    approval_sent_at: approval !== "pending" || status === "waiting_approval" ? created : undefined,
    approval_confirmed_at: approval === "approved" ? created : undefined,
    technician_name: rand(technicians, i),
    internal_tag: i % 5 === 0 ? "VIP" : i % 7 === 0 ? "加急" : undefined,
    warranty_text: "90天质保",
    completed_at: status === "completed" ? created : undefined,
    delivered_at: status === "completed" && i % 2 === 0 ? created : undefined,
    cancel_reason: status === "cancelled" ? "客户主动取消" : undefined,
    supplier_id: i % 6 === 0 ? suppliers[i % suppliers.length].id : undefined,
    original_order_id: status === "rework" ? `ord_${((i + 5) % 40) + 1}` : undefined,
    contact_phones: customer.contact_phones,
    fault_prices,
    customer_signature: ["completed", "delivered"].includes(status) ? "data:signed" : undefined,
    created_at: created,
    updated_at: created,
  };
});

export function getCustomer(id: string) { return customers.find((c) => c.id === id); }
export function getDevice(id: string) { return devices.find((d) => d.id === id); }
export function getSupplier(id?: string) { return id ? suppliers.find((s) => s.id === id) : undefined; }

export function getEvents(orderId: string): OrderEvent[] {
  const o = orders.find((x) => x.id === orderId);
  if (!o) return [];
  const t = new Date(o.created_at).getTime();
  const e: OrderEvent[] = [
    { id: `${orderId}_e1`, order_id: orderId, event_type: "created",
      payload: { type: o.order_type }, operator_name: "前台 小赵",
      created_at: new Date(t).toISOString() },
    { id: `${orderId}_e2`, order_id: orderId, event_type: "status_changed",
      payload: { from: "new", to: "diagnosing" }, operator_name: o.technician_name,
      created_at: new Date(t + 30 * 60_000).toISOString() },
    { id: `${orderId}_e3`, order_id: orderId, event_type: "quoted",
      payload: { amount: o.quotation_amount }, operator_name: o.technician_name,
      created_at: new Date(t + 90 * 60_000).toISOString() },
  ];
  if (o.approval_status === "approved")
    e.push({ id: `${orderId}_e4`, order_id: orderId, event_type: "approval_result",
      payload: { result: "approved" }, operator_name: "客户",
      created_at: new Date(t + 120 * 60_000).toISOString() });
  if (o.is_paid)
    e.push({ id: `${orderId}_e5`, order_id: orderId, event_type: "payment",
      payload: { amount: o.quotation_amount, method: "微信" }, operator_name: "前台 小赵",
      created_at: new Date(t + 240 * 60_000).toISOString() });
  return e.reverse();
}

export function getMessages(orderId: string): MessageLog[] {
  const o = orders.find((x) => x.id === orderId);
  if (!o) return [];
  if (!["notified", "waiting_pickup", "completed"].includes(o.status)) return [];
  const t = new Date(o.created_at).getTime();
  return [
    { id: `${orderId}_m1`, order_id: orderId, channel: "whatsapp",
      message_body: `您的设备已维修完成，请您前来取机。工单号：${o.public_no}`,
      status: "read",
      sent_at: new Date(t + 300 * 60_000).toISOString(),
      opened_at: new Date(t + 320 * 60_000).toISOString() },
  ];
}
```

### 8.5 `src/lib/mock/api.ts`

```ts
import {
  customers, devices, getCustomer, getDevice, getEvents, getMessages, getSupplier,
  orders, suppliers, type RepairOrder,
} from "./fixtures";
import type { RepairOrderStatus, RepairOrderType } from "./enums";

export interface OrderListFilters {
  search?: string;
  statuses?: RepairOrderStatus[];
  types?: RepairOrderType[];
  technicians?: string[];
  supplierIds?: string[];
  paid?: "all" | "paid" | "unpaid";
}

export interface OrderListItem extends RepairOrder {
  customer_name: string;
  customer_phone: string;
  device_label: string;
  device_imei: string;
  supplier_name?: string;
  supplier_color?: string;
}

function decorate(o: RepairOrder): OrderListItem {
  const c = getCustomer(o.customer_id);
  const d = getDevice(o.device_id);
  const s = getSupplier(o.supplier_id);
  return {
    ...o,
    customer_name: c?.name ?? "—",
    customer_phone: c?.phone_e164 ?? "",
    device_label: d ? `${d.brand} ${d.model}` : "—",
    device_imei: d?.serial_or_imei ?? "",
    supplier_name: s?.name,
    supplier_color: s?.color,
  };
}

export async function listOrders(filters: OrderListFilters = {}): Promise<OrderListItem[]> {
  let result = orders.map(decorate);
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    result = result.filter((o) =>
      o.public_no.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.toLowerCase().includes(q) ||
      o.device_imei.toLowerCase().includes(q) ||
      o.device_label.toLowerCase().includes(q),
    );
  }
  if (filters.statuses?.length) result = result.filter((o) => filters.statuses!.includes(o.status));
  if (filters.types?.length) result = result.filter((o) => filters.types!.includes(o.order_type));
  if (filters.technicians?.length) result = result.filter((o) => filters.technicians!.includes(o.technician_name));
  if (filters.supplierIds?.length) result = result.filter((o) => o.supplier_id && filters.supplierIds!.includes(o.supplier_id));
  if (filters.paid && filters.paid !== "all")
    result = result.filter((o) => (filters.paid === "paid" ? o.is_paid : !o.is_paid));
  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getOrder(id: string) {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  return {
    order: decorate(o),
    customer: getCustomer(o.customer_id),
    device: getDevice(o.device_id),
    supplier: getSupplier(o.supplier_id),
    events: getEvents(o.id),
    messages: getMessages(o.id),
  };
}

export async function transitionOrder(id: string, to: RepairOrderStatus) {
  const o = orders.find((x) => x.id === id);
  if (o) o.status = to;
  return { ok: true };
}

export async function batchTransition(ids: string[], to: RepairOrderStatus) {
  ids.forEach((id) => { const o = orders.find((x) => x.id === id); if (o) o.status = to; });
  return { ok: true, count: ids.length };
}

export async function createOrder(input: Partial<RepairOrder>) {
  return { id: `ord_new_${Date.now()}`, ...input };
}

export const allTechnicians = Array.from(new Set(orders.map((o) => o.technician_name)));
export { suppliers, customers, devices };
```

### 8.6 `src/components/orders/badges.tsx`

```tsx
import { cn } from "@/lib/utils";
import {
  approvalMeta, orderTypeMeta, statusMeta,
  type ApprovalStatus, type RepairOrderStatus, type RepairOrderType,
} from "@/lib/mock/enums";

type Tone = "neutral" | "info" | "progress" | "warn" | "success" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-status-neutral text-status-neutral-foreground ring-status-neutral-foreground/20",
  info: "bg-status-info text-status-info-foreground ring-status-info-foreground/30",
  progress: "bg-status-progress text-status-progress-foreground ring-status-progress-foreground/30",
  warn: "bg-status-warn text-status-warn-foreground ring-status-warn-foreground/30",
  success: "bg-status-success text-status-success-foreground ring-status-success-foreground/30",
  danger: "bg-status-danger text-status-danger-foreground ring-status-danger-foreground/30",
};

const dotClass: Record<Tone, string> = {
  neutral: "bg-status-neutral-foreground/70",
  info: "bg-status-info-foreground",
  progress: "bg-status-progress-foreground",
  warn: "bg-status-warn-foreground",
  success: "bg-status-success-foreground",
  danger: "bg-status-danger-foreground",
};

const livePulse: Tone[] = ["progress", "warn"];

function Pill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  const live = livePulse.includes(tone);
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
      toneClass[tone], className,
    )}>
      <span className="relative inline-flex size-1.5">
        {live && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", dotClass[tone])} />
        )}
        <span className={cn("relative inline-flex size-1.5 rounded-full", dotClass[tone])} />
      </span>
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: RepairOrderStatus; className?: string }) {
  const m = statusMeta[status];
  return <Pill tone={m.tone} className={className}>{m.label}</Pill>;
}

export function OrderTypeBadge({ type }: { type: RepairOrderType }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border/60 bg-surface-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      {orderTypeMeta[type].label}
    </span>
  );
}

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const m = approvalMeta[status];
  return <Pill tone={m.tone}>{m.label}</Pill>;
}

export function MoneyText({ amount, className }: { amount: number; className?: string }) {
  return <span className={cn("font-mono tabular-nums", className)}>¥{amount.toLocaleString("zh-CN")}</span>;
}

export function PhoneText({ value }: { value: string }) {
  return <span className="font-mono text-xs tabular-nums text-muted-foreground">{value}</span>;
}
```

### 8.7 `src/routes/orders.tsx`（父布局）

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "工单 — RepairDesk" },
      { name: "description", content: "查看、筛选与管理所有维修工单" },
    ],
  }),
  component: () => <Outlet />,
});
```

### 8.8 `src/routes/orders.index.tsx`（列表页 — 727 行）

```tsx
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download, Filter, MoreHorizontal, Printer, Search, SlidersHorizontal, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fadeUp, stagger } from "@/lib/motion";
import { AnimatedNumber } from "@/components/animated-number";

import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import { MoneyText, OrderTypeBadge, PhoneText, StatusBadge } from "@/components/orders/badges";
import { allTechnicians, listOrders, suppliers, type OrderListFilters } from "@/lib/mock/api";
import {
  repairOrderStatus, repairOrderType, statusGroups, statusMeta,
  type RepairOrderStatus,
} from "@/lib/mock/enums";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "工单 — RepairDesk" },
      { name: "description", content: "查看与管理所有维修工单" },
    ],
  }),
  component: OrdersListPage,
});

const tabs: { key: string; label: string; statuses?: RepairOrderStatus[] }[] = [
  { key: "all", label: "全部" },
  { key: "in_progress", label: "进行中", statuses: statusGroups.in_progress },
  { key: "awaiting_approval", label: "待审批", statuses: statusGroups.awaiting_approval },
  { key: "awaiting_pickup", label: "待取机", statuses: statusGroups.awaiting_pickup },
  { key: "completed", label: "已完成", statuses: statusGroups.completed },
  { key: "cancelled", label: "已取消", statuses: statusGroups.cancelled },
];

function FiltersPanel({
  filters, setFilters, onClose,
}: {
  filters: OrderListFilters;
  setFilters: (f: OrderListFilters) => void;
  onClose?: () => void;
}) {
  const toggle = <K extends keyof OrderListFilters>(key: K, value: string) => {
    const arr = (filters[key] as string[] | undefined) ?? [];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    setFilters({ ...filters, [key]: next });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" />
          <span className="text-sm font-semibold">高级筛选</span>
        </div>
        <Button variant="ghost" size="sm"
          onClick={() => setFilters({ search: filters.search })} className="h-7 text-xs">
          重置
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          <FilterGroup label="工单状态">
            <div className="flex flex-wrap gap-1.5">
              {repairOrderStatus.map((s) => {
                const active = filters.statuses?.includes(s);
                return (
                  <button key={s} onClick={() => toggle("statuses", s)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-colors",
                      active ? "border-primary bg-primary/10 text-primary" : "bg-surface hover:bg-accent",
                    )}>
                    {statusMeta[s].label}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup label="工单类型">
            <div className="flex gap-1.5">
              {repairOrderType.map((t) => {
                const active = filters.types?.includes(t);
                return (
                  <button key={t} onClick={() => toggle("types", t)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs",
                      active ? "border-primary bg-primary/10 text-primary" : "bg-surface hover:bg-accent",
                    )}>
                    {t === "quick_repair" ? "快修" : "送修"}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup label="付款状态">
            <div className="flex gap-1.5">
              {(["all", "paid", "unpaid"] as const).map((p) => (
                <button key={p} onClick={() => setFilters({ ...filters, paid: p })}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs",
                    (filters.paid ?? "all") === p ? "border-primary bg-primary/10 text-primary" : "bg-surface hover:bg-accent",
                  )}>
                  {p === "all" ? "全部" : p === "paid" ? "已结清" : "未结清"}
                </button>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="技师">
            <div className="space-y-1.5">
              {allTechnicians.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                  <Checkbox checked={filters.technicians?.includes(t) ?? false}
                    onCheckedChange={() => toggle("technicians", t)} />
                  {t}
                </label>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="外修供应商">
            <div className="space-y-1.5">
              {suppliers.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                  <Checkbox checked={filters.supplierIds?.includes(s.id) ?? false}
                    onCheckedChange={() => toggle("supplierIds", s.id)} />
                  <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                  {s.short_name}
                </label>
              ))}
            </div>
          </FilterGroup>
        </div>
      </ScrollArea>
      {onClose && (
        <div className="border-t p-3">
          <Button className="w-full" onClick={onClose}>应用筛选</Button>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function KpiPill({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="glass-card group relative overflow-hidden px-3 py-2">
      <span aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 size-16 rounded-full opacity-50 blur-2xl transition-opacity group-hover:opacity-80"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }} />
      <div className="relative flex items-center gap-3">
        <span className="size-1.5 rounded-full" style={{ background: accent }} />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{label}</div>
          <div className="font-display text-lg font-semibold tabular-nums leading-none">
            <AnimatedNumber value={value} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function OrdersListPage() {
  const [tab, setTab] = useState("all");
  const [filters, setFilters] = useState<OrderListFilters>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const effectiveFilters = useMemo<OrderListFilters>(() => {
    const tabConf = tabs.find((t) => t.key === tab);
    return {
      ...filters,
      statuses: filters.statuses && filters.statuses.length > 0 ? filters.statuses : tabConf?.statuses,
    };
  }, [filters, tab]);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", effectiveFilters],
    queryFn: () => listOrders(effectiveFilters),
  });

  const allSelected = (data?.length ?? 0) > 0 && selected.length === data?.length;

  const todayCount = (data ?? []).filter(
    (o) => new Date(o.created_at).toDateString() === new Date().toDateString(),
  ).length;
  const inProgressCount = (data ?? []).filter((o) => statusGroups.in_progress.includes(o.status)).length;
  const unpaidCount = (data ?? []).filter((o) => !o.is_paid).length;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-6 lg:px-8">
      {/* Hero */}
      <motion.div variants={stagger(0.05)} initial="hidden" animate="show"
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <motion.div variants={fadeUp}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">工作台 / 工单</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            <span className="gradient-text">工单</span>
            <span className="ml-2 align-middle text-base font-normal text-muted-foreground">
              共 {data?.length ?? 0} 条
            </span>
          </h1>
        </motion.div>
        <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
          <KpiPill label="今日新建" value={todayCount} accent="oklch(0.7 0.2 285)" />
          <KpiPill label="进行中" value={inProgressCount} accent="oklch(0.78 0.16 200)" />
          <KpiPill label="未结清" value={unpaidCount} accent="oklch(0.78 0.18 75)" />
        </motion.div>
      </motion.div>

      {/* Toolbar */}
      <div className="glass-card mb-4 flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="搜索工单号、客户姓名、电话或 IMEI"
              className="h-9 border-border/60 bg-surface/60 pl-8 backdrop-blur transition-all focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_4px_oklch(0.7_0.2_285_/_0.18)]" />
          </div>
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm"
                className="h-9 gap-1.5 border-border/60 bg-surface/60 backdrop-blur">
                <Filter className="size-3.5" /> 筛选
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-sm p-0">
              <SheetHeader className="sr-only"><SheetTitle>筛选</SheetTitle></SheetHeader>
              <FiltersPanel filters={filters} setFilters={setFilters}
                onClose={() => setMobileFiltersOpen(false)} />
            </SheetContent>
          </Sheet>
          <Button variant="outline" size="sm"
            className="hidden h-9 gap-1.5 border-border/60 bg-surface/60 backdrop-blur sm:inline-flex">
            <Download className="size-3.5" /> 导出
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <SegmentedTabs value={tab} onChange={setTab} />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            选中 <span className="text-foreground">{selected.length}</span>
          </span>
        </div>
      </div>

      {/* List */}
      <div className="pb-8">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-14 w-full" />))}
          </div>
        ) : !data?.length ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="mx-auto mt-16 flex max-w-sm flex-col items-center justify-center text-center">
            <div className="mb-4 grid size-16 place-items-center rounded-2xl text-white shadow-[0_8px_28px_-8px_oklch(0.7_0.2_285_/_0.6)]"
              style={{ background: "var(--gradient-brand)" }}>
              <Search className="size-7" />
            </div>
            <h3 className="font-display text-lg font-semibold">暂无符合条件的工单</h3>
            <p className="mt-1 text-sm text-muted-foreground">试试调整搜索词或重置筛选条件。</p>
          </motion.div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="glass-card hidden overflow-hidden md:block">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/40">
                    <th className="w-10 px-4 py-2.5">
                      <Checkbox checked={allSelected}
                        onCheckedChange={(v) => setSelected(v ? data.map((o) => o.id) : [])} />
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium">工单号</th>
                    <th className="px-3 py-2.5 text-left font-medium">客户</th>
                    <th className="px-3 py-2.5 text-left font-medium">设备</th>
                    <th className="px-3 py-2.5 text-left font-medium">故障</th>
                    <th className="px-3 py-2.5 text-left font-medium">状态</th>
                    <th className="px-3 py-2.5 text-right font-medium">报价</th>
                    <th className="px-3 py-2.5 text-left font-medium">技师</th>
                    <th className="px-3 py-2.5 text-left font-medium">创建</th>
                    <th className="w-10 px-3 py-2.5"></th>
                  </tr>
                </thead>
                <motion.tbody variants={stagger(0.025)} initial="hidden" animate="show">
                  {data.map((o) => {
                    const checked = selected.includes(o.id);
                    return (
                      <motion.tr key={o.id} variants={fadeUp}
                        className={cn(
                          "group relative border-b border-border/30 transition-colors hover:bg-accent/30",
                          checked && "bg-accent/40",
                        )}>
                        <td className="relative px-4 py-2.5">
                          <span className={cn(
                            "absolute inset-y-0 left-0 w-[2px] origin-top transition-transform duration-300",
                            checked ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100",
                          )} style={{ background: "var(--gradient-brand)" }} />
                          <Checkbox checked={checked}
                            onCheckedChange={(v) => setSelected((prev) =>
                              v ? [...prev, o.id] : prev.filter((x) => x !== o.id),
                            )} />
                        </td>
                        <td className="px-3 py-2.5">
                          <Link to="/orders/$id" params={{ id: o.id }}
                            className="font-mono text-xs font-medium text-primary hover:underline">
                            {o.public_no}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1">
                            <OrderTypeBadge type={o.order_type} />
                            {o.internal_tag && (
                              <span className="rounded border border-status-warn-foreground/20 bg-status-warn px-1 py-0.5 text-[10px] text-status-warn-foreground">
                                {o.internal_tag}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{o.customer_name}</div>
                          <PhoneText value={o.customer_phone} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div>{o.device_label}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {o.device_imei.slice(-8)}
                          </div>
                        </td>
                        <td className="max-w-[260px] truncate px-3 py-2.5 text-muted-foreground">
                          {o.issue_description}
                        </td>
                        <td className="px-3 py-2.5"><StatusBadge status={o.status} /></td>
                        <td className="px-3 py-2.5 text-right">
                          <MoneyText amount={o.quotation_amount} />
                          <div className="text-[11px] text-muted-foreground">
                            {o.is_paid ? "已结清" : "未结清"}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{o.technician_name}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("zh-CN")}
                        </td>
                        <td className="px-3 py-2.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to="/orders/$id" params={{ id: o.id }}>查看详情</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast("打印工单 " + o.public_no)}>打印</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toast("发送通知 " + o.public_no)}>发送通知</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">删除</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <motion.div variants={stagger(0.04)} initial="hidden" animate="show"
              className="space-y-2 md:hidden">
              {data.map((o) => (
                <motion.div key={o.id} variants={fadeUp}>
                  <Link to="/orders/$id" params={{ id: o.id }}
                    className="glass-card group relative block overflow-hidden p-3 transition-transform active:scale-[0.99]">
                    <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]"
                      style={{ background: "var(--gradient-brand)" }} />
                    <div className="flex items-start justify-between gap-2 pl-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-medium text-primary">{o.public_no}</span>
                          <OrderTypeBadge type={o.order_type} />
                        </div>
                        <div className="mt-1 truncate text-sm font-medium">
                          {o.customer_name}
                          <span className="ml-1.5 text-xs text-muted-foreground">· {o.device_label}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <PhoneText value={o.customer_phone} />
                        </div>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="mt-2 line-clamp-1 pl-2 text-xs text-muted-foreground">
                      {o.issue_description}
                    </div>
                    <div className="mt-2 flex items-center justify-between pl-2 text-xs">
                      <span className="text-muted-foreground">
                        {o.technician_name} · {new Date(o.created_at).toLocaleDateString("zh-CN")}
                      </span>
                      <MoneyText amount={o.quotation_amount} className="font-semibold" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-none fixed bottom-20 left-0 right-0 z-30 flex justify-center px-3 md:bottom-6">
            <div className="glass-strong pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 shadow-elevated">
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setSelected([])}>
                <X className="size-4" />
              </Button>
              <span className="text-sm font-medium">
                已选 <span className="gradient-text font-semibold">{selected.length}</span> 条
              </span>
              <Separator orientation="vertical" className="h-5" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">批量流转状态</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>选择目标状态</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {repairOrderStatus.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => {
                      toast.success(`已将 ${selected.length} 条工单流转为「${statusMeta[s].label}」`);
                      setSelected([]);
                    }}>
                      {statusMeta[s].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Printer className="size-3.5" /> 打印
              </Button>
              <Button size="sm" className="border-0 text-white" style={{ background: "var(--gradient-brand)" }}>
                发送通知
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SegmentedTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 overflow-x-auto rounded-lg border border-border/60 bg-surface/60 p-1 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            className={cn(
              "relative whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}>
            {active && (
              <motion.span layoutId="orders-tab-indicator"
                className="absolute inset-0 -z-10 rounded-md"
                style={{
                  background: "linear-gradient(120deg, oklch(0.7 0.2 285 / 0.25), oklch(0.78 0.16 200 / 0.18))",
                  boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.08)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }} />
            )}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
```

### 8.9 `src/routes/orders.$id.tsx`（详情页 — 609 行）

```tsx
import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowLeft, Bell, CheckCircle2, ChevronRight, CreditCard, MessageCircle,
  MoreHorizontal, Package, Pencil, Phone, Printer, Send, Signature, Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import {
  ApprovalBadge, MoneyText, OrderTypeBadge, PhoneText, StatusBadge,
} from "@/components/orders/badges";
import { getOrder } from "@/lib/mock/api";
import { repairOrderStatus, statusMeta } from "@/lib/mock/enums";
import { fadeUp, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `工单 ${params.id} — RepairDesk` },
      { name: "description", content: "工单详情、报价、时间线与通知" },
    ],
  }),
  component: OrderDetailPage,
});

const tabs = [
  { key: "overview", label: "概览" },
  { key: "timeline", label: "时间线" },
  { key: "messages", label: "通知" },
  { key: "attachments", label: "附件" },
  { key: "inventory", label: "库存关联" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function OrderDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");
  const { scrollY } = useScroll();
  const heroPad = useTransform(scrollY, [0, 120], [24, 10]);
  const heroTitleScale = useTransform(scrollY, [0, 120], [1, 0.86]);
  const subtitleOpacity = useTransform(scrollY, [0, 80], [1, 0]);

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
  });

  if (isLoading || !data) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">加载中…</div>;
  }
  const { order, customer, device, supplier, events, messages } = data;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-4 md:px-6">
      {/* Hero (sticky, scroll-collapse) */}
      <motion.div style={{ paddingTop: heroPad, paddingBottom: heroPad }}
        className="glass-card sticky top-[64px] z-20 mb-6 px-5 md:top-[64px]">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-1.5 text-xs">
            <Link to="/orders"><ArrowLeft className="size-3.5" /> 返回列表</Link>
          </Button>
          <span className="opacity-50">/</span>
          <span>工单详情</span>
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <motion.div style={{ scale: heroTitleScale, originX: 0 }} className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-2xl font-semibold tracking-tight gradient-text md:text-3xl">
                {order.public_no}
              </span>
              <StatusBadge status={order.status} />
              <OrderTypeBadge type={order.order_type} />
              {order.original_order_id && (
                <Link to="/orders/$id" params={{ id: order.original_order_id }}
                  className="inline-flex items-center gap-1 rounded border bg-status-warn px-1.5 py-0.5 text-xs text-status-warn-foreground hover:underline">
                  <Wrench className="size-3" /> 返修来源
                </Link>
              )}
            </div>
            <motion.div style={{ opacity: subtitleOpacity }}
              className="mt-1 truncate text-sm text-muted-foreground">
              {device?.brand} {device?.model} · {customer?.name} · 技师 {order.technician_name}
            </motion.div>
          </motion.div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">总报价</div>
              <MoneyText amount={order.quotation_amount}
                className="font-display text-xl font-semibold" />
            </div>
          </div>
        </div>

        {/* Action chips */}
        <div className="-mx-5 mt-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-8 gap-1.5 border-0 text-white"
                  style={{ background: "var(--gradient-brand)" }}>
                  流转状态 <ChevronRight className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>选择目标状态</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {repairOrderStatus.map((s) => (
                  <DropdownMenuItem key={s} disabled={s === order.status}
                    onClick={() => {
                      toast.success(`已流转为「${statusMeta[s].label}」`);
                      router.invalidate();
                    }}>
                    {statusMeta[s].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" className="h-8 gap-1.5"><Bell className="size-3.5" /> 通知客户</Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5"><CreditCard className="size-3.5" /> 收款</Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5"><Printer className="size-3.5" /> 打印</Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5"><Package className="size-3.5" /> 转库存</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 size-8 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>取消工单</DropdownMenuItem>
                <DropdownMenuItem>复制链接</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">删除</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>

      {/* Segmented Tabs */}
      <div className="mb-4 -mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-surface/60 p-1 backdrop-blur">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}>
                {active && (
                  <motion.span layoutId="order-tab-indicator"
                    className="absolute inset-0 -z-10 rounded-md"
                    style={{
                      background: "linear-gradient(120deg, oklch(0.7 0.2 285 / 0.25), oklch(0.78 0.16 200 / 0.18))",
                      boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.08)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                )}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} variants={stagger(0.05)} initial="hidden" animate="show"
          exit={{ opacity: 0, y: -4 }} className="space-y-4">

          {tab === "overview" && (<>
            <motion.div variants={fadeUp}>
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">客户与设备</h3>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                    <Pencil className="size-3" /> 编辑
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">客户</div>
                    <div className="mt-1 text-sm font-medium">{customer?.name}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="size-3" />
                      <PhoneText value={customer?.phone_e164 ?? ""} />
                    </div>
                    {!!order.contact_phones.length && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {order.contact_phones.map((p) => (
                          <span key={p} className="rounded border bg-surface-muted px-1.5 py-0.5 font-mono text-[11px]">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">设备</div>
                    <div className="mt-1 text-sm font-medium">{device?.brand} {device?.model}</div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">IMEI {device?.serial_or_imei}</div>
                    {device?.device_notes && (
                      <div className="mt-1 text-xs text-muted-foreground">备注：{device.device_notes}</div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeUp}>
              <Card className="p-5">
                <h3 className="mb-3 text-sm font-semibold">故障与诊断</h3>
                <div className="space-y-3 text-sm">
                  <Field label="故障描述">{order.issue_description}</Field>
                  <Field label="诊断结果">
                    {order.diagnosis_result ?? <span className="text-muted-foreground">尚未填写</span>}
                  </Field>
                  <div className="flex flex-wrap gap-4 text-xs">
                    {order.internal_tag && (
                      <Field label="内部标签">
                        <span className="rounded bg-status-warn px-1.5 py-0.5 text-status-warn-foreground">
                          {order.internal_tag}
                        </span>
                      </Field>
                    )}
                    {order.warranty_text && <Field label="质保">{order.warranty_text}</Field>}
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeUp}>
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">报价与财务</h3>
                  <ApprovalBadge status={order.approval_status} />
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-border/40">
                      <th className="py-2 text-left font-medium">项目</th>
                      <th className="py-2 text-right font-medium">金额</th>
                      <th className="py-2 text-left font-medium">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.fault_prices.map((f, i) => (
                      <tr key={i} className="border-b border-border/30 last:border-0">
                        <td className="py-2">{f.name}</td>
                        <td className="py-2 text-right"><MoneyText amount={f.price} /></td>
                        <td className="py-2 text-xs text-muted-foreground">{f.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Separator className="my-3" />
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Field label="总报价">
                    <MoneyText amount={order.quotation_amount} className="font-semibold" />
                  </Field>
                  <Field label="押金"><MoneyText amount={order.deposit_amount} /></Field>
                  <Field label="尾款"><MoneyText amount={order.balance_amount} /></Field>
                  <Field label="结清状态">
                    {order.is_paid ? (
                      <span className="inline-flex items-center gap-1 text-status-success-foreground">
                        <CheckCircle2 className="size-3.5" /> 已结清
                      </span>
                    ) : (<span className="text-muted-foreground">未结清</span>)}
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Send className="size-3.5" /> 发送审批
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <CreditCard className="size-3.5" /> 收款
                  </Button>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeUp}>
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">客户签名</h3>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                    <Signature className="size-3" />
                    {order.customer_signature ? "重新签名" : "请客户签名"}
                  </Button>
                </div>
                <div className={cn(
                  "flex h-32 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground",
                  order.customer_signature && "bg-surface-muted",
                )}>
                  {order.customer_signature ? "签名已采集" : "尚未签名"}
                </div>
              </Card>
            </motion.div>

            <motion.div variants={fadeUp}>
              <Card className="p-5">
                <h3 className="mb-3 text-sm font-semibold">关键信息</h3>
                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  <Row label="创建时间" value={new Date(order.created_at).toLocaleString("zh-CN")} />
                  <Row label="完成时间"
                    value={order.completed_at ? new Date(order.completed_at).toLocaleString("zh-CN") : "—"} />
                  <Row label="交付时间"
                    value={order.delivered_at ? new Date(order.delivered_at).toLocaleString("zh-CN") : "—"} />
                  <Row label="技师" value={order.technician_name} />
                  {supplier && (
                    <Row label="外修供应商" value={
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: supplier.color }} />
                        {supplier.name}
                      </span>
                    } />
                  )}
                  {order.cancel_reason && <Row label="取消原因" value={order.cancel_reason} />}
                </dl>
              </Card>
            </motion.div>
          </>)}

          {tab === "timeline" && (
            <motion.div variants={fadeUp}>
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold">时间线</h3>
                <ol className="relative space-y-5 border-l border-border/60 pl-5">
                  {events.map((e, idx) => (
                    <motion.li key={e.id} variants={fadeUp} className="group relative">
                      <span className="absolute -left-[26px] top-1 grid size-4 place-items-center rounded-full ring-4 ring-background transition-shadow group-hover:shadow-[0_0_0_6px_oklch(0.7_0.2_285_/_0.18)]"
                        style={{ background: idx === 0 ? "var(--gradient-brand)" : "oklch(0.7 0.2 285 / 0.6)" }} />
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("zh-CN")} · {e.operator_name}
                      </div>
                      <div className="text-sm">{renderEvent(e.event_type, e.payload)}</div>
                    </motion.li>
                  ))}
                </ol>
              </Card>
            </motion.div>
          )}

          {tab === "messages" && (
            <motion.div variants={fadeUp}>
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">通知历史</h3>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                    onClick={() => toast.success("已生成 WhatsApp 通知草稿")}>
                    <MessageCircle className="size-3" /> 发送通知
                  </Button>
                </div>
                {messages.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-xs text-muted-foreground">
                    暂无通知记录
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {messages.map((m) => (
                      <li key={m.id} className="rounded-md border bg-surface-muted/40 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{m.channel === "whatsapp" ? "WhatsApp" : "短信"}</span>
                          <span className={cn(
                            "rounded px-1.5 py-0.5 text-[10px]",
                            m.status === "read"
                              ? "bg-status-success text-status-success-foreground"
                              : "bg-status-info text-status-info-foreground",
                          )}>
                            {m.status === "read" ? "已读" : m.status}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{m.message_body}</p>
                        <p className="mt-2 text-[10px] text-muted-foreground/70">
                          {new Date(m.sent_at).toLocaleString("zh-CN")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </motion.div>
          )}

          {tab === "attachments" && (
            <motion.div variants={fadeUp}>
              <Card className="p-8 text-center text-sm text-muted-foreground">附件功能即将上线。</Card>
            </motion.div>
          )}

          {tab === "inventory" && (
            <motion.div variants={fadeUp}>
              <Card className="p-8 text-center text-sm text-muted-foreground">暂无与该工单关联的库存记录。</Card>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-surface-muted/30 px-2 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function renderEvent(type: string, payload: Record<string, unknown>) {
  switch (type) {
    case "created": return "工单创建";
    case "status_changed":
      return `状态变更：${statusMeta[payload.from as keyof typeof statusMeta]?.label ?? payload.from} → ${statusMeta[payload.to as keyof typeof statusMeta]?.label ?? payload.to}`;
    case "quoted": return `提交报价 ¥${payload.amount}`;
    case "approval_result": return `客户审批${payload.result === "approved" ? "通过" : "拒绝"}`;
    case "payment": return `收款 ¥${payload.amount}（${payload.method}）`;
    case "message_sent": return "已发送通知";
    default: return type;
  }
}
```

### 8.10 `src/routes/orders.new.tsx`（新建工单）

```tsx
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { allTechnicians } from "@/lib/mock/api";
import { repairOrderType } from "@/lib/mock/enums";

export const Route = createFileRoute("/orders/new")({
  head: () => ({
    meta: [
      { title: "新建工单 — RepairDesk" },
      { name: "description", content: "录入新工单：客户、设备、故障与报价" },
    ],
  }),
  component: NewOrderPage,
});

function NewOrderPage() {
  const router = useRouter();
  const [type, setType] = useState<string>("quick_repair");

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link to="/orders"><ArrowLeft className="size-4" /> 返回</Link>
        </Button>
        <h1 className="text-lg font-semibold">新建工单</h1>
      </div>

      <form onSubmit={(e) => {
        e.preventDefault();
        toast.success("工单已创建");
        router.navigate({ to: "/orders" });
      }} className="space-y-4">

        <Section title="客户信息">
          <Grid>
            <FormItem label="客户姓名" required><Input placeholder="姓名" required /></FormItem>
            <FormItem label="手机号" required>
              <Input placeholder="+86 138 0000 0000" required className="font-mono" />
            </FormItem>
          </Grid>
        </Section>

        <Section title="设备信息">
          <Grid>
            <FormItem label="品牌" required><Input placeholder="例如 Apple" required /></FormItem>
            <FormItem label="型号" required><Input placeholder="例如 iPhone 15 Pro" required /></FormItem>
            <FormItem label="IMEI / 序列号"><Input placeholder="可选" className="font-mono" /></FormItem>
            <FormItem label="设备备注"><Input placeholder="外观、配件等" /></FormItem>
          </Grid>
        </Section>

        <Section title="故障与服务">
          <FormItem label="工单类型" required>
            <div className="flex gap-2">
              {repairOrderType.map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={"rounded-md border px-3 py-1.5 text-sm transition-colors " +
                    (type === t ? "border-primary bg-primary/10 text-primary" : "bg-surface hover:bg-accent")}>
                  {t === "quick_repair" ? "快修" : "送修"}
                </button>
              ))}
            </div>
          </FormItem>
          <FormItem label="故障描述" required>
            <Textarea required rows={3} placeholder="客户描述的故障现象" />
          </FormItem>
          <Grid>
            <FormItem label="技师">
              <Select>
                <SelectTrigger><SelectValue placeholder="选择技师" /></SelectTrigger>
                <SelectContent>
                  {allTechnicians.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </FormItem>
            <FormItem label="内部标签"><Input placeholder="VIP / 加急 等" /></FormItem>
          </Grid>
        </Section>

        <Section title="报价（可选）">
          <Grid>
            <FormItem label="预估总报价"><Input type="number" placeholder="0" className="font-mono" /></FormItem>
            <FormItem label="押金"><Input type="number" placeholder="0" className="font-mono" /></FormItem>
          </Grid>
        </Section>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background py-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" type="button" asChild><Link to="/orders">取消</Link></Button>
          <Button type="submit">创建工单</Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function FormItem({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
```

---

## 9. UI 设计要点（一眼能抓住的差异化）

### 列表页（`/orders`）

- **Hero**：左上角小字 `工作台 / 工单`（uppercase、letter-spacing 0.2em），下方大标题 `工单`（`gradient-text` + `font-display`）+ 灰色总数；右侧三枚 KPI Pill（今日新建/进行中/未结清），每枚右上角带径向高斯光晕（`oklch` 三色：紫/青/橙），数字用 `AnimatedNumber` 滚动入场。
- **Toolbar**：一张 `glass-card`，内含搜索框（focus 时品牌色 4px 阴影描边）、移动端 Sheet 触发的「筛选」、桌面端「导出」、底部 `SegmentedTabs`（active 用 `layoutId` 滑动指示器，紫→青线性渐变 25%/18% 不透明度）。
- **桌面表格**：10 列，行 hover 变 `bg-accent/30`，hover/选中时左边出现 2px 品牌渐变竖条（`scale-y` 动画）；状态列使用 `StatusBadge`（带 ping 点）；金额列右对齐 `MoneyText` + 结清状态副文字。
- **移动卡片**：`md:hidden`，每张卡片左缘 3px 品牌渐变条；上方为工单号 + 类型徽章 + 状态徽章；中部姓名 · 设备；底部技师 · 日期 · 金额；点击 `active:scale-[0.99]`。
- **批量条**：`AnimatePresence` + spring 弹入，`fixed bottom-20 md:bottom-6`，`glass-strong`，含取消、计数、批量流转 DropdownMenu、打印、品牌渐变「发送通知」按钮。
- **空状态**：64px 品牌渐变圆角方块包 Search 图标 + 标题 + 提示。

### 详情页（`/orders/:id`）

- **Sticky Hero**：`sticky top-[64px]`，绑定 `useScroll`：
  - `paddingTop / paddingBottom`：24 → 10
  - 标题 `scale`：1 → 0.86（origin-x: 0）
  - 副标题（设备 · 客户 · 技师）`opacity`：1 → 0
- 标题区：`gradient-text` 工单号 + `StatusBadge` + `OrderTypeBadge`（+ 返修来源 chip：`bg-status-warn` 内嵌 Wrench 图标，可点回原工单）。
- Action Chips：横向滚动条，第一颗为品牌渐变「流转状态」DropdownMenu，其余 outline。
- **Tabs**：5 颗（概览/时间线/通知/附件/库存关联），同样 `layoutId` 滑动指示器。
- **概览**：5 张 `Card`：
  1. 客户与设备（2 列网格 + 编辑按钮 + 多联系人 chip）
  2. 故障与诊断（Field 行 + 内部标签 + 质保）
  3. 报价与财务（fault_prices 表格 + 4 列汇总 + 发送审批/收款按钮 + 顶部 `ApprovalBadge`）
  4. 客户签名（128 高 dashed 占位 + 「请客户签名/重新签名」按钮）
  5. 关键信息（dl 网格 + Row 行：键值对、灰底）
- **时间线**：左竖线 `border-l`，每节点带 4px 圆点；首节点用品牌渐变，其余半透明紫色；hover 出 12px 品牌色辉光（`shadow-[0_0_0_6px_...]`）。
- **通知历史**：消息列表，`status="read"` 用 `bg-status-success`，否则 `bg-status-info`。
- **附件 / 库存关联**：占位 Card。

### 新建页（`/orders/new`）

- 4 段 `Card`：客户信息 / 设备信息 / 故障与服务（内含「快修/送修」分段按钮 + 故障描述 textarea + 技师 Select + 内部标签）/ 报价（可选，数字输入用等宽字体）。
- 底部 `sticky bottom-0` 操作条：取消（ghost）+ 创建工单（primary）。

---

## 10. 复刻 Checklist（按顺序勾选）

- [ ] **依赖安装**（§1）；shadcn 组件齐全
- [ ] `src/styles.css` 含 §6 所有 Token 与 `glass-card` `glass-strong` `gradient-text` `shadow-elevated` 工具类
- [ ] `tailwind.config` 注册 `font-display`（建议 `Space Grotesk`）
- [ ] 复制 §8.1 `motion.ts`、§8.2 `animated-number.tsx`、§8.3-8.5 mock 三件套、§8.6 `badges.tsx`、§8.7-8.10 四个路由文件
- [ ] `src/routes/__root.tsx` 已挂载 `<QueryClientProvider>` 与 `<Toaster />`（sonner）
- [ ] AppBar 高度 64px，详情页 sticky hero 顶距 `top-[64px]` 对齐
- [ ] 校验：列表 Hero 三枚 KPI 数字滚动入场；Tab 切换有 spring 滑块；批量勾选弹出底部条；详情页向下滚动 Hero 收缩、副标题淡出
- [ ] 暗黑/明亮两模式下，`glass-card`、status 徽章对比度均通过 WCAG AA
- [ ] 严禁出现 `bg-white / text-black / #xxx` 等硬编码颜色

---

复刻完成后界面与本项目 `/orders`、`/orders/new`、`/orders/:id` 1:1 一致。
