// Mock API layer — signatures mirror the real Next.js Route Handlers.
// Replace these with fetch() calls when wiring to apps/backoffice.

import {
  customers,
  devices,
  getCustomer,
  getDevice,
  getEvents,
  getMessages,
  getSupplier,
  orders,
  suppliers,
  type Customer,
  type Device,
  type FaultPriceItem,
  type RepairOrder,
} from "./fixtures";
import type { RepairOrderStatus, RepairOrderType } from "./enums";
import {
  getStatusListSortIndex,
  isApprovalOverdue,
  isPickupOverdue,
  validateOrderTransition,
} from "./workflow";

export interface OrderListFilters {
  search?: string;
  statuses?: RepairOrderStatus[];
  types?: RepairOrderType[];
  technicians?: string[];
  supplierIds?: string[];
  paid?: "all" | "paid" | "unpaid";
  /** Show only overdue rows. "any" = either approval or pickup overdue. */
  overdue?: "approval" | "pickup" | "any";
}

export interface OrderListItem extends RepairOrder {
  customer_name: string;
  customer_phone: string;
  device_label: string;
  device_imei: string;
  supplier_name?: string;
  supplier_color?: string;
  approval_overdue: boolean;
  pickup_overdue: boolean;
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
    approval_overdue: isApprovalOverdue(o),
    pickup_overdue: isPickupOverdue(o),
  };
}

// GET /api/orders
export async function listOrders(filters: OrderListFilters = {}): Promise<OrderListItem[]> {
  let result = orders.map(decorate);
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (o) =>
        o.public_no.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q) ||
        o.device_imei.toLowerCase().includes(q) ||
        o.device_label.toLowerCase().includes(q),
    );
  }
  if (filters.statuses?.length) {
    result = result.filter((o) => filters.statuses!.includes(o.status));
  }
  if (filters.types?.length) {
    result = result.filter((o) => filters.types!.includes(o.order_type));
  }
  if (filters.technicians?.length) {
    result = result.filter((o) => filters.technicians!.includes(o.technician_name));
  }
  if (filters.supplierIds?.length) {
    result = result.filter((o) => o.supplier_id && filters.supplierIds!.includes(o.supplier_id));
  }
  if (filters.paid && filters.paid !== "all") {
    result = result.filter((o) => (filters.paid === "paid" ? o.is_paid : !o.is_paid));
  }
  if (filters.overdue) {
    result = result.filter((o) =>
      filters.overdue === "approval"
        ? o.approval_overdue
        : filters.overdue === "pickup"
          ? o.pickup_overdue
          : o.approval_overdue || o.pickup_overdue,
    );
  }
  // Workflow-first sort, then updated_at desc.
  return result.sort((a, b) => {
    const d = getStatusListSortIndex(a.status) - getStatusListSortIndex(b.status);
    if (d !== 0) return d;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

// Used to compute KPIs without re-running filters on the same dataset.
export async function getOrderStats() {
  return {
    total: orders.length,
    today: orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString())
      .length,
    inProgress: orders.filter((o) =>
      [
        "new",
        "rework",
        "mail_in_progress",
        "diagnosing",
        "quoted",
        "parts_ordered",
        "parts_arrived",
        "repairing",
      ].includes(o.status),
    ).length,
    unpaid: orders.filter((o) => !o.is_paid).length,
    approvalOverdue: orders.filter(isApprovalOverdue).length,
    pickupOverdue: orders.filter(isPickupOverdue).length,
  };
}

// GET /api/orders/[id]
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

// POST /api/orders/[id]/transition
export async function transitionOrder(
  id: string,
  to: RepairOrderStatus,
  opts: { reason?: string; operator?: string } = {},
) {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  const v = validateOrderTransition(o.status, to);
  if (!v.ok) throw new Error(v.reason ?? "状态流转不合法");
  const from = o.status;
  o.status = to;
  o.updated_at = new Date().toISOString();
  if (to === "cancelled" && opts.reason) o.cancel_reason = opts.reason;
  if (to === "completed") o.completed_at = o.updated_at;
  if (to === "waiting_approval") o.approval_sent_at = o.updated_at;
  return { ok: true, from, to };
}

// POST /api/orders/batch-transition
export async function batchTransition(ids: string[], to: RepairOrderStatus) {
  let count = 0;
  const failures: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      await transitionOrder(id, to);
      count++;
    } catch (e) {
      failures.push({ id, reason: (e as Error).message });
    }
  }
  return { ok: failures.length === 0, count, failures };
}

