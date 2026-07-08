import type { OnboardingRequest } from "@/lib/repairdesk/types";

export function canPlatformApproveOnboardingRequest(request: OnboardingRequest) {
  return false;
}

export function canPlatformRejectOnboardingRequest(request: OnboardingRequest) {
  return request.review_scope === "platform";
}

export function canStoreReviewAccessRequest(request: OnboardingRequest, storeId: string) {
  return (
    request.request_type === "join_store" &&
    request.review_scope === "store" &&
    request.target_store_id === storeId
  );
}

export function redactRequesterOnboardingRequest(request: OnboardingRequest): OnboardingRequest {
  if (request.request_type !== "join_store") return request;
  return {
    ...request,
    review_scope: "platform",
    target_store_id: undefined,
    target_store_name: undefined,
    resulting_store_id: request.status === "approved" ? request.resulting_store_id : undefined,
    reviewed_by: undefined,
    reviewed_by_membership_id: undefined,
  };
}

export function createOnboardingAuditSnapshot(request: OnboardingRequest): Record<string, unknown> {
  return {
    id: request.id,
    requester_user_id: request.requester_user_id,
    request_type: request.request_type,
    requested_role: request.requested_role,
    approved_role: request.approved_role,
    status: request.status,
    review_scope: request.review_scope,
    has_target_owner_email: Boolean(request.target_owner_email),
    has_target_store: Boolean(request.target_store_id),
    resulting_store_id:
      request.request_type === "create_store" ? request.resulting_store_id : undefined,
    reviewed_by: request.reviewed_by,
    reviewed_by_membership_id: request.reviewed_by_membership_id,
    reviewed_at: request.reviewed_at,
  };
}
