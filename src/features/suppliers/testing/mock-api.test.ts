import { describe, expect, it, beforeEach } from "vitest";

import {
  archiveMockSupplier,
  createMockSupplier,
  getMockSupplier,
  listMockSuppliers,
  resetMockSuppliers,
} from "./mock-api";

describe("supplier mock API", () => {
  beforeEach(() => {
    resetMockSuppliers();
  });

  it("starts each store without default suppliers", () => {
    expect(listMockSuppliers()).toEqual([]);
  });

  it("creates suppliers explicitly and hides archived suppliers from order selection", () => {
    const supplier = createMockSupplier({
      name: "UTOPYA",
      short_name: "UTO",
      color: "#16a34a",
    });

    expect(listMockSuppliers()).toHaveLength(1);
    expect(getMockSupplier(supplier.id)?.name).toBe("UTOPYA");

    archiveMockSupplier(supplier.id);

    expect(listMockSuppliers()[0]?.archived_at).toBeTruthy();
    expect(getMockSupplier(supplier.id)).toBeUndefined();
  });

  it("keeps mock supplier data isolated by the actor store", () => {
    const storeA = { storeId: "store-a", displayName: "Owner A" };
    const storeB = { storeId: "store-b", displayName: "Owner B" };
    const supplier = createMockSupplier({ name: "Store A Supplier" }, storeA);

    expect(listMockSuppliers(storeA)).toEqual([supplier]);
    expect(listMockSuppliers(storeB)).toEqual([]);
    expect(() => archiveMockSupplier(supplier.id, storeB)).toThrow("供应商不存在或不属于当前店铺");
    expect(listMockSuppliers(storeA)[0]?.archived_at).toBeUndefined();
  });
});
