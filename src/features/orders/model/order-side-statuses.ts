import type { StatusTone } from "@/lib/mock/enums";
import type { OrderListItem, Supplier } from "@/lib/repairdesk/types";

import {
  orderApprovalFlowStatusMeta,
  orderExceptionMeta,
  orderNotifyStatusMeta,
  orderPartsStatusMeta,
} from "./canonical-order-status";

export interface OrderSideStatusBadge {
  key: string;
  label: string;
  tone: StatusTone;
  description: string;
}

export function getOrderSideStatusBadges(
  order: Pick<
    OrderListItem,
    | "status"
    | "order_type"
    | "supplier_name"
    | "supplier_id"
    | "exception_status"
    | "approval_flow_status"
    | "parts_status"
    | "notify_status"
  >,
  supplier?: Pick<Supplier, "name">,
): OrderSideStatusBadge[] {
  const badges: OrderSideStatusBadge[] = [];
  const supplierName = supplier?.name ?? order.supplier_name;

  if (order.status === "mail_in_progress") {
    badges.push({
      key: "logistics-mail",
      label: supplierName ? "外修寄送中" : "邮寄中",
      tone: "info",
      description: supplierName
        ? `设备正在寄送或外修，供应商：${supplierName}`
        : "设备尚未进入店内维修主流程，当前处于邮寄/送修途中。",
    });
  } else if (order.order_type === "dropoff_repair" || order.supplier_id) {
    badges.push({
      key: "external-repair",
      label: supplierName ? `外修 ${supplierName}` : "送修单",
      tone: "progress",
      description: supplierName
        ? `该订单关联外修供应商：${supplierName}`
        : "该订单属于送修/寄修类型，外修进度作为辅助状态展示。",
    });
  }

  if (order.exception_status) {
    const meta = orderExceptionMeta[order.exception_status];
    badges.push({
      key: `exception-${order.exception_status}`,
      label: meta.shortLabel,
      tone: meta.tone,
      description: meta.label,
    });
  }

  if (order.approval_flow_status && order.approval_flow_status !== "not_required") {
    const meta = orderApprovalFlowStatusMeta[order.approval_flow_status];
    badges.push({
      key: `approval-${order.approval_flow_status}`,
      label: meta.label,
      tone: meta.tone,
      description: "报价审批是客户沟通状态，不等同于维修主流程阶段。",
    });
  }

  if (order.parts_status && order.parts_status !== "not_required") {
    const meta = orderPartsStatusMeta[order.parts_status];
    badges.push({
      key: `parts-${order.parts_status}`,
      label: meta.label,
      tone: meta.tone,
      description: "配件状态用于辅助说明订件进度，主流程仍按阶段推进。",
    });
  }

  if (order.notify_status && order.notify_status !== "not_sent") {
    const meta = orderNotifyStatusMeta[order.notify_status];
    badges.push({
      key: `notify-${order.notify_status}`,
      label: meta.label,
      tone: meta.tone,
      description: "通知状态只说明是否已联系客户，不作为主维修阶段。",
    });
  }

  return dedupeBadges(badges);
}

function dedupeBadges(badges: OrderSideStatusBadge[]) {
  const seen = new Set<string>();
  return badges.filter((badge) => {
    if (seen.has(badge.label)) return false;
    seen.add(badge.label);
    return true;
  });
}
