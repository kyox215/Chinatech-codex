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
});
