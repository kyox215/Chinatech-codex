import { describe, expect, it } from "vitest";

import {
  getMobileWorkspaceLazyPanelState,
  shouldHideMobileWorkspaceDock,
} from "@/components/mobile-workspace-dock";

describe("shouldHideMobileWorkspaceDock", () => {
  it.each([
    "/",
    "/settings",
    "/settings/profile",
    "/orders",
    "/orders/new",
    "/orders/order-1",
    "/customers/customer-1",
  ])("hides the floating dock on interaction-sensitive route %s", (pathname) => {
    expect(shouldHideMobileWorkspaceDock(pathname)).toBe(true);
  });

  it.each(["/customers", "/inventory", "/messages"])(
    "keeps the dock available on workspace route %s",
    (pathname) => {
      expect(shouldHideMobileWorkspaceDock(pathname)).toBe(false);
    },
  );
});

describe("getMobileWorkspaceLazyPanelState", () => {
  it("does not mount before activation and keeps the loaded panel mounted when closed", () => {
    expect(getMobileWorkspaceLazyPanelState(false, false)).toEqual({ mounted: false, open: false });
    expect(getMobileWorkspaceLazyPanelState(true, true)).toEqual({ mounted: true, open: true });
    expect(getMobileWorkspaceLazyPanelState(true, false)).toEqual({ mounted: true, open: false });
  });
});
