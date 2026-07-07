import { describe, expect, it } from "vitest";
import { isRoleLikeDisplayName, resolveStaffDisplayName } from "@/server/staff-display-name";

describe("resolveStaffDisplayName", () => {
  it("maps the owner email to Alessio for customer-facing output", () => {
    expect(
      resolveStaffDisplayName({
        email: "kyox120@gmail.com",
        displayName: "最高管理员",
        role: "owner",
      }),
    ).toBe("Alessio");
  });

  it("keeps explicit person names", () => {
    expect(resolveStaffDisplayName({ email: "marco@example.com", displayName: "Marco" })).toBe(
      "Marco",
    );
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
});

describe("isRoleLikeDisplayName", () => {
  it("detects Chinese and English role labels", () => {
    expect(isRoleLikeDisplayName("最高管理员")).toBe(true);
    expect(isRoleLikeDisplayName("technician")).toBe(true);
    expect(isRoleLikeDisplayName("Alessio")).toBe(false);
  });
});
