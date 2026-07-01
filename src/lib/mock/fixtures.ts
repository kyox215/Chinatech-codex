import {
  repairOrderStatus,
  type ApprovalStatus,
  type RepairOrderStatus,
  type RepairOrderType,
} from "./enums";
import type { CurrencyCode } from "@/lib/money";
import type {
  OrderApprovalFlowStatus,
  OrderExceptionStatus,
  OrderNotifyStatus,
  OrderPartsStatus,
  OrderPaymentStatus,
  OrderWorkflowStatusCode,
} from "@/lib/repairdesk/types";

export interface Customer {
  id: string;
  name: string;
  phone_e164: string;
  phone_raw: string;
  contact_phones: string[];
  consent_marketing: boolean;
  consent_sms: boolean;
  email?: string;
  preferred_channel?: "whatsapp" | "sms";
  language?: "it" | "zh" | "en";
  notes?: string;
  marketing_notes?: string;
  last_contacted_at?: string;
  blacklisted_at?: string;
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
  currency_code?: CurrencyCode;
  note?: string;
}

export interface DeviceSnapshot {
  brand: string;
  model: string;
  serial_or_imei: string;
  device_notes?: string;
}

export interface RepairOrder {
  id: string;
  public_no: string;
  order_type: RepairOrderType;
  status: RepairOrderStatus;
  legacy_status?: RepairOrderStatus;
  workflow_status?: OrderWorkflowStatusCode;
  exception_status?: OrderExceptionStatus;
  payment_status?: OrderPaymentStatus;
  approval_flow_status?: OrderApprovalFlowStatus;
  parts_status?: OrderPartsStatus;
  notify_status?: OrderNotifyStatus;
  customer_id: string;
  device_id: string;
  issue_description: string;
  diagnosis_result?: string;
  quotation_amount: number;
  deposit_amount: number;
  balance_amount: number;
  currency_code: CurrencyCode;
  is_paid: boolean;
  approval_status: ApprovalStatus;
  approval_sent_at?: string;
  approval_confirmed_at?: string;
  technician_name: string;
  internal_tag?: string;
  accessory_notes?: string;
  warranty_text?: string;
  warranty_months?: number;
  warranty_change_reason?: string;
  warranty_changed_by?: string;
  warranty_changed_at?: string;
  completed_at?: string;
  delivered_at?: string;
  pause_reason?: string;
  cancel_reason?: string;
  supplier_id?: string;
  original_order_id?: string;
  contact_phones: string[];
  fault_prices: FaultPriceItem[];
  device_snapshot?: DeviceSnapshot;
  device_unlock_method?: "text" | "pin" | "pattern";
  device_unlock_value?: string;
  device_unlock_pattern?: number[];
  customer_signature?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type:
    | "created"
    | "status_changed"
    | "quoted"
    | "approval_sent"
    | "approval_result"
    | "payment"
    | "note"
    | "message_sent"
    | "delivered";
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

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface CustomerInteraction {
  id: string;
  customer_id: string;
  order_id?: string;
  channel: "whatsapp" | "sms";
  direction: "outbound" | "inbound" | "note";
  message_body: string;
  status: "sent" | "delivered" | "read" | "failed";
  operator_name: string;
  created_at: string;
}

export interface CustomerFollowup {
  id: string;
  customer_id: string;
  order_id?: string;
  title: string;
  note?: string;
  due_at: string;
  owner_name?: string;
  status: "open" | "done" | "cancelled";
  completed_at?: string;
  created_at: string;
  updated_at: string;
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
  "屏幕碎裂，触摸局部失灵",
  "进水开机黑屏",
  "电池续航严重下降，需更换电池",
  "充电口接触不良",
  "后摄无法对焦",
  "听筒无声",
  "Face ID 失效",
  "主板无法开机，疑似电源 IC",
  "扬声器破音",
  "无法识别 SIM 卡",
];

export const suppliers: Supplier[] = [
  { id: "sup_1", name: "华强北维修中心", short_name: "华强北", color: "#6366f1" },
  { id: "sup_2", name: "速达主板维修", short_name: "速达", color: "#10b981" },
  { id: "sup_3", name: "深修苹果服务商", short_name: "深修", color: "#f59e0b" },
];

const customerNames = [
  "张伟",
  "王芳",
  "李娜",
  "刘洋",
  "陈静",
  "杨帆",
  "赵敏",
  "孙磊",
  "周雪",
  "吴桐",
  "郑凯",
  "钱进",
  "冯莉",
  "蒋欣",
  "许文",
  "韩梅",
  "曹杰",
  "邓超",
  "彭程",
  "宋佳",
];

function pad(n: number, width = 4) {
  return n.toString().padStart(width, "0");
}

function rand<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

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
    preferred_channel: "whatsapp",
    language: "it",
    email: i % 4 === 0 ? `cliente${i + 1}@example.com` : undefined,
    notes: i % 6 === 0 ? "VIP客户，优先通知维修进度。" : undefined,
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

export const customerTags: CustomerTag[] = [
  { id: "tag_vip", name: "VIP", color: "#8b5cf6", description: "高价值客户" },
  { id: "tag_repeat", name: "复购", color: "#10b981", description: "多次维修客户" },
  { id: "tag_business", name: "企业", color: "#0ea5e9", description: "企业或批量客户" },
  { id: "tag_price_sensitive", name: "价格敏感", color: "#f59e0b" },
  { id: "tag_followup", name: "需回访", color: "#ef4444" },
];

export const customerTagAssignments = customers.flatMap((customer, index) => {
  const assigned = [customerTags[index % customerTags.length]];
  if (index % 4 === 0 && !assigned.some((tag) => tag.id === customerTags[1].id)) {
    assigned.push(customerTags[1]);
  }
  return assigned.map((tag) => ({ customer_id: customer.id, tag_id: tag.id }));
});

export const customerInteractions: CustomerInteraction[] = customers
  .slice(0, 8)
  .map((customer, index) => ({
    id: `ci_${index + 1}`,
    customer_id: customer.id,
    channel: "whatsapp",
    direction: "outbound",
    message_body: `Gentile ${customer.name}, grazie per aver scelto ChinaTech. Restiamo a disposizione per assistenza.`,
    status: "sent",
    operator_name: "前台",
    created_at: new Date(Date.now() - index * 86_400_000).toISOString(),
  }));

export const customerFollowups: CustomerFollowup[] = customers
  .slice(0, 10)
  .map((customer, index) => {
    const now = Date.now();
    return {
      id: `cf_${index + 1}`,
      customer_id: customer.id,
      title: index % 2 === 0 ? "维修后满意度回访" : "报价确认跟进",
      note: index % 2 === 0 ? "确认设备使用情况和保修说明。" : "提醒客户确认维修报价。",
      due_at: new Date(now + (index - 3) * 86_400_000).toISOString(),
      owner_name: technicians[index % technicians.length],
      status: index % 7 === 0 ? "done" : "open",
      completed_at: index % 7 === 0 ? new Date(now - index * 3_600_000).toISOString() : undefined,
      created_at: new Date(now - index * 86_400_000).toISOString(),
      updated_at: new Date(now - index * 3_600_000).toISOString(),
    };
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
      : [
            "quoted",
            "parts_ordered",
            "parts_arrived",
            "repairing",
            "repaired",
            "notified",
            "waiting_pickup",
            "completed",
          ].includes(status)
        ? "approved"
        : "pending";

  const fault_prices: FaultPriceItem[] = [
    {
      name: "屏幕总成",
      price: Math.round(quotation * 0.7),
      currency_code: "EUR",
      note: "原厂品质",
    },
  ];
  if (i % 2 === 0)
    fault_prices.push({ name: "人工", price: Math.round(quotation * 0.3), currency_code: "EUR" });

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
    currency_code: "EUR",
    is_paid: isPaid,
    approval_status: approval,
    approval_sent_at: approval !== "pending" || status === "waiting_approval" ? created : undefined,
    approval_confirmed_at: approval === "approved" ? created : undefined,
    technician_name: rand(technicians, i),
    internal_tag: i % 5 === 0 ? "VIP" : i % 7 === 0 ? "加急" : undefined,
    accessory_notes: i % 9 === 0 ? "SIM卡托、手机壳" : undefined,
    device_unlock_method: i % 10 === 0 ? "pattern" : i % 6 === 0 ? "pin" : undefined,
    device_unlock_value: i % 6 === 0 && i % 10 !== 0 ? "001258" : undefined,
    device_unlock_pattern: i % 10 === 0 ? [1, 2, 5, 8] : undefined,
    warranty_text: "90天质保",
    completed_at: status === "completed" ? created : undefined,
    delivered_at: status === "completed" && i % 2 === 0 ? created : undefined,
    cancel_reason: status === "cancelled" ? "客户主动取消" : undefined,
    supplier_id: i % 6 === 0 ? suppliers[i % suppliers.length].id : undefined,
    original_order_id: status === "rework" ? `ord_${((i + 5) % 40) + 1}` : undefined,
    contact_phones: customer.contact_phones,
    fault_prices,
    device_snapshot: {
      brand: device.brand,
      model: device.model,
      serial_or_imei: device.serial_or_imei,
      ...(device.device_notes ? { device_notes: device.device_notes } : {}),
    },
    customer_signature: ["completed", "delivered"].includes(status) ? "data:signed" : undefined,
    created_at: created,
    updated_at: created,
  };
});

