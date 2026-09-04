import type {
  CustomerDetailTabKey,
  CustomerQuickGroup,
  CustomerWorkFilter,
  CustomerWorkSummary,
} from "@/features/customers/model/customer-list";
import type {
  CustomerCurrentItem,
  CustomerOrderWorkbenchState,
  CustomerWarrantyFact,
} from "@/features/customers/model/customer-workbench";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";

export type CustomerTranslate = (key: MessageKey, values?: MessageValues) => string;

const quickGroupKeys = {
  all: ["customers.quick.all", "customers.quick.allShort"],
  active: ["customers.quick.active", "customers.quick.activeShort"],
  unpaid: ["customers.quick.unpaid", "customers.quick.unpaidShort"],
  followup: ["customers.quick.followup", "customers.quick.followupShort"],
} as const satisfies Record<CustomerQuickGroup, readonly [MessageKey, MessageKey]>;

const workFilterKeys = {
  all: ["customers.work.all", "customers.work.allShort"],
  active: ["customers.work.active", "customers.work.activeShort"],
  unpaid: ["customers.work.unpaid", "customers.work.unpaidShort"],
  with_devices: ["customers.work.withDevices", "customers.work.withDevicesShort"],
  repeat: ["customers.work.repeat", "customers.work.repeatShort"],
} as const satisfies Record<CustomerWorkFilter, readonly [MessageKey, MessageKey]>;

const tabKeys = {
  overview: "customers.tab.overview",
  orders: "customers.tab.orders",
  devices: "customers.tab.devices",
  followups: "customers.tab.followups",
  profile: "customers.tab.profile",
} as const satisfies Record<CustomerDetailTabKey, MessageKey>;

const currentTitleKeys = {
  overdue_followup: "customers.current.overdueFollowup",
  followup: "customers.current.followup",
  notify: "customers.current.notify",
  pickup: "customers.current.pickup",
  active_order: "customers.current.activeOrder",
  unpaid: "customers.current.unpaid",
} as const satisfies Record<CustomerCurrentItem["titleKind"], MessageKey>;

const currentActionKeys = {
  view_order: "customers.current.viewOrder",
  view_followup: "customers.current.viewFollowup",
  notify: "customers.current.notifyAction",
  deliver: "customers.current.deliverAction",
} as const satisfies Record<CustomerCurrentItem["actionKind"], MessageKey>;

const orderStateKeys = {
  active: "customers.orderState.active",
  unpaid: "customers.orderState.unpaid",
  settled: "customers.orderState.settled",
  closed: "customers.orderState.closed",
} as const satisfies Record<CustomerOrderWorkbenchState, MessageKey>;

export function localizeCustomerQuickGroup(
  value: string,
  raw: string,
  t: CustomerTranslate,
  short = false,
) {
  const keys = quickGroupKeys[value as CustomerQuickGroup];
  return keys ? t(keys[short ? 1 : 0]) : raw;
}

export function localizeCustomerWorkFilter(
  value: string,
  raw: string,
  t: CustomerTranslate,
  short = false,
) {
  const keys = workFilterKeys[value as CustomerWorkFilter];
  return keys ? t(keys[short ? 1 : 0]) : raw;
}

