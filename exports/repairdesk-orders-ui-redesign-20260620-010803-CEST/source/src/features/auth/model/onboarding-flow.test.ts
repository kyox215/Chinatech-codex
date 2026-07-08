import { describe, expect, it } from "vitest";

import type { OnboardingRequest, OnboardingStatus } from "@/lib/repairdesk/types";

import {
  buildOnboardingRequestInput,
  getOnboardingRequestSummary,
  getPendingOnboardingRequest,
  validateOnboardingForm,
  type OnboardingFormState,
} from "./onboarding-flow";

const baseStatus: Pick<OnboardingStatus, "availableStores"> = {
  availableStores: [{ id: "store_1", name: "ChinaTech", slug: "chinatech" }],
};

function request(overrides: Partial<OnboardingRequest>): OnboardingRequest {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000001",
    requester_user_id: overrides.requester_user_id ?? "user_1",
    email: overrides.email ?? "staff@example.com",
    display_name: overrides.display_name ?? "Marco",
    request_type: overrides.request_type ?? "join_store",
    desired_store_name: overrides.desired_store_name,
    target_store_id: overrides.target_store_id ?? "store_1",
    target_store_name: overrides.target_store_name ?? "ChinaTech",
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

describe("onboarding flow helpers", () => {
  it("picks the newest pending request", () => {
    const latest = getPendingOnboardingRequest([
      request({
        id: "00000000-0000-4000-8000-000000000001",
        created_at: "2026-06-17T08:00:00.000Z",
      }),
      request({
        id: "00000000-0000-4000-8000-000000000002",
        created_at: "2026-06-18T08:00:00.000Z",
      }),
      request({
        id: "00000000-0000-4000-8000-000000000003",
        status: "approved",
        created_at: "2026-06-19T08:00:00.000Z",
      }),
    ]);

    expect(latest?.id).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("summarizes create and join requests", () => {
    expect(
      getOnboardingRequestSummary(
        request({
          request_type: "create_store",
          desired_store_name: "ChinaTech Roma",
          requested_role: "owner",
        }),
      ),
    ).toBe("创建店铺：ChinaTech Roma");

    expect(
      getOnboardingRequestSummary(
        request({
          request_type: "join_store",
          target_store_name: "ChinaTech",
          requested_role: "sales",
        }),
      ),
    ).toBe("加入店铺：ChinaTech · 销售/前台");
  });

  it("validates join store requirements", () => {
    const form: OnboardingFormState = {
      mode: "join_store",
      storeName: "",
      targetStoreId: "",
      requestedRole: "technician",
    };

    expect(validateOnboardingForm(form, baseStatus)).toMatchObject({
      canSubmit: false,
      reason: "请选择要加入的店铺",
    });
    expect(validateOnboardingForm({ ...form, targetStoreId: "store_2" }, baseStatus)).toMatchObject(
      {
        canSubmit: false,
        reason: "所选店铺不在可申请列表中",
      },
    );
    expect(validateOnboardingForm({ ...form, targetStoreId: "store_1" }, baseStatus)).toMatchObject(
      {
        canSubmit: true,
      },
    );
  });

  it("validates store creation names", () => {
    const form: OnboardingFormState = {
      mode: "create_store",
      storeName: "C",
      targetStoreId: "",
      requestedRole: "technician",
    };

    expect(validateOnboardingForm(form, baseStatus)).toMatchObject({
      canSubmit: false,
      reason: "店铺名称至少需要 2 个字符",
    });
    expect(
      validateOnboardingForm({ ...form, storeName: "ChinaTech Roma" }, baseStatus),
    ).toMatchObject({
      canSubmit: true,
    });
  });

  it("builds sanitized request input", () => {
    expect(
      buildOnboardingRequestInput({
        mode: "create_store",
        storeName: "  ChinaTech Roma  ",
        targetStoreId: "",
        requestedRole: "technician",
      }),
    ).toEqual({
      request_type: "create_store",
      desired_store_name: "ChinaTech Roma",
    });

    expect(
      buildOnboardingRequestInput({
        mode: "join_store",
        storeName: "",
        targetStoreId: "store_1",
        requestedRole: "manager",
      }),
    ).toEqual({
      request_type: "join_store",
      target_store_id: "store_1",
      requested_role: "manager",
    });
  });
});
