import type {
  OnboardingRequest,
  OnboardingRequestInput,
  OnboardingStatus,
} from "@/lib/repairdesk/types";

export const onboardingRoleLabels: Record<
  NonNullable<OnboardingRequestInput["requested_role"]>,
  string
> = {
  technician: "维修员工",
  sales: "销售/前台",
  manager: "店铺经理",
  viewer: "只读查看",
};

export interface OnboardingFormState {
  mode: OnboardingRequestInput["request_type"];
  storeName: string;
  targetOwnerEmail: string;
  note: string;
  requestedRole: NonNullable<OnboardingRequestInput["requested_role"]>;
}

export interface OnboardingFormValidation {
  canSubmit: boolean;
  reason: string;
}

export function getPendingOnboardingRequest(
  requests: OnboardingRequest[] | undefined,
): OnboardingRequest | undefined {
  return [...(requests ?? [])]
    .filter((request) => request.status === "pending")
    .sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )[0];
}

export function getLatestOnboardingRequest(
  requests: OnboardingRequest[] | undefined,
): OnboardingRequest | undefined {
  return [...(requests ?? [])].sort((left, right) => {
    const rightTime = new Date(right.updated_at || right.created_at).getTime();
    const leftTime = new Date(left.updated_at || left.created_at).getTime();
    return rightTime - leftTime;
  })[0];
}

export function getOnboardingRequestSummary(request: OnboardingRequest) {
  if (request.request_type === "create_store") {
    return `创建店铺：${request.desired_store_name || "未填写店铺名"}`;
  }

  const target = request.target_store_name
    ? request.target_store_name
    : request.target_owner_email
      ? `负责人 ${request.target_owner_email}`
      : request.target_store_id || "等待负责人确认";
  return `加入店铺：${target} · ${
    onboardingRoleLabels[
      request.requested_role as NonNullable<OnboardingRequestInput["requested_role"]>
    ] ?? request.requested_role
  }`;
}

export function getOnboardingRequestStatusLabel(request: OnboardingRequest) {
  switch (request.status) {
    case "approved":
      return "申请已通过";
    case "rejected":
      return "申请未通过";
    case "cancelled":
      return "申请已取消";
    case "pending":
    default:
      return "申请待审核";
  }
}

export function validateOnboardingForm(
  form: OnboardingFormState,
  _status: Pick<OnboardingStatus, "availableStores"> | null | undefined,
): OnboardingFormValidation {
  if (form.mode === "create_store") {
    const name = form.storeName.trim();
    if (name.length < 2) {
      return { canSubmit: false, reason: "店铺名称至少需要 2 个字符" };
    }
    if (name.length > 80) {
      return { canSubmit: false, reason: "店铺名称不能超过 80 个字符" };
    }
    return { canSubmit: true, reason: "将立即创建你的独立私有店铺" };
  }

  const email = form.targetOwnerEmail.trim();
  if (!email) {
    return { canSubmit: false, reason: "请填写目标店铺负责人的邮箱" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { canSubmit: false, reason: "店铺负责人邮箱格式不正确" };
  }
  if (form.note.trim().length > 500) {
    return { canSubmit: false, reason: "申请备注不能超过 500 个字符" };
  }

  return { canSubmit: true, reason: "申请会发送给该负责人审批，不会展示系统内已有店铺列表" };
}

export function buildOnboardingRequestInput(form: OnboardingFormState): OnboardingRequestInput {
  if (form.mode === "create_store") {
    throw new Error("创建店铺请使用创建店铺接口");
  }
  return {
    request_type: "join_store",
    target_owner_email: form.targetOwnerEmail.trim().toLowerCase(),
    note: form.note.trim() || undefined,
    requested_role: form.requestedRole,
  };
}
