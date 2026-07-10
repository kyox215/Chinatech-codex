import { describe, expect, it } from "vitest";

import {
  REGISTRATION_COMPLETE_PATH,
  buildAuthCallbackUrl,
  resolveAuthRedirectOrigin,
  safeAuthNextPath,
} from "./auth-redirect";

describe("auth redirect helpers", () => {
  it("builds a safe callback URL with a next path", () => {
    expect(buildAuthCallbackUrl("/reset-password", "https://chinatech.test/app")).toBe(
      "https://chinatech.test/auth/callback?next=%2Freset-password",
    );
  });

  it("builds the registration completion callback URL", () => {
    expect(buildAuthCallbackUrl(REGISTRATION_COMPLETE_PATH, "https://chinatech.test")).toBe(
      "https://chinatech.test/auth/callback?next=%2Fregister%2Fcomplete",
    );
  });

  it("rejects external next paths", () => {
    expect(safeAuthNextPath("https://evil.test")).toBe("/");
    expect(safeAuthNextPath("//evil.test")).toBe("/");
    expect(safeAuthNextPath("/account?email=1")).toBe("/account?email=1");
  });

  it("falls back to local origin when origin parsing fails", () => {
    expect(resolveAuthRedirectOrigin("not a url")).toBe("http://127.0.0.1:3000");
  });
});
