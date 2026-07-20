import type {
  CustomerCreateInput,
  CustomerDetail,
  CustomerListFilters,
  CustomerListItem,
  CustomerStats,
} from "@/lib/repairdesk/api";

import { isCustomerOrderClosed } from "./customer-order-state";

export type CustomerWorkFilter = NonNullable<CustomerListFilters["work"]>;
export type CustomerQuickGroup = "all" | "active" | "unpaid" | "followup";

export interface CustomerQuickGroupChip {
  value: CustomerQuickGroup;
  label: string;
  shortLabel: string;
  count: number;
}

export interface CustomerListUrlState {
  search: string;
  filters: CustomerListFilters;
  page: number;
}

export interface CustomerPageRange {
  page: number;
  pageSize: number;
  pageCount: number;
  start: number;
  end: number;
}

export type CustomerWorkSummaryTone = "info" | "warning" | "success" | "neutral";

export type CustomerRepairState =
  | { kind: "active"; count: number; label: string }
  | { kind: "closed"; label: string };

export type CustomerPaymentState =
  | { kind: "outstanding"; amount: number; label: string }
  | { kind: "settled"; label: string }
  | { kind: "redacted"; label: string };

export interface CustomerWorkSummary {
  label: string;
  detail: string;
  actionLabel: string;
  tone: CustomerWorkSummaryTone;
}

export type CustomerDetailTabKey = "overview" | "devices" | "orders" | "profile" | "followups";

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
  { value: "unpaid", label: "有待收", shortLabel: "款", statKey: "unpaid" },
  { value: "with_devices", label: "有设备", shortLabel: "设", statKey: "withDevices" },
  { value: "repeat", label: "老客户", shortLabel: "老", statKey: "repeat" },
];

export const customerQuickGroupOptions: Array<{
  value: CustomerQuickGroup;
  label: string;
  shortLabel: string;
  statKey: keyof Pick<CustomerStats, "total" | "activeRepairs" | "unpaid" | "dueFollowups">;
}> = [
  { value: "all", label: "全部", shortLabel: "全", statKey: "total" },
  { value: "active", label: "处理中", shortLabel: "修", statKey: "activeRepairs" },
  { value: "unpaid", label: "待收款", shortLabel: "款", statKey: "unpaid" },
  { value: "followup", label: "要跟进", shortLabel: "跟", statKey: "dueFollowups" },
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
  const marketing = ["all", "allowed", "blocked"].includes(filters.marketing ?? "")
    ? filters.marketing
    : "all";
  const followup = ["all", "due", "overdue"].includes(filters.followup ?? "")
    ? filters.followup
    : "all";
  return {
    ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
    ...(tagIds?.length ? { tagIds } : {}),
    work: normalizeCustomerWorkFilter(filters.work),
    marketing,
    followup,
  };
}

export function normalizeCustomerWorkFilter(work: CustomerListFilters["work"]): CustomerWorkFilter {
  return customerWorkFilterOptions.some((option) => option.value === work) ? work! : "all";
}

export function getCustomerWorkFilterLabel(work: CustomerListFilters["work"]) {
  const value = normalizeCustomerWorkFilter(work);
  return customerWorkFilterOptions.find((option) => option.value === value)?.label ?? "全部";
}

export function buildCustomerQuickGroupChips(
  stats: CustomerStats | undefined,
): CustomerQuickGroupChip[] {
  return customerQuickGroupOptions
    .filter((option) => option.value !== "unpaid" || !stats?.financeRedacted)
    .map((option) => ({
      value: option.value,
      label: option.label,
      shortLabel: option.shortLabel,
      count: Number(stats?.[option.statKey] ?? 0),
    }));
}

export function getCustomerQuickGroup(filters: CustomerListFilters): CustomerQuickGroup {
  if (filters.followup === "due" || filters.followup === "overdue") return "followup";
  if (filters.work === "active") return "active";
  if (filters.work === "unpaid") return "unpaid";
  if (!filters.work || filters.work === "all") return "all";
  return "all";
}

export function applyCustomerQuickGroup(
  filters: CustomerListFilters,
  group: CustomerQuickGroup,
): CustomerListFilters {
  const next: CustomerListFilters = { ...filters, work: "all", followup: "all" };
  if (group === "active") next.work = "active";
  if (group === "unpaid") next.work = "unpaid";
  if (group === "followup") next.followup = "due";
  return sanitizeCustomerListFilters(next);
}

export function getCustomerActiveFilterCount(filters: CustomerListFilters) {
  const tagCount = filters.tagIds?.filter(Boolean).length ?? 0;
  const workCount = filters.work === "with_devices" || filters.work === "repeat" ? 1 : 0;
  const marketingCount = filters.marketing && filters.marketing !== "all" ? 1 : 0;
  const followupCount = filters.followup === "overdue" ? 1 : 0;
  return tagCount + workCount + marketingCount + followupCount;
}

export function getCustomerListSubtitle(filters: CustomerListFilters, total: number) {
  const quickGroup = getCustomerQuickGroup(filters);
  const groupLabel = quickGroup
    ? customerQuickGroupOptions.find((option) => option.value === quickGroup)?.label
    : getCustomerWorkFilterLabel(filters.work);
  return `${groupLabel ?? "全部"} · 共 ${Math.max(0, total)} 位`;
}

