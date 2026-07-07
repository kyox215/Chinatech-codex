import { describe, expect, it } from "vitest";

import type { OnboardingRequest } from "@/lib/repairdesk/types";

import {
  canPlatformApproveOnboardingRequest,
  canPlatformRejectOnboardingRequest,
  canStoreReviewAccessRequest,
  redactRequesterOnboardingRequest,
} from "./onboarding-review-policy";

function request(overrides: Partial<OnboardingRequest> = {}): OnboardingRequest {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000001",
    requester_user_id: overrides.requester_user_id ?? "user_1",
    email: overrides.email ?? "staff@example.com",
    display_name: overrides.display_name ?? "Mario",
    request_type: overrides.request_type ?? "join_store",
    desired_store_name: overrides.desired_store_name,
    target_store_id: "target_store_id" in overrides ? overrides.target_store_id : "store_1",
    target_store_name: "target_store_name" in overrides ? overrides.target_store_name : "ChinaTech",
    target_owner_email: overrides.target_owner_email,
    request_note: overrides.request_note,
    review_scope: overrides.review_scope ?? "store",
    requested_role: overrides.requested_role ?? "technician",
    status: overrides.status ?? "pending",
    reviewed_by: overrides.reviewed_by,
    reviewed_by_membership_id: overrides.reviewed_by_membership_id,
    reviewed_at: overrides.reviewed_at,
    decision_note: overrides.decision_note,
    resulting_store_id: overrides.resulting_store_id,
    created_at: overrides.created_at ?? "2026-06-18T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-06-18T08:00:00.000Z",
  };
}

describe("onboarding review policy", () => {
  it("does not allow platform approval for onboarding requests", () => {
    expect(
      canPlatformApproveOnboardingRequest(
        request({
          request_type: "create_store",
          review_scope: "platform",
          desired_store_name: "ChinaTech Roma",
          requested_role: "owner",
          target_store_id: undefined,
          target_store_name: undefined,
        }),
      ),
    ).toBe(false);

    expect(
      canPlatformApproveOnboardingRequest(
        request({ request_type: "join_store", review_scope: "platform" }),
      ),
    ).toBe(false);
    expect(
      canPlatformApproveOnboardingRequest(
        request({
          request_type: "create_store",
          review_scope: "store",
          desired_store_name: "ChinaTech Roma",
          requested_role: "owner",
        }),
      ),
    ).toBe(false);
  });

  it("allows platform rejection only for platform-scoped requests", () => {
    expect(canPlatformRejectOnboardingRequest(request({ review_scope: "platform" }))).toBe(true);
    expect(canPlatformRejectOnboardingRequest(request({ review_scope: "store" }))).toBe(false);
  });

  it("allows store review only for requests explicitly routed to that store", () => {
    expect(canStoreReviewAccessRequest(request({ target_store_id: "store_1" }), "store_1")).toBe(
      true,
    );

    expect(
      canStoreReviewAccessRequest(
        request({
          target_store_id: undefined,
          target_store_name: undefined,
          target_owner_email: "owner@chinatech.in",
        }),
        "store_1",
      ),
    ).toBe(false);
    expect(canStoreReviewAccessRequest(request({ review_scope: "platform" }), "store_1")).toBe(
      false,
    );
    expect(canStoreReviewAccessRequest(request({ target_store_id: "store_2" }), "store_1")).toBe(
      false,
    );
  });

  it("redacts owner-email routed target store details for the requester view", () => {
    const redacted = redactRequesterOnboardingRequest(
      request({
        target_store_id: "store_1",
        target_store_name: "ChinaTech",
        target_owner_email: "owner@chinatech.in",
        resulting_store_id: "store_1",
      }),
    );

    expect(redacted.target_owner_email).toBe("owner@chinatech.in");
    expect(redacted.review_scope).toBe("platform");
    expect(redacted.target_store_id).toBeUndefined();
    expect(redacted.target_store_name).toBeUndefined();
    expect(redacted.resulting_store_id).toBeUndefined();
  });

  it("keeps rejection and cancellation notes visible to the requester", () => {
    expect(
      redactRequesterOnboardingRequest(
        request({
          status: "rejected",
          decision_note: "资料不匹配",
          target_store_id: "store_1",
          target_store_name: "ChinaTech",
        }),
      ).decision_note,
    ).toBe("资料不匹配");

    expect(
      redactRequesterOnboardingRequest(
        request({
          status: "cancelled",
          decision_note: "申请人撤回",
          target_store_id: "store_1",
          target_store_name: "ChinaTech",
        }),
      ).decision_note,
    ).toBe("申请人撤回");
  });

  it("redacts malformed target-store-only join requests for the requester view", () => {
    const redacted = redactRequesterOnboardingRequest(
      request({
        target_store_id: "store_1",
        target_store_name: "ChinaTech",
        target_owner_email: undefined,
        review_scope: "store",
      }),
    );

    expect(redacted.review_scope).toBe("platform");
    expect(redacted.target_store_id).toBeUndefined();
    expect(redacted.target_store_name).toBeUndefined();
  });
});