export function localizeCustomerWorkSummary(
  summary: CustomerWorkSummary | (Omit<CustomerWorkSummary, "kind"> & { kind: string }),
  t: CustomerTranslate,
) {
  const count = summary.count ?? 0;
  if (summary.kind === "followup_due") {
    return {
      ...summary,
      label: t("customers.summary.followupLabel"),
      detail: t("customers.summary.followupDetail"),
      actionLabel: t("customers.summary.followupAction"),
    };
  }
  if (summary.kind === "active") {
    return {
      ...summary,
      label: t("customers.summary.activeLabel", { count }),
      detail: t("customers.summary.activeDetail"),
      actionLabel: t("customers.summary.activeAction"),
    };
  }
  if (summary.kind === "outstanding") {
    return {
      ...summary,
      label: t("customers.summary.unpaidLabel"),
      detail: t("customers.summary.unpaidDetail"),
      actionLabel: t("customers.summary.unpaidAction"),
    };
  }
  if (summary.kind === "repeat") {
    return {
      ...summary,
      label: t("customers.summary.repeatLabel"),
      detail: t("customers.summary.repeatDetail", { count }),
      actionLabel: t("customers.summary.repeatAction"),
    };
  }
  if (summary.kind === "device") {
    return {
      ...summary,
      label: t("customers.summary.deviceLabel"),
      detail: t("customers.summary.deviceDetail", { count }),
      actionLabel: t("customers.summary.deviceAction"),
    };
  }
  if (summary.kind === "new") {
    return {
      ...summary,
      label: t("customers.summary.newLabel"),
      detail: t("customers.summary.newDetail"),
      actionLabel: t("customers.summary.newAction"),
    };
  }
  return summary;
}

export function localizeCustomerRepairState(
  state: { kind: string; count?: number; label: string },
  t: CustomerTranslate,
) {
  if (state.kind === "active") return t("customers.repair.active", { count: state.count ?? 0 });
  if (state.kind === "closed") return t("customers.repair.closed");
  return state.label;
}

export function localizeCustomerPaymentState(
  state: { kind: string; amount?: number; label: string },
  t: CustomerTranslate,
) {
  if (state.kind === "outstanding") return t("customers.payment.outstanding");
  if (state.kind === "settled") return t("customers.payment.settled");
  if (state.kind === "redacted") return t("customers.payment.redacted");
  return state.label;
}

export function localizeCustomerTab(key: string, raw: string, t: CustomerTranslate) {
  const messageKey = tabKeys[key as CustomerDetailTabKey];
  return messageKey ? t(messageKey) : raw;
}

export function localizeCustomerCurrentItem(
  item:
    | CustomerCurrentItem
    | (Omit<CustomerCurrentItem, "titleKind" | "actionKind"> & {
        titleKind: string;
        actionKind: string;
      }),
  t: CustomerTranslate,
) {
  const titleKey = currentTitleKeys[item.titleKind as CustomerCurrentItem["titleKind"]];
  const actionKey = currentActionKeys[item.actionKind as CustomerCurrentItem["actionKind"]];
  return {
    ...item,
    title: titleKey ? t(titleKey) : item.title,
    actionLabel: actionKey ? t(actionKey) : item.actionLabel,
  };
}

export function localizeCustomerFollowupStatus(status: string, raw: string, t: CustomerTranslate) {
  if (status === "open") return t("customers.followup.open");
  if (status === "done") return t("customers.followup.completed");
  return raw;
}

export function localizeCustomerChannel(channel: string, raw: string, t: CustomerTranslate) {
  if (channel === "whatsapp") return t("customers.channel.whatsapp");
  if (channel === "sms") return t("customers.channel.sms");
  return raw;
}

export function localizeCustomerLanguage(language: string, raw: string, t: CustomerTranslate) {
  if (language === "zh") return t("customers.language.zh");
  if (language === "en") return t("customers.language.en");
  if (language === "it") return t("customers.language.it");
  return raw;
}

export function localizeCustomerWarranty(fact: CustomerWarrantyFact, t: CustomerTranslate) {
  if (fact.kind === "custom") return fact.value;
  if (fact.kind === "months") return t("customers.warranty.months", { count: fact.count });
  if (fact.kind === "no_coverage") return t("customers.warranty.noCoverage");
  if (fact.kind === "none") return t("customers.warranty.none");
  return t("customers.warranty.unset");
}

export function localizeCustomerOrderState(state: string, raw: string, t: CustomerTranslate) {
  const messageKey = orderStateKeys[state as CustomerOrderWorkbenchState];
  return messageKey ? t(messageKey) : raw;
}

export function localizeCustomerDeviceDeleteReason(
  kind: string | undefined,
  raw: string | undefined,
  t: CustomerTranslate,
) {
  return kind === "has_order_history" ? t("customers.device.deleteBlockedHistory") : raw;
}
