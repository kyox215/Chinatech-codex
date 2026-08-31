import { describe, expect, it } from "vitest";

import type { OnboardingRequest, OnboardingStatus } from "@/lib/repairdesk/types";
import { translateMessage } from "@/shared/i18n/messages";

import {
  buildOnboardingRequestInput,
  getLatestOnboardingRequest,
  getOnboardingRequestSummary,
  getOnboardingRequestStatusLabel,
  getPendingOnboardingRequest,
  validateOnboardingForm,
  type OnboardingFormState,
} from "./onboarding-flow";

const baseStatus: Pick<OnboardingStatus, "availableStores"> = {
  availableStores: [{ id: "store_1", name: "Demo Repair Store", slug: "demo-repair-store" }],
};

function request(overrides: Partial<OnboardingRequest>): OnboardingRequest {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000001",
    requester_user_id: overrides.requester_user_id ?? "user_1",
    email: overrides.email ?? "staff@example.com",
    display_name: overrides.display_name ?? "Marco",
    request_type: overrides.request_type ?? "join_store",
    desired_store_name: overrides.desired_store_name,
    target_store_id: "target_store_id" in overrides ? overrides.target_store_id : "store_1",
    target_store_name:
      "target_store_name" in overrides ? overrides.target_store_name : "Demo Repair Store",
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

  it("picks the latest request by update time and labels final states", () => {
    const latest = getLatestOnboardingRequest([
      request({
        id: "00000000-0000-4000-8000-000000000001",
        status: "pending",
        updated_at: "2026-06-18T08:00:00.000Z",
      }),
      request({
        id: "00000000-0000-4000-8000-000000000002",
        status: "rejected",
        updated_at: "2026-06-18T09:00:00.000Z",
      }),
    ]);

    expect(latest?.id).toBe("00000000-0000-4000-8000-000000000002");
    expect(getOnboardingRequestStatusLabel(latest!)).toBe("申请未通过");
    expect(getOnboardingRequestStatusLabel(request({ status: "cancelled" }))).toBe("申请已取消");
  });

  it("summarizes create and join requests", () => {
    expect(
      getOnboardingRequestSummary(
        request({
          request_type: "create_store",
          desired_store_name: "Centro Riparazioni Roma",
          requested_role: "owner",
        }),
      ),
    ).toBe("创建店铺：Centro Riparazioni Roma");

    expect(
      getOnboardingRequestSummary(
        request({
          request_type: "join_store",
          target_store_name: undefined,
          target_owner_email: "owner@example.com",
          requested_role: "sales",
        }),
      ),
    ).toBe("加入店铺：负责人 owner@example.com · 销售/前台");
  });

  it("localizes summaries, statuses, roles, and validation through the shared catalog", () => {
    const t = (
      key: Parameters<typeof translateMessage>[1],
      values?: Record<string, string | number>,
    ) => translateMessage("en", key, values);
    const joinRequest = request({
      request_type: "join_store",
      target_store_name: undefined,
      target_owner_email: "owner@example.com",
      requested_role: "sales",
      status: "rejected",
    });

    expect(getOnboardingRequestSummary(joinRequest, t)).toBe(
      "Join store: Owner owner@example.com · Sales staff",
    );
    expect(getOnboardingRequestStatusLabel(joinRequest, t)).toBe("Request rejected");
    expect(
      validateOnboardingForm(
        {
          mode: "join_store",
          storeName: "",
          targetOwnerEmail: "",
          note: "",
          requestedRole: "technician",
        },
        baseStatus,
        t,
      ).reason,
    ).toBe("Enter the target store owner’s email");
  });

  it("validates join store requirements", () => {
    const form: OnboardingFormState = {
      mode: "join_store",
      storeName: "",
      targetOwnerEmail: "",
      note: "",
      requestedRole: "technician",
    };

    expect(validateOnboardingForm(form, baseStatus)).toMatchObject({
      canSubmit: false,
      reason: "请填写目标店铺负责人的邮箱",
    });
    expect(
      validateOnboardingForm({ ...form, targetOwnerEmail: "bad-email" }, baseStatus),
    ).toMatchObject({
      canSubmit: false,
      reason: "店铺负责人邮箱格式不正确",
    });
    expect(
      validateOnboardingForm({ ...form, targetOwnerEmail: "owner@example.com" }, baseStatus),
    ).toMatchObject({
      canSubmit: true,
    });
  });

  it("validates store creation names", () => {
    const form: OnboardingFormState = {
      mode: "create_store",
      storeName: "C",
      targetOwnerEmail: "",
      note: "",
      requestedRole: "technician",
    };

    expect(validateOnboardingForm(form, baseStatus)).toMatchObject({
      canSubmit: false,
      reason: "店铺名称至少需要 2 个字符",
    });
    expect(
      validateOnboardingForm({ ...form, storeName: "Centro Riparazioni Roma" }, baseStatus),
    ).toMatchObject({
      canSubmit: true,
      reason: "将立即创建你的独立私有店铺",
    });
  });

  it("builds sanitized request input", () => {
    expect(() =>
      buildOnboardingRequestInput({
        mode: "create_store",
        storeName: "  Centro Riparazioni Roma  ",
        targetOwnerEmail: "",
        note: "",
        requestedRole: "technician",
      }),
    ).toThrow("创建店铺请使用创建店铺接口");

    expect(
      buildOnboardingRequestInput({
        mode: "join_store",
        storeName: "",
        targetOwnerEmail: " OWNER@Example.COM ",
        note: "  我是新员工  ",
        requestedRole: "manager",
      }),
    ).toEqual({
      request_type: "join_store",
      target_owner_email: "owner@example.com",
      note: "我是新员工",
      requested_role: "manager",
    });
  });
});
