import type {
  InventoryLifecycleCommand,
  InventoryLifecycleListSummary,
} from "@/lib/repairdesk/types";
import type { InventoryDetailNextAction } from "@/features/inventory/model/inventory-detail-next-action";

export function resolveInventoryDetailNextAction({
  itemId,
  summary,
  lifecycleSummaryState = "ready",
  canEdit,
}: {
  itemId: string;
  summary?: InventoryLifecycleListSummary | null;
  lifecycleSummaryState?: "loading" | "ready" | "unavailable" | "dormant";
  canEdit: boolean;
}): InventoryDetailNextAction {
  if (lifecycleSummaryState === "loading") {
    return {
      kind: "loading",
      label: "正在读取下一动作",
      reason: "lifecycle-loading",
    };
  }

  if (!summary) {
    return lifecycleSummaryState === "unavailable" || lifecycleSummaryState === "dormant"
      ? editAction(itemId, canEdit)
      : { kind: "none", reason: "lifecycle-ready-without-summary" };
  }

  const allowedActions = getAllowedActions(summary);
  const afterSalesCaseId = summary.after_sales?.case_id;
  if (afterSalesCaseId) {
    if (
      allowedActions.includes("after_sales.update") ||
      allowedActions.includes("after_sales.close")
    ) {
      return {
        kind: "action",
        id: "after-sales-work",
        label: "继续处理售后",
        href: `/inventory/after-sales/${encodeURIComponent(afterSalesCaseId)}`,
        command: allowedActions.includes("after_sales.update")
          ? "after_sales.update"
          : "after_sales.close",
      };
    }
    return {
      kind: "action",
      id: "view-after-sales",
      label: "查看售后案件",
      href: `/inventory/after-sales/${encodeURIComponent(afterSalesCaseId)}`,
      readOnly: true,
    };
  }

  const saleOrderId = summary.sale_order_id;
  if (saleOrderId) {
    const collectionCommand = ["payment.append", "sale.complete", "reservation.cancel"].find(
      (command) => allowedActions.includes(command as InventoryLifecycleCommand),
    ) as "payment.append" | "sale.complete" | "reservation.cancel" | undefined;
    if (collectionCommand) {
      return {
        kind: "action",
        id: "sale-collection",
        label: "继续预订与收款",
        href: `/inventory/sales/${encodeURIComponent(saleOrderId)}`,
        command: collectionCommand,
      };
    }
    if (allowedActions.includes("pickup.confirm")) {
      return {
        kind: "action",
        id: "sale-pickup",
        label: "确认客户取走",
        href: `/inventory/sales/${encodeURIComponent(saleOrderId)}`,
        command: "pickup.confirm",
      };
    }
    const warrantyCommand = ["warranty.adjust", "after_sales.create"].find((command) =>
      allowedActions.includes(command as InventoryLifecycleCommand),
    ) as "warranty.adjust" | "after_sales.create" | undefined;
    if (warrantyCommand) {
      return {
        kind: "action",
        id: "sale-warranty",
        label: "打开销售与保修",
        href: `/inventory/sales/${encodeURIComponent(saleOrderId)}`,
        command: warrantyCommand,
      };
    }
    return {
      kind: "action",
      id: "view-sale",
      label: "查看销售记录",
      href: `/inventory/sales/${encodeURIComponent(saleOrderId)}`,
      readOnly: true,
    };
  }

  if (allowedActions.includes("reservation.create")) {
    return {
      kind: "action",
      id: "reserve-product",
      label: "开始预订",
      href: `/inventory/${encodeURIComponent(itemId)}/reserve`,
      command: "reservation.create",
    };
  }

  if (allowedActions.includes("inspection.save")) {
    return {
      kind: "action",
      id: "inspection-editor",
      label: "补齐设备检测",
      target: "inspection-editor",
      command: "inspection.save",
    };
  }

  return {
    kind: "none",
    reason: "no-server-action",
  };
}

function getAllowedActions(summary: InventoryLifecycleListSummary): InventoryLifecycleCommand[] {
  return summary.projection?.mode === "exact"
    ? summary.projection.allowed_actions
    : summary.allowed_actions;
}

function editAction(itemId: string, canEdit: boolean): InventoryDetailNextAction {
  return canEdit
    ? {
        kind: "action",
        id: "edit-product",
        label: "编辑商品",
        href: `/inventory/${encodeURIComponent(itemId)}/edit`,
      }
    : { kind: "none", reason: "no-server-action" };
}
