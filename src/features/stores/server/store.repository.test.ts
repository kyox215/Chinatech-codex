import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, OnboardingRequest } from "@/lib/repairdesk/types";

import {
  acceptStoreInvitation,
  approveStoreAccessRequest,
  createStore,
  createStoreInviteLink,
  disableStoreMember,
  inviteStoreMember,
  listStoreMembers,
  listStoreAccessRequests,
  redeemStoreInviteLink,
  rejectStoreAccessRequest,
  restoreStoreMember,
  revokeStoreInvitation,
  updateStoreMemberPermissions,
  updateStoreMemberRole,
} from "./store.repository";

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  writeAuditLog: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
}));

vi.mock("@/server/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mocks.setCookie,
  })),
}));

const storeOwner: AuditActor = {
  id: "owner_1",
  email: "owner@chinatech.in",
  emailVerified: true,
  displayName: "Owner",
  storeId: "store_1",
  storeName: "ChinaTech",
  storeRole: "owner",
};

const storeManager: AuditActor = {
  id: "manager_1",
  email: "manager@chinatech.in",
  emailVerified: true,
  displayName: "Manager",
  storeId: "store_1",
  storeName: "ChinaTech",
  storeRole: "manager",
};

const storeViewer: AuditActor = {
  id: "viewer_1",
  email: "viewer@chinatech.in",
  emailVerified: true,
  displayName: "Viewer",
  storeId: "store_1",
  storeName: "ChinaTech",
  storeRole: "viewer",
};

const invitedActor: AuditActor = {
  id: "staff_1",
  email: "staff@example.com",
  emailVerified: true,
  displayName: "Invited Staff",
};

