import type { CustomerDetail, Device, OrderListItem } from "@/lib/repairdesk/api";
import {
  deriveOrderFinancialState,
  type OrderFinancialState,
} from "@/features/orders/model/order-payment-state";
import { APP_TIME_ZONE, type AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

import {
  isCustomerOrderBillable,
  isCustomerOrderCancelled,
  isCustomerOrderClosed,
} from "./customer-order-state";

export type CustomerOrderWorkbenchState = "active" | "unpaid" | "settled" | "closed";

export function formatCustomerWorkbenchDate(value: string, locale: AppLocale = "zh-CN") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    return translateMessage(locale, "customers.dateUnavailable");
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

export interface CustomerPaymentSummary {
  totalQuoted: number;
  depositTotal: number;
  unpaidAmount: number;
  settledOrderCount: number;
  unpaidOrderCount: number;
  pendingQuoteCount: number;
  financeReviewCount: number;
  financeRedacted?: boolean;
}

export interface CustomerOrderWorkbenchItem {
  order: OrderListItem;
  device?: Device;
  deviceLabel: string;
  deviceImei: string;
  state: CustomerOrderWorkbenchState;
  financialState: OrderFinancialState;
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
  warranty: CustomerWarrantyFact;
  warrantyLabel: string;
  canDelete: boolean;
  deleteBlockedReasonKind?: "has_order_history";
  deleteBlockedReason?: string;
}

export type CustomerWarrantyFact =
  | { kind: "none" }
  | { kind: "custom"; value: string }
  | { kind: "months"; count: number }
  | { kind: "no_coverage" }
  | { kind: "unset" };

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
    channelKind: "whatsapp" | "sms";
    channel: "WhatsApp" | "SMS";
    languageKind: "zh" | "en" | "it";
    language: "中文" | "English" | "Italiano";
    lastContactedAt?: string;
  };
}

export type CustomerCurrentItemTone = "info" | "warn" | "danger" | "success";

export interface CustomerCurrentItem {
  id: string;
  kind: "overdue_followup" | "followup" | "pickup" | "active_order" | "unpaid";
  tone: CustomerCurrentItemTone;
  titleKind: "overdue_followup" | "followup" | "notify" | "pickup" | "active_order" | "unpaid";
  title: string;
  description: string;
  actionKind: "view_order" | "view_followup" | "notify" | "deliver";
  actionLabel: string;
  orderId?: string;
  followupId?: string;
  dueAt?: string;
  sortTime: number;
  priority: number;
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

