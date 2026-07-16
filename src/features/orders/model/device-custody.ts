import type { DeviceCustodyStatus, DeviceUnlockInput, RepairOrder } from "@/lib/repairdesk/types";

export const DEVICE_CUSTODY_WITH_SHOP = "with_shop" as const;
export const DEVICE_CUSTODY_WITH_CUSTOMER = "with_customer" as const;

export const deviceCustodyStatuses = [
  DEVICE_CUSTODY_WITH_SHOP,
  DEVICE_CUSTODY_WITH_CUSTOMER,
] as const satisfies readonly DeviceCustodyStatus[];

export const deviceCustodyLabels: Record<DeviceCustodyStatus, string> = {
  with_shop: "设备留店",
  with_customer: "设备未留店",
};

const physicalCustodyStatuses = new Set([
  "diagnosing",
  "mail_in_progress",
  "repairing",
  "repaired",
  "notified",
  "waiting_pickup",
  "unfixed_pickup",
]);

export function isDeviceCustodyStatus(value: unknown): value is DeviceCustodyStatus {
  return value === DEVICE_CUSTODY_WITH_SHOP || value === DEVICE_CUSTODY_WITH_CUSTOMER;
}

export function deviceCustodyStatusFromOrder(
  order: Pick<RepairOrder, "device_custody_status">,
): DeviceCustodyStatus | null {
  return isDeviceCustodyStatus(order.device_custody_status) ? order.device_custody_status : null;
}

export function deviceCustodyLabel(status: DeviceCustodyStatus | null | undefined) {
  return isDeviceCustodyStatus(status) ? deviceCustodyLabels[status] : "保管状态待确认";
}

export function deviceCustodyDisplayLabel(
  status: DeviceCustodyStatus | null | undefined,
  deliveredAt?: string | null,
) {
  if (status === DEVICE_CUSTODY_WITH_CUSTOMER && deliveredAt) return "已归还客户";
  if (status === DEVICE_CUSTODY_WITH_CUSTOMER) return "客户持有";
  if (status === DEVICE_CUSTODY_WITH_SHOP) return "门店保管";
  return "保管未确认";
}

export function formatDeviceCustodyEvent(payload: Record<string, unknown>) {
  const action = typeof payload.action === "string" ? payload.action : "";
  const supportedActions = new Set([
    "device_custody_changed",
    "device_custody_backfilled",
    "device_custody_received",
    "device_custody_returned",
    "device_custody_corrected",
    "terminal_custody_correction",
    "device_custody_import_rolled_back",
    "custody_return_confirmed",
  ]);
  if (!supportedActions.has(action)) return null;

  const from = isDeviceCustodyStatus(payload.from) ? payload.from : null;
  const to = isDeviceCustodyStatus(payload.to) ? payload.to : null;
  const fromLabel = deviceCustodyDisplayLabel(from);
  const toLabel =
    action === "custody_return_confirmed"
      ? deviceCustodyDisplayLabel(to ?? DEVICE_CUSTODY_WITH_CUSTOMER, "confirmed")
      : deviceCustodyDisplayLabel(to);
  const prefix =
    action === "custody_return_confirmed"
      ? "已确认设备退还"
      : action === "device_custody_import_rolled_back"
        ? "设备保管导入已回滚"
        : action === "device_custody_corrected"
          ? "设备保管已导入调整"
          : !from || action === "device_custody_backfilled"
            ? "设备保管已补录"
            : to === DEVICE_CUSTODY_WITH_SHOP || action === "device_custody_received"
              ? "已确认收机"
              : to === DEVICE_CUSTODY_WITH_CUSTOMER || action === "device_custody_returned"
                ? "已确认设备归还"
                : "设备保管已更新";
  const route = to ? `：${fromLabel} → ${toLabel}` : "";
  const reason =
    typeof payload.reason === "string" && payload.reason.trim()
      ? `，说明：${payload.reason.trim()}`
      : "";
  const credentialsCleared = payload.credentials_cleared === true ? "，解锁信息已清除" : "";
  return `${prefix}${route}${reason}${credentialsCleared}`;
}

export function deviceCustodyBlocksStatus(status: string, workflowBucket?: string | null) {
  return (
    physicalCustodyStatuses.has(status) ||
    workflowBucket === "diagnosing" ||
    workflowBucket === "repair" ||
    workflowBucket === "pickup"
  );
}

export function deviceCustodyAllowsStatus(
  custodyStatus: DeviceCustodyStatus | null | undefined,
  status: string,
  workflowBucket?: string | null,
) {
  if (deviceCustodyBlocksStatus(status, workflowBucket)) {
    return custodyStatus === DEVICE_CUSTODY_WITH_SHOP;
  }
  if (
    status === "completed" ||
    status === "cancelled" ||
    workflowBucket === "done" ||
    workflowBucket === "cancelled"
  ) {
    return Boolean(custodyStatus);
  }
  return true;
}

export function deviceCustodyAllowsChange(input: {
  current: DeviceCustodyStatus | null | undefined;
  target: DeviceCustodyStatus;
  status: string;
  exceptionStatus?: string | null;
  workflowBucket?: string | null;
}) {
  if (input.current === input.target) return false;
  if (
    (input.status === "completed" || input.workflowBucket === "done") &&
    input.target === DEVICE_CUSTODY_WITH_SHOP
  ) {
    return false;
  }

  const cancelled =
    input.status === "cancelled" ||
    input.exceptionStatus === "cancelled" ||
    input.workflowBucket === "cancelled";
  if (
    input.current === DEVICE_CUSTODY_WITH_SHOP &&
    input.target === DEVICE_CUSTODY_WITH_CUSTOMER &&
    (cancelled || deviceCustodyBlocksStatus(input.status, input.workflowBucket))
  ) {
    return false;
  }

  return true;
}

export function normalizeUnlockForCustody(
  custodyStatus: DeviceCustodyStatus,
  unlock: DeviceUnlockInput | undefined,
): DeviceUnlockInput {
  return custodyStatus === DEVICE_CUSTODY_WITH_CUSTOMER
    ? { method: "none" }
    : (unlock ?? { method: "none" });
}

export function hasUnlockValue(input: DeviceUnlockInput | undefined) {
  if (!input || input.method === "none") return false;
  if (input.method === "pattern") return input.pattern.length > 0;
  return input.value.trim().length > 0;
}

export function isDeviceCustodyReasonValid(reason: string, minimumLength: number) {
  return reason.trim().length >= minimumLength;
}
