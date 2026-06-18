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
  targetStoreId: string;
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

export function getOnboardingRequestSummary(request: OnboardingRequest) {
  if (request.request_type === "create_store") {
    return `创建店铺：${request.desired_store_name || "未填写店铺名"}`;
  }

  return `加入店铺：${request.target_store_name || request.target_store_id || "未选择店铺"} · ${
    onboardingRoleLabels[
      request.requested_role as NonNullable<OnboardingRequestInput["requested_role"]>
    ] ?? request.requested_role
  }`;
}

export function validateOnboardingForm(
  form: OnboardingFormState,
  status: Pick<OnboardingStatus, "availableStores"> | null | undefined,
): OnboardingFormValidation {
  if (form.mode === "create_store") {
    const name = form.storeName.trim();
    if (name.length < 2) {
      return { canSubmit: false, reason: "店铺名称至少需要 2 个字符" };
    }
    if (name.length > 80) {
      return { canSubmit: false, reason: "店铺名称不能超过 80 个字符" };
    }
    return { canSubmit: true, reason: "将提交新店铺创建申请" };
  }

  if (!status?.availableStores.length) {
    return { canSubmit: false, reason: "暂无可申请加入的店铺，请创建店铺或联系平台管理员" };
  }
  if (!form.targetStoreId) {
    return { canSubmit: false, reason: "请选择要加入的店铺" };
  }
  if (!status.availableStores.some((store) => store.id === form.targetStoreId)) {
    return { canSubmit: false, reason: "所选店铺不在可申请列表中" };
  }

  return { canSubmit: true, reason: "将提交加入店铺申请" };
}

export function buildOnboardingRequestInput(form: OnboardingFormState): OnboardingRequestInput {
  return form.mode === "create_store"
    ? {
        request_type: "create_store",
        desired_store_name: form.storeName.trim(),
      }
    : {
        request_type: "join_store",
        target_store_id: form.targetStoreId,
        requested_role: form.requestedRole,
      };
}