describe("store repository access request boundaries", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
    mocks.supabase.rpc.mockReset();
    mocks.writeAuditLog.mockReset();
    mocks.setCookie.mockReset();
  });

  it("lists only pending store-scoped requests explicitly routed to the active store", async () => {
    const query = createSupabaseQuery({ data: [], error: null });
    mocks.supabase.from.mockReturnValue(query);

    await listStoreAccessRequests(storeOwner);

    expect(mocks.supabase.from).toHaveBeenCalledWith("onboarding_requests");
    expect(query.eq).toHaveBeenCalledWith("request_type", "join_store");
    expect(query.eq).toHaveBeenCalledWith("status", "pending");
    expect(query.eq).toHaveBeenCalledWith("review_scope", "store");
    expect(query.eq).toHaveBeenCalledWith("target_store_id", "store_1");
    expect(query.in).not.toHaveBeenCalled();
  });

  it("does not allow store approval for platform-scoped fallback requests", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        review_scope: "platform",
        target_store_id: undefined,
        target_store_name: undefined,
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    const membershipQuery = createSupabaseQuery({
      data: { id: "membership_1" },
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(pendingQuery).mockReturnValueOnce(membershipQuery);

    await expect(
      approveStoreAccessRequest({ id: "00000000-0000-4000-8000-000000000001" }, storeOwner),
    ).rejects.toThrow("你没有权限处理这个加入申请");

    expect(pendingQuery.eq).toHaveBeenCalledWith("review_scope", "store");
    expect(pendingQuery.eq).toHaveBeenCalledWith("target_store_id", "store_1");
    expect(mocks.supabase.from).toHaveBeenCalledTimes(2);
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("staff_profiles");
    expect(pendingQuery.update).not.toHaveBeenCalled();
  });

  it("does not allow store approval for another store target", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        review_scope: "store",
        target_store_id: "store_2",
        target_store_name: "Other Store",
      }),
      error: null,
    });
    const membershipQuery = createSupabaseQuery({
      data: { id: "membership_1" },
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(pendingQuery).mockReturnValueOnce(membershipQuery);

    await expect(
      approveStoreAccessRequest({ id: "00000000-0000-4000-8000-000000000001" }, storeOwner),
    ).rejects.toThrow("你没有权限处理这个加入申请");

    expect(pendingQuery.eq).toHaveBeenCalledWith("review_scope", "store");
    expect(pendingQuery.eq).toHaveBeenCalledWith("target_store_id", "store_1");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("staff_profiles");
    expect(pendingQuery.update).not.toHaveBeenCalled();
  });

  it("creates an independent private store with an active owner membership", async () => {
    const createRateLimitQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const slugQuery = createSupabaseQuery({ data: null, error: null });
    const storeInsertQuery = createSupabaseQuery({
      data: {
        id: "store_new",
        name: "ChinaTech Roma",
        slug: "chinatech-roma",
        status: "active",
      },
      error: null,
    });
    const membershipInsertQuery = createSupabaseQuery({ data: null, error: null });
    const settingsProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const templatesProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const statusesProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const transitionsProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const activateStoreQuery = createSupabaseQuery({
      data: {
        id: "store_new",
        name: "ChinaTech Roma",
        slug: "chinatech-roma",
        status: "active",
      },
      error: null,
    });
    const newOwner: AuditActor = {
      id: "owner_2",
      email: " Owner@ChinaTech.IN ",
      emailVerified: true,
      displayName: "New Owner",
      role: "viewer",
    };
    mocks.supabase.from
      .mockReturnValueOnce(createRateLimitQuery)
      .mockReturnValueOnce(slugQuery)
      .mockReturnValueOnce(storeInsertQuery)
      .mockReturnValueOnce(settingsProvisionQuery)
      .mockReturnValueOnce(templatesProvisionQuery)
      .mockReturnValueOnce(statusesProvisionQuery)
      .mockReturnValueOnce(transitionsProvisionQuery)
      .mockReturnValueOnce(membershipInsertQuery)
      .mockReturnValueOnce(activateStoreQuery);

    const context = await createStore(
      { name: "  ChinaTech Roma  ", currency_code: "EUR" },
      newOwner,
    );

    expect(mocks.supabase.from).toHaveBeenCalledTimes(9);
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(1, "stores");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(2, "stores");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(3, "stores");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(4, "store_settings");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(5, "message_templates");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(6, "order_workflow_statuses");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(7, "order_workflow_transitions");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(8, "store_memberships");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(9, "stores");
    expect(createRateLimitQuery.eq).toHaveBeenCalledWith("owner_user_id", "owner_2");
    expect(createRateLimitQuery.gte).toHaveBeenCalledWith("created_at", expect.any(String));
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("onboarding_requests");
    expect(storeInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_code: expect.stringMatching(/^CHINAT-[A-F0-9]{6}$/),
        name: "ChinaTech Roma",
        slug: expect.stringMatching(/^chinatech-roma-[a-f0-9]{8}$/),
        owner_user_id: "owner_2",
        status: "suspended",
        plan: "starter",
        currency_code: "EUR",
      }),
    );
    expect(membershipInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store_new",
        user_id: "owner_2",
        email: "owner@chinatech.in",
        display_name: "New Owner",
        role: "owner",
        status: "active",
      }),
    );
    expect(activateStoreQuery.update).toHaveBeenCalledWith({
      status: "active",
      updated_at: expect.any(String),
    });
    expect(activateStoreQuery.eq).toHaveBeenCalledWith("id", "store_new");
    expect(settingsProvisionQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store_new",
        store_name: "ChinaTech Roma",
        store_address: "",
        message_signature: "ChinaTech Roma",
        updated_by: "owner_2",
      }),
      { onConflict: "id", ignoreDuplicates: true },
    );
    expect(templatesProvisionQuery.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          store_id: "store_new",
          domain: "order",
          channel: "whatsapp",
        }),
      ]),
      {
        onConflict: "id",
        ignoreDuplicates: true,
      },
    );
    expect(statusesProvisionQuery.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          store_id: "store_new",
          code: "new",
          is_default_create_status: true,
          allowed_for_create: true,
          is_system: true,
        }),
        expect.objectContaining({
          store_id: "store_new",
          code: "repaired",
          bucket: "repair",
        }),
        expect.objectContaining({
          store_id: "store_new",
          code: "mail_in_progress",
          sort_order: 85,
          bucket: "repair",
          show_in_order_filters: true,
        }),
      ]),
      { onConflict: "store_id,code", ignoreDuplicates: true },
    );
    expect(transitionsProvisionQuery.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          store_id: "store_new",
          from_status_code: "new",
          to_status_code: "diagnosing",
          is_primary: true,
        }),
        expect.objectContaining({
          store_id: "store_new",
          from_status_code: "quoted",
          to_status_code: "mail_in_progress",
          sort_order: 35,
        }),
      ]),
      {
        onConflict: "store_id,from_status_code,to_status_code",
        ignoreDuplicates: true,
      },
    );
    expect(mocks.setCookie).toHaveBeenCalledWith(
      "repairdesk-store-id",
      "store_new",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(context.activeStore).toMatchObject({
      id: "store_new",
      name: "ChinaTech Roma",
      role: "owner",
      status: "active",
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entityType: "store",
        entityId: "store_new",
      }),
    );
  });

  it("rejects unverified accounts before creating a store", async () => {
    await expect(
      createStore(
        { name: "ChinaTech Roma", currency_code: "EUR" },
        {
          id: "owner_2",
          email: "owner@chinatech.in",
          emailVerified: false,
          displayName: "New Owner",
        },
      ),
    ).rejects.toThrow("请先验证账号邮箱");

    expect(mocks.supabase.from).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("soft-rate limits repeated store creation before writing stores", async () => {
    const createRateLimitQuery = createSupabaseQuery({ data: null, error: null, count: 3 });
    mocks.supabase.from.mockReturnValueOnce(createRateLimitQuery);

    await expect(
      createStore(
        { name: "ChinaTech Roma", currency_code: "EUR" },
        {
          id: "owner_2",
          email: "owner@chinatech.in",
          emailVerified: true,
          displayName: "New Owner",
        },
      ),
    ).rejects.toThrow("创建店铺过于频繁");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(createRateLimitQuery.insert).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("rolls back the created store if owner membership creation fails", async () => {
    const createRateLimitQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const slugQuery = createSupabaseQuery({ data: null, error: null });
    const storeInsertQuery = createSupabaseQuery({
      data: {
        id: "store_new",
        name: "ChinaTech Roma",
        slug: "chinatech-roma",
        status: "suspended",
      },
      error: null,
    });
    const settingsProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const templatesProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const statusesProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const transitionsProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const membershipInsertQuery = createSupabaseQuery({
      data: null,
      error: { message: "membership insert failed" },
    });
    membershipInsertQuery.insert.mockReturnValue({
      error: { message: "membership insert failed" },
    } as unknown as ReturnType<typeof membershipInsertQuery.insert>);
    const rollbackQuery = createSupabaseQuery({ data: null, error: null });
    const newOwner: AuditActor = {
      id: "owner_2",
      email: "owner@chinatech.in",
      emailVerified: true,
      displayName: "New Owner",
      role: "viewer",
    };
    mocks.supabase.from
      .mockReturnValueOnce(createRateLimitQuery)
      .mockReturnValueOnce(slugQuery)
      .mockReturnValueOnce(storeInsertQuery)
      .mockReturnValueOnce(settingsProvisionQuery)
      .mockReturnValueOnce(templatesProvisionQuery)
      .mockReturnValueOnce(statusesProvisionQuery)
      .mockReturnValueOnce(transitionsProvisionQuery)
      .mockReturnValueOnce(membershipInsertQuery)
      .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null }))
      .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null }))
      .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null }))
      .mockReturnValueOnce(createSupabaseQuery({ data: null, error: null }))
      .mockReturnValueOnce(rollbackQuery);

    await expect(
      createStore({ name: "ChinaTech Roma", currency_code: "EUR" }, newOwner),
    ).rejects.toThrow("创建店铺成员关系失败，请稍后重试");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(13);
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(8, "store_memberships");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(9, "order_workflow_transitions");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(10, "order_workflow_statuses");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(11, "message_templates");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(12, "store_settings");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(13, "stores");
    expect(rollbackQuery.delete).toHaveBeenCalled();
    expect(rollbackQuery.eq).toHaveBeenCalledWith("id", "store_new");
    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rolls back the created store if default provisioning fails", async () => {
    const createRateLimitQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const slugQuery = createSupabaseQuery({ data: null, error: null });
    const storeInsertQuery = createSupabaseQuery({
      data: {
        id: "store_new",
        name: "ChinaTech Roma",
        slug: "chinatech-roma",
        status: "suspended",
      },
      error: null,
    });
    const settingsProvisionQuery = createSupabaseQuery({
      data: null,
      error: { message: "settings insert failed" },
    });
    const transitionRollbackQuery = createSupabaseQuery({ data: null, error: null });
    const statusRollbackQuery = createSupabaseQuery({ data: null, error: null });
    const templateRollbackQuery = createSupabaseQuery({ data: null, error: null });
    const settingsRollbackQuery = createSupabaseQuery({ data: null, error: null });
    const storeRollbackQuery = createSupabaseQuery({ data: null, error: null });
    const newOwner: AuditActor = {
      id: "owner_2",
      email: "owner@chinatech.in",
      emailVerified: true,
      displayName: "New Owner",
      role: "viewer",
    };
    mocks.supabase.from
      .mockReturnValueOnce(createRateLimitQuery)
      .mockReturnValueOnce(slugQuery)
      .mockReturnValueOnce(storeInsertQuery)
      .mockReturnValueOnce(settingsProvisionQuery)
      .mockReturnValueOnce(transitionRollbackQuery)
      .mockReturnValueOnce(statusRollbackQuery)
      .mockReturnValueOnce(templateRollbackQuery)
      .mockReturnValueOnce(settingsRollbackQuery)
      .mockReturnValueOnce(storeRollbackQuery);

    await expect(
      createStore({ name: "ChinaTech Roma", currency_code: "EUR" }, newOwner),
    ).rejects.toThrow("创建店铺初始化失败，请稍后重试");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(9);
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(5, "order_workflow_transitions");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(6, "order_workflow_statuses");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(7, "message_templates");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(8, "store_settings");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(9, "stores");
    expect(transitionRollbackQuery.delete).toHaveBeenCalled();
    expect(statusRollbackQuery.delete).toHaveBeenCalled();
    expect(templateRollbackQuery.delete).toHaveBeenCalled();
    expect(settingsRollbackQuery.delete).toHaveBeenCalled();
    expect(storeRollbackQuery.delete).toHaveBeenCalled();
    expect(storeRollbackQuery.eq).toHaveBeenCalledWith("id", "store_new");
    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rolls back defaults and store if final activation fails", async () => {
    const createRateLimitQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const slugQuery = createSupabaseQuery({ data: null, error: null });
    const storeInsertQuery = createSupabaseQuery({
      data: {
        id: "store_new",
        name: "ChinaTech Roma",
        slug: "chinatech-roma",
        status: "suspended",
      },
      error: null,
    });
    const settingsProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const templatesProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const statusesProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const transitionsProvisionQuery = createSupabaseQuery({ data: null, error: null });
    const membershipInsertQuery = createSupabaseQuery({ data: null, error: null });
    const activateStoreQuery = createSupabaseQuery({
      data: null,
      error: { message: "activation failed" },
    });
    const transitionRollbackQuery = createSupabaseQuery({ data: null, error: null });
    const statusRollbackQuery = createSupabaseQuery({ data: null, error: null });
    const templateRollbackQuery = createSupabaseQuery({ data: null, error: null });
    const settingsRollbackQuery = createSupabaseQuery({ data: null, error: null });
    const storeRollbackQuery = createSupabaseQuery({ data: null, error: null });
    const newOwner: AuditActor = {
      id: "owner_2",
      email: "owner@chinatech.in",
      emailVerified: true,
      displayName: "New Owner",
      role: "viewer",
    };
    mocks.supabase.from
      .mockReturnValueOnce(createRateLimitQuery)
      .mockReturnValueOnce(slugQuery)
      .mockReturnValueOnce(storeInsertQuery)
      .mockReturnValueOnce(settingsProvisionQuery)
      .mockReturnValueOnce(templatesProvisionQuery)
      .mockReturnValueOnce(statusesProvisionQuery)
      .mockReturnValueOnce(transitionsProvisionQuery)
      .mockReturnValueOnce(membershipInsertQuery)
      .mockReturnValueOnce(activateStoreQuery)
      .mockReturnValueOnce(transitionRollbackQuery)
      .mockReturnValueOnce(statusRollbackQuery)
      .mockReturnValueOnce(templateRollbackQuery)
      .mockReturnValueOnce(settingsRollbackQuery)
      .mockReturnValueOnce(storeRollbackQuery);

    await expect(
      createStore({ name: "ChinaTech Roma", currency_code: "EUR" }, newOwner),
    ).rejects.toThrow("创建店铺激活失败，请稍后重试");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(14);
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(9, "stores");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(10, "order_workflow_transitions");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(11, "order_workflow_statuses");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(12, "message_templates");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(13, "store_settings");
    expect(mocks.supabase.from).toHaveBeenNthCalledWith(14, "stores");
    expect(storeRollbackQuery.delete).toHaveBeenCalled();
    expect(storeRollbackQuery.eq).toHaveBeenCalledWith("id", "store_new");
    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("does not let managers invite another manager", async () => {
    await expect(
      inviteStoreMember({ email: "new-manager@example.com", role: "manager" }, storeManager),
    ).rejects.toThrow("当前员工没有权限执行此操作");

    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("keeps owner invitations pending even when the email already has an account", async () => {
    const memberReadQuery = createSupabaseQuery({ data: null, error: null });
    const inviteReadQuery = createSupabaseQuery({ data: null, error: null });
    const inviteInsertQuery = createSupabaseQuery({
      data: invitationRow({
        email: "staff@example.com",
        role: "technician",
        status: "invited",
        accepted_at: null,
      }),
      error: null,
    });
    const membersQuery = createSupabaseQuery({ data: [], error: null });
    membersQuery.order
      .mockReturnValueOnce(membersQuery as unknown as { data: unknown; error: unknown })
      .mockReturnValueOnce({ data: [], error: null });
    const invitationsQuery = createSupabaseQuery({
      data: [invitationRow({ email: "staff@example.com", role: "technician" })],
      error: null,
    });
    const inviteLinksQuery = createSupabaseQuery({ data: [], error: null });
    mocks.supabase.from
      .mockReturnValueOnce(memberReadQuery)
      .mockReturnValueOnce(inviteReadQuery)
      .mockReturnValueOnce(inviteInsertQuery)
      .mockReturnValueOnce(membersQuery)
      .mockReturnValueOnce(invitationsQuery)
      .mockReturnValueOnce(inviteLinksQuery);

    const result = await inviteStoreMember(
      { email: " Staff@Example.com ", role: "technician" },
      storeOwner,
    );

    expect(mocks.supabase.from).not.toHaveBeenCalledWith("staff_profiles");
    expect(inviteInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "staff@example.com",
        role: "technician",
        status: "invited",
        accepted_at: null,
      }),
    );
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("store_memberships", expect.anything());
    expect(result.invitations[0]).toMatchObject({
      email: "staff@example.com",
      role: "technician",
      status: "invited",
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "invite",
        after: expect.not.objectContaining({ token_hash: expect.anything() }),
        metadata: { role: "technician", invitation_status: "invited" },
      }),
    );
  });

  it("does not create an invitation when the email is already an active member", async () => {
    const memberReadQuery = createSupabaseQuery({
      data: { id: "membership_active" },
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(memberReadQuery);

    await expect(
      inviteStoreMember({ email: " Staff@Example.com ", role: "viewer" }, storeOwner),
    ).rejects.toThrow("该邮箱已经是当前店铺成员");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(memberReadQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(memberReadQuery.ilike).toHaveBeenCalledWith("email", "staff@example.com");
    expect(memberReadQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(memberReadQuery.insert).not.toHaveBeenCalled();
  });

  it("does not expose employee management data to ordinary store members", async () => {
    await expect(listStoreMembers(storeViewer)).rejects.toThrow("当前员工没有权限执行此操作");

    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("still lists members when the invite-link table is not deployed yet", async () => {
    const membersQuery = createMembershipListQuery([
      membershipRow({ email: "owner@chinatech.in", role: "owner", status: "active" }),
    ]);
    const invitationsQuery = createSupabaseQuery({ data: [], error: null });
    const inviteLinksQuery = createSupabaseQuery({
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.store_invite_links' in the schema cache",
      },
    });
    mocks.supabase.from
      .mockReturnValueOnce(membersQuery)
      .mockReturnValueOnce(invitationsQuery)
      .mockReturnValueOnce(inviteLinksQuery);

    const result = await listStoreMembers(storeOwner);

    expect(result.members).toHaveLength(1);
    expect(result.members[0]).toMatchObject({ email: "owner@chinatech.in", role: "owner" });
    expect(result.invite_links).toEqual([]);
    expect(inviteLinksQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("does not hide non-schema-cache invite-link read failures", async () => {
    const membersQuery = createMembershipListQuery([
      membershipRow({ email: "owner@chinatech.in", role: "owner", status: "active" }),
    ]);
    const invitationsQuery = createSupabaseQuery({ data: [], error: null });
    const inviteLinksQuery = createSupabaseQuery({
      data: null,
      error: {
        code: "42501",
        message: "permission denied for table store_invite_links",
      },
    });
    mocks.supabase.from
      .mockReturnValueOnce(membersQuery)
      .mockReturnValueOnce(invitationsQuery)
      .mockReturnValueOnce(inviteLinksQuery);

    await expect(listStoreMembers(storeOwner)).rejects.toThrow("读取店铺邀请码失败");
  });

  it("does not hide schema-cache errors for unrelated tables", async () => {
    const membersQuery = createMembershipListQuery([
      membershipRow({ email: "owner@chinatech.in", role: "owner", status: "active" }),
    ]);
    const invitationsQuery = createSupabaseQuery({ data: [], error: null });
    const inviteLinksQuery = createSupabaseQuery({
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.store_memberships' in the schema cache",
      },
    });
    mocks.supabase.from
      .mockReturnValueOnce(membersQuery)
      .mockReturnValueOnce(invitationsQuery)
      .mockReturnValueOnce(inviteLinksQuery);

    await expect(listStoreMembers(storeOwner)).rejects.toThrow("读取店铺邀请码失败");
  });

  it("still fails when employee member rows cannot be read", async () => {
    const membersQuery = createSupabaseQuery({
      data: null,
      error: { message: "connection terminated" },
    });
    membersQuery.order
      .mockReturnValueOnce(membersQuery as unknown as { data: unknown; error: unknown })
      .mockReturnValueOnce({ data: null, error: { message: "connection terminated" } });
    const invitationsQuery = createSupabaseQuery({ data: [], error: null });
    const inviteLinksQuery = createSupabaseQuery({ data: [], error: null });
    mocks.supabase.from
      .mockReturnValueOnce(membersQuery)
      .mockReturnValueOnce(invitationsQuery)
      .mockReturnValueOnce(inviteLinksQuery);

    await expect(listStoreMembers(storeOwner)).rejects.toThrow("读取店铺成员失败");
  });

  it("still fails when pending employee invitations cannot be read", async () => {
    const membersQuery = createMembershipListQuery([
      membershipRow({ email: "owner@chinatech.in", role: "owner", status: "active" }),
    ]);
    const invitationsQuery = createSupabaseQuery({
      data: null,
      error: { message: "connection terminated" },
    });
    const inviteLinksQuery = createSupabaseQuery({ data: [], error: null });
    mocks.supabase.from
      .mockReturnValueOnce(membersQuery)
      .mockReturnValueOnce(invitationsQuery)
      .mockReturnValueOnce(inviteLinksQuery);

    await expect(listStoreMembers(storeOwner)).rejects.toThrow("读取店铺邀请失败");
  });

  it("lets the owner update an active employee role with minimized audit data", async () => {
    const memberReadQuery = createSupabaseQuery({
      data: membershipRow({ role: "technician", status: "active" }),
      error: null,
    });
    const membersQuery = createMembershipListQuery([
      membershipRow({ role: "sales", status: "active" }),
    ]);
    const invitationsQuery = createSupabaseQuery({ data: [], error: null });
    const inviteLinksQuery = createSupabaseQuery({ data: [], error: null });
    mocks.supabase.from
      .mockReturnValueOnce(memberReadQuery)
      .mockReturnValueOnce(membersQuery)
      .mockReturnValueOnce(invitationsQuery)
      .mockReturnValueOnce(inviteLinksQuery);
    mocks.supabase.rpc.mockResolvedValueOnce({
      data: [membershipRow({ role: "sales", status: "active" })],
      error: null,
    });

    const result = await updateStoreMemberRole(
      { id: "membership_staff", role: "sales" },
      storeOwner,
    );

    expect(memberReadQuery.eq).toHaveBeenCalledWith("id", "membership_staff");
    expect(memberReadQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("repairdesk_update_member_access_rpc", {
      p_store_id: "store_1",
      p_membership_id: "membership_staff",
      p_role: "sales",
      p_status: null,
      p_actor_id: "owner_1",
    });
    expect(result.members[0]).toMatchObject({ role: "sales", status: "active" });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update_role",
        entityType: "store_membership",
        entityId: "membership_staff",
        before: expect.not.objectContaining({ email: expect.anything() }),
        after: expect.not.objectContaining({ email: expect.anything() }),
      }),
    );
  });

  it("replaces member grants through one serialized transaction RPC", async () => {
    const memberReadQuery = createSupabaseQuery({
      data: membershipRow({ role: "manager", status: "active" }),
      error: null,
    });
    const membersQuery = createMembershipListQuery([
      membershipRow({ role: "manager", status: "active" }),
    ]);
    const invitationsQuery = createSupabaseQuery({ data: [], error: null });
    const inviteLinksQuery = createSupabaseQuery({ data: [], error: null });
    const grantsQuery = createSupabaseQuery({
      data: [
        {
          membership_id: "membership_staff",
          action: "finance:aggregate_read",
        },
      ],
      error: null,
    });
    mocks.supabase.from
      .mockReturnValueOnce(memberReadQuery)
      .mockReturnValueOnce(membersQuery)
      .mockReturnValueOnce(invitationsQuery)
      .mockReturnValueOnce(inviteLinksQuery)
      .mockReturnValueOnce(grantsQuery);
    mocks.supabase.rpc.mockResolvedValueOnce({
      data: {
        before: ["supplier:read"],
        after: ["finance:aggregate_read", "finance:profit_read"],
      },
      error: null,
    });

    const result = await updateStoreMemberPermissions(
      {
        id: "membership_staff",
        permissions: ["finance:profit_read"],
      },
      storeOwner,
    );

    expect(mocks.supabase.rpc).toHaveBeenCalledWith(
      "repairdesk_replace_member_permission_grants_rpc",
      {
        p_store_id: "store_1",
        p_membership_id: "membership_staff",
        p_actions: ["finance:aggregate_read", "finance:profit_read"],
        p_actor_id: "owner_1",
      },
    );
    expect(result.members[0]?.permission_grants).toEqual(["finance:aggregate_read"]);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update_member_permissions",
        before: { permission_grants: ["supplier:read"] },
        after: {
          permission_grants: ["finance:aggregate_read", "finance:profit_read"],
        },
      }),
    );
  });

  it("does not let managers grant the manager role", async () => {
    await expect(
      updateStoreMemberRole({ id: "membership_staff", role: "manager" }, storeManager),
    ).rejects.toThrow("当前员工没有权限执行此操作");

    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("does not let managers manage another manager membership", async () => {
    const memberReadQuery = createSupabaseQuery({
      data: membershipRow({
        id: "membership_manager",
        user_id: "manager_2",
        email: "manager2@example.com",
        role: "manager",
      }),
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(memberReadQuery);

    await expect(
      updateStoreMemberRole({ id: "membership_manager", role: "sales" }, storeManager),
    ).rejects.toThrow("当前员工没有权限执行此操作");

    expect(memberReadQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
  });

  it("does not let employees disable their own active store membership", async () => {
    const memberReadQuery = createSupabaseQuery({
      data: membershipRow({
        id: "membership_manager",
        user_id: "manager_1",
        email: "manager@chinatech.in",
        role: "manager",
      }),
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(memberReadQuery);

    await expect(disableStoreMember({ id: "membership_manager" }, storeManager)).rejects.toThrow(
      "不能停用自己的当前店铺权限",
    );

    expect(memberReadQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
  });

  it("lets managers disable and restore ordinary employees only inside the active store", async () => {
    const memberReadQuery = createSupabaseQuery({
      data: membershipRow({ role: "technician", status: "active" }),
      error: null,
    });
    const disabledMembersQuery = createMembershipListQuery([
      membershipRow({ role: "technician", status: "inactive" }),
    ]);
    const disabledInvitationsQuery = createSupabaseQuery({ data: [], error: null });
    const disabledInviteLinksQuery = createSupabaseQuery({ data: [], error: null });
    const disabledPermissionGrantsQuery = createSupabaseQuery({ data: [], error: null });
    const inactiveReadQuery = createSupabaseQuery({
      data: membershipRow({ role: "technician", status: "inactive" }),
      error: null,
    });
    const restoredMembersQuery = createMembershipListQuery([
      membershipRow({ role: "technician", status: "active" }),
    ]);
    const restoredInvitationsQuery = createSupabaseQuery({ data: [], error: null });
    const restoredInviteLinksQuery = createSupabaseQuery({ data: [], error: null });
    const restoredPermissionGrantsQuery = createSupabaseQuery({ data: [], error: null });
    mocks.supabase.from
      .mockReturnValueOnce(memberReadQuery)
      .mockReturnValueOnce(disabledMembersQuery)
      .mockReturnValueOnce(disabledInvitationsQuery)
      .mockReturnValueOnce(disabledInviteLinksQuery)
      .mockReturnValueOnce(disabledPermissionGrantsQuery)
      .mockReturnValueOnce(inactiveReadQuery)
      .mockReturnValueOnce(restoredMembersQuery)
      .mockReturnValueOnce(restoredInvitationsQuery)
      .mockReturnValueOnce(restoredInviteLinksQuery)
      .mockReturnValueOnce(restoredPermissionGrantsQuery);
    mocks.supabase.rpc
      .mockResolvedValueOnce({
        data: [membershipRow({ role: "technician", status: "inactive" })],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [membershipRow({ role: "technician", status: "active" })],
        error: null,
      });

    const disabled = await disableStoreMember({ id: "membership_staff" }, storeManager);
    const restored = await restoreStoreMember({ id: "membership_staff" }, storeManager);

    expect(mocks.supabase.rpc).toHaveBeenNthCalledWith(1, "repairdesk_update_member_access_rpc", {
      p_store_id: "store_1",
      p_membership_id: "membership_staff",
      p_role: null,
      p_status: "inactive",
      p_actor_id: "manager_1",
    });
    expect(mocks.supabase.rpc).toHaveBeenNthCalledWith(2, "repairdesk_update_member_access_rpc", {
      p_store_id: "store_1",
      p_membership_id: "membership_staff",
      p_role: null,
      p_status: "active",
      p_actor_id: "manager_1",
    });
    expect(disabled.members[0]).toMatchObject({ status: "inactive" });
    expect(restored.members[0]).toMatchObject({ status: "active" });
  });

  it("accepts a pending invitation and creates the active store membership", async () => {
    const invitationReadQuery = createSupabaseQuery({
      data: invitationRow({ email: "staff@example.com", role: "viewer" }),
      error: null,
    });
    const invitationAcceptQuery = createSupabaseQuery({
      data: invitationRow({
        email: "staff@example.com",
        role: "viewer",
        status: "active",
        accepted_at: "2026-06-18T09:00:00.000Z",
      }),
      error: null,
    });
    const membershipQuery = createSupabaseQuery({ data: null, error: null });
    const storeQuery = createSupabaseQuery({
      data: {
        id: "store_1",
        name: "ChinaTech",
        slug: "chinatech",
        status: "active",
      },
      error: null,
    });
    mocks.supabase.from
      .mockReturnValueOnce(invitationReadQuery)
      .mockReturnValueOnce(invitationAcceptQuery)
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(storeQuery);

    const context = await acceptStoreInvitation(
      { id: "00000000-0000-4000-8000-000000000101" },
      invitedActor,
    );

    expect(invitationAcceptQuery.eq).toHaveBeenCalledWith("email", "staff@example.com");
    expect(invitationAcceptQuery.eq).toHaveBeenCalledWith("status", "invited");
    expect(invitationAcceptQuery.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
    expect(membershipQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store_1",
        user_id: "staff_1",
        email: "staff@example.com",
        role: "viewer",
        status: "active",
      }),
      { onConflict: "store_id,user_id" },
    );
    expect(mocks.setCookie).toHaveBeenCalledWith(
      "repairdesk-store-id",
      "store_1",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(context.activeStore).toMatchObject({ id: "store_1", role: "viewer" });
  });

  it("does not accept invitations for a different account email", async () => {
    const invitationReadQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValueOnce(invitationReadQuery);

    await expect(
      acceptStoreInvitation(
        { id: "00000000-0000-4000-8000-000000000101" },
        { ...invitedActor, email: "other@example.com" },
      ),
    ).rejects.toThrow("邀请不存在或已失效");

    expect(invitationReadQuery.eq).toHaveBeenCalledWith(
      "id",
      "00000000-0000-4000-8000-000000000101",
    );
    expect(invitationReadQuery.eq).toHaveBeenCalledWith("email", "other@example.com");
    expect(invitationReadQuery.eq).toHaveBeenCalledWith("status", "invited");
    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
  });

  it("does not accept invitations for unverified accounts", async () => {
    await expect(
      acceptStoreInvitation(
        { id: "00000000-0000-4000-8000-000000000101" },
        { ...invitedActor, emailVerified: false },
      ),
    ).rejects.toThrow("请先验证账号邮箱");

    expect(mocks.supabase.from).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("does not accept revoked invitations", async () => {
    const invitationReadQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValueOnce(invitationReadQuery);

    await expect(
      acceptStoreInvitation({ id: "00000000-0000-4000-8000-000000000101" }, invitedActor),
    ).rejects.toThrow("邀请不存在或已失效");

    expect(invitationReadQuery.eq).toHaveBeenCalledWith("status", "invited");
    expect(invitationReadQuery.update).not.toHaveBeenCalled();
    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
  });

  it("does not create membership when invitation acceptance loses the stale-state race", async () => {
    const invitationReadQuery = createSupabaseQuery({
      data: invitationRow({ email: "staff@example.com", role: "viewer" }),
      error: null,
    });
    const invitationAcceptQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(invitationReadQuery)
      .mockReturnValueOnce(invitationAcceptQuery);

    await expect(
      acceptStoreInvitation({ id: "00000000-0000-4000-8000-000000000101" }, invitedActor),
    ).rejects.toThrow("邀请不存在或已失效");

    expect(invitationAcceptQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" }),
    );
    expect(invitationAcceptQuery.eq).toHaveBeenCalledWith("status", "invited");
    expect(invitationAcceptQuery.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
    expect(mocks.supabase.from).toHaveBeenCalledTimes(2);
  });

  it("does not mark malformed owner invitations as accepted", async () => {
    const invitationReadQuery = createSupabaseQuery({
      data: invitationRow({ email: "staff@example.com", role: "owner" }),
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(invitationReadQuery);

    await expect(
      acceptStoreInvitation({ id: "00000000-0000-4000-8000-000000000101" }, invitedActor),
    ).rejects.toThrow("不能批准 owner 角色");

    expect(invitationReadQuery.update).not.toHaveBeenCalled();
    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
  });

  it("does not accept expired invitations", async () => {
    const invitationReadQuery = createSupabaseQuery({
      data: invitationRow({
        email: "staff@example.com",
        expires_at: "2020-01-01T00:00:00.000Z",
      }),
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(invitationReadQuery);

    await expect(
      acceptStoreInvitation({ id: "00000000-0000-4000-8000-000000000101" }, invitedActor),
    ).rejects.toThrow("邀请已过期");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(invitationReadQuery.update).not.toHaveBeenCalled();
  });

  it("lets store owners revoke a pending invitation", async () => {
    const revokeQuery = createSupabaseQuery({
      data: invitationRow({ status: "inactive" }),
      error: null,
    });
    const membersQuery = createSupabaseQuery({ data: [], error: null });
    membersQuery.order
      .mockReturnValueOnce(membersQuery as unknown as { data: unknown; error: unknown })
      .mockReturnValueOnce({ data: [], error: null });
    const invitationsQuery = createSupabaseQuery({ data: [], error: null });
    const inviteLinksQuery = createSupabaseQuery({ data: [], error: null });
    mocks.supabase.from
      .mockReturnValueOnce(revokeQuery)
      .mockReturnValueOnce(membersQuery)
      .mockReturnValueOnce(invitationsQuery)
      .mockReturnValueOnce(inviteLinksQuery);

    await revokeStoreInvitation({ id: "00000000-0000-4000-8000-000000000101" }, storeOwner);

    expect(revokeQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "inactive" }),
    );
    expect(revokeQuery.eq).toHaveBeenCalledWith("id", "00000000-0000-4000-8000-000000000101");
    expect(revokeQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(revokeQuery.eq).toHaveBeenCalledWith("status", "invited");
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "revoke_invitation" }),
    );
  });

  it("creates a hashed invite link and returns the raw code only once", async () => {
    const linkInsertQuery = createSupabaseQuery({
      data: inviteLinkRow({ role: "sales", max_uses: 1, used_count: 0 }),
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(linkInsertQuery);

    const { code, link } = await createStoreInviteLink(
      {
        label: "临时员工",
        role: "sales",
        expires_in_days: 7,
        max_uses: 1,
      },
      storeOwner,
    );

    expect(code).toMatch(/^rd_/);
    const insertCalls = linkInsertQuery.insert.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >;
    const insertPayload = insertCalls[0][0];
    expect(insertPayload).toMatchObject({
      store_id: "store_1",
      label: "临时员工",
      role: "sales",
      status: "active",
      max_uses: 1,
      used_count: 0,
      created_by: "owner_1",
    });
    expect(insertPayload.token_hash).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(insertPayload.token_hash).not.toBe(code);
    expect(link).toMatchObject({ role: "sales", used_count: 0, max_uses: 1 });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create_invite_link",
        after: expect.not.objectContaining({ token_hash: expect.anything() }),
      }),
    );
  });

  it("does not let managers create manager invite links", async () => {
    await expect(
      createStoreInviteLink(
        {
          label: "店长",
          role: "manager",
          expires_in_days: 7,
          max_uses: 1,
        },
        storeManager,
      ),
    ).rejects.toThrow("当前员工没有权限执行此操作");

    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("redeems an invite link into a pending invitation without creating membership", async () => {
    const attemptsCountQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const linkReadQuery = createSupabaseQuery({
      data: inviteLinkRow({ role: "viewer", max_uses: 1, used_count: 0 }),
      error: null,
    });
    const membershipQuery = createSupabaseQuery({ data: null, error: null });
    const existingInviteQuery = createSupabaseQuery({ data: null, error: null });
    const invitationInsertQuery = createSupabaseQuery({
      data: invitationRow({ email: "staff@example.com", role: "viewer" }),
      error: null,
    });
    const attemptRecordQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(attemptsCountQuery)
      .mockReturnValueOnce(linkReadQuery)
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(existingInviteQuery)
      .mockReturnValueOnce(invitationInsertQuery)
      .mockReturnValueOnce(attemptRecordQuery);
    mocks.supabase.rpc.mockReturnValue({
      data: [inviteLinkRow({ role: "viewer", max_uses: 1, used_count: 1 })],
      error: null,
    });

    const invitation = await redeemStoreInviteLink({ code: "rd_valid_invite_code" }, invitedActor);

    expect(attemptsCountQuery.eq).toHaveBeenCalledWith("actor_id", "staff_1");
    expect(attemptsCountQuery.gte).toHaveBeenCalledWith("created_at", expect.any(String));
    expect(linkReadQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("claim_store_invite_link", {
      p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(invitationInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store_1",
        email: "staff@example.com",
        role: "viewer",
        status: "invited",
      }),
    );
    expect(membershipQuery.upsert).not.toHaveBeenCalled();
    expect(invitation).toMatchObject({ email: "staff@example.com", role: "viewer" });
    expect(invitation).not.toHaveProperty("store_id");
    expect(invitation).not.toHaveProperty("invited_by");
    expect(attemptRecordQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "staff_1",
        code_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        store_id: "store_1",
        result: "success",
      }),
    );
    const attemptInsertCalls = attemptRecordQuery.insert.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >;
    const attemptInsertPayload = attemptInsertCalls[0]?.[0];
    expect(attemptInsertPayload).not.toHaveProperty("actor_email");
  });

  it("does not redeem invite links for unverified accounts", async () => {
    await expect(
      redeemStoreInviteLink(
        { code: "rd_valid_invite_code" },
        { ...invitedActor, emailVerified: false },
      ),
    ).rejects.toThrow("请先验证账号邮箱");

    expect(mocks.supabase.from).not.toHaveBeenCalled();
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
  });

  it("does not create an invitation when invite link claim loses the use-limit race", async () => {
    const attemptsCountQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const linkReadQuery = createSupabaseQuery({
      data: inviteLinkRow({ role: "viewer", max_uses: 1, used_count: 0 }),
      error: null,
    });
    const membershipQuery = createSupabaseQuery({ data: null, error: null });
    const existingInviteQuery = createSupabaseQuery({ data: null, error: null });
    const attemptRecordQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(attemptsCountQuery)
      .mockReturnValueOnce(linkReadQuery)
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(existingInviteQuery)
      .mockReturnValueOnce(attemptRecordQuery);
    mocks.supabase.rpc.mockReturnValue({ data: [], error: null });

    await expect(
      redeemStoreInviteLink({ code: "rd_valid_invite_code" }, invitedActor),
    ).rejects.toThrow("邀请码不存在或已失效");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(5);
    expect(attemptRecordQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ result: "claim_failed" }),
    );
  });

  it("rate limits repeated invite link redemption attempts before reading invite links", async () => {
    const attemptsCountQuery = createSupabaseQuery({ data: null, error: null, count: 10 });
    const attemptRecordQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(attemptsCountQuery)
      .mockReturnValueOnce(attemptRecordQuery);

    await expect(
      redeemStoreInviteLink({ code: "rd_valid_invite_code" }, invitedActor),
    ).rejects.toThrow("邀请码不存在或已失效");

    expect(attemptsCountQuery.eq).toHaveBeenCalledWith("actor_id", "staff_1");
    expect(attemptRecordQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "staff_1",
        code_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        result: "rate_limited",
      }),
    );
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
  });

  it("records missing or revoked invite link redemption attempts without revealing state", async () => {
    const attemptsCountQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const linkReadQuery = createSupabaseQuery({ data: null, error: null });
    const attemptRecordQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(attemptsCountQuery)
      .mockReturnValueOnce(linkReadQuery)
      .mockReturnValueOnce(attemptRecordQuery);

    await expect(
      redeemStoreInviteLink({ code: "rd_revoked_invite_code" }, invitedActor),
    ).rejects.toThrow("邀请码不存在或已失效");

    expect(linkReadQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(attemptRecordQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ result: "not_found" }),
    );
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
  });

  it("records expired and over-limit invite link redemption attempts without claiming", async () => {
    const expiredAttemptsQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const expiredLinkQuery = createSupabaseQuery({
      data: inviteLinkRow({ expires_at: "2020-01-01T00:00:00.000Z" }),
      error: null,
    });
    const expiredRecordQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(expiredAttemptsQuery)
      .mockReturnValueOnce(expiredLinkQuery)
      .mockReturnValueOnce(expiredRecordQuery);

    await expect(
      redeemStoreInviteLink({ code: "rd_expired_invite_code" }, invitedActor),
    ).rejects.toThrow("邀请码不存在或已失效");
    expect(expiredRecordQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ result: "expired" }),
    );

    mocks.supabase.from.mockReset();
    mocks.supabase.rpc.mockReset();
    const overLimitAttemptsQuery = createSupabaseQuery({ data: null, error: null, count: 0 });
    const overLimitLinkQuery = createSupabaseQuery({
      data: inviteLinkRow({ max_uses: 1, used_count: 1 }),
      error: null,
    });
    const overLimitRecordQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(overLimitAttemptsQuery)
      .mockReturnValueOnce(overLimitLinkQuery)
      .mockReturnValueOnce(overLimitRecordQuery);

    await expect(
      redeemStoreInviteLink({ code: "rd_over_limit_invite_code" }, invitedActor),
    ).rejects.toThrow("邀请码不存在或已失效");
    expect(overLimitRecordQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ result: "over_limit" }),
    );
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
  });

  it("approves a matching store-scoped request and writes minimized audit payloads", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        request_note: "我是新员工",
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    const membershipQuery = createSupabaseQuery({
      data: { id: "membership_1" },
      error: null,
    });
    const staffProfileQuery = createSupabaseQuery({ data: null, error: null });
    const storeMembershipQuery = createSupabaseQuery({ data: null, error: null });
    const updateRequestQuery = createSupabaseQuery({
      data: onboardingRow({
        status: "approved",
        approved_role: "viewer",
        reviewed_by: "owner_1",
        reviewed_by_membership_id: "membership_1",
        reviewed_at: "2026-06-18T09:00:00.000Z",
        decision_note: "通过",
        resulting_store_id: "store_1",
        request_note: "我是新员工",
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    mocks.supabase.from
      .mockReturnValueOnce(pendingQuery)
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(updateRequestQuery)
      .mockReturnValueOnce(staffProfileQuery)
      .mockReturnValueOnce(storeMembershipQuery);

    const result = await approveStoreAccessRequest(
      {
        id: "00000000-0000-4000-8000-000000000001",
        note: "通过",
        approved_role: "viewer",
      },
      storeOwner,
    );

    expect(mocks.supabase.from).toHaveBeenCalledWith("staff_profiles");
    expect(mocks.supabase.from).toHaveBeenCalledWith("store_memberships");
    expect(staffProfileQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "viewer" }),
      { onConflict: "id" },
    );
    expect(storeMembershipQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "viewer" }),
      { onConflict: "store_id,user_id" },
    );
    expect(updateRequestQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        approved_role: "viewer",
        target_store_id: "store_1",
        reviewed_by_membership_id: "membership_1",
      }),
    );
    expect(updateRequestQuery.eq).toHaveBeenCalledWith(
      "id",
      "00000000-0000-4000-8000-000000000001",
    );
    expect(updateRequestQuery.eq).toHaveBeenCalledWith("request_type", "join_store");
    expect(updateRequestQuery.eq).toHaveBeenCalledWith("status", "pending");
    expect(updateRequestQuery.eq).toHaveBeenCalledWith("review_scope", "store");
    expect(updateRequestQuery.eq).toHaveBeenCalledWith("target_store_id", "store_1");
    expect(result.status).toBe("approved");
    expect(result.approved_role).toBe("viewer");

    const auditPayload = mocks.writeAuditLog.mock.calls[0]?.[0] as {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    };
    expect(auditPayload.before).toMatchObject({
      request_type: "join_store",
      has_target_owner_email: true,
      has_target_store: true,
    });
    expect(auditPayload.after).toMatchObject({
      status: "approved",
      reviewed_by_membership_id: "membership_1",
    });
    for (const snapshot of [auditPayload.before, auditPayload.after]) {
      expect(snapshot).not.toHaveProperty("email");
      expect(snapshot).not.toHaveProperty("target_owner_email");
      expect(snapshot).not.toHaveProperty("target_store_name");
      expect(snapshot).not.toHaveProperty("request_note");
    }
  });

  it("does not let managers list, approve, or reject store access requests", async () => {
    await expect(listStoreAccessRequests(storeManager)).rejects.toThrow("只有店主可以处理加入申请");
    await expect(
      approveStoreAccessRequest(
        {
          id: "00000000-0000-4000-8000-000000000001",
          approved_role: "viewer",
        },
        storeManager,
      ),
    ).rejects.toThrow("只有店主可以处理加入申请");
    await expect(
      rejectStoreAccessRequest(
        {
          id: "00000000-0000-4000-8000-000000000001",
          note: "不是本店员工",
        },
        storeManager,
      ),
    ).rejects.toThrow("只有店主可以处理加入申请");

    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("does not approve if the store request was already processed", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    const membershipQuery = createSupabaseQuery({
      data: { id: "membership_1" },
      error: null,
    });
    const updateRequestQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(pendingQuery)
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(updateRequestQuery);

    await expect(
      approveStoreAccessRequest(
        {
          id: "00000000-0000-4000-8000-000000000001",
          approved_role: "viewer",
        },
        storeOwner,
      ),
    ).rejects.toThrow("加入申请已处理，请刷新后再试");

    expect(updateRequestQuery.eq).toHaveBeenCalledWith(
      "id",
      "00000000-0000-4000-8000-000000000001",
    );
    expect(updateRequestQuery.eq).toHaveBeenCalledWith("status", "pending");
    expect(updateRequestQuery.eq).toHaveBeenCalledWith("target_store_id", "store_1");
    expect(mocks.supabase.from).toHaveBeenCalledTimes(3);
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("staff_profiles");
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("uses a generic applicant-facing note if approval side effects fail", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    const membershipQuery = createSupabaseQuery({
      data: { id: "membership_1" },
      error: null,
    });
    const updateRequestQuery = createSupabaseQuery({
      data: onboardingRow({
        status: "approved",
        approved_role: "viewer",
        reviewed_by: "owner_1",
        reviewed_by_membership_id: "membership_1",
        resulting_store_id: "store_1",
      }),
      error: null,
    });
    const staffProfileQuery = createSupabaseQuery({
      data: null,
      error: { message: "internal staff sync details" },
    });
    const compensationQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from
      .mockReturnValueOnce(pendingQuery)
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(updateRequestQuery)
      .mockReturnValueOnce(staffProfileQuery)
      .mockReturnValueOnce(compensationQuery);

    await expect(
      approveStoreAccessRequest(
        {
          id: "00000000-0000-4000-8000-000000000001",
          approved_role: "viewer",
        },
        storeOwner,
      ),
    ).rejects.toThrow("批准加入申请失败，请稍后重试");

    expect(compensationQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        decision_note: "批准失败，请重新提交申请或联系店铺负责人。",
      }),
    );
    expect(compensationQuery.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        decision_note: expect.stringContaining("internal staff sync details"),
      }),
    );
    expect(compensationQuery.eq).toHaveBeenCalledWith("id", "00000000-0000-4000-8000-000000000001");
    expect(compensationQuery.eq).toHaveBeenCalledWith("status", "approved");
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects a matching store-scoped request with the same store and pending guards", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    const membershipQuery = createSupabaseQuery({
      data: { id: "membership_1" },
      error: null,
    });
    const updateRequestQuery = createSupabaseQuery({
      data: onboardingRow({
        status: "rejected",
        reviewed_by: "owner_1",
        reviewed_by_membership_id: "membership_1",
        reviewed_at: "2026-06-18T09:00:00.000Z",
        decision_note: "资料不完整",
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    mocks.supabase.from
      .mockReturnValueOnce(pendingQuery)
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(updateRequestQuery);

    const result = await rejectStoreAccessRequest(
      {
        id: "00000000-0000-4000-8000-000000000001",
        note: "资料不完整",
      },
      storeOwner,
    );

    expect(updateRequestQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        reviewed_by: "owner_1",
        reviewed_by_membership_id: "membership_1",
        decision_note: "资料不完整",
      }),
    );
    expect(updateRequestQuery.eq).toHaveBeenCalledWith(
      "id",
      "00000000-0000-4000-8000-000000000001",
    );
    expect(updateRequestQuery.eq).toHaveBeenCalledWith("request_type", "join_store");
    expect(updateRequestQuery.eq).toHaveBeenCalledWith("status", "pending");
    expect(updateRequestQuery.eq).toHaveBeenCalledWith("review_scope", "store");
    expect(updateRequestQuery.eq).toHaveBeenCalledWith("target_store_id", "store_1");
    expect(result.status).toBe("rejected");
    expect(result.decision_note).toBe("资料不完整");
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "reject_access_request" }),
    );
  });

  it("does not approve owner role through a store access request", async () => {
    const pendingQuery = createSupabaseQuery({
      data: onboardingRow({
        requested_role: "owner",
        target_owner_email: "owner@chinatech.in",
      }),
      error: null,
    });
    const membershipQuery = createSupabaseQuery({
      data: { id: "membership_1" },
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(pendingQuery).mockReturnValueOnce(membershipQuery);

    await expect(
      approveStoreAccessRequest({ id: "00000000-0000-4000-8000-000000000001" }, storeOwner),
    ).rejects.toThrow("不能批准 owner 角色");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(2);
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("staff_profiles");
    expect(membershipQuery.upsert).not.toHaveBeenCalled();
    expect(pendingQuery.update).not.toHaveBeenCalled();
  });
});

