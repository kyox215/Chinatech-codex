import { CURRENCY_CODE } from "@/lib/money";
import type { OrderListItem } from "@/lib/repairdesk/types";
import { primaryPhoneRaw } from "@/shared/lib/phone";

import {
  customers,
  customerFollowups,
  customerInteractions,
  customerTagAssignments,
  customerTags,
  devices,
  getCustomer,
  getDevice,
  getEvents,
  getMessages,
  getSupplier,
  orders,
  suppliers,
  type CustomerFollowup,
  type CustomerInteraction,
  type MessageLog,
  type OrderEvent,
  type RepairOrder,
} from "./fixtures";
import { isApprovalOverdue, isPickupOverdue } from "./workflow";

export {
  customers,
  customerFollowups,
  customerInteractions,
  customerTagAssignments,
  customerTags,
  devices,
  getCustomer,
  getDevice,
  getEvents,
  getMessages,
  getSupplier,
  orders,
  suppliers,
};

export const extraEvents: OrderEvent[] = [];
export const extraMessages: MessageLog[] = [];
export const extraCustomerInteractions: CustomerInteraction[] = [];
export const extraCustomerFollowups: CustomerFollowup[] = [];
export const dynamicTagAssignments: { customer_id: string; tag_id: string }[] = [];
export const tagOverrides = new Set<string>();

export function phoneRaw(value: string) {
  return primaryPhoneRaw(value);
}

export function decorate(order: RepairOrder): OrderListItem {
  const customer = getCustomer(order.customer_id);
  const device = getDevice(order.device_id);
  const supplier = getSupplier(order.supplier_id);
  const snapshot = order.device_snapshot;
  const deviceLabel = snapshot
    ? `${snapshot.brand} ${snapshot.model}`.trim()
    : device
      ? `${device.brand} ${device.model}`
      : "—";
  return {
    ...order,
    customer_name: customer?.name ?? "—",
    customer_phone: customer?.phone_e164 ?? "",
    device_label: deviceLabel || "—",
    device_imei: snapshot?.serial_or_imei ?? device?.serial_or_imei ?? "",
    supplier_name: supplier?.name,
    supplier_color: supplier?.color,
    currency_code: order.currency_code ?? CURRENCY_CODE,
    approval_overdue: isApprovalOverdue(order),
    pickup_overdue: isPickupOverdue(order),
  };
}

export const allTechnicians = Array.from(new Set(orders.map((order) => order.technician_name)));
