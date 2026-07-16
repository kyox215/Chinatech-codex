import type { CustomerDetail, Device, OrderListItem } from "@/lib/repairdesk/api";

import {
  isCustomerOrderBillable,
  isCustomerOrderCancelled,
  isCustomerOrderClosed,
} from "./customer-order-state";

export type CustomerOrderWorkbenchState = "active" | "unpaid" | "settled" | "closed";

export interface CustomerPaymentSummary {
  totalQuoted: number;
  depositTotal: number;
  unpaidAmount: number;
  settledOrderCount: number;
  unpaidOrderCount: number;
  financeRedacted?: boolean;
}

export interface CustomerOrderWorkbenchItem {
  order: OrderListItem;
  device?: Device;
  deviceLabel: string;
  deviceImei: string;
  state: CustomerOrderWorkbenchState;
  financeRedacted: boolean;
}

export interface CustomerDeviceWorkbenchItem {
  device: Device;
  orderItems: CustomerOrderWorkbenchItem[];
  historyPreviewItems: CustomerOrderWorkbenchItem[];
  latestOrder?: CustomerOrderWorkbenchItem;
  repairCount: number;
  activeOrderCount: number;
  totalQuoted: number;
  unpaidAmount: number;
  financeRedacted: boolean;
  warrantyLabel: string;
  canDelete: boolean;
  deleteBlockedReason?: string;
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

export function buildCustomerDeviceWorkbenchItems(
  data: CustomerDetail,
): CustomerDeviceWorkbenchItem[] {
  const orderItems = buildCustomerOrderWorkbenchItems(data);
  const financeRedacted = Boolean(data.stats.finance_redacted);

  return data.devices.map((device) => {
    const linkedOrders = orderItems.filter((item) => item.order.device_id === device.id);
    const billableOrders = linkedOrders.filter((item) => isCustomerOrderBillable(item.order));
    const latestClosedOrder = linkedOrders.find(
      (item) => isCustomerOrderClosed(item.order) && isCustomerOrderBillable(item.order),
    );

    return {
      device,
      orderItems: linkedOrders,
      historyPreviewItems: linkedOrders.slice(0, 4),
      latestOrder: linkedOrders[0],
      repairCount: billableOrders.length,
      activeOrderCount: linkedOrders.filter((item) => item.state === "active").length,
      totalQuoted: billableOrders.reduce(
        (sum, item) => sum + safeAmount(item.order.quotation_amount),
        0,
      ),
      unpaidAmount: billableOrders.reduce(
        (sum, item) => sum + safeAmount(item.order.balance_amount),
        0,
      ),
      financeRedacted: financeRedacted || linkedOrders.some((item) => item.order.finance_redacted),
      warrantyLabel: warrantyLabelFromOrder(latestClosedOrder?.order),
      canDelete: linkedOrders.length === 0,
      deleteBlockedReason: linkedOrders.length
        ? "已有历史工单，设备档案需要保留用于维修记录追踪"
        : undefined,
    };
  });
}

export function buildCustomerWorkbenchSummary(data: CustomerDetail): CustomerWorkbenchSummary {
  const orderItems = buildCustomerOrderWorkbenchItems(data);
  const payment = buildCustomerPaymentSummary(data.orders, data.stats.finance_redacted);
  return {
    orderItems,
    payment,
    activeOrders: orderItems.filter((item) => item.state === "active"),
    unpaidOrders: payment.financeRedacted
      ? []
      : orderItems.filter(
          (item) =>
            isCustomerOrderBillable(item.order) && safeAmount(item.order.balance_amount) > 0,
        ),
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
  const financeRedacted = Boolean(data.stats.finance_redacted);
  return [...data.orders]
    .sort((a, b) => orderTime(b) - orderTime(a))
    .map((order) => {
      const device = deviceById.get(order.device_id);
      return {
        order,
        device,
        deviceLabel: device ? `${device.brand} ${device.model}` : order.device_label,
        deviceImei: device?.serial_or_imei || order.device_imei || "",
        state: getCustomerOrderWorkbenchState(order, financeRedacted),
        financeRedacted,
      };
    });
}

export function buildCustomerPaymentSummary(
  orders: OrderListItem[],
  financeRedacted = false,
): CustomerPaymentSummary {
  if (financeRedacted) {
    return {
      totalQuoted: 0,
      depositTotal: 0,
      unpaidAmount: 0,
      settledOrderCount: 0,
      unpaidOrderCount: 0,
      financeRedacted: true,
    };
  }
  return orders.reduce<CustomerPaymentSummary>(
    (summary, order) => {
      if (!isCustomerOrderBillable(order)) return summary;
      if (order.finance_redacted) return summary;

      const unpaid = safeAmount(order.balance_amount);
      return {
        totalQuoted: summary.totalQuoted + safeAmount(order.quotation_amount),
        depositTotal: summary.depositTotal + safeAmount(order.deposit_amount),
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
  order: Pick<
    OrderListItem,
    | "status"
    | "balance_amount"
    | "workflow_status"
    | "workflow_bucket"
    | "exception_status"
    | "record_state"
    | "deleted_at"
  >,
  financeRedacted = false,
): CustomerOrderWorkbenchState {
  if (isCustomerOrderCancelled(order)) return "closed";
  if (!isCustomerOrderClosed(order)) return "active";
  if (financeRedacted) return "closed";
  if (safeAmount(order.balance_amount) > 0) return "unpaid";
  return "settled";
}

function orderTime(order: Pick<OrderListItem, "updated_at" | "created_at">) {
  return new Date(order.updated_at || order.created_at || 0).getTime();
}

function safeAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function warrantyLabelFromOrder(order?: OrderListItem) {
  if (!order) return "暂无售后记录";
  const warrantyText = order.warranty_text?.trim();
  if (warrantyText) return warrantyText;
  if (typeof order.warranty_months === "number") {
    return order.warranty_months > 0 ? `${order.warranty_months}个月售后` : "无售后";
  }
  return "售后未设置";
}
