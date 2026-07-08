import type {
  CustomerCreateInput,
  CustomerDetail,
  CustomerListFilters,
  CustomerListItem,
  CustomerStats,
} from "@/lib/repairdesk/api";

export type CustomerWorkFilter = NonNullable<CustomerListFilters["work"]>;

export interface CustomerWorkFilterChip {
  value: CustomerWorkFilter;
  label: string;
  shortLabel: string;
  count: number;
}

export interface CustomerPageRange {
  page: number;
  pageSize: number;
  pageCount: number;
  start: number;
  end: number;
}

export type CustomerWorkSummaryTone = "info" | "warning" | "success" | "neutral";

export interface CustomerWorkSummary {
  label: string;
  detail: string;
  actionLabel: string;
  tone: CustomerWorkSummaryTone;
}

export type CustomerDetailTabKey =
  | "overview"
  | "devices"
  | "orders"
  | "messages"
  | "profile"
  | "followups"
  | "timeline";

export interface CustomerDetailTabMeta {
  key: CustomerDetailTabKey;
  label: string;
  count?: number;
}

export const customerWorkFilterOptions: Array<{
  value: CustomerWorkFilter;
  label: string;
  shortLabel: string;
  statKey: keyof Pick<
    CustomerStats,
    "total" | "activeRepairs" | "unpaid" | "withDevices" | "repeat"
  >;
}> = [
  { value: "all", label: "全部", shortLabel: "全", statKey: "total" },
  { value: "active", label: "在修", shortLabel: "修", statKey: "activeRepairs" },
  { value: "unpaid", label: "未结清", shortLabel: "款", statKey: "unpaid" },
  { value: "with_devices", label: "有设备", shortLabel: "设", statKey: "withDevices" },
  { value: "repeat", label: "老客户", shortLabel: "老", statKey: "repeat" },
];

export const defaultCustomerForm: CustomerCreateInput = {
  name: "",
  phone_e164: "",
  email: "",
  contact_phones: [],
  consent_marketing: true,
  consent_sms: true,
  preferred_channel: "whatsapp",
  language: "it",
  notes: "",
  marketing_notes: "",
  blacklisted: false,
};

export function sanitizeCustomerListFilters(filters: CustomerListFilters): CustomerListFilters {
  const tagIds = filters.tagIds?.filter(Boolean);
  return {
    ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
    ...(tagIds?.length ? { tagIds } : {}),
    work: normalizeCustomerWorkFilter(filters.work),
  };
}

export function normalizeCustomerWorkFilter(work: CustomerListFilters["work"]): CustomerWorkFilter {
  return customerWorkFilterOptions.some((option) => option.value === work) ? work! : "all";
}

export function getCustomerWorkFilterLabel(work: CustomerListFilters["work"]) {
  const value = normalizeCustomerWorkFilter(work);
  return customerWorkFilterOptions.find((option) => option.value === value)?.label ?? "全部";
}

export function buildCustomerWorkFilterChips(
  stats: CustomerStats | undefined,
): CustomerWorkFilterChip[] {
  return customerWorkFilterOptions.map((option) => ({
    value: option.value,
    label: option.label,
    shortLabel: option.shortLabel,
    count: Number(stats?.[option.statKey] ?? 0),
  }));
}

export function getCustomerActiveFilterCount(filters: CustomerListFilters) {
  const tagCount = filters.tagIds?.filter(Boolean).length ?? 0;
  const workCount = normalizeCustomerWorkFilter(filters.work) === "all" ? 0 : 1;
  return tagCount + workCount;
}

export function getCustomerListSubtitle(filters: CustomerListFilters, total: number) {
  return `${getCustomerWorkFilterLabel(filters.work)} · 共 ${Math.max(0, total)} 位`;
}

export function getCustomerDetailHref(customerId: string) {
  return `/customers/${encodeURIComponent(customerId)}`;
}

export function getCustomerWorkSummary(
  customer: Pick<
    CustomerListItem,
    "active_order_count" | "unpaid_amount" | "order_count" | "device_count"
  >,
): CustomerWorkSummary {
  if (customer.active_order_count > 0) {
    return {
      label: `在修 ${customer.active_order_count}`,
      detail: "客户还有正在处理的维修单",
      actionLabel: "跟进维修进度",
      tone: "info",
    };
  }
  if (customer.unpaid_amount > 0) {
    return {
      label: "未结清",
      detail: "客户还有待确认尾款",
      actionLabel: "确认尾款",
      tone: "warning",
    };
  }
  if (customer.order_count > 1) {
    return {
      label: "老客户",
      detail: `${customer.order_count} 个历史工单`,
      actionLabel: "复用历史设备",
      tone: "success",
    };
  }
  if (customer.device_count > 0) {
    return {
      label: "有设备",
      detail: `${customer.device_count} 台设备`,
      actionLabel: "新工单可复用",
      tone: "neutral",
    };
  }
  return {
    label: "新客户",
    detail: "还没有设备或工单记录",
    actionLabel: "完善客户资料",
    tone: "neutral",
  };
}

export function getCustomerDetailWorkSummary(data: CustomerDetail): CustomerWorkSummary {
  const activeOrderCount = data.orders.filter(
    (order) => !isClosedCustomerOrderStatus(order.status),
  ).length;

  return getCustomerWorkSummary({
    active_order_count: activeOrderCount,
    unpaid_amount: data.stats.unpaid_amount,
    order_count: data.stats.order_count,
    device_count: data.stats.device_count,
  });
}

export function buildCustomerDetailTabs(data: CustomerDetail): CustomerDetailTabMeta[] {
  const openFollowupCount = data.followups.filter((followup) => followup.status === "open").length;
  const timelineCount = data.orders.length + data.interactions.length + data.followups.length;

  return [
    { key: "overview", label: "概览" },
    { key: "devices", label: "设备", count: data.devices.length },
    { key: "orders", label: "工单", count: data.orders.length },
    { key: "messages", label: "联系", count: data.interactions.length },
    { key: "profile", label: "资料", count: data.tags.length },
    { key: "followups", label: "待办", count: openFollowupCount },
    { key: "timeline", label: "记录", count: timelineCount },
  ];
}

export function getCustomerPageRange({
  total,
  page,
  pageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
}): CustomerPageRange {
  const safeTotal = Math.max(0, Math.floor(total));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = Math.min(pageCount, Math.max(1, Math.floor(page)));
  const start = safeTotal === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const end = Math.min(safeTotal, safePage * safePageSize);
  return {
    page: safePage,
    pageSize: safePageSize,
    pageCount,
    start,
    end,
  };
}

export function formatCustomerDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isClosedCustomerOrderStatus(status: CustomerDetail["orders"][number]["status"]) {
  return status === "completed" || status === "cancelled";
}
