import type { RepairOrderStatus } from "@/lib/mock/enums";

import {
  getOrderReasonCatalog,
  getOrderTransitionReasonContext,
  type OrderReasonCatalog,
} from "@/features/orders/model/order-reason-catalog";

export type OrderTransitionReasonPreset = {
  id: string;
  label: string;
  description: string;
};

export type OrderTransitionReasonConfig = {
  context: OrderReasonCatalog["context"];
  title: string;
  description: string;
  required: boolean;
  presets: OrderTransitionReasonPreset[];
};

export function getOrderTransitionReasonConfig(
  to: RepairOrderStatus,
): OrderTransitionReasonConfig | undefined {
  const context = getOrderTransitionReasonContext(to);
  if (!context) return undefined;
  const catalog = getOrderReasonCatalog(context);
  return {
    context,
    title: catalog.title,
    description: catalog.description,
    required: catalog.required,
    presets: catalog.options.map((entry) => ({
      id: entry.code,
      label: entry.staffLabel,
      description: entry.staffDescription ?? "",
    })),
  };
}

export function orderTransitionRequiresReason(to: RepairOrderStatus) {
  return Boolean(getOrderTransitionReasonConfig(to)?.required);
}

/**
 * High-risk actions deliberately have no default reason. Kept as a compatibility
 * export while existing screens migrate to OrderReasonDraft.
 */
export function getDefaultOrderTransitionReason(_to: RepairOrderStatus) {
  return "";
}