export function parseCustomerListUrlState(params: { get: (key: string) => string | null }) {
  const group = params.get("group");
  let filters: CustomerListFilters = { work: "all", followup: "all", marketing: "all" };
  if (group === "active" || group === "unpaid" || group === "followup") {
    filters = applyCustomerQuickGroup(filters, group);
  }

  const advancedWork = params.get("work");
  if (advancedWork === "with_devices" || advancedWork === "repeat") {
    filters.work = advancedWork;
  }
  const followup = params.get("followup");
  if (followup === "due" || followup === "overdue") filters.followup = followup;
  const marketing = params.get("marketing");
  if (marketing === "allowed" || marketing === "blocked") filters.marketing = marketing;
  const tagIds = (params.get("tags") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (tagIds.length) filters.tagIds = [...new Set(tagIds)];

  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  return {
    search: params.get("q")?.trim() ?? "",
    filters: sanitizeCustomerListFilters(filters),
    page,
  } satisfies CustomerListUrlState;
}

export function serializeCustomerListUrlState(state: CustomerListUrlState) {
  const params = new URLSearchParams();
  const filters = sanitizeCustomerListFilters(state.filters);
  const search = state.search.trim();
  if (search) params.set("q", search);

  const group = getCustomerQuickGroup(filters);
  if (group && group !== "all") params.set("group", group);
  if (filters.work === "with_devices" || filters.work === "repeat") {
    params.set("work", filters.work);
  }
  if (filters.followup === "overdue") params.set("followup", "overdue");
  if (filters.marketing && filters.marketing !== "all") {
    params.set("marketing", filters.marketing);
  }
  if (filters.tagIds?.length) params.set("tags", [...new Set(filters.tagIds)].join(","));
  if (state.page > 1) params.set("page", String(Math.floor(state.page)));
  return params;
}

export function getCustomerDetailHref(customerId: string) {
  return `/customers/${encodeURIComponent(customerId)}`;
}

export function getCustomerWorkSummary(
  customer: Pick<
    CustomerListItem,
    | "active_order_count"
    | "unpaid_amount"
    | "order_count"
    | "valid_order_count"
    | "device_count"
    | "finance_redacted"
    | "next_followup_at"
  >,
): CustomerWorkSummary {
  const followupAt = customer.next_followup_at
    ? new Date(customer.next_followup_at).getTime()
    : Number.NaN;
  if (Number.isFinite(followupAt) && followupAt <= Date.now()) {
    return {
      label: "要跟进",
      detail: "客户跟进已经到时间",
      actionLabel: "联系客户并记录结果",
      tone: "warning",
    };
  }
  if (customer.active_order_count > 0) {
    return {
      label: `在修 ${customer.active_order_count}`,
      detail: "客户还有正在处理的维修单",
      actionLabel: "跟进维修进度",
      tone: "info",
    };
  }
  if (!customer.finance_redacted && (customer.unpaid_amount ?? 0) > 0) {
    return {
      label: "有待收",
      detail: "客户还有待确认尾款",
      actionLabel: "确认尾款",
      tone: "warning",
    };
  }
  if ((customer.valid_order_count ?? 0) > 1) {
    return {
      label: "老客户",
      detail: `${customer.valid_order_count} 个有效工单`,
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

export function getCustomerRepairState(
  customer: Pick<CustomerListItem, "active_order_count">,
): CustomerRepairState {
  return customer.active_order_count > 0
    ? {
        kind: "active",
        count: customer.active_order_count,
        label: `在修 ${customer.active_order_count}`,
      }
    : { kind: "closed", label: "已结案" };
}

export function getCustomerPaymentState(
  customer: Pick<CustomerListItem, "outstanding_amount" | "unpaid_amount" | "finance_redacted">,
): CustomerPaymentState {
  if (customer.finance_redacted) return { kind: "redacted", label: "金额受限" };
  const amount = Math.max(0, customer.outstanding_amount ?? customer.unpaid_amount ?? 0);
  return amount > 0
    ? { kind: "outstanding", amount, label: "待收" }
    : { kind: "settled", label: "已结清" };
}

export function getCustomerLifetimeQuotedAmount(
  customer: Pick<CustomerListItem, "lifetime_quoted_amount" | "total_spent">,
) {
  return Math.max(0, customer.lifetime_quoted_amount ?? customer.total_spent ?? 0);
}

export function getCustomerOutstandingAmount(
  customer: Pick<CustomerListItem, "outstanding_amount" | "unpaid_amount">,
) {
  return Math.max(0, customer.outstanding_amount ?? customer.unpaid_amount ?? 0);
}

export function getCustomerDetailWorkSummary(data: CustomerDetail): CustomerWorkSummary {
  const activeOrderCount = data.orders.filter((order) => !isCustomerOrderClosed(order)).length;

  return getCustomerWorkSummary({
    active_order_count: activeOrderCount,
    unpaid_amount: data.stats.unpaid_amount,
    finance_redacted: data.stats.finance_redacted,
    order_count: data.stats.order_count,
    valid_order_count: data.stats.valid_order_count,
    device_count: data.stats.device_count,
    next_followup_at: data.stats.next_followup_at,
  });
}

export function buildCustomerDetailTabs(data: CustomerDetail): CustomerDetailTabMeta[] {
  const followupCount = data.followups.filter((followup) => followup.status === "open").length;

  return [
    { key: "overview", label: "总览" },
    { key: "orders", label: "工单", count: data.orders.length },
    { key: "devices", label: "设备", count: data.devices.length },
    { key: "followups", label: "跟进", count: followupCount },
    { key: "profile", label: "资料", count: data.tags.length },
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

export function clampCustomerPageAfterLoad({
  page,
  pageCount,
  isPlaceholderData,
}: {
  page: number;
  pageCount?: number;
  isPlaceholderData: boolean;
}) {
  if (pageCount === undefined || isPlaceholderData) return page;
  return Math.min(Math.max(1, page), Math.max(1, pageCount));
}

export function formatCustomerDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
