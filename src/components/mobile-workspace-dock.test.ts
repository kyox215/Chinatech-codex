import { describe, expect, it } from "vitest";

import { shouldHideMobileWorkspaceDock } from "@/components/mobile-workspace-dock";

describe("shouldHideMobileWorkspaceDock", () => {
  it.each(["/settings", "/settings/profile", "/orders", "/orders/new", "/orders/order-1"])(
    "hides the floating dock on interaction-sensitive route %s",
    (pathname) => {
      expect(shouldHideMobileWorkspaceDock(pathname)).toBe(true);
    },
  );

  it.each(["/", "/customers", "/inventory", "/messages"])(
    "keeps the dock available on workspace route %s",
    (pathname) => {
      expect(shouldHideMobileWorkspaceDock(pathname)).toBe(false);
    },
  );
});
