import { describe, expect, it, vi } from "vitest";

import { PLATFORM_OWNER_EMAIL } from "@/shared/config/platform-authority";

import { isActivePlatformAdmin } from "./auth-context";

describe("platform owner authorization projection", () => {
  it("requires the canonical verified auth identity and its matching active row", async () => {
    const { admin, getUserById, from, eq } = createAdmin({
      authUser: verifiedOwnerAuthUser(),
      platformAdminRow: { user_id: "owner_1", status: "active" },
    });

    await expect(
      isActivePlatformAdmin(admin, {
        userId: "owner_1",
        authenticatedEmail: PLATFORM_OWNER_EMAIL,
        emailVerified: true,
      }),
    ).resolves.toBe(true);

    expect(getUserById).toHaveBeenCalledWith("owner_1");
    expect(from).toHaveBeenCalledWith("platform_admins");
    expect(eq).toHaveBeenCalledWith("email", PLATFORM_OWNER_EMAIL);
    expect(eq).toHaveBeenCalledWith("status", "active");
  });

  it("does not query admin state for another email or an unverified identity", async () => {
    for (const identity of [
      { userId: "other_1", authenticatedEmail: "admin@example.com", emailVerified: true },
      { userId: "owner_1", authenticatedEmail: PLATFORM_OWNER_EMAIL, emailVerified: false },
    ]) {
      const { admin, getUserById, from } = createAdmin({
        authUser: verifiedOwnerAuthUser(),
        platformAdminRow: { user_id: identity.userId, status: "active" },
      });

      await expect(isActivePlatformAdmin(admin, identity)).resolves.toBe(false);
      expect(getUserById).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
    }
  });

  it("revokes platform authority when the authoritative auth email changes", async () => {
    const { admin, from } = createAdmin({
      authUser: { ...verifiedOwnerAuthUser(), email: "changed@example.com" },
      platformAdminRow: { user_id: "owner_1", status: "active" },
    });

    await expect(
      isActivePlatformAdmin(admin, {
        userId: "owner_1",
        authenticatedEmail: PLATFORM_OWNER_EMAIL,
        emailVerified: true,
      }),
    ).resolves.toBe(false);

    expect(from).not.toHaveBeenCalled();
  });

  it("denies the owner identity without a matching active platform-admin row", async () => {
    const { admin } = createAdmin({
      authUser: verifiedOwnerAuthUser(),
      platformAdminRow: null,
    });

    await expect(
      isActivePlatformAdmin(admin, {
        userId: "owner_1",
        authenticatedEmail: PLATFORM_OWNER_EMAIL,
        emailVerified: true,
      }),
    ).resolves.toBe(false);
  });
});

function verifiedOwnerAuthUser() {
  return {
    id: "owner_1",
    email: PLATFORM_OWNER_EMAIL,
    email_confirmed_at: "2026-07-20T20:00:00.000Z",
  };
}

function createAdmin({
  authUser,
  platformAdminRow,
}: {
  authUser: ReturnType<typeof verifiedOwnerAuthUser>;
  platformAdminRow: { user_id: string; status: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: platformAdminRow, error: null });
  const eq = vi.fn();
  const query = { select: vi.fn(), eq, maybeSingle };
  query.select.mockReturnValue(query);
  eq.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  const getUserById = vi.fn().mockResolvedValue({ data: { user: authUser }, error: null });
  const admin = {
    auth: { admin: { getUserById } },
    from,
  } as unknown as Parameters<typeof isActivePlatformAdmin>[0];

  return { admin, getUserById, from, eq };
}
