import type { OnboardingRequest } from "@/lib/repairdesk/api";

export const onboardingRoleLabels: Record<string, string> = {
  owner: "店主",
  manager: "经理",
  technician: "维修",
  sales: "前台/销售",
  viewer: "只读",
};

export type OnboardingQueueTone = "neutral" | "warn" | "danger";

export interface OnboardingQueueSummary {
  total: number;
  createStoreCount: number;
  joinStoreCount: number;
  oldestWaitLabel: string;
  attentionTone: OnboardingQueueTone;
  headline: string;
  nextAction: string;
}

export function buildOnboardingQueueSummary(
  requests: OnboardingRequest[],
  now = new Date(),
): OnboardingQueueSummary {
  const sortedRequests = sortOnboardingRequests(requests);
  const createStoreCount = requests.filter(
    (request) => request.request_type === "create_store",
  ).length;
  const joinStoreCount = requests.length - createStoreCount;
  const oldestRequest = sortedRequests[0];
  const oldestWaitHours = oldestRequest ? getWaitHours(oldestRequest.created_at, now) : 0;
  const oldestWaitLabel = oldestRequest ? formatWaitDuration(oldestWaitHours) : "无等待";
  const attentionTone =
    oldestWaitHours >= 72 ? "danger" : oldestWaitHours >= 24 ? "warn" : "neutral";

  return {
    total: requests.length,
    createStoreCount,
    joinStoreCount,
    oldestWaitLabel,
    attentionTone,
    headline:
      requests.length === 0
        ? "审批队列已清空"
        : `最早等待 ${oldestWaitLabel} · 优先处理最早提交申请`,
    nextAction:
      requests.length === 0
        ? "暂无新店铺或成员加入申请。"
        : createStoreCount > 0
          ? "先核对店铺名称，再批准创建店铺。"
          : "核对目标店铺和角色后批准加入。",
  };
}

export function sortOnboardingRequests(requests: OnboardingRequest[]) {
  return [...requests].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();
    return leftTime - rightTime;
  });
}

export function getOnboardingRequestTarget(request: OnboardingRequest) {
  return request.request_type === "create_store"
    ? request.desired_store_name?.trim() || "新店铺"
    : request.target_store_name?.trim() || request.target_store_id || "已有店铺";
}

export function getOnboardingRequestTypeLabel(request: OnboardingRequest) {
  return request.request_type === "create_store" ? "创建店铺" : "加入店铺";
}

export function getOnboardingRequestedRoleLabel(request: OnboardingRequest) {
  return onboardingRoleLabels[request.requested_role] ?? request.requested_role;
}

export function formatOnboardingDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getWaitHours(createdAt: string, now: Date) {
  const diff = now.getTime() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(diff / 3_600_000));
}

function formatWaitDuration(hours: number) {
  if (hours < 1) return "1 小时内";
  if (hours < 24) return `${hours} 小时`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days} 天 ${restHours} 小时` : `${days} 天`;
}
