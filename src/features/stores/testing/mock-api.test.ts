import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as StoreMockApi from "./mock-api";

let api: typeof StoreMockApi;

describe("store mock api invitation parity", () => {
  beforeEach(async () => {
    vi.resetModules();
    api = await import("./mock-api");
  });

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

    expect(context.activeStore?.name).toBe("ChinaTech");
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
});
