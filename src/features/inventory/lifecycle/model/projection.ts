import type {
  InventoryAfterSalesStatus,
  InventoryItemStatus,
  InventoryLifecycleCommand,
  InventoryLifecycleProjection,
  InventoryLifecycleProjectionCounts,
  InventoryLifecycleProjectionStatus,
} from "@/lib/repairdesk/types";

export type InventoryLifecycleIconName =
  | "circle-dashed"
  | "tag"
  | "clock"
  | "package-check"
  | "check-circle"
  | "wrench"
  | "archive-x";

export interface InventoryLifecycleProjectionMeta {
  label: string;
  shortLabel: string;
  description: string;
  tone: "neutral" | "info" | "warning" | "success" | "danger";
  icon: InventoryLifecycleIconName;
  nextStep?: string;
}

export const inventoryLifecycleProjectionStatusMeta: Record<
  InventoryLifecycleProjectionStatus,
  InventoryLifecycleProjectionMeta
> = {
  processing: {
    label: "待处理",
    shortLabel: "处理",
    description: "商品仍在入库、检测或整备流程中。",
    tone: "neutral",
    icon: "circle-dashed",
    nextStep: "补齐检测或推进流程",
  },
  in_stock: {
    label: "在售",
    shortLabel: "在售",
    description: "商品已明确上架，可继续登记预订。",
    tone: "success",
    icon: "tag",
    nextStep: "跟进销售或登记预订",
  },
  reserved: {
    label: "已预订",
    shortLabel: "预订",
    description: "商品已被客户锁定，等待收款或成交。",
    tone: "warning",
    icon: "clock",
    nextStep: "核对定金与尾款",
  },
  sold_pending_pickup: {
    label: "待取走",
    shortLabel: "待取",
    description: "销售已完成，但尚未记录实际取走。",
    tone: "info",
    icon: "package-check",
    nextStep: "确认客户实际取走",
  },
  delivered: {
    label: "已取走",
    shortLabel: "已取",
    description: "已记录实际取走时间，可查看保修或登记售后。",
    tone: "neutral",
    icon: "check-circle",
    nextStep: "查看保修或登记售后",
  },
  after_sales: {
    label: "售后处理中",
    shortLabel: "售后",
    description: "已交付商品存在尚未关闭的售后案件。",
    tone: "danger",
    icon: "wrench",
    nextStep: "按案件允许的状态继续处理",
  },
  removed: {
    label: "已移除",
    shortLabel: "移除",
    description: "商品已取消、回收处理或不再参与正常销售。",
    tone: "neutral",
    icon: "archive-x",
  },
};

export interface InventoryLifecycleProjectionOrderFacts {
  status: "reserved" | "sold" | "cancelled";
  reservedAt?: string | null;
  reservationExpiresAt?: string | null;
  expectedPickupAt?: string | null;
  soldAt?: string | null;
  actualPickupAt?: string | null;
}

export interface InventoryLifecycleProjectionAfterSalesFacts {
  status: InventoryAfterSalesStatus;
  returnedAt?: string | null;
}

export interface InventoryLifecycleProjectionFacts {
  legacyStatus: InventoryItemStatus | string | null | undefined;
  unitStatus?: string | null;
  order?: InventoryLifecycleProjectionOrderFacts | null;
  afterSales?: InventoryLifecycleProjectionAfterSalesFacts | null;
  balance?: number;
  warrantyEndsAt?: string | null;
  allowedActions?: InventoryLifecycleCommand[];
}

/**
 * Safe fallback while lifecycle reads are dormant. This intentionally does not
 * claim that an item is on sale unless its legacy status is explicitly listed.
 */
export function projectCompatibleInventoryLifecycle(
  legacyStatus: InventoryItemStatus | string | null | undefined,
): InventoryLifecycleProjection {
  const status = String(legacyStatus ?? "");
  if (status === "listed") {
    return projection({
      mode: "compatible",
      status: "in_stock",
      confidence: "medium",
      needs_review: false,
    });
  }
  if (status === "reserved") {
    return projection({
      mode: "compatible",
      status: "reserved",
      confidence: "medium",
      needs_review: false,
    });
  }
  if (status === "sold") {
    return projection({
      mode: "compatible",
      status: "processing",
      confidence: "low",
      needs_review: true,
    });
  }
  if (status === "cancelled" || status === "recycled") {
    return projection({
      mode: "compatible",
      status: "removed",
      confidence: "high",
      needs_review: false,
    });
  }
  return projection({
    mode: "compatible",
    status: "processing",
    confidence: status ? "medium" : "low",
    needs_review: !status || status === "returned",
  });
}

/**
 * Exact projection from independently stored stock, order, payment and
 * after-sales facts. A listed item is considered truly sellable only when no
 * active order/case or contradictory stock fact exists.
 */
