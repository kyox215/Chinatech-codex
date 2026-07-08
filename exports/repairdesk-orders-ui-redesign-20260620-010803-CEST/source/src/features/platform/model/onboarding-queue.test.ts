import { describe, expect, it } from "vitest";

import type { OnboardingRequest } from "@/lib/repairdesk/api";

import {
  buildOnboardingQueueSummary,
  getOnboardingRequestTarget,
  getOnboardingRequestTypeLabel,
  getOnboardingRequestedRoleLabel,
  sortOnboardingRequests,
} from "./onboarding-queue";

function makeRequest(overrides: Partial<OnboardingRequest>): OnboardingRequest {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000001",
    requester_user_id: overrides.requester_user_id ?? "user_1",
    email: overrides.email ?? "staff@example.com",
    display_name: overrides.display_name ?? "Mario",
    request_type: overrides.request_type ?? "join_store",
    desired_store_name: overrides.desired_store_name,
    target_store_id: overrides.target_store_id ?? "store_1",
    target_store_name: overrides.target_store_name ?? "Chinatech",
    requested_role: overrides.requested_role ?? "technician",
    status: overrides.status ?? "pending",
    reviewed_by: overrides.reviewed_by,
    reviewed_at: overrides.reviewed_at,
    decision_note: overrides.decision_note,
    resulting_store_id: overrides.resulting_store_id,
    created_at: overrides.created_at ?? "2026-06-18T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-06-18T08:00:00.000Z",
  };
}

describe("onboarding queue helpers", () => {
  it("summarizes pending queue and marks long waits", () => {
    const summary = buildOnboardingQueueSummary(
      [
        makeRequest({ request_type: "join_store", created_at: "2026-06-17T08:00:00.000Z" }),
        makeRequest({
          request_type: "create_store",
          desired_store_name: "Floridia 2",
          created_at: "2026-06-15T08:00:00.000Z",
        }),
      ],
      new Date("2026-06-18T10:00:00.000Z"),
    );

    expect(summary).toMatchObject({
      total: 2,
      createStoreCount: 1,
      joinStoreCount: 1,
      oldestWaitLabel: "3 天 2 小时",
      attentionTone: "danger",
    });
    expect(summary.headline).toContain("最早等待");
    expect(summary.nextAction).toContain("店铺名称");
  });

  it("sorts requests oldest first", () => {
    const sorted = sortOnboardingRequests([
      makeRequest({
        id: "00000000-0000-4000-8000-000000000002",
        created_at: "2026-06-18T08:00:00.000Z",
      }),
      makeRequest({
        id: "00000000-0000-4000-8000-000000000001",
        created_at: "2026-06-16T08:00:00.000Z",
      }),
    ]);

    expect(sorted.map((request) => request.id)).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ]);
  });

  it("builds readable request labels", () => {
    const createRequest = makeRequest({
      request_type: "create_store",
      desired_store_name: "Siracusa",
      requested_role: "owner",
    });
    const joinRequest = makeRequest({
      request_type: "join_store",
      target_store_name: "Chinatech",
      requested_role: "sales",
    });

    expect(getOnboardingRequestTarget(createRequest)).toBe("Siracusa");
    expect(getOnboardingRequestTarget(joinRequest)).toBe("Chinatech");
    expect(getOnboardingRequestTypeLabel(createRequest)).toBe("创建店铺");
    expect(getOnboardingRequestedRoleLabel(joinRequest)).toBe("前台/销售");
  });
});
