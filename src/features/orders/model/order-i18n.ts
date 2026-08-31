import type { OrderQueueGroup } from "@/lib/repairdesk/types";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";

type Translate = (key: MessageKey, values?: MessageValues) => string;

const orderQueueMessageKeys: Record<
  OrderQueueGroup,
  { label: MessageKey; shortLabel: MessageKey }
> = {
  processing: { label: "orders.processing", shortLabel: "orders.processingShort" },
  ordered: { label: "orders.ordered", shortLabel: "orders.orderedShort" },
  arrived: { label: "orders.arrived", shortLabel: "orders.arrivedShort" },
  arrived_notified: {
    label: "orders.arrivedNotified",
    shortLabel: "orders.arrivedNotifiedShort",
  },
  repaired: { label: "orders.repaired", shortLabel: "orders.repairedShort" },
  repaired_notified: {
    label: "orders.repairedNotified",
    shortLabel: "orders.repairedNotifiedShort",
  },
};

export function localizeOrderQueueGroup(group: OrderQueueGroup, t: Translate) {
  const keys = orderQueueMessageKeys[group];
  return { label: t(keys.label), shortLabel: t(keys.shortLabel) };
}
