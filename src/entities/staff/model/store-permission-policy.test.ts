import { describe, expect, it } from "vitest";

import {
  canRoleReceiveStorePermissionGrant,
  normalizeStorePermissionGrants,
} from "./store-permission-policy";

describe("store permission grants", () => {
  it("keeps sensitive finance and archive grants manager-only", () => {
    expect(canRoleReceiveStorePermissionGrant("manager", "finance:aggregate_read")).toBe(true);
    expect(canRoleReceiveStorePermissionGrant("manager", "finance:cost_manage")).toBe(true);
    expect(canRoleReceiveStorePermissionGrant("manager", "finance:cost_export")).toBe(true);
    expect(canRoleReceiveStorePermissionGrant("manager", "finance:cost_backfill_preview")).toBe(
      true,
    );
    expect(canRoleReceiveStorePermissionGrant("manager", "inventory:cost_allocate")).toBe(true);
    expect(canRoleReceiveStorePermissionGrant("technician", "finance:aggregate_read")).toBe(false);
    expect(canRoleReceiveStorePermissionGrant("technician", "finance:cost_manage")).toBe(false);
    expect(canRoleReceiveStorePermissionGrant("sales", "finance:cost_manage")).toBe(false);
    expect(canRoleReceiveStorePermissionGrant("sales", "order:archive_browse")).toBe(false);
    expect(canRoleReceiveStorePermissionGrant("viewer", "supplier:read")).toBe(false);
  });

  it("normalizes dependent grants and removes incompatible grants", () => {
    expect(normalizeStorePermissionGrants(["supplier:manage"], "technician")).toEqual([
      "supplier:read",
      "supplier:assign",
      "supplier:manage",
    ]);
    expect(normalizeStorePermissionGrants(["finance:profit_read"], "manager")).toEqual([
      "finance:aggregate_read",
      "finance:profit_read",
    ]);
    expect(normalizeStorePermissionGrants(["finance:profit_read"], "technician")).toEqual([]);
    expect(normalizeStorePermissionGrants(["finance:cost_manage"], "manager")).toEqual([
      "finance:cost_manage",
    ]);
    expect(normalizeStorePermissionGrants(["finance:cost_manage"], "sales")).toEqual([]);
    expect(normalizeStorePermissionGrants(["finance:cost_export"], "manager")).toEqual([
      "finance:aggregate_read",
      "finance:profit_read",
      "finance:cost_export",
    ]);
    expect(normalizeStorePermissionGrants(["inventory:cost_allocate"], "manager")).toEqual([
      "finance:cost_manage",
      "inventory:cost_allocate",
    ]);
    expect(normalizeStorePermissionGrants(["finance:cost_backfill_preview"], "manager")).toEqual([
      "finance:cost_manage",
      "finance:cost_backfill_preview",
    ]);
  });
});