function createSupabaseQuery(result: { data: unknown; error: unknown; count?: number }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    gt: vi.fn(() => query),
    gte: vi.fn(() => result),
    in: vi.fn(() => query),
    is: vi.fn(() => result),
    ilike: vi.fn(() => query),
    order: vi.fn(() => result),
    maybeSingle: vi.fn(() => result),
    single: vi.fn(() => result),
    insert: vi.fn(() => query),
    delete: vi.fn(() => query),
    update: vi.fn(() => query),
    upsert: vi.fn(() => result),
  };
  return query;
}

function createMembershipListQuery(rows: unknown[]) {
  const query = createSupabaseQuery({ data: rows, error: null });
  query.order
    .mockReturnValueOnce(query as unknown as { data: unknown; error: unknown })
    .mockReturnValueOnce({ data: rows, error: null });
  return query;
}

function invitationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000101",
    store_id: overrides.store_id ?? "store_1",
    email: overrides.email ?? "staff@example.com",
    role: overrides.role ?? "technician",
    status: overrides.status ?? "invited",
    invited_by: overrides.invited_by ?? "owner_1",
    accepted_at: overrides.accepted_at ?? null,
    expires_at: overrides.expires_at ?? "2026-07-18T09:00:00.000Z",
    created_at: overrides.created_at ?? "2026-07-04T09:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-07-04T09:00:00.000Z",
  };
}

