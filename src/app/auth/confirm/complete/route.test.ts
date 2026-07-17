import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/auth/confirm/complete/route";
import {
  isSameOriginRequest,
  safeInviteCompletionPath,
} from "@/features/auth/model/invite-confirmation";

const verifyOtp = vi.hoisted(() => vi.fn());

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}));

describe("invite auth confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://repairdesk.example");
  });

  it("accepts only the dedicated internal invitation completion path", () => {
    const valid =
      "https://repairdesk.example/invite/complete?id=10000000-0000-4000-8000-000000000001&mode=new";
    expect(safeInviteCompletionPath(valid, "https://repairdesk.example")).toBe(
      "/invite/complete?id=10000000-0000-4000-8000-000000000001&mode=new",
    );
    expect(
      safeInviteCompletionPath(
        "https://evil.example/invite/complete?id=x&mode=new",
        "https://repairdesk.example",
      ),
    ).toBeUndefined();
    expect(
      safeInviteCompletionPath(
        "https://repairdesk.example/orders?mode=new",
        "https://repairdesk.example",
      ),
    ).toBeUndefined();
  });

  it("rejects cross-origin form posts", () => {
    expect(
      isSameOriginRequest(
        new Request("https://repairdesk.example/auth/confirm/complete", {
          headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
        }),
        "https://repairdesk.example",
      ),
    ).toBe(false);
    expect(
      isSameOriginRequest(
        new Request("https://repairdesk.example/auth/confirm/complete"),
        "https://repairdesk.example",
      ),
    ).toBe(false);
  });

  it("verifies a supported token only after POST and redirects without caching", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const form = new FormData();
    form.set("token_hash", "a".repeat(64));
    form.set("type", "invite");
    form.set(
      "next",
      "https://repairdesk.example/invite/complete?id=10000000-0000-4000-8000-000000000001&mode=new",
    );
    const response = await POST(
      new Request("https://repairdesk.example/auth/confirm/complete", {
        method: "POST",
        headers: { origin: "https://repairdesk.example", "sec-fetch-site": "same-origin" },
        body: form,
      }),
    );

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "a".repeat(64), type: "invite" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/invite/complete?");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("does not call Auth for invalid input", async () => {
    const form = new FormData();
    form.set("token_hash", "short");
    form.set("type", "signup");
    form.set("next", "https://evil.example");
    const response = await POST(
      new Request("https://repairdesk.example/auth/confirm/complete", {
        method: "POST",
        headers: { origin: "https://repairdesk.example", "sec-fetch-site": "same-origin" },
        body: form,
      }),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("auth_error=invite");
  });
});
