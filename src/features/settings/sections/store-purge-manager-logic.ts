import type { StoreLifecycleActionCapability, StorePurgeRequest } from "@/lib/repairdesk/types";

export type StorePurgeManagerMode = "request" | "confirm";

export type MutationOutcome = {
  kind: StorePurgeManagerMode | "cancel";
  previousState: StorePurgeRequest["state"] | null;
};

const knownPurgeRequestStates: ReadonlySet<StorePurgeRequest["state"]> = new Set([
  "cooling",
  "preparing_export",
  "ready_for_confirmation",
  "scheduled",
  "cancelled",
  "purging",
  "failed",
  "completed",
]);

export function isKnownPurgeRequestState(value: unknown): value is StorePurgeRequest["state"] {
  return (
    typeof value === "string" && knownPurgeRequestStates.has(value as StorePurgeRequest["state"])
  );
}

export function cancellableState(request: StorePurgeRequest) {
  return (
    ["cooling", "preparing_export", "ready_for_confirmation", "scheduled"].includes(
      request.state,
    ) && !request.destructive_step_started
  );
}

export function isMutationOutcomeResolved(
  outcome: MutationOutcome,
  request: StorePurgeRequest | null,
) {
  if (!request || !isKnownPurgeRequestState(request.state)) return false;
  if (outcome.kind === "cancel") return request.state === "cancelled";
  if (outcome.kind === "confirm") {
    return ["scheduled", "purging", "failed", "completed"].includes(request.state);
  }
  return (
    request.state !== "cancelled" &&
    (outcome.previousState === null || outcome.previousState === "cancelled")
  );
}

export function reconciledMutationCopy(kind: MutationOutcome["kind"]) {
  if (kind === "cancel") return "取消结果已从服务器状态核对并同步";
  if (kind === "confirm") return "最终确认结果已从服务器状态核对并同步";
  return "永久删除申请结果已从服务器状态核对并同步";
}

export function purgeStatusCopy(state: string) {
  switch (state) {
    case "cooling":
      return "永久删除冷静期中";
    case "preparing_export":
      return "正在准备加密备份";
    case "ready_for_confirmation":
      return "可以进行最终确认";
    case "scheduled":
      return "已最终确认，等待后台清除";
    case "purging":
      return "正在永久清除，已不可取消";
    case "failed":
      return "后台清除暂停，需要平台处理";
    case "completed":
      return "永久删除已完成";
    default:
      return "永久删除处理中";
  }
}

export function purgeUnavailableCopy(code: StoreLifecycleActionCapability["code"]) {
  if (code === "feature_disabled") return "永久删除功能正在准备中。";
  if (code === "primary_owner_required") return "只有系统登记的店铺主账号可以申请永久删除。";
  if (code === "enforcement_unhealthy") return "店铺写入保护尚未启用，当前不能申请永久删除。";
  if (code === "migration_unavailable") return "店铺保护尚未安装完成，当前不能申请永久删除。";
  return "当前店铺暂时不能申请永久删除。";
}

export function formatTimestamp(value: string) {
  if (!value) return "未提供";
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toLocaleString("zh-CN");
}
