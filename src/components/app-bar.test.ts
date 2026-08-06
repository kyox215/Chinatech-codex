import { describe, expect, it } from "vitest";

import { getAppBarVisibilityClass, usesRepairOsMobileHeader } from "@/components/app-bar";

describe("AppBar responsive route contract", () => {
  it("uses the compact shell only on confirmed list routes", () => {
    expect(usesRepairOsMobileHeader("/customers")).toBe(true);
    expect(usesRepairOsMobileHeader("/inventory")).toBe(true);
    expect(usesRepairOsMobileHeader("/orders")).toBe(true);
    expect(usesRepairOsMobileHeader("/orders/new")).toBe(true);
    expect(usesRepairOsMobileHeader("/settings/closed-stores")).toBe(true);
    expect(usesRepairOsMobileHeader("/customers/id")).toBe(false);
    expect(usesRepairOsMobileHeader("/inventory/id")).toBe(false);
    expect(usesRepairOsMobileHeader("/orders/id")).toBe(false);
  });

  it("keeps the legacy mobile-only hide for unconfirmed subpages", () => {
    expect(getAppBarVisibilityClass("/customers")).toBe("max-lg:hidden");
    expect(getAppBarVisibilityClass("/inventory")).toBe("max-lg:hidden");
    expect(getAppBarVisibilityClass("/orders")).toBe("max-lg:hidden");
    expect(getAppBarVisibilityClass("/orders/new")).toBe("max-lg:hidden");
    expect(getAppBarVisibilityClass("/settings/closed-stores")).toBe("max-lg:hidden");
    expect(getAppBarVisibilityClass("/customers/id")).toBe("max-md:hidden");
    expect(getAppBarVisibilityClass("/inventory/id")).toBe("max-md:hidden");
    expect(getAppBarVisibilityClass("/inventory/new")).toBe("max-md:hidden");
    expect(getAppBarVisibilityClass("/orders/id")).toBe("max-md:hidden");
    expect(getAppBarVisibilityClass("/dashboard")).toBe("");
  });
});
