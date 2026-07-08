import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, OnboardingRequest } from "@/lib/repairdesk/types";

import {
  approveOnboardingRequest,
  cancelOnboardingRequest,
  getOnboardingStatus,
  listPlatformOnboardingRequests,
  rejectOnboardingRequest,
  submitOnboardingRequest,
  updateAccountProfile,
} from "./platform.repository";

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
  },
}));

const provisioningMocks = vi.hoisted(() => ({
  deleteProvisionedStoreDefaults: vi.fn(),
  provisionStoreDefaults: vi.fn(),
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
}));

vi.mock("@/features/stores/server/store-provisioning", () => provisioningMocks);

const platformActor: AuditActor = {
  id: "platform_1",
  email: "admin@example.com",
  emailVerified: true,
  displayName: "Platform Admin",
  isPlatformAdmin: true,
};

const applicantActor: AuditActor = {
  id: "user_1",
  email: "staff@example.com",
  emailVerified: true,
  displayName: "Mario",
};

describe("platform repository onboarding boundaries", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
    provisioningMocks.deleteProvisionedStoreDefaults.mockReset();
    provisioningMocks.provisionStoreDefaults.mockReset();
  });

  it("lists only platform-scoped pending requests", async () => {
    const query = createSupabaseQuery({ data: [], error: null });
    mocks.supabase.from.mockReturnValue(query);

    await listPlatformOnboardingRequests(platformActor);

    expect(mocks.supabase.from).toHaveBeenCalledWith("onboarding_requests");
    expect(query.eq).toHaveBeenCalledWith("status", "pending");
    expect(query.eq).toHaveBeenCalledWith("review_scope", "platform");
  });

  it("falls back to the legacy queue query when review_scope is missing", async () => {
    const scopedQuery = createSupabaseQuery({
      data: null,
      error: { message: "column onboarding_requests.review_scope does not exist" },
    });
    const fallbackQuery = createSupabaseQuery({
      data: [
        {
          ...onboardingRow({ request_type: "join_store", review_scope: "platform" }),
          review_scope: undefined,
        },
      ],
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(scopedQuery).mockReturnValueOnce(fallbackQuery);

    const result = await listPlatformOnboardingRequests(platformActor);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ request_type: "join_store", review_scope: "platform" });
    expect(scopedQuery.eq).toHaveBeenCalledWith("review_scope", "platform");
    expect(fallbackQuery.eq).not.toHaveBeenCalledWith("review_scope", "platform");
  });

  it("auto-approves legacy create-store requests instead of returning them to the queue", async () => {
    const listQuery = createSupabaseQuery({
      data: [
        onboardingRow({
          request_type: "create_store",
          review_scope: "platform",
          requested_role: "owner",
          desired_store_name: "ChinaTech Roma",
        }),
      ],
      error: null,
    });
    const slugQuery = createSupabaseQuery({ data: null, error: null });
    const storeInsertQuery = createSupabaseQuery({
      data: {
        id: "store_1",
        name: "ChinaTech Roma",
        slug: "chinatech-roma-12345678",
        status: "suspended",
      },
      error: null,
    });
    const membershipInsertQuery = createSupabaseQuery({ data: null, error: null });
    const activateStoreQuery = createSupabaseQuery({ data: null, error: null });
    const updateRequestQuery = createSupabaseQuery({
      data: onboardingRow({
        request_type: "create_store",
        review_scope: "platform",
        requested_role: "owner",
        desired_store_name: "ChinaTech Roma",
        status: "approved",
        decision_note: "系统自动开通店铺，无需平台审批",
        resulting_store_id: "store_1",
      }),
      error: null,
    });
    const auditQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(listQuery)
      .mockReturnValueOnce(slugQuery)
      .mockReturnValueOnce(storeInsertQuery)
      .mockReturnValueOnce(membershipInsertQuery)
      .mockReturnValueOnce(activateStoreQuery)
      .mockReturnValueOnce(updateRequestQuery)
      .mockReturnValueOnce(auditQuery);

    const result = await listPlatformOnboardingRequests(platformActor);

    expect(result).toEqual([]);
    expect(provisioningMocks.provisionStoreDefaults).toHaveBeenCalledWith(
      mocks.supabase,
      expect.objectContaining({
        storeId: "store_1",
        storeName: "ChinaTech Roma",
        actorId: "user_1",
      }),
    );
    expect(storeInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ChinaTech Roma",
        owner_user_id: "user_1",
        status: "suspended",
        currency_code: "EUR",
      }),
    );
    expect(membershipInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store_1",
        user_id: "user_1",
        email: "staff@example.com",
        role: "owner",
        status: "active",
      }),
    );
    expect(updateRequestQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        decision_note: "系统自动开通店铺，无需平台审批",
        resulting_store_id: "store_1",
      }),
    );
    expect(auditQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auto_approve_create_store_request" }),
    );
  });

  it("returns current-email pending invitations without exposing internal store identifiers", async () => {
    const requestsQuery = createSupabaseQuery({ data: [], error: null });
    const invitationsQuery = createSupabaseQuery({
      data: [
        {
          id: "00000000-0000-4000-8000-000000000101",
          store_id: "store_1",
          email: "staff@example.com",
          role: "technician",
          status: "invited",
          invited_by: "owner_1",
          accepted_at: null,
          expires_at: "2026-07-18T09:00:00.000Z",
          created_at: "2026-07-04T09:00:00.000Z",
          updated_at: "2026-07-04T09:00:00.000Z",
          store: { id: "store_1", name: "ChinaTech", slug: "chinatech", status: "active" },
        },
      ],
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(requestsQuery).mockReturnValueOnce(invitationsQuery);

    const result = await getOnboardingStatus(applicantActor);

    expect(invitationsQuery.eq).toHaveBeenCalledWith("email", "staff@example.com");
    expect(invitationsQuery.eq).toHaveBeenCalledWith("status", "invited");
    expect(invitationsQuery.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
    expect(result.invitations?.[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000101",
      store_name: "ChinaTech",
      email: "staff@example.com",
      role: "technician",
      status: "invited",
    });
    expect(result.invitations?.[0]).not.toHaveProperty("store_id");
    expect(result.invitations?.[0]).not.toHaveProperty("invited_by");
    expect(result.invitations?.[0]).not.toHaveProperty("accepted_at");
  });

  it("does not expose store options in onboarding status", async () => {
    const requestsQuery = createSupabaseQuery({ data: [], error: null });
    const invitationsQuery = createSupabaseQuery({ data: [], error: null });
    mocks.supabase.from.mockReturnValueOnce(requestsQuery).mockReturnValueOnce(invitationsQuery);

    const result = await getOnboardingStatus(applicantActor);

    expect(result.availableStores).toEqual([]);
  });

  it("does not read email-bound invitations before the account email is verified", async () => {
    const requestsQuery = createSupabaseQuery({ data: [], error: null });
    mocks.supabase.from.mockReturnValueOnce(requestsQuery);

    const result = await getOnboardingStatus({ ...applicantActor, emailVerified: false });

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).toHaveBeenCalledWith("onboarding_requests");
    expect(result.invitations).toEqual([]);
    expect(result.availableStores).toEqual([]);
  });

  it("sanitizes platform audit profile payloads before persistence", async () => {
    const profileQuery = createSupabaseQuery({
      data: {
        id: "user_1",
        email: "staff@example.com",
        display_name: "Mario Updated",
      },
      error: null,
    });
    const membershipQuery = createSupabaseQuery({ data: null, error: null });
    const auditQuery = createSupabaseQuery({ data: null, error: null });
    const requestsQuery = createSupabaseQuery({ data: [], error: null });
    const invitationsQuery = createSupabaseQuery({ data: [], error: null });
    mocks.supabase.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(auditQuery)
      .mockReturnValueOnce(requestsQuery)
      .mockReturnValueOnce(invitationsQuery);

    await updateAccountProfile({ display_name: "Mario Updated" }, applicantActor);

    const auditCalls = auditQuery.insert.mock.calls as unknown as Array<[Record<string, unknown>]>;
    const auditPayload = auditCalls[0][0];
    expect(auditPayload.before_data).toMatchObject({ display_name: "[redacted]" });
    expect(auditPayload.after_data).toMatchObject({
      display_name: "[redacted]",
      email: "[redacted]",
    });
  });

  it("does not let platform approval create private-store memberships for join requests", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        request_type: "join_store",
        review_scope: "store",
        target_store_id: "store_1",
        target_store_name: "ChinaTech",
      }),
      error: null,
    });
    mocks.supabase.from.mockReturnValue(pendingQuery);

    await expect(
      approveOnboardingRequest({ id: "00000000-0000-4000-8000-000000000001" }, platformActor),
    ).rejects.toThrow("加入私有店铺必须由目标店铺负责人审批");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("staff_profiles");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("store_memberships");
    expect(pendingQuery.update).not.toHaveBeenCalled();
  });

  it("does not let platform approval process legacy create-store requests", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        request_type: "create_store",
        review_scope: "platform",
        desired_store_name: "ChinaTech Roma",
        target_store_id: undefined,
        target_store_name: undefined,
        requested_role: "owner",
      }),
      error: null,
    });
    mocks.supabase.from.mockReturnValue(pendingQuery);

    await expect(
      approveOnboardingRequest({ id: "00000000-0000-4000-8000-000000000001" }, platformActor),
    ).rejects.toThrow("平台不再审批创建店铺");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("stores");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("staff_profiles");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("store_memberships");
    expect(pendingQuery.update).not.toHaveBeenCalled();
  });

  it("does not let platform rejection process store-scoped private join requests", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        request_type: "join_store",
        review_scope: "store",
        target_store_id: "store_1",
        target_store_name: "ChinaTech",
      }),
      error: null,
    });
    mocks.supabase.from.mockReturnValue(pendingQuery);

    await expect(
      rejectOnboardingRequest({ id: "00000000-0000-4000-8000-000000000001" }, platformActor),
    ).rejects.toThrow("店铺加入申请必须由目标店铺负责人处理");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(pendingQuery.update).not.toHaveBeenCalled();
  });

  it("redacts owner-email routed store details in requester responses and audit payloads", async () => {
    const existingRequestQuery = createSupabaseQuery({ data: null, error: null });
    const rateLimitQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const ownerMatchQuery = createSupabaseQuery({
      data: [
        {
          store_id: "store_1",
          store: { id: "store_1", name: "ChinaTech", status: "active" },
        },
      ],
      error: null,
    });
    const insertQuery = createSupabaseQuery({
      data: onboardingRow({
        request_type: "join_store",
        review_scope: "store",
        target_store_id: "store_1",
        target_store_name: "ChinaTech",
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    const auditQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(existingRequestQuery)
      .mockReturnValueOnce(rateLimitQuery)
      .mockReturnValueOnce(ownerMatchQuery)
      .mockReturnValueOnce(insertQuery)
      .mockReturnValueOnce(auditQuery);

    const result = await submitOnboardingRequest(
      {
        request_type: "join_store",
        target_owner_email: "owner@chinatech.in",
        requested_role: "technician",
        note: "请加入",
      },
      applicantActor,
    );

    expect(ownerMatchQuery.eq).toHaveBeenCalledWith("email", "owner@chinatech.in");
    expect(ownerMatchQuery.in).toHaveBeenCalledWith("role", ["owner"]);
    expect(ownerMatchQuery.ilike).not.toHaveBeenCalled();
    expect(rateLimitQuery.eq).toHaveBeenCalledWith("requester_user_id", "user_1");
    expect(rateLimitQuery.eq).toHaveBeenCalledWith("request_type", "join_store");
    expect(rateLimitQuery.gte).toHaveBeenCalledWith("created_at", expect.any(String));
    expect(result).toMatchObject({
      request_type: "join_store",
      review_scope: "platform",
      target_owner_email: "owner@chinatech.in",
    });
    expect(result.target_store_id).toBeUndefined();
    expect(result.target_store_name).toBeUndefined();

    const auditCalls = auditQuery.insert.mock.calls as unknown as Array<
      [{ after_data?: Record<string, unknown> }]
    >;
    const auditPayload = auditCalls[0][0];
    expect(auditPayload.after_data).toMatchObject({
      request_type: "join_store",
      has_target_owner_email: true,
      has_target_store: true,
    });
    expect(auditPayload.after_data).not.toHaveProperty("target_store_id");
    expect(auditPayload.after_data).not.toHaveProperty("target_store_name");
    expect(auditPayload.after_data).not.toHaveProperty("target_owner_email");
    expect(auditPayload.after_data).not.toHaveProperty("request_note");
  });

  it("rejects unverified join requests before reading onboarding rows", async () => {
    await expect(
      submitOnboardingRequest(
        {
          request_type: "join_store",
          target_owner_email: "owner@chinatech.in",
          requested_role: "technician",
        },
        { ...applicantActor, emailVerified: false },
      ),
    ).rejects.toThrow("请先验证账号邮箱");

    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("soft-rate limits repeated owner-email join requests before owner lookup", async () => {
    const existingRequestQuery = createSupabaseQuery({ data: null, error: null });
    const rateLimitQuery = createSupabaseQuery({ data: null, error: null, count: 5 });
    mocks.supabase.from
      .mockReturnValueOnce(existingRequestQuery)
      .mockReturnValueOnce(rateLimitQuery);

    await expect(
      submitOnboardingRequest(
        {
          request_type: "join_store",
          target_owner_email: "owner@chinatech.in",
          requested_role: "technician",
        },
        applicantActor,
      ),
    ).rejects.toThrow("提交申请过于频繁");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(2);
    expect(rateLimitQuery.gte).toHaveBeenCalledWith("created_at", expect.any(String));
    expect(rateLimitQuery.insert).not.toHaveBeenCalled();
  });

  it("uses a generic owner-email lookup error without leaking database details", async () => {
    const existingRequestQuery = createSupabaseQuery({ data: null, error: null });
    const rateLimitQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const ownerMatchQuery = createSupabaseQuery({
      data: null,
      error: { message: "more than one relationship was found for repair_orders and suppliers" },
    });
    mocks.supabase.from
      .mockReturnValueOnce(existingRequestQuery)
      .mockReturnValueOnce(rateLimitQuery)
      .mockReturnValueOnce(ownerMatchQuery);

    let message = "";
    try {
      await submitOnboardingRequest(
        {
          request_type: "join_store",
          target_owner_email: "owner@chinatech.in",
          requested_role: "technician",
        },
        applicantActor,
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe("提交注册申请失败，请稍后重试");
    expect(message).not.toContain("more than one relationship");
  });

  it("rejects requester-supplied target store ids before store lookup", async () => {
    const existingRequestQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValueOnce(existingRequestQuery);

    await expect(
      submitOnboardingRequest(
        {
          request_type: "join_store",
          target_store_id: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
          requested_role: "technician",
        },
        applicantActor,
      ),
    ).rejects.toThrow("加入店铺请填写负责人邮箱");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("stores");
    expect(existingRequestQuery.insert).not.toHaveBeenCalled();
  });

  it("rejects legacy create-store onboarding requests before touching the queue", async () => {
    await expect(
      submitOnboardingRequest(
        {
          request_type: "create_store",
          desired_store_name: "ChinaTech Roma",
        },
        applicantActor,
      ),
    ).rejects.toThrow("创建店铺请使用创建店铺接口");

    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("lets an applicant cancel only their own pending request", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        request_type: "join_store",
        review_scope: "store",
        requester_user_id: "user_1",
        target_store_id: "store_1",
        target_store_name: "ChinaTech",
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    const updateQuery = createSupabaseQuery({
      data: onboardingRow({
        request_type: "join_store",
        status: "cancelled",
        decision_note: "我先撤回",
        review_scope: "store",
        requester_user_id: "user_1",
        target_store_id: "store_1",
        target_store_name: "ChinaTech",
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    const auditQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(pendingQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(auditQuery);

    const result = await cancelOnboardingRequest(
      { id: "00000000-0000-4000-8000-000000000001", note: " 我先撤回 " },
      applicantActor,
    );

    expect(pendingQuery.eq).toHaveBeenCalledWith("id", "00000000-0000-4000-8000-000000000001");
    expect(pendingQuery.eq).toHaveBeenCalledWith("requester_user_id", "user_1");
    expect(pendingQuery.eq).toHaveBeenCalledWith("status", "pending");
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        decision_note: "我先撤回",
      }),
    );
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "00000000-0000-4000-8000-000000000001");
    expect(updateQuery.eq).toHaveBeenCalledWith("requester_user_id", "user_1");
    expect(updateQuery.eq).toHaveBeenCalledWith("status", "pending");
    expect(result).toMatchObject({
      status: "cancelled",
      decision_note: "我先撤回",
      review_scope: "platform",
    });
    expect(result.target_store_id).toBeUndefined();
    expect(result.target_store_name).toBeUndefined();
    expect(auditQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cancel_onboarding_request" }),
    );
  });

  it("does not cancel a request if another reviewer already processed it", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        request_type: "join_store",
        review_scope: "store",
        requester_user_id: "user_1",
        target_store_id: "store_1",
        target_store_name: "ChinaTech",
      }),
      error: null,
    });
    const updateQuery = createSupabaseQuery({ data: null, error: null });
    const auditQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(pendingQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(auditQuery);

    await expect(
      cancelOnboardingRequest(
        { id: "00000000-0000-4000-8000-000000000001", note: "取消" },
        applicantActor,
      ),
    ).rejects.toThrow("申请已处理，请刷新后再试");

    expect(updateQuery.eq).toHaveBeenCalledWith("id", "00000000-0000-4000-8000-000000000001");
    expect(updateQuery.eq).toHaveBeenCalledWith("requester_user_id", "user_1");
    expect(updateQuery.eq).toHaveBeenCalledWith("status", "pending");
    expect(auditQuery.insert).not.toHaveBeenCalled();
  });

  it("rejects overlong platform rejection notes before writing a decision", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        request_type: "join_store",
        review_scope: "platform",
        target_store_id: undefined,
        target_store_name: undefined,
      }),
      error: null,
    });
    const updateQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValueOnce(pendingQuery).mockReturnValueOnce(updateQuery);

    await expect(
      rejectOnboardingRequest(
        {
          id: "00000000-0000-4000-8000-000000000001",
          note: "x".repeat(501),
        },
        platformActor,
      ),
    ).rejects.toThrow("申请备注不能超过 500 个字符");

    expect(updateQuery.update).not.toHaveBeenCalled();
  });

  it("normalizes mixed-case owner email before exact matching", async () => {
    const existingRequestQuery = createSupabaseQuery({ data: null, error: null });
    const rateLimitQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const ownerMatchQuery = createSupabaseQuery({ data: [], error: null });
    const insertQuery = createSupabaseQuery({
      data: onboardingRow({
        request_type: "join_store",
        review_scope: "platform",
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    const auditQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(existingRequestQuery)
      .mockReturnValueOnce(rateLimitQuery)
      .mockReturnValueOnce(ownerMatchQuery)
      .mockReturnValueOnce(insertQuery)
      .mockReturnValueOnce(auditQuery);

    await submitOnboardingRequest(
      {
        request_type: "join_store",
        target_owner_email: " Owner@Chinatech.IN ",
        requested_role: "technician",
      },
      applicantActor,
    );

    expect(ownerMatchQuery.eq).toHaveBeenCalledWith("email", "owner@chinatech.in");
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ target_owner_email: "owner@chinatech.in" }),
    );
  });

  it("keeps owner-email requester responses indistinguishable across unique, zero, and multiple matches", async () => {
    const unique = await submitOwnerEmailScenario([
      {
        store_id: "store_1",
        store: { id: "store_1", name: "ChinaTech", status: "active" },
      },
    ]);
    const zero = await submitOwnerEmailScenario([]);
    const multi = await submitOwnerEmailScenario([
      {
        store_id: "store_1",
        store: { id: "store_1", name: "ChinaTech", status: "active" },
      },
      {
        store_id: "store_2",
        store: { id: "store_2", name: "Other Store", status: "active" },
      },
    ]);

    for (const scenario of [unique, zero, multi]) {
      expect(scenario.result).toMatchObject({
        request_type: "join_store",
        review_scope: "platform",
        target_owner_email: "owner@chinatech.in",
      });
      expect(scenario.result.target_store_id).toBeUndefined();
      expect(scenario.result.target_store_name).toBeUndefined();
      expect(scenario.result.resulting_store_id).toBeUndefined();
    }

    expect(unique.insertPayload).toMatchObject({
      review_scope: "store",
      target_store_id: "store_1",
      target_store_name: "ChinaTech",
    });
    expect(zero.insertPayload).toMatchObject({
      review_scope: "platform",
      target_owner_email: "owner@chinatech.in",
    });
    expect(zero.insertPayload).not.toHaveProperty("target_store_id");
    expect(multi.insertPayload).toMatchObject({
      review_scope: "platform",
      target_owner_email: "owner@chinatech.in",
    });
    expect(multi.insertPayload).not.toHaveProperty("target_store_id");
  });
});