export function projectExactInventoryLifecycle(
  facts: InventoryLifecycleProjectionFacts,
): InventoryLifecycleProjection {
  const legacyStatus = String(facts.legacyStatus ?? "");
  const unitStatus = facts.unitStatus ? String(facts.unitStatus) : undefined;
  const removed =
    ["cancelled", "recycled"].includes(legacyStatus) ||
    ["cancelled", "recycled"].includes(unitStatus ?? "");

  if (removed) {
    return projection({
      mode: "exact",
      status: "removed",
      confidence: "high",
      needs_review: false,
      allowed_actions: [],
    });
  }

  const order = facts.order ?? undefined;
  const afterSales = facts.afterSales ?? undefined;
  if (afterSales) {
    const delivered = order?.status === "sold" && Boolean(order.actualPickupAt);
    if (delivered) {
      return projection({
        mode: "exact",
        status: "after_sales",
        confidence: "high",
        needs_review: false,
        after_sales_status: afterSales.status,
        allowed_actions: withoutReservationAction(facts.allowedActions),
        warranty_ends_at: definedDate(facts.warrantyEndsAt),
      });
    }
    return projection({
      mode: "exact",
      status: "processing",
      confidence: "low",
      needs_review: true,
      allowed_actions: [],
    });
  }

  if (order?.status === "reserved") {
    return projection({
      mode: "exact",
      status: "reserved",
      confidence: "high",
      needs_review: false,
      balance: normalizedMoney(facts.balance),
      reservation_expires_at: definedDate(order.reservationExpiresAt),
      expected_pickup_at: definedDate(order.expectedPickupAt),
      allowed_actions: withoutReservationAction(facts.allowedActions),
    });
  }

  if (order?.status === "sold") {
    const delivered = Boolean(order.actualPickupAt);
    return projection({
      mode: "exact",
      status: delivered ? "delivered" : "sold_pending_pickup",
      confidence: "high",
      needs_review: false,
      balance: normalizedMoney(facts.balance),
      expected_pickup_at: definedDate(order.expectedPickupAt),
      actual_pickup_at: definedDate(order.actualPickupAt),
      warranty_ends_at: definedDate(facts.warrantyEndsAt),
      allowed_actions: withoutReservationAction(facts.allowedActions),
    });
  }

  // Exact mode requires the canonical stock-unit fact as well as the legacy
  // item flag. A missing unit is a data-integrity gap, never evidence that an
  // item is safely sellable.
  const listed = legacyStatus === "listed" && unitStatus === "listed";
  if (listed) {
    return projection({
      mode: "exact",
      status: "in_stock",
      confidence: "high",
      needs_review: false,
      allowed_actions: facts.allowedActions,
    });
  }

  return projection({
    mode: "exact",
    status: "processing",
    confidence: unitStatus && unitStatus === legacyStatus ? "high" : "medium",
    needs_review: unitStatus !== "listed" || unitStatus !== legacyStatus,
    allowed_actions: [],
  });
}

export function projectUnavailableInventoryLifecycle(): InventoryLifecycleProjection {
  return projection({
    mode: "unavailable",
    status: "processing",
    confidence: "low",
    needs_review: true,
    allowed_actions: [],
  });
}

export function countInventoryLifecycleProjections(
  projections: readonly InventoryLifecycleProjection[],
): InventoryLifecycleProjectionCounts {
  const counts: InventoryLifecycleProjectionCounts = {};
  for (const item of projections) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  return counts;
}

export function getInventoryLifecycleProjectionMeta(
  projection: InventoryLifecycleProjection,
  legacyStatus?: InventoryItemStatus | string | null,
): InventoryLifecycleProjectionMeta {
  const base = inventoryLifecycleProjectionStatusMeta[projection.status];
  if (projection.mode === "compatible" && legacyStatus === "sold") {
    return {
      ...inventoryLifecycleProjectionStatusMeta.processing,
      label: "已售",
      shortLabel: "已售",
      description: "旧资料仅确认已售，未确认实际取走，不能猜测为待取或已取走。",
      nextStep: "核对实际取走记录",
    };
  }
  if (projection.status === "sold_pending_pickup" && projection.needs_review) {
    return {
      ...base,
      label: "已售·需核对",
      shortLabel: "已售",
      description: "已记录售出，但旧资料没有可靠的实际取走事实。",
      nextStep: "核对实际取走记录",
    };
  }
  if (projection.status === "processing" && projection.needs_review) {
    return {
      ...base,
      label: legacyStatus === "returned" ? "退回·需核对" : "待处理·需核对",
      shortLabel: "核对",
      description: "当前资料不足以安全判断是否在售或已交付。",
      nextStep: "核对库存与业务事实",
    };
  }
  return base;
}

export function getInventoryLifecycleAfterSalesNextStatuses(
  status: InventoryAfterSalesStatus | string,
): InventoryAfterSalesStatus[] {
  switch (status) {
    case "open":
      return ["in_progress", "waiting_customer", "returned"];
    case "in_progress":
      return ["waiting_customer", "returned"];
    case "waiting_customer":
      return ["in_progress", "returned"];
    case "returned":
      return ["closed"];
    case "closed":
      return [];
    default:
      return [];
  }
}

function projection(
  input: Omit<InventoryLifecycleProjection, "allowed_actions"> & {
    allowed_actions?: InventoryLifecycleCommand[];
  },
): InventoryLifecycleProjection {
  return {
    ...input,
    ...(input.balance === undefined ? {} : { balance: normalizedMoney(input.balance) }),
    ...(input.reservation_expires_at
      ? { reservation_expires_at: input.reservation_expires_at }
      : {}),
    ...(input.expected_pickup_at ? { expected_pickup_at: input.expected_pickup_at } : {}),
    ...(input.actual_pickup_at ? { actual_pickup_at: input.actual_pickup_at } : {}),
    ...(input.warranty_ends_at ? { warranty_ends_at: input.warranty_ends_at } : {}),
    allowed_actions: input.allowed_actions ?? [],
  };
}

function normalizedMoney(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value * 100) / 100);
}

function definedDate(value: string | null | undefined) {
  return value ?? undefined;
}

function withoutReservationAction(actions: InventoryLifecycleCommand[] | undefined) {
  return (actions ?? []).filter((action) => action !== "reservation.create");
}
