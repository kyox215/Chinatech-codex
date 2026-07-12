import { describe, expect, it } from "vitest";

import { getSettingsQueryActivation } from "@/features/settings/api/query-options";

const ownerCapabilities = {
  canReadStoreSettings: true,
  canUpdateStoreSettings: true,
  canReadSuppliers: true,
  canListMembers: true,
  canReviewAccessRequests: true,
  canManageKioskDevices: true,
  canReviewKioskSessions: true,
  canConfigureWorkflow: true,
  canManageOrderData: true,
};

describe("settings query activation", () => {
  it("loads only readiness data for the overview", () => {
    expect(getSettingsQueryActivation({ kind: "overview" }, ownerCapabilities)).toEqual({
      storeSettings: true,
      account: false,
      suppliers: false,
      members: false,
      accessRequests: false,
      workflow: false,
      kioskDevices: false,
      kioskSessions: false,
      orderData: false,
    });
  });

  it("activates only the selected section dependencies", () => {
    expect(
      getSettingsQueryActivation({ kind: "section", section: "members" }, ownerCapabilities),
    ).toMatchObject({ members: true, accessRequests: true, storeSettings: false });
    expect(
      getSettingsQueryActivation({ kind: "section", section: "kiosk" }, ownerCapabilities),
    ).toMatchObject({ kioskDevices: true, kioskSessions: true, storeSettings: false });
  });

  it("keeps blocked queries disabled", () => {
    expect(
      getSettingsQueryActivation(
        { kind: "section", section: "store" },
        { ...ownerCapabilities, canReadStoreSettings: false },
      ).storeSettings,
    ).toBe(false);
    expect(
      getSettingsQueryActivation(
        { kind: "section", section: "members" },
        { ...ownerCapabilities, canListMembers: false, canReviewAccessRequests: true },
      ),
    ).toMatchObject({ members: false, accessRequests: false });
  });

  it("keeps the store-independent account query available before capabilities arrive", () => {
    expect(
      getSettingsQueryActivation({ kind: "section", section: "account" }, undefined).account,
    ).toBe(true);
  });
});
