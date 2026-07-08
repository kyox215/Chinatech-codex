import { describe, expect, it } from "vitest";

import { isRoleLikeDisplayName, resolveStaffDisplayName } from "@/server/staff-display-name";

describe("staff display name", () => {
  it("uses Alessio for the owner email even when the stored profile is a role label", () => {
    expect(
      resolveStaffDisplayName({
        email: "kyox120@gmail.com",
        displayName: "最高管理员",
        role: "owner",
      }),
    ).toBe("Alessio");
  });

  it("keeps an explicit person name", () => {
    expect(
      resolveStaffDisplayName({
        email: "marco@example.com",
        displayName: "Marco",
        role: "technician",
      }),
    ).toBe("Marco");
  });

  it("derives a readable person name from email when display name is a role", () => {
    expect(
      resolveStaffDisplayName({
        email: "mario.rossi+store@example.com",
        displayName: "管理员",
        role: "manager",
      }),
    ).toBe("Mario Rossi");
  });

  it("falls back to an email-derived name when the stored display name is only a role", () => {
    expect(
      resolveStaffDisplayName({
        email: "giulia.rossi@example.com",
        displayName: "技术人员",
      }),
    ).toBe("Giulia Rossi");
  });

  it("keeps the supplied fallback when no identity hint exists", () => {
    expect(resolveStaffDisplayName({ fallback: "前台" })).toBe("前台");
  });

  it("treats common role words as unsafe customer-facing names", () => {
    expect(isRoleLikeDisplayName("最高管理员")).toBe(true);
    expect(isRoleLikeDisplayName("technician")).toBe(true);
    expect(isRoleLikeDisplayName("Alessio")).toBe(false);
  });
});
