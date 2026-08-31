import type {
  RepairDeskNavItem,
  RepairDeskShellAction,
  RepairDeskModuleId,
} from "@/shared/config/navigation";
import type { MessageKey } from "@/shared/i18n/messages";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

const navKeys: Record<RepairDeskModuleId, { title: MessageKey; short: MessageKey }> = {
  dashboard: { title: "nav.dashboard.title", short: "nav.dashboard.short" },
  orders: { title: "nav.orders.title", short: "nav.orders.short" },
  customers: { title: "nav.customers.title", short: "nav.customers.short" },
  memos: { title: "nav.memos.title", short: "nav.memos.short" },
  buyback: { title: "nav.buyback.title", short: "nav.buyback.short" },
  inventory: { title: "nav.inventory.title", short: "nav.inventory.short" },
  finance: { title: "nav.finance.title", short: "nav.finance.short" },
  messages: { title: "nav.messages.title", short: "nav.messages.short" },
  toolkit: { title: "nav.toolkit.title", short: "nav.toolkit.short" },
  platform: { title: "nav.platform.title", short: "nav.platform.short" },
  settings: { title: "nav.settings.title", short: "nav.settings.short" },
};

const actionKeys: Record<
  string,
  { label: MessageKey; short?: MessageKey; description: MessageKey }
> = {
  "new-order": {
    label: "action.new-order.label",
    short: "action.new-order.short",
    description: "action.new-order.description",
  },
  "open-orders": {
    label: "action.open-orders.label",
    short: "action.open-orders.short",
    description: "action.open-orders.description",
  },
  "new-customer": {
    label: "action.new-customer.label",
    short: "action.new-customer.short",
    description: "action.new-customer.description",
  },
  "new-memo": {
    label: "action.new-memo.label",
    short: "action.new-memo.short",
    description: "action.new-memo.description",
  },
  "new-buyback": {
    label: "action.new-buyback.label",
    short: "action.new-buyback.short",
    description: "action.new-buyback.description",
  },
  "new-inventory": {
    label: "action.new-inventory.label",
    short: "action.new-inventory.short",
    description: "action.new-inventory.description",
  },
  "invite-members": {
    label: "action.invite-members.label",
    short: "action.invite-members.short",
    description: "action.invite-members.description",
  },
  "account-center": {
    label: "action.account-center.label",
    short: "action.account-center.short",
    description: "action.account-center.description",
  },
  scan: { label: "action.scan.label", description: "action.scan.description" },
  camera: { label: "action.camera.label", description: "action.camera.description" },
  messages: { label: "action.messages.label", description: "action.messages.description" },
  search: { label: "action.search.label", description: "action.search.description" },
};

const routeKeys: Record<string, MessageKey> = {
  "": "nav.dashboard.title",
  orders: "nav.orders.title",
  customers: "nav.customers.title",
  memos: "nav.memos.title",
  buyback: "nav.buyback.title",
  inventory: "nav.inventory.title",
  finance: "nav.finance.title",
  messages: "nav.messages.title",
  toolkit: "nav.toolkit.title",
  platform: "nav.platform.title",
  settings: "nav.settings.title",
  reserve: "route.reserve",
  reservations: "route.reservations",
  sales: "route.sales",
  "after-sales": "route.after-sales",
  "closed-stores": "route.closed-stores",
  account: "route.account",
  offline: "route.offline",
  new: "route.new",
  edit: "route.edit",
  task: "route.task",
};

export function localizeShellAction(action: RepairDeskShellAction, t: Translate) {
  const keys = actionKeys[action.id];
  if (!keys) return action;
  return {
    ...action,
    label: t(keys.label),
    shortLabel: keys.short ? t(keys.short) : action.shortLabel,
    description: t(keys.description),
  };
}

export function localizeNavItem(item: RepairDeskNavItem, t: Translate) {
  const keys = navKeys[item.id];
  return {
    ...item,
    title: t(keys.title),
    shortTitle: t(keys.short),
    commandLabel: t(keys.title),
    primaryAction: item.primaryAction ? localizeShellAction(item.primaryAction, t) : undefined,
  };
}

export function localizeRouteLabel(segment: string, t: Translate) {
  const key = routeKeys[segment];
  return key ? t(key) : undefined;
}