export function getCustomer(id: string) {
  return customers.find((c) => c.id === id);
}
export function getDevice(id: string) {
  return devices.find((d) => d.id === id);
}
export function getSupplier(id?: string) {
  return id ? suppliers.find((s) => s.id === id) : undefined;
}

export function getEvents(orderId: string): OrderEvent[] {
  const o = orders.find((x) => x.id === orderId);
  if (!o) return [];
  const t = new Date(o.created_at).getTime();
  const e: OrderEvent[] = [
    {
      id: `${orderId}_e1`,
      order_id: orderId,
      event_type: "created",
      payload: { type: o.order_type },
      operator_name: "前台 小赵",
      created_at: new Date(t).toISOString(),
    },
    {
      id: `${orderId}_e2`,
      order_id: orderId,
      event_type: "status_changed",
      payload: { from: "new", to: "diagnosing" },
      operator_name: o.technician_name,
      created_at: new Date(t + 30 * 60_000).toISOString(),
    },
    {
      id: `${orderId}_e3`,
      order_id: orderId,
      event_type: "quoted",
      payload: { amount: o.quotation_amount, currency_code: "EUR" },
      operator_name: o.technician_name,
      created_at: new Date(t + 90 * 60_000).toISOString(),
    },
  ];
  if (o.approval_status === "approved")
    e.push({
      id: `${orderId}_e4`,
      order_id: orderId,
      event_type: "approval_result",
      payload: { result: "approved" },
      operator_name: "客户",
      created_at: new Date(t + 120 * 60_000).toISOString(),
    });
  if (o.is_paid)
    e.push({
      id: `${orderId}_e5`,
      order_id: orderId,
      event_type: "payment",
      payload: { amount: o.quotation_amount, currency_code: "EUR", method: "现金" },
      operator_name: "前台 小赵",
      created_at: new Date(t + 240 * 60_000).toISOString(),
    });
  return e.reverse();
}

export function getMessages(orderId: string): MessageLog[] {
  const o = orders.find((x) => x.id === orderId);
  if (!o) return [];
  if (!["notified", "waiting_pickup", "completed"].includes(o.status)) return [];
  const t = new Date(o.created_at).getTime();
  return [
    {
      id: `${orderId}_m1`,
      order_id: orderId,
      channel: "whatsapp",
      message_body: `您的设备已维修完成，请您前来取机。工单号：${o.public_no}`,
      status: "read",
      sent_at: new Date(t + 300 * 60_000).toISOString(),
      opened_at: new Date(t + 320 * 60_000).toISOString(),
    },
  ];
}
