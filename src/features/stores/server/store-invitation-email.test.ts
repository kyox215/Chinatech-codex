import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildInviteCompletionUrl,
  classifyAuthDeliveryError,
  deliverStoreInvitationEmail,
  isExistingAuthUserInviteError,
  resolveInviteSiteOrigin,
} from "@/features/stores/server/store-invitation-email";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("store invitation email delivery", () => {
  it("sends a Supabase invite for a new account", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://repairdesk.example");
    const inviteUserByEmail = vi.fn().mockResolvedValue({ error: null });
    const signInWithOtp = vi.fn();

    await expect(
      deliverStoreInvitationEmail({
        admin: { auth: { admin: { inviteUserByEmail }, signInWithOtp } } as never,
        email: "staff@example.com",
        invitationId: "10000000-0000-4000-8000-000000000001",
      }),
    ).resolves.toEqual({ ok: true, method: "supabase_invite" });

    expect(inviteUserByEmail).toHaveBeenCalledWith("staff@example.com", {
      redirectTo:
        "https://repairdesk.example/invite/complete?id=10000000-0000-4000-8000-000000000001&mode=new",
    });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("falls back to a non-creating magic link only for an existing account", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://repairdesk.example");
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      error: { code: "user_already_exists", status: 422, message: "User already registered" },
    });
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });

    await expect(
      deliverStoreInvitationEmail({
        admin: { auth: { admin: { inviteUserByEmail }, signInWithOtp } } as never,
        email: "staff@example.com",
        invitationId: "10000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toEqual({ ok: true, method: "supabase_magic_link" });

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "staff@example.com",
      options: {
        shouldCreateUser: false,
        emailRedirectTo:
          "https://repairdesk.example/invite/complete?id=10000000-0000-4000-8000-000000000002&mode=existing",
      },
    });
  });

  it("recognizes the hosted Auth existing-user message", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://repairdesk.example");
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      error: {
        status: 422,
        message: "A user with this email address has already been registered",
      },
    });
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });

    await expect(
      deliverStoreInvitationEmail({
        admin: { auth: { admin: { inviteUserByEmail }, signInWithOtp } } as never,
        email: "staff@example.com",
        invitationId: "10000000-0000-4000-8000-000000000004",
      }),
    ).resolves.toEqual({ ok: true, method: "supabase_magic_link" });
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ shouldCreateUser: false }) }),
    );
  });

  it("does not turn provider or rate-limit errors into account-existence fallback", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://repairdesk.example");
    const signInWithOtp = vi.fn();
    const admin = {
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue({
            error: { status: 429, message: "Email rate limit exceeded" },
          }),
        },
        signInWithOtp,
      },
    } as never;

    await expect(
      deliverStoreInvitationEmail({
        admin,
        email: "staff@example.com",
        invitationId: "10000000-0000-4000-8000-000000000003",
      }),
    ).resolves.toEqual({ ok: false, errorCode: "rate_limited" });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("requires a trusted configured site origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://evil.example");
    expect(resolveInviteSiteOrigin()).toBeUndefined();
    expect(buildInviteCompletionUrl("https://repairdesk.example", "invite-id", "new")).toBe(
      "https://repairdesk.example/invite/complete?id=invite-id&mode=new",
    );
  });

  it("classifies only explicit existing-account errors and redacts provider messages", () => {
    expect(isExistingAuthUserInviteError({ code: "user_already_exists" })).toBe(true);
    expect(isExistingAuthUserInviteError({ status: 500, message: "already exists" })).toBe(false);
    expect(classifyAuthDeliveryError({ status: 503, message: "SMTP host secret" })).toBe(
      "provider_unavailable",
    );
  });
});
