import type { RepairOrderStatus, StatusTone } from "@/lib/mock/enums";
import type {
  OrderApprovalFlowStatus,
  OrderExceptionStatus,
  OrderNotifyStatus,
  OrderPartsStatus,
  OrderPaymentStatus,
  OrderWorkflowStatusCode,
} from "@/lib/repairdesk/types";

export const orderWorkflowStatuses = [
  "intake",
  "diagnosis",
  "quote",
  "parts",
  "repair",
  "pickup",
  "closed",
] as const satisfies readonly OrderWorkflowStatusCode[];

export const orderWorkflowMeta: Record<
  OrderWorkflowStatusCode,
  { label: string; shortLabel: string; actionLabel: string; tone: StatusTone }
> = {
  intake: { label: "收机", shortLabel: "收机", actionLabel: "开始检测", tone: "info" },
  diagnosis: { label: "检测", shortLabel: "检测", actionLabel: "发送报价", tone: "progress" },
  quote: { label: "报价确认", shortLabel: "报价", actionLabel: "继续处理", tone: "warn" },
  parts: { label: "等配件", shortLabel: "配件", actionLabel: "开始维修", tone: "progress" },
  repair: { label: "维修中", shortLabel: "维修", actionLabel: "完成维修", tone: "progress" },
  pickup: { label: "待取机", shortLabel: "取机", actionLabel: "完成交付", tone: "warn" },
  closed: { label: "已结案", shortLabel: "结案", actionLabel: "查看记录", tone: "success" },
};

export const orderExceptionMeta: Record<
  OrderExceptionStatus,
  { label: string; shortLabel: string; tone: StatusTone }
> = {
  cancelled: { label: "已取消", shortLabel: "取消", tone: "neutral" },
  unrepairable: { label: "无法维修", shortLabel: "无法修", tone: "danger" },
  returned_unfixed: { label: "未修取机", shortLabel: "未修", tone: "danger" },
  rework: { label: "返修", shortLabel: "返修", tone: "warn" },
  waiting_customer: { label: "等客户", shortLabel: "等客户", tone: "warn" },
  paused: { label: "暂停", shortLabel: "暂停", tone: "neutral" },
};

export const orderPaymentStatusMeta: Record<
  OrderPaymentStatus,
  { label: string; tone: StatusTone }
> = {
  unpaid: { label: "未付款", tone: "warn" },
  partial: { label: "部分付款", tone: "progress" },
  paid: { label: "已结清", tone: "success" },
  refunded: { label: "已退款", tone: "neutral" },
};

export const orderPartsStatusMeta: Record<OrderPartsStatus, { label: string; tone: StatusTone }> = {
  not_required: { label: "不需配件", tone: "neutral" },
  needed: { label: "需订件", tone: "warn" },
  ordered: { label: "已订件", tone: "progress" },
  arrived: { label: "配件到货", tone: "success" },
  out_of_stock: { label: "缺货", tone: "danger" },
};

export const orderApprovalFlowStatusMeta: Record<
  OrderApprovalFlowStatus,
  { label: string; tone: StatusTone }
> = {
  not_required: { label: "无需确认", tone: "neutral" },
  waiting_customer: { label: "等客户确认", tone: "warn" },
  approved: { label: "客户同意", tone: "success" },
  rejected: { label: "客户拒绝", tone: "danger" },
};

export const orderNotifyStatusMeta: Record<OrderNotifyStatus, { label: string; tone: StatusTone }> =
  {
    not_sent: { label: "未通知", tone: "neutral" },
    sent: { label: "已通知", tone: "success" },
    contacted: { label: "已联系", tone: "success" },
  };

export const orderWorkflowTransitions: Partial<
  Record<OrderWorkflowStatusCode, OrderWorkflowStatusCode>
> = {
  intake: "diagnosis",
  diagnosis: "quote",
  quote: "parts",
  parts: "repair",
  repair: "pickup",
  pickup: "closed",
};

export function workflowStatusFromLegacyStatus(status: RepairOrderStatus): OrderWorkflowStatusCode {
  if (["new", "rework", "mail_in_progress"].includes(status)) return "intake";
  if (status === "diagnosing") return "diagnosis";
  if (["quoted", "waiting_approval"].includes(status)) return "quote";
  if (["parts_ordered", "parts_arrived"].includes(status)) return "parts";
  if (["repairing", "repaired"].includes(status)) return "repair";
  if (["notified", "unfixed_pickup", "waiting_pickup"].includes(status)) {
    return "pickup";
  }
  return "closed";
}

export function legacyStatusFromWorkflowStatus(
  status: OrderWorkflowStatusCode,
  context?: { partsStatus?: OrderPartsStatus; exceptionStatus?: OrderExceptionStatus | null },
): RepairOrderStatus {
  if (context?.exceptionStatus === "cancelled") return "cancelled";
  if (context?.exceptionStatus === "rework") return "rework";
  if (context?.exceptionStatus === "returned_unfixed") return "unfixed_pickup";
  if (status === "intake") return "new";
  if (status === "diagnosis") return "diagnosing";
  if (status === "quote") return "waiting_approval";
  if (status === "parts")
    return context?.partsStatus === "arrived" ? "parts_arrived" : "parts_ordered";
  if (status === "repair") return "repairing";
  if (status === "pickup") return "waiting_pickup";
  return "completed";
}

export function paymentStatusFromMoney(input: {
  isPaid?: boolean;
  depositAmount?: number;
  balanceAmount?: number;
}): OrderPaymentStatus {
  if (input.isPaid || Number(input.balanceAmount ?? 0) <= 0) return "paid";
  if (Number(input.depositAmount ?? 0) > 0) return "partial";
  return "unpaid";
}

export function approvalFlowStatusFromLegacyStatus(
  status: RepairOrderStatus,
  approvalStatus?: string,
): OrderApprovalFlowStatus {
  if (approvalStatus === "approved") return "approved";
  if (approvalStatus === "rejected") return "rejected";
  if (status === "waiting_approval") return "waiting_customer";
  return "not_required";
}

export function partsStatusFromLegacyStatus(status: RepairOrderStatus): OrderPartsStatus {
  if (status === "parts_ordered") return "ordered";
  if (status === "parts_arrived") return "arrived";
  return "not_required";
}

export function notifyStatusFromLegacyStatus(status: RepairOrderStatus): OrderNotifyStatus {
  if (["notified", "waiting_pickup", "completed"].includes(status)) return "sent";
  return "not_sent";
}
