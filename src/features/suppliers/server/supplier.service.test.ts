import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, Supplier } from "@/lib/repairdesk/types";

import { archiveSupplier, createSupplier, listSuppliers, updateSupplier } from "./supplier.service";

const mocks = vi.hoisted(() => ({
  archiveSupplierRow: vi.fn(),
  createSupplierRow: vi.fn(),
  getSupplierRow: vi.fn(),
  listSupplierRows: vi.fn(),
  updateSupplierRow: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("./supplier.repository", () => ({
  archiveSupplierRow: mocks.archiveSupplierRow,
  createSupplierRow: mocks.createSupplierRow,
  getSupplierRow: mocks.getSupplierRow,
  listSupplierRows: mocks.listSupplierRows,
  updateSupplierRow: mocks.updateSupplierRow,
}));

vi.mock("@/server/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

const owner: AuditActor = {
  id: "owner-user",
  email: "owner@example.com",
  emailVerified: true,
  displayName: "Owner",
  storeId: "store-a",
  storeName: "Store A",
  storeRole: "owner",
};

const supplier: Supplier = {
  id: "supplier-a",
  name: "Store A Supplier",
  short_name: "A",
  color: "#64748b",
  contact_name: undefined,
  phone: undefined,
  email: undefined,
  website: undefined,
  notes: undefined,
  archived_at: undefined,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

describe("supplier service tenant boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives every repository scope from the authenticated actor", async () => {
    mocks.listSupplierRows.mockResolvedValue([supplier]);

    await expect(listSuppliers(owner)).resolves.toEqual([supplier]);

    expect(mocks.listSupplierRows).toHaveBeenCalledWith("store-a", {
      includeArchived: true,
    });
  });

  it("does not accept a store id from supplier input", async () => {
    mocks.createSupplierRow.mockResolvedValue(supplier);

    await createSupplier({ name: "Store A Supplier" }, owner);

    expect(mocks.createSupplierRow).toHaveBeenCalledWith({ name: "Store A Supplier" }, "store-a");
  });

  it("rejects cross-store update attempts before the write repository is called", async () => {
    mocks.getSupplierRow.mockResolvedValue(undefined);

    await expect(updateSupplier("supplier-b", { name: "Other" }, owner)).rejects.toThrow(
      "供应商不存在或不属于当前店铺",
    );

    expect(mocks.getSupplierRow).toHaveBeenCalledWith("supplier-b", "store-a");
    expect(mocks.updateSupplierRow).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects cross-store archive attempts before the write repository is called", async () => {
    mocks.getSupplierRow.mockResolvedValue(undefined);

    await expect(archiveSupplier("supplier-b", owner)).rejects.toThrow(
      "供应商不存在或不属于当前店铺",
    );

    expect(mocks.getSupplierRow).toHaveBeenCalledWith("supplier-b", "store-a");
    expect(mocks.archiveSupplierRow).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
