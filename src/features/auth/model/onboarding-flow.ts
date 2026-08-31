import type {
  OnboardingRequest,
  OnboardingRequestInput,
  OnboardingStatus,
} from "@/lib/repairdesk/types";
import { translateMessage, type MessageKey, type MessageValues } from "@/shared/i18n/messages";

export type OnboardingTranslator = (key: MessageKey, values?: MessageValues) => string;

const defaultTranslate: OnboardingTranslator = (key, values) =>
  translateMessage("zh-CN", key, values);

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

export function getOnboardingRoleLabel(
  role: string | null | undefined,
  t: OnboardingTranslator = defaultTranslate,
) {
  switch (role) {
    case "owner":
      return t("role.owner");
    case "manager":
      return t("role.manager");
    case "technician":
      return t("role.technician");
    case "sales":
      return t("role.sales");
    case "viewer":
      return t("role.viewer");
    default:
      return role ?? "";
  }
}

export function getOnboardingRequestSummary(
  request: OnboardingRequest,
  t: OnboardingTranslator = defaultTranslate,
) {
  if (request.request_type === "create_store") {
    return t("onboarding.createSummary", {
      store: request.desired_store_name || t("onboarding.unnamedStore"),
    });
  }

  const target = request.target_store_name
    ? request.target_store_name
    : request.target_owner_email
      ? t("onboarding.ownerTarget", { email: request.target_owner_email })
      : request.target_store_id || t("onboarding.awaitingOwner");
  return t("onboarding.joinSummary", {
    target,
    role: getOnboardingRoleLabel(request.requested_role, t),
  });
}

export function getOnboardingRequestStatusLabel(
  request: OnboardingRequest,
  t: OnboardingTranslator = defaultTranslate,
) {
  switch (request.status) {
    case "approved":
      return t("onboarding.requestApproved");
    case "rejected":
      return t("onboarding.requestRejected");
    case "cancelled":
      return t("onboarding.requestCancelled");
    case "pending":
    default:
      return t("onboarding.requestPending");
  }
}

export function validateOnboardingForm(
  form: OnboardingFormState,
  _status: Pick<OnboardingStatus, "availableStores"> | null | undefined,
  t: OnboardingTranslator = defaultTranslate,
): OnboardingFormValidation {
  if (form.mode === "create_store") {
    const name = form.storeName.trim();
    if (name.length < 2) {
      return { canSubmit: false, reason: t("onboarding.storeNameMin") };
    }
    if (name.length > 80) {
      return { canSubmit: false, reason: t("onboarding.storeNameMax") };
    }
    return { canSubmit: true, reason: t("onboarding.createImmediate") };
  }

  const email = form.targetOwnerEmail.trim();
  if (!email) {
    return { canSubmit: false, reason: t("onboarding.ownerEmailRequired") };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { canSubmit: false, reason: t("onboarding.ownerEmailInvalid") };
  }
  if (form.note.trim().length > 500) {
    return { canSubmit: false, reason: t("onboarding.noteMax") };
  }

  return { canSubmit: true, reason: t("onboarding.joinWait") };
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