// POST /api/orders/[id]/payment
export async function recordPayment(id: string, amount: number) {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  o.balance_amount = Math.max(0, o.balance_amount - amount);
  if (o.balance_amount === 0) o.is_paid = true;
  o.updated_at = new Date().toISOString();
  return { ok: true, balance: o.balance_amount, is_paid: o.is_paid };
}

// POST /api/orders/[id]/notify
export async function sendNotification(
  id: string,
  body: string,
  channel: "whatsapp" | "sms" = "whatsapp",
) {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new Error("工单不存在");
  o.updated_at = new Date().toISOString();
  return { ok: true, id: `msg_${Date.now()}`, channel, body };
}

// GET /api/customers/suggest?q=
export async function searchCustomers(q: string, limit = 6): Promise<Customer[]> {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return customers
    .filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.phone_e164.toLowerCase().includes(s) ||
        c.phone_raw.includes(s),
    )
    .slice(0, limit);
}

export async function getCustomerDevices(customerId: string): Promise<Device[]> {
  return devices.filter((d) => d.customer_id === customerId);
}

// POST /api/orders — appends to the in-memory store so the new order shows up
// immediately on the list / detail pages without a backend.
export interface CreateOrderInput {
  // existing customer
  customer_id?: string;
  device_id?: string;
  // or new customer/device — ignored if customer_id is supplied
  customer_name?: string;
  customer_phone?: string;
  device_brand?: string;
  device_model?: string;
  device_imei?: string;
  device_notes?: string;
  // order fields
  order_type: RepairOrderType;
  status: RepairOrderStatus;
  issue_description: string;
  technician_name: string;
  internal_tag?: string;
  fault_prices: FaultPriceItem[];
  deposit_amount?: number;
}

export async function createOrder(input: CreateOrderInput): Promise<{ id: string }> {
  let customer = input.customer_id ? getCustomer(input.customer_id) : undefined;
  if (!customer) {
    customer = {
      id: `cus_new_${Date.now()}`,
      name: input.customer_name ?? "未命名客户",
      phone_raw: (input.customer_phone ?? "").replace(/\D/g, ""),
      phone_e164: input.customer_phone ?? "",
      contact_phones: [],
      consent_marketing: false,
      consent_sms: true,
    };
    customers.push(customer);
  }
  let device = input.device_id ? getDevice(input.device_id) : undefined;
  if (!device) {
    device = {
      id: `dev_new_${Date.now()}`,
      customer_id: customer.id,
      brand: input.device_brand ?? "—",
      model: input.device_model ?? "—",
      serial_or_imei: input.device_imei ?? "",
      device_notes: input.device_notes,
    };
    devices.push(device);
  }
  const quotation = input.fault_prices.reduce((s, f) => s + (f.price || 0), 0);
  const deposit = input.deposit_amount ?? 0;
  const id = `ord_new_${Date.now()}`;
  const seq = orders.length + 1;
  const now = new Date().toISOString();
  const newOrder: RepairOrder = {
    id,
    public_no: `R${(2026000 + seq).toString().padStart(7, "0")}`,
    order_type: input.order_type,
    status: input.status,
    customer_id: customer.id,
    device_id: device.id,
    issue_description: input.issue_description,
    quotation_amount: quotation,
    deposit_amount: deposit,
    balance_amount: Math.max(0, quotation - deposit),
    is_paid: false,
    approval_status: "pending",
    technician_name: input.technician_name,
    internal_tag: input.internal_tag,
    warranty_text: "90天质保",
    contact_phones: customer.contact_phones,
    fault_prices: input.fault_prices,
    created_at: now,
    updated_at: now,
  };
  orders.unshift(newOrder);
  return { id };
}

export const allTechnicians = Array.from(new Set(orders.map((o) => o.technician_name)));
export { suppliers, customers, devices };
