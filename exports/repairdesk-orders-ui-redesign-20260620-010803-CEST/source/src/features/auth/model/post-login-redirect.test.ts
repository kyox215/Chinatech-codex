import { describe, expect, it } from "vitest";

import type { OnboardingStatus } from "@/lib/repairdesk/types";
import { resolvePostLoginPath } from "./post-login-redirect";

const baseStatus: OnboardingStatus = {
  email: "kyox120@gmail.com",
  displayName: "最高管理员",
  isPlatformAdmin: false,
  stores: [],
  requests: [],
  availableStores: [],
};

describe("resolvePostLoginPath", () => {
  it("defaults an active store platform admin to the store workspace", () => {
    expect(
      resolvePostLoginPath(
        {
          ...baseStatus,
          isPlatformAdmin: true,
          activeStore: {
            id: "store_1",
            name: "ChinaTech",
            slug: "chinatech",
            role: "owner",
            status: "active",
          },
          stores: [
            {
              id: "store_1",
              name: "ChinaTech",
              slug: "chinatech",
              role: "owner",
              status: "active",
            },
          ],
        },
        "/",
      ),
    ).toBe("/");
  });

  it("sends platform-only admins to the platform approval page", () => {
    expect(resolvePostLoginPath({ ...baseStatus, isPlatformAdmin: true }, "/")).toBe("/platform");
  });

  it("sends users without store access to onboarding", () => {
    expect(resolvePostLoginPath(baseStatus, "/")).toBe("/onboarding");
  });

  it("does not send non-platform staff to platform from a next parameter", () => {
    expect(
      resolvePostLoginPath(
        {
          ...baseStatus,
          activeStore: {
            id: "store_1",
            name: "ChinaTech",
            slug: "chinatech",
            role: "technician",
            status: "active",
          },
        },
        "/platform",
      ),
    ).toBe("/");
  });
});
