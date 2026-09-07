import type { RepairOrderStatus } from "@/lib/mock/enums";

export const orderTransitionFailureCodes = [
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "TARGET_DISABLED",
  "TRANSITION_NOT_ALLOWED",
  "REASON_REQUIRED",
  "APPROVAL_REQUIRED",
  "CUSTODY_REQUIRED",
  "DEVICE_NOT_IN_STORE",
  "ORDER_LOCKED",
  "UNAVAILABLE",
  "TRANSITION_FAILED",
] as const;

export type OrderTransitionFailureCode = (typeof orderTransitionFailureCodes)[number];

const legacyReasons: Record<string, OrderTransitionFailureCode> = {
  工单不存在: "NOT_FOUND",
  目标状态不存在: "TARGET_DISABLED",
  目标工单状态不存在或已停用: "TARGET_DISABLED",
  目标状态与当前一致: "TRANSITION_NOT_ALLOWED",
  状态流转不合法: "TRANSITION_NOT_ALLOWED",
  "状态流转必须使用具体工单状态，不能使用主流程分组": "TRANSITION_NOT_ALLOWED",
  "自定义状态尚未绑定主流程阶段，当前不能用于工单流转": "TRANSITION_NOT_ALLOWED",
  客户审批阶段必须通过审批处理记录同意或拒绝: "APPROVAL_REQUIRED",
  "请先确认设备是留在门店还是由客户带走，再进行此状态流转": "CUSTODY_REQUIRED",
  "设备当前未留店，不能进入诊断、维修或待取机状态": "DEVICE_NOT_IN_STORE",
  "工单已被更新，请刷新后再试": "CONFLICT",
  "缺少工单版本，请刷新后重试": "CONFLICT",
  "缺少工单版本，请刷新后再试": "CONFLICT",
  "该操作标识已用于不同请求，请刷新后重试": "CONFLICT",
  "该工单记录已作废，只能查看历史证据": "ORDER_LOCKED",
  已结束工单必须使用审计化纠正或重新打开操作: "ORDER_LOCKED",
  当前员工无权更新此工单: "FORBIDDEN",
};

/** A closed classification shared by the server and UI; never returns raw error text. */
export function classifyOrderTransitionFailure(error: unknown): string {
  const failure =
    error && typeof error === "object"
      ? (error as { code?: unknown; status?: unknown; message?: unknown })
      : undefined;
  const code = typeof error === "string" ? error : failure?.code;
  if (typeof code === "string" && orderTransitionFailureCodes.some((known) => known === code)) {
    return code;
  }
  if (
    failure?.status === 401 ||
    failure?.status === 403 ||
    ["AUTH_REQUIRED", "UNAUTHORIZED", "actor_forbidden"].includes(String(code))
  )
    return "FORBIDDEN";
  if (failure?.status === 404 || ["ORDER_NOT_FOUND", "order_not_found"].includes(String(code)))
    return "NOT_FOUND";
  if (
    failure?.status === 409 ||
    ["ORDER_WRITE_CONFLICT", "stale_version", "idempotency_conflict"].includes(String(code))
  )
    return "CONFLICT";
  if (typeof failure?.status === "number" && failure.status >= 500) return "UNAVAILABLE";
  const message = typeof error === "string" ? error : failure?.message;
  if (typeof message !== "string") return "TRANSITION_FAILED";
  if (Object.prototype.hasOwnProperty.call(legacyReasons, message)) return legacyReasons[message];
  if (/^「[^「」\r\n]+」已停用，不能流转到该状态$/.test(message)) return "TARGET_DISABLED";
  if (/^「[^「」\r\n]+」不能直接流转到「[^「」\r\n]+」$/.test(message))
    return "TRANSITION_NOT_ALLOWED";
  if (/^流转到「[^「」\r\n]+」需要填写原因$/.test(message)) return "REASON_REQUIRED";
  return "TRANSITION_FAILED";
}

export type OrderBulkTransitionFailure = {
  id: string;
  publicNo?: string;
  reason: string;
};

export type OrderBulkTransitionRecovery = {
  scopeKey: string;
  to: RepairOrderStatus;
  successCount: number;
  failures: OrderBulkTransitionFailure[];
  requestFailed?: boolean;
};

/** Keep only attempted failed IDs, in request order; never retry unrelated response IDs. */
export function getFailedOrderTransitionIds(requestedIds: string[], failures: { id: string }[]) {
  const failedIds = new Set(failures.map((failure) => failure.id));
  return [...new Set(requestedIds)].filter((id) => failedIds.has(id));
}
