import { describe, expect, it } from "vitest";

import { resolveSettingsSectionAccess } from "@/features/settings/model/settings-section-access";

describe("settings section access", () => {
  it("does not mistake missing permissions for an explicit denial", () => {
    expect(resolveSettingsSectionAccess("order-data", undefined)).toBe("unavailable");
    expect(resolveSettingsSectionAccess("order-data", {})).toBe("unavailable");
    expect(resolveSettingsSectionAccess("order-data", { canManageOrderData: false })).toBe(
      "blocked",
    );
  });

  it("distinguishes blocked, readonly, and editable supplier access", () => {
    expect(
      resolveSettingsSectionAccess("suppliers", {
        canReadSuppliers: false,
        canManageSuppliers: false,
      }),
    ).toBe("blocked");
    expect(
      resolveSettingsSectionAccess("suppliers", {
        canReadSuppliers: true,
        canManageSuppliers: false,
      }),
    ).toBe("readonly");
    expect(
      resolveSettingsSectionAccess("suppliers", {
        canReadSuppliers: true,
        canManageSuppliers: true,
      }),
    ).toBe("editable");
  });

  it("makes store-backed draft sections readonly without update capability", () => {
    expect(
      resolveSettingsSectionAccess("store", {
        canReadStoreSettings: true,
        canUpdateStoreSettings: false,
      }),
    ).toBe("readonly");
    expect(
      resolveSettingsSectionAccess("rules", {
        canReadStoreSettings: true,
        canUpdateStoreSettings: true,
      }),
    ).toBe("editable");
    expect(
      resolveSettingsSectionAccess("notifications", {
        canReadStoreSettings: false,
        canUpdateStoreSettings: true,
      }),
    ).toBe("blocked");
  });

  it("keeps workflow readable while reserving edits for configurators", () => {
    expect(resolveSettingsSectionAccess("workflow", {})).toBe("unavailable");
    expect(resolveSettingsSectionAccess("workflow", { canConfigureWorkflow: false })).toBe(
      "readonly",
    );
    expect(resolveSettingsSectionAccess("workflow", { canConfigureWorkflow: true })).toBe(
      "editable",
    );
  });
});
