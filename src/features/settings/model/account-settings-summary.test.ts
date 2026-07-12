import { describe, expect, it } from "vitest";

import { buildAccountSettingsSummary } from "@/features/settings/model/account-settings-summary";

describe("buildAccountSettingsSummary", () => {
  it("separates platform account nature from the current store role", () => {
    expect(
      buildAccountSettingsSummary({
        email: "owner@example.test",
        emailVerified: true,
        isPlatformAdmin: true,
        activeStore: {
          id: "store-a",
          name: "Repair Lab",
          slug: "repair-lab",
          role: "owner",
          status: "active",
        },
      }),
    ).toEqual({
      email: "owner@example.test",
      emailVerificationState: "verified",
      accountNature: "平台管理员账号",
      activeStoreName: "Repair Lab",
      currentStoreRole: "店主",
    });
  });

  it("reports a regular store member and an explicitly unverified email", () => {
    expect(
      buildAccountSettingsSummary({
        email: "staff@example.test",
        emailVerified: false,
        isPlatformAdmin: false,
        activeStore: {
          id: "store-a",
          name: "Repair Lab",
          slug: "repair-lab",
          role: "technician",
          status: "active",
        },
      }),
    ).toMatchObject({
      emailVerificationState: "unverified",
      accountNature: "门店成员账号",
      currentStoreRole: "技师",
    });
  });

  it("does not mislabel a user without a store as an employee", () => {
    expect(
      buildAccountSettingsSummary({
        email: "personal@example.test",
        emailVerified: undefined,
        isPlatformAdmin: false,
        activeStore: undefined,
      }),
    ).toMatchObject({
      emailVerificationState: "unknown",
      accountNature: "个人账号",
      activeStoreName: "尚未选择店铺",
      currentStoreRole: "当前无店铺角色",
    });
  });
});
