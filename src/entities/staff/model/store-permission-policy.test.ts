import { describe, expect, it } from "vitest";

import {
  canRoleReceiveStorePermissionGrant,
  normalizeStorePermissionGrants,
} from "./store-permission-policy";

describe("store permission grants", () => {
  it("keeps sensitive finance and archive grants manager-only", () => {
    expect(canRoleReceiveStorePermissionGrant("manager", "finance:aggregate_read")).toBe(true);
    expect(canRoleReceiveStorePermissionGrant("technician", "finance:aggregate_read")).toBe(false);
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
  });
});
