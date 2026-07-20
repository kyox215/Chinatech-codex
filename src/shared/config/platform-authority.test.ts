import { describe, expect, it } from "vitest";

import { isPlatformOwnerEmail, PLATFORM_OWNER_EMAIL } from "./platform-authority";

describe("platform authority policy", () => {
  it("recognizes only the canonical project owner email", () => {
    expect(isPlatformOwnerEmail(PLATFORM_OWNER_EMAIL)).toBe(true);
    expect(isPlatformOwnerEmail(" KY0X120@gmail.com ")).toBe(false);
    expect(isPlatformOwnerEmail(" KYox120@GMAIL.COM ")).toBe(true);
    expect(isPlatformOwnerEmail("admin@example.com")).toBe(false);
    expect(isPlatformOwnerEmail(undefined)).toBe(false);
  });
});
