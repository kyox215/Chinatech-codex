import { describe, expect, it } from "vitest";

import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";

import {
  canUseInventoryV2Commands,
  canUseInventoryV2Intake,
  canUseInventoryV2Sale,
  canUseInventoryV2Ui,
} from "./inventory-v2-access";

const baseEnv = {
  INVENTORY_V2_SCHEMA_READY: "1",
  INVENTORY_V2_COMMANDS: "1",
  INVENTORY_V2_UI: "1",
} as const;

describe("inventory V2 actor rollout access", () => {
  it("preserves explicitly allowlisted sales while protecting intake financial fields", () => {
    const env = { ...baseEnv, INVENTORY_V2_STORE_ALLOWLIST: "store-1" };
    expect(canUseInventoryV2Sale(actor("sales"), env)).toBe(true);
    expect(canUseInventoryV2Intake(actor("technician"), env)).toBe(false);
    expect(canUseInventoryV2Ui(actor("sales"), env)).toBe(false);
    expect(canUseInventoryV2Intake(actor("manager", ["inventory:cost_allocate"]), env)).toBe(true);
  });

  it("limits newly expanded stores and requires financial authority for intake", () => {
    const env = { ...baseEnv, INVENTORY_V2_ALL_STORES_ENABLED: "1" };
    expect(canUseInventoryV2Intake(actor("owner"), env)).toBe(true);
    expect(canUseInventoryV2Intake(actor("manager"), env)).toBe(false);
    expect(canUseInventoryV2Intake(actor("manager", ["inventory:cost_allocate"]), env)).toBe(true);
    expect(canUseInventoryV2Sale(actor("manager"), env)).toBe(true);
    expect(canUseInventoryV2Commands(actor("manager"), env)).toBe(true);
    expect(canUseInventoryV2Commands(actor("technician"), env)).toBe(false);
    expect(canUseInventoryV2Ui(actor("sales"), env)).toBe(false);
  });

  it("keeps parent flags and the store denylist authoritative", () => {
    expect(
      canUseInventoryV2Commands(actor("owner"), {
        ...baseEnv,
        INVENTORY_V2_ALL_STORES_ENABLED: "1",
        INVENTORY_V2_STORE_DENYLIST: "store-1",
      }),
    ).toBe(false);
    expect(
      canUseInventoryV2Commands(actor("owner"), {
        ...baseEnv,
        INVENTORY_V2_ALL_STORES_ENABLED: "1",
        INVENTORY_V2_COMMANDS: "0",
      }),
    ).toBe(false);
  });
});

function actor(role: StoreRole, permissionGrants: AuditActor["permissionGrants"] = []): AuditActor {
  return {
    id: `actor-${role}`,
    displayName: role,
    role,
    storeRole: role,
    storeId: "store-1",
    activeMembershipId: `membership-${role}`,
    permissionGrants,
  };
}