function createSupabaseQuery(result: { data: unknown; error: unknown; count?: number }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    gt: vi.fn(() => query),
    gte: vi.fn(() => result),
    in: vi.fn(() => result),
    ilike: vi.fn(() => query),
    order: vi.fn(() => result),
    maybeSingle: vi.fn(() => result),
    single: vi.fn(() => result),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    upsert: vi.fn(() => result),
  };
  return query;
}

async function submitOwnerEmailScenario(
  ownerMatches: Array<{
    store_id: string;
    store: { id: string; name: string; status: string };
  }>,
) {
  mocks.supabase.from.mockReset();
  const isUnique = ownerMatches.length === 1;
  const existingRequestQuery = createSupabaseQuery({ data: null, error: null });
  const rateLimitQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
  const ownerMatchQuery = createSupabaseQuery({ data: ownerMatches, error: null });
  const insertedRow = onboardingRow({
    request_type: "join_store",
    review_scope: isUnique ? "store" : "platform",
    target_store_id: isUnique ? ownerMatches[0]?.store.id : undefined,
    target_store_name: isUnique ? ownerMatches[0]?.store.name : undefined,
    target_owner_email: "owner@chinatech.in",
  });
  const insertQuery = createSupabaseQuery({ data: insertedRow, error: null });
  const auditQuery = createSupabaseQuery({ data: null, error: null });
  mocks.supabase.from
    .mockReturnValueOnce(existingRequestQuery)
    .mockReturnValueOnce(rateLimitQuery)
    .mockReturnValueOnce(ownerMatchQuery)
    .mockReturnValueOnce(insertQuery)
    .mockReturnValueOnce(auditQuery);

  const result = await submitOnboardingRequest(
    {
      request_type: "join_store",
      target_owner_email: "owner@chinatech.in",
      requested_role: "technician",
    },
    applicantActor,
  );
  const insertCalls = insertQuery.insert.mock.calls as unknown as Array<[Record<string, unknown>]>;
  return {
    result,
    insertPayload: insertCalls[0][0],
  };
}

function onboardingRow(overrides: Partial<OnboardingRequest> = {}) {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000001",
    requester_user_id: overrides.requester_user_id ?? "user_1",
    email: overrides.email ?? "staff@example.com",
    display_name: overrides.display_name ?? "Mario",
    request_type: overrides.request_type ?? "join_store",
    desired_store_name: overrides.desired_store_name ?? null,
    target_store_id: overrides.target_store_id ?? null,
    target_store_name: overrides.target_store_name ?? null,
    target_owner_email: overrides.target_owner_email ?? null,
    request_note: overrides.request_note ?? null,
    review_scope: overrides.review_scope ?? "store",
    requested_role: overrides.requested_role ?? "technician",
    status: overrides.status ?? "pending",
    reviewed_by: overrides.reviewed_by ?? null,
    reviewed_by_membership_id: overrides.reviewed_by_membership_id ?? null,
    reviewed_at: overrides.reviewed_at ?? null,
    decision_note: overrides.decision_note ?? null,
    resulting_store_id: overrides.resulting_store_id ?? null,
    created_at: overrides.created_at ?? "2026-06-18T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-06-18T08:00:00.000Z",
  };
}
