import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderNotifyStatus } from "@/lib/repairdesk/types";

export type OrderDetailPrimaryAction = "approval" | "flow" | "notify" | "payment" | null;

export function resolveOrderDetailPrimaryAction({
  status,
  cancelled,
  notifyStatus,
  approvalOverdue,
  pickupOverdue,
  approvalDecisionAvailable,
  flowAvailable,
  notificationAvailable,
  paymentAvailable,
}: {
  status: RepairOrderStatus;
  cancelled?: boolean;
  notifyStatus?: OrderNotifyStatus;
  approvalOverdue?: boolean;
  pickupOverdue?: boolean;
  approvalDecisionAvailable: boolean;
  flowAvailable: boolean;
  notificationAvailable: boolean;
  paymentAvailable: boolean;
}): OrderDetailPrimaryAction {
  if (cancelled || status === "cancelled") return null;
  if (status === "completed") return paymentAvailable ? "payment" : null;

  if (approvalDecisionAvailable) return "approval";

  const notificationDue =
    approvalOverdue ||
    pickupOverdue ||
    ((["quoted", "parts_arrived", "repaired"] as RepairOrderStatus[]).includes(status) &&
      notifyStatus !== "sent" &&
      notifyStatus !== "contacted");

  if (notificationAvailable && notificationDue) {
    return "notify";
  }

  if (
    paymentAvailable &&
    (["notified", "unfixed_pickup", "waiting_pickup"] as RepairOrderStatus[]).includes(status)
  ) {
    return "payment";
  }

  if (flowAvailable) return "flow";
  if (paymentAvailable) return "payment";
  return null;
}