function inviteLinkRow(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000201",
    store_id: overrides.store_id ?? "store_1",
    label: overrides.label ?? "临时员工",
    role: overrides.role ?? "technician",
    status: overrides.status ?? "active",
    token_hash: overrides.token_hash ?? "hash",
    expires_at: overrides.expires_at ?? "2026-07-18T09:00:00.000Z",
    max_uses: overrides.max_uses ?? 1,
    used_count: overrides.used_count ?? 0,
    created_by: overrides.created_by ?? "owner_1",
    revoked_by: overrides.revoked_by ?? null,
    revoked_at: overrides.revoked_at ?? null,
    created_at: overrides.created_at ?? "2026-07-04T09:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-07-04T09:00:00.000Z",
  };
}

function membershipRow(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? "membership_staff",
    user_id: overrides.user_id ?? "staff_1",
    email: overrides.email ?? "staff@example.com",
    display_name: overrides.display_name ?? "Staff",
    role: overrides.role ?? "technician",
    status: overrides.status ?? "active",
    created_at: overrides.created_at ?? "2026-07-04T09:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-07-04T09:00:00.000Z",
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
    target_store_id: overrides.target_store_id ?? "store_1",
    target_store_name: overrides.target_store_name ?? "ChinaTech",
    target_owner_email: overrides.target_owner_email ?? null,
    request_note: overrides.request_note ?? null,
    review_scope: overrides.review_scope ?? "store",
    requested_role: overrides.requested_role ?? "technician",
    status: overrides.status ?? "pending",
    approved_role: overrides.approved_role ?? null,
    reviewed_by: overrides.reviewed_by ?? null,
    reviewed_by_membership_id: overrides.reviewed_by_membership_id ?? null,
    reviewed_at: overrides.reviewed_at ?? null,
    decision_note: overrides.decision_note ?? null,
    resulting_store_id: overrides.resulting_store_id ?? null,
    created_at: overrides.created_at ?? "2026-06-18T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-06-18T08:00:00.000Z",
  };
}