    const warranty = warrantyFactFromOrder(latestClosedOrder?.order);
    return {
      device,
      orderItems: linkedOrders,
      historyPreviewItems: linkedOrders.slice(0, 4),
      latestOrder: linkedOrders[0],
      repairCount: billableOrders.length,
      activeOrderCount: linkedOrders.filter((item) => item.state === "active").length,
      totalQuoted: sumMoney(billableOrders.map((item) => item.order.quotation_amount)),
      unpaidAmount: sumMoney(
        billableOrders.flatMap((item) =>
          item.financialState.collectible ? [item.order.balance_amount] : [],
        ),
      ),
      financeRedacted: financeRedacted || linkedOrders.some((item) => item.order.finance_redacted),
      warranty,
      warrantyLabel: warrantyLabelFromFact(warranty),
      canDelete: linkedOrders.length === 0,
      deleteBlockedReasonKind: linkedOrders.length ? "has_order_history" : undefined,
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
      : orderItems.filter((item) => item.financialState.collectible),
    latestOrder: orderItems[0],
    openFollowupCount: data.followups.filter((followup) => followup.status === "open").length,
    contactSummary: {
      primaryPhone: data.customer.phone_e164,
      backupPhoneCount: data.customer.contact_phones.length,
      channelKind: data.customer.preferred_channel === "sms" ? "sms" : "whatsapp",
      channel: data.customer.preferred_channel === "sms" ? "SMS" : "WhatsApp",
      languageKind:
        data.customer.language === "zh" ? "zh" : data.customer.language === "en" ? "en" : "it",
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

export function buildCustomerCurrentItems(
  data: CustomerDetail,
  now: Date = new Date(),
): CustomerCurrentItem[] {
  const orderItems = buildCustomerOrderWorkbenchItems(data);
  const items: CustomerCurrentItem[] = [];
  const nowTime = now.getTime();

  data.followups
    .filter((followup) => followup.status === "open")
    .forEach((followup) => {
      const dueTime = new Date(followup.due_at).getTime();
      const overdue = Number.isFinite(dueTime) && dueTime < nowTime;
      items.push({
        id: `followup:${followup.id}`,
        kind: overdue ? "overdue_followup" : "followup",
        tone: overdue ? "danger" : "warn",
        titleKind: overdue ? "overdue_followup" : "followup",
        title: overdue ? "逾期待办" : "待处理待办",
        description: followup.title,
        actionKind: followup.order_id ? "view_order" : "view_followup",
        actionLabel: followup.order_id ? "查看工单" : "查看跟进",
        orderId: followup.order_id,
        followupId: followup.id,
        dueAt: followup.due_at,
        sortTime: Number.isFinite(dueTime) ? dueTime : Number.MAX_SAFE_INTEGER,
        priority: overdue ? 10 : 30,
      });
    });

  orderItems
    .filter((item) => item.state === "active")
    .forEach((item) => {
      const workflow = item.order.workflow_status ?? item.order.workflow_bucket;
      const pickup = workflow === "pickup";
      const notificationPending = pickup && item.order.notify_status === "not_sent";
      const updatedAt = orderTime(item.order);
      items.push({
        id: `order:${item.order.id}:active`,
        kind: pickup ? "pickup" : "active_order",
        tone: notificationPending ? "warn" : pickup ? "success" : "info",
        titleKind: notificationPending ? "notify" : pickup ? "pickup" : "active_order",
        title: notificationPending ? "待通知客户" : pickup ? "待客户取机" : "维修处理中",
        description: `${item.order.public_no} · ${item.deviceLabel}`,
        actionKind: notificationPending ? "notify" : pickup ? "deliver" : "view_order",
        actionLabel: notificationPending ? "去通知" : pickup ? "去交付" : "查看工单",
        orderId: item.order.id,
        sortTime: updatedAt,
        priority: notificationPending ? 20 : pickup ? 25 : 40,
      });
    });

  if (!data.stats.finance_redacted) {
    orderItems
      .filter((item) => item.financialState.collectible)
      .forEach((item) => {
        items.push({
          id: `order:${item.order.id}:unpaid`,
          kind: "unpaid",
          tone: "danger",
          titleKind: "unpaid",
          title: "待收款",
          description: `${item.order.public_no} · ${formatEuro(item.order.balance_amount)}`,
          actionKind: "view_order",
          actionLabel: "查看工单",
          orderId: item.order.id,
          sortTime: orderTime(item.order),
          priority: 50,
        });
      });
  }

  return items.sort(
    (left, right) =>
      left.priority - right.priority ||
      left.sortTime - right.sortTime ||
      left.id.localeCompare(right.id),
  );
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
      const financialState = deriveCustomerOrderFinancialState(order, financeRedacted);
      return {
        order,
        device,
        deviceLabel: device ? `${device.brand} ${device.model}` : order.device_label,
        deviceImei: device?.serial_or_imei || order.device_imei || "",
        state: getCustomerOrderWorkbenchState(order, financeRedacted),
        financialState,
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
      pendingQuoteCount: 0,
      financeReviewCount: 0,
      financeRedacted: true,
    };
  }
  const summaryCents = orders.reduce(
    (summary, order) => {
      if (!isCustomerOrderBillable(order) || order.finance_redacted) return summary;

      const financialState = deriveOrderFinancialState(order);
      const settled =
        financialState.settlement === "settled" || financialState.settlement === "zero_charge";
      const pendingQuote =
        financialState.settlement === "not_due" &&
        (financialState.quote === "not_quoted" ||
          financialState.quote === "draft" ||
          financialState.quote === "awaiting_approval" ||
          financialState.quote === "rejected");
      return {
        totalQuotedCents: summary.totalQuotedCents + (moneyToCents(order.quotation_amount) ?? 0),
        depositTotalCents: summary.depositTotalCents + (moneyToCents(order.deposit_amount) ?? 0),
        unpaidAmountCents:
          summary.unpaidAmountCents +
          (financialState.collectible ? (moneyToCents(order.balance_amount) ?? 0) : 0),
        settledOrderCount: summary.settledOrderCount + (settled ? 1 : 0),
        unpaidOrderCount: summary.unpaidOrderCount + (financialState.collectible ? 1 : 0),
        pendingQuoteCount: summary.pendingQuoteCount + (pendingQuote ? 1 : 0),
        financeReviewCount:
          summary.financeReviewCount + (financialState.settlement === "review" ? 1 : 0),
      };
    },
    {
      totalQuotedCents: 0,
      depositTotalCents: 0,
      unpaidAmountCents: 0,
      settledOrderCount: 0,
      unpaidOrderCount: 0,
      pendingQuoteCount: 0,
      financeReviewCount: 0,
    },
  );
  return {
    totalQuoted: summaryCents.totalQuotedCents / 100,
    depositTotal: summaryCents.depositTotalCents / 100,
    unpaidAmount: summaryCents.unpaidAmountCents / 100,
    settledOrderCount: summaryCents.settledOrderCount,
    unpaidOrderCount: summaryCents.unpaidOrderCount,
    pendingQuoteCount: summaryCents.pendingQuoteCount,
    financeReviewCount: summaryCents.financeReviewCount,
  };
}

export function getCustomerOrderWorkbenchState(
  order: OrderListItem,
  financeRedacted = false,
): CustomerOrderWorkbenchState {
  if (isCustomerOrderCancelled(order)) return "closed";
  if (!isCustomerOrderClosed(order)) return "active";
  if (financeRedacted) return "closed";
  const financialState = deriveCustomerOrderFinancialState(order, financeRedacted);
  if (financialState.collectible) return "unpaid";
  if (financialState.settlement === "settled" || financialState.settlement === "zero_charge") {
    return "settled";
  }
  return "closed";
}

function deriveCustomerOrderFinancialState(order: OrderListItem, financeRedacted = false) {
  return deriveOrderFinancialState(
    financeRedacted && !order.finance_redacted ? { ...order, finance_redacted: true } : order,
  );
}

function orderTime(order: Pick<OrderListItem, "updated_at" | "created_at">) {
  return new Date(order.updated_at || order.created_at || 0).getTime();
}

function safeAmount(value: unknown) {
  const cents = moneyToCents(value);
  return cents === null ? 0 : cents / 100;
}

function moneyToCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const cents = Math.round(amount * 100);
  return Math.abs(amount * 100 - cents) < 1e-7 ? cents : null;
}

function sumMoney(values: unknown[]) {
  return values.reduce<number>((sum, value) => sum + (moneyToCents(value) ?? 0), 0) / 100;
}

function formatEuro(value: unknown) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(safeAmount(value));
}

function warrantyFactFromOrder(order?: OrderListItem): CustomerWarrantyFact {
  if (!order) return { kind: "none" };
  const warrantyText = order.warranty_text;
  if (warrantyText?.trim()) return { kind: "custom", value: warrantyText };
  if (typeof order.warranty_months === "number") {
    return order.warranty_months > 0
      ? { kind: "months", count: order.warranty_months }
      : { kind: "no_coverage" };
  }
  return { kind: "unset" };
}

function warrantyLabelFromFact(fact: CustomerWarrantyFact) {
  if (fact.kind === "custom") return fact.value;
  if (fact.kind === "months") return `${fact.count}个月售后`;
  if (fact.kind === "no_coverage") return "无售后";
  if (fact.kind === "none") return "暂无售后记录";
  return "售后未设置";
}
