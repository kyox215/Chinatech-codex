// Default workflow values seeded into order_workflow_statuses.
// Stores can add their own status codes after the workflow migration.

export const repairOrderStatus = [
  "new",
  "rework",
  "mail_in_progress",
  "diagnosing",
  "quoted",
  "waiting_approval",
  "parts_ordered",
  "parts_arrived",
  "repairing",
  "repaired",
  "notified",
  "unfixed_pickup",
  "waiting_pickup",
  "completed",
  "cancelled",
] as const;
export type DefaultRepairOrderStatus = (typeof repairOrderStatus)[number];
export type RepairOrderStatus = string;

export const repairOrderType = ["quick_repair", "dropoff_repair"] as const;
export type RepairOrderType = (typeof repairOrderType)[number];

export const approvalStatus = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof approvalStatus)[number];

export type StatusTone = "neutral" | "info" | "progress" | "warn" | "success" | "danger";

export const statusMeta: Record<string, { label: string; shortLabel?: string; tone: StatusTone }> =
  {
    new: { label: "新建", tone: "info" },
    rework: { label: "返修", tone: "warn" },
    mail_in_progress: { label: "寄修中", shortLabel: "寄修", tone: "progress" },
    diagnosing: { label: "检测中", tone: "progress" },
    quoted: { label: "已报价", tone: "progress" },
    waiting_approval: { label: "待审批", tone: "warn" },
    parts_ordered: { label: "配件已订", tone: "progress" },
    parts_arrived: { label: "配件已到", tone: "progress" },
    repairing: { label: "维修中", tone: "progress" },
    repaired: { label: "已修复", tone: "success" },
    notified: { label: "已通知", tone: "success" },
    unfixed_pickup: { label: "未修取机", tone: "danger" },
    waiting_pickup: { label: "待取机", tone: "warn" },
    completed: { label: "已完成", tone: "success" },
    cancelled: { label: "已取消", tone: "neutral" },
  };

export function getStatusMeta(status: RepairOrderStatus | undefined) {
  if (status && statusMeta[status]) return statusMeta[status];
  return {
    label: status || "未知状态",
    shortLabel: status || "未知",
    tone: "neutral" as StatusTone,
  };
}

export const orderTypeMeta: Record<RepairOrderType, { label: string }> = {
  quick_repair: { label: "快修" },
  dropoff_repair: { label: "送修" },
};

export const approvalMeta: Record<ApprovalStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "待审批", tone: "warn" },
  approved: { label: "已批准", tone: "success" },
  rejected: { label: "已拒绝", tone: "danger" },
};

// Convenience groupings for tab views — UI only, not a state machine.
export const statusGroups = {
  in_progress: [
    "new",
    "rework",
    "mail_in_progress",
    "diagnosing",
    "quoted",
    "parts_ordered",
    "parts_arrived",
    "repairing",
  ] as RepairOrderStatus[],
  awaiting_approval: ["waiting_approval"] as RepairOrderStatus[],
  awaiting_pickup: [
    "repaired",
    "notified",
    "waiting_pickup",
    "unfixed_pickup",
  ] as RepairOrderStatus[],
  completed: ["completed"] as RepairOrderStatus[],
  cancelled: ["cancelled"] as RepairOrderStatus[],
};
