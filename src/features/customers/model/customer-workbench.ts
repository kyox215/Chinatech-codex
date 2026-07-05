import type { CustomerDetail, Device, OrderListItem } from "@/lib/repairdesk/api";

import { isCustomerOrderBillable, isCustomerOrderClosed } from "./customer-order-state";

export type CustomerOrderWorkbenchState = "active" | "unpaid" | "settled" | "closed";

export interface CustomerPaymentSummary {
  totalQuoted: number;
  depositTotal: number;
  unpaidAmount: number;
  settledOrderCount: number;
  unpaidOrderCount: number;
}

export interface CustomerOrderWorkbenchItem {
  order: OrderListItem;
  device?: Device;
  deviceLabel: string;
  deviceImei: string;
  state: CustomerOrderWorkbenchState;
}

export interface CustomerWorkbenchSummary {
  orderItems: CustomerOrderWorkbenchItem[];
  payment: CustomerPaymentSummary;
  activeOrders: CustomerOrderWorkbenchItem[];
  unpaidOrders: CustomerOrderWorkbenchItem[];
  latestOrder?: CustomerOrderWorkbenchItem;
  openFollowupCount: number;
  contactSummary: {
    primaryPhone: string;
    backupPhoneCount: number;
    channel: "WhatsApp" | "SMS";
    language: "中文" | "English" | "Italiano";
    lastContactedAt?: string;
  };
}

export function buildCustomerWorkbenchSummary(data: CustomerDetail): CustomerWorkbenchSummary {
  const orderItems = buildCustomerOrderWorkbenchItems(data);
  const payment = buildCustomerPaymentSummary(data.orders);
  return {
    orderItems,
    payment,
    activeOrders: orderItems.filter((item) => item.state === "active"),
    unpaidOrders: orderItems.filter((item) => item.order.balance_amount > 0),
    latestOrder: orderItems[0],
    openFollowupCount: data.followups.filter((followup) => followup.status === "open").length,
    contactSummary: {
      primaryPhone: data.customer.phone_e164,
      backupPhoneCount: data.customer.contact_phones.length,
      channel: data.customer.preferred_channel === "sms" ? "SMS" : "WhatsApp",
      language:
        data.customer.language === "zh"
          ? "中文"
          : data.customer.language === "en"
            ? "English"
            : "Italiano",
      lastContactedAt: data.customer.last_contacted_at,
    },
  };
}

export function buildCustomerOrderWorkbenchItems(
  data: CustomerDetail,
): CustomerOrderWorkbenchItem[] {
  const deviceById = new Map(data.devices.map((device) => [device.id, device]));
  return [...data.orders]
    .sort((a, b) => orderTime(b) - orderTime(a))
    .map((order) => {
      const device = deviceById.get(order.device_id);
      return {
        order,
        device,
        deviceLabel: device ? `${device.brand} ${device.model}` : order.device_label,
        deviceImei: device?.serial_or_imei || order.device_imei || "",
        state: getCustomerOrderWorkbenchState(order),
      };
    });
}

export function buildCustomerPaymentSummary(orders: OrderListItem[]): CustomerPaymentSummary {
  return orders.reduce<CustomerPaymentSummary>(
    (summary, order) => {
      if (!isCustomerOrderBillable(order)) return summary;

      const unpaid = Math.max(0, order.balance_amount);
      return {
        totalQuoted: summary.totalQuoted + Math.max(0, order.quotation_amount),
        depositTotal: summary.depositTotal + Math.max(0, order.deposit_amount),
        unpaidAmount: summary.unpaidAmount + unpaid,
        settledOrderCount: summary.settledOrderCount + (unpaid <= 0 ? 1 : 0),
        unpaidOrderCount: summary.unpaidOrderCount + (unpaid > 0 ? 1 : 0),
      };
    },
    {
      totalQuoted: 0,
      depositTotal: 0,
      unpaidAmount: 0,
      settledOrderCount: 0,
      unpaidOrderCount: 0,
    },
  );
}

export function getCustomerOrderWorkbenchState(
  order: Pick<OrderListItem, "status" | "balance_amount" | "workflow_status" | "exception_status">,
): CustomerOrderWorkbenchState {
  if (!isCustomerOrderClosed(order)) return "active";
  if (order.balance_amount > 0) return "unpaid";
  return order.status === "cancelled" || order.exception_status === "cancelled"
    ? "closed"
    : "settled";
}

function orderTime(order: Pick<OrderListItem, "updated_at" | "created_at">) {
  return new Date(order.updated_at || order.created_at || 0).getTime();
}
