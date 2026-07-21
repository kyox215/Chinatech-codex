import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as StoreMockApi from "./mock-api";

let api: typeof StoreMockApi;

describe("store mock api invitation parity", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("ORDER_DATA_EXPORT_ENABLED", "1");
    vi.stubEnv("ORDER_DATA_APPLY_ENABLED", "1");
    vi.stubEnv("ORDER_DATA_APPLY_STORE_ALLOWLIST", "00000000-0000-0000-0000-000000000001");
    api = await import("./mock-api");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("blocks invitations for emails that are already active members", async () => {
    await expect(
      api.inviteStoreMember({ email: "owner@repairdesk.local", role: "viewer" }),
    ).rejects.toThrow("该邮箱已经是当前店铺成员");
  });

  it("resends pending invitations instead of duplicating them and hides revoked invitations", async () => {
    const first = await api.inviteStoreMember({
      email: "pending@example.com",
      role: "viewer",
    });
    const id = first.invitations[0]?.id;

    const resent = await api.inviteStoreMember({
      email: " Pending@Example.com ",
      role: "technician",
    });

    expect(resent.invitations).toHaveLength(1);
    expect(resent.invitations[0]).toMatchObject({
      id,
      email: "pending@example.com",
      role: "technician",
      status: "invited",
    });

    await api.revokeStoreInvitation({ id: id ?? "" });
    await expect(api.revokeStoreInvitation({ id: id ?? "" })).rejects.toThrow("邀请不存在或已处理");
    expect((await api.listStoreMembers()).invitations).toHaveLength(0);
  });

  it("accepts only matching pending invitations and then removes them from the pending list", async () => {
    const invited = await api.inviteStoreMember({
      email: "accepted@example.com",
      role: "sales",
    });
    const id = invited.invitations[0]?.id ?? "";

    await expect(
      api.acceptStoreInvitation(
        { id },
        { id: "mock_user_other", email: "other@example.com", displayName: "Other" },
      ),
    ).rejects.toThrow("邀请不存在或已失效");

    const context = await api.acceptStoreInvitation(
      { id },
      {
        id: "mock_user_accepted",
        email: "accepted@example.com",
        displayName: "Accepted Staff",
      },
    );

    expect(context.activeStore?.name).toBe("Demo Repair Store");
    const members = await api.listStoreMembers();
    expect(members.invitations).toHaveLength(0);
    expect(members.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: "accepted@example.com",
          role: "sales",
          status: "active",
        }),
      ]),
    );
  });

  it("creates, redeems, and revokes invite links without exposing raw codes in lists", async () => {
    const created = await api.createStoreInviteLink({
      label: "测试邀请码",
      role: "viewer",
      expires_in_days: 7,
      max_uses: 1,
    });

    expect(created.code).toMatch(/^rd_/);
    expect(created.link.store_id).toBeTruthy();
    expect((await api.listStoreMembers()).invite_links?.[0]).toMatchObject({
      id: created.link.id,
      label: "测试邀请码",
      role: "viewer",
      used_count: 0,
      max_uses: 1,
    });
    expect(JSON.stringify((await api.listStoreMembers()).invite_links)).not.toContain(created.code);

    const invitation = await api.redeemStoreInviteLink(
      { code: created.code },
      {
        id: "mock_user_link",
        email: "link@example.com",
        displayName: "Link User",
      },
    );

    expect(invitation).toMatchObject({
      email: "link@example.com",
      role: "viewer",
      status: "invited",
    });
    expect(invitation).not.toHaveProperty("store_id");
    expect(invitation).not.toHaveProperty("invited_by");
    expect(invitation).not.toHaveProperty("accepted_at");
    expect((await api.listStoreMembers()).invite_links?.[0]).toMatchObject({ used_count: 1 });
    await expect(
      api.redeemStoreInviteLink(
        { code: created.code },
        {
          id: "mock_user_link_2",
          email: "link2@example.com",
          displayName: "Link User 2",
        },
      ),
    ).rejects.toThrow("邀请码不存在或已失效");

    await api.revokeStoreInviteLink({ id: created.link.id });
    expect((await api.listStoreMembers()).invite_links).toHaveLength(0);
  });

  it("publishes the complete owner settings capability contract", async () => {
    const context = await api.getStoreContext();

    expect(context.permissions).toMatchObject({
      canReadStoreSettings: true,
      canUpdateStoreSettings: true,
      canConfigureWorkflow: true,
      canUpdateMessageTemplates: true,
      canReadMessageTemplates: true,
      canListMembers: true,
      canInviteMembers: true,
      memberInviteRoles: ["manager", "technician", "sales", "viewer"],
      canManageMembers: true,
      canRevokeMembers: true,
      canGrantManager: true,
      canReviewAccessRequests: true,
      canManageKioskDevices: true,
      canReviewKioskSessions: true,
      canManageOrderData: true,
      canApplyOrderData: true,
    });
  });

  it("does not treat a secondary owner membership as the primary store owner", async () => {
    const context = await api.getStoreContext({
      id: "mock_user_secondary_owner",
      email: "secondary-owner@repairdesk.local",
      displayName: "Secondary owner",
      storeRole: "owner",
    });

    expect(context.permissions).toMatchObject({
      canManageOrderData: false,
      canApplyOrderData: false,
    });
  });

  it("keeps manager and technician mock capabilities aligned with server policy", async () => {
    const manager = {
      id: "mock_user_manager",
      email: "manager@repairdesk.local",
      displayName: "Manager",
      storeRole: "manager" as const,
    };
    const technician = {
      id: "mock_user_technician",
      email: "technician@repairdesk.local",
      displayName: "Technician",
      storeRole: "technician" as const,
    };

    await expect(api.getStoreContext(manager)).resolves.toMatchObject({
      activeStore: { role: "manager" },
      permissions: {
        canListMembers: true,
        canInviteMembers: true,
        memberInviteRoles: ["technician", "sales", "viewer"],
        canGrantManager: false,
        canReviewAccessRequests: false,
      },
    });
    await expect(
      api.inviteStoreMember({ email: "manager-invite@example.com", role: "manager" }, manager),
    ).rejects.toThrow("没有权限授予店长角色");

    await expect(api.getStoreContext(technician)).resolves.toMatchObject({
      activeStore: { role: "technician" },
      permissions: {
        canListMembers: false,
        canInviteMembers: false,
        memberInviteRoles: [],
        canReviewAccessRequests: false,
      },
    });
    await expect(api.listStoreMembers(technician)).rejects.toThrow("没有权限执行此操作");
    await expect(api.listStoreAccessRequests(technician)).rejects.toThrow(
      "只有店主可以处理加入申请",
    );
  });

  it("approves a store-scoped access request once and persists the new member", async () => {
    const owner = {
      id: "mock_user_owner",
      email: "owner@repairdesk.local",
      displayName: "Owner",
      storeRole: "owner" as const,
      activeMembershipId: "10000000-0000-4000-8000-000000000001",
    };
    const [request] = await api.listStoreAccessRequests(owner);

    const approved = await api.approveStoreAccessRequest(
      { id: request.id, approved_role: "technician" },
      owner,
    );

    expect(approved).toMatchObject({
      status: "approved",
      approved_role: "technician",
      resulting_store_id: expect.any(String),
    });
    expect(await api.listStoreAccessRequests(owner)).toEqual([]);
    expect((await api.listStoreMembers(owner)).members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: request.requester_user_id,
          role: "technician",
          status: "active",
        }),
      ]),
    );
    await expect(
      api.approveStoreAccessRequest({ id: request.id, approved_role: "sales" }, owner),
    ).rejects.toThrow("不存在、已处理或不属于当前店铺");
  });

  it("rejects a store-scoped access request without creating a member", async () => {
    const owner = {
      id: "mock_user_owner",
      email: "owner@repairdesk.local",
      displayName: "Owner",
      storeRole: "owner" as const,
    };
    const [request] = await api.listStoreAccessRequests(owner);

    await expect(
      api.rejectStoreAccessRequest({ id: request.id, note: "Not now" }, owner),
    ).resolves.toMatchObject({ status: "rejected", decision_note: "Not now" });
    expect(await api.listStoreAccessRequests(owner)).toEqual([]);
    expect(
      (await api.listStoreMembers(owner)).members.some(
        (member) => member.user_id === request.requester_user_id,
      ),
    ).toBe(false);
  });

  it("publishes UUID identifiers compatible with the HTTP mutation schemas", async () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const invited = await api.inviteStoreMember({
      email: "schema-compatible@example.com",
      role: "viewer",
    });
    const link = await api.createStoreInviteLink({ role: "viewer" });
    const context = await api.getStoreContext();

    expect(context.activeStore?.membershipId).toMatch(uuid);
    expect(invited.members.every((member) => uuid.test(member.id))).toBe(true);
    expect(invited.invitations.every((invitation) => uuid.test(invitation.id))).toBe(true);
    expect(invited.invitations[0]).toMatchObject({
      email_delivery_status: "sent",
      email_delivery_method: "supabase_invite",
    });
    expect(link.link.id).toMatch(uuid);
  });

  it("isolates members, invitations, and invite links by the active mock store", async () => {
    const originalStoreId = (await api.getStoreContext()).activeStore?.id ?? "";
    const created = await api.createStore(
      { name: "Second Store" },
      { id: "owner-2", email: "owner2@example.com", displayName: "Owner 2" },
    );
    const secondStoreId = created.activeStore?.id ?? "";
    await api.inviteStoreMember({ email: "second@example.com", role: "viewer" });
    await api.createStoreInviteLink({ role: "viewer", label: "Second only" });

    expect((await api.listStoreMembers()).invitations).toHaveLength(1);
    expect((await api.listStoreMembers()).invite_links).toHaveLength(1);

    await api.switchActiveStore(originalStoreId);
    expect((await api.listStoreMembers()).invitations).toHaveLength(0);
    expect((await api.listStoreMembers()).invite_links).toHaveLength(0);
    expect(
      (await api.listStoreMembers()).members.some(
        (member) => member.email === "owner2@example.com",
      ),
    ).toBe(false);

    await api.switchActiveStore(secondStoreId);
    expect((await api.listStoreMembers()).invitations[0]?.email).toBe("second@example.com");
  });

  it("persists role, grant, disable, and restore mutations in mock mode", async () => {
    const technicianId = "10000000-0000-4000-8000-000000000003";
    await api.updateStoreMemberRole({ id: technicianId, role: "sales" });
    await api.updateStoreMemberPermissions({
      id: technicianId,
      permissions: ["supplier:manage"],
    });
    expect(
      (await api.listStoreMembers()).members.find((member) => member.id === technicianId),
    ).toMatchObject({
      role: "sales",
      permission_grants: ["supplier:read", "supplier:assign", "supplier:manage"],
      status: "active",
    });

    await api.disableStoreMember({ id: technicianId });
    expect(
      (await api.listStoreMembers()).members.find((member) => member.id === technicianId),
    ).toMatchObject({ status: "inactive", permission_grants: [] });
    await api.restoreStoreMember({ id: technicianId });
    expect(
      (await api.listStoreMembers()).members.find((member) => member.id === technicianId)?.status,
    ).toBe("active");
  });
});
