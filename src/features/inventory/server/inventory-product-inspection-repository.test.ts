import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/features/inventory/server/inventory-product.repository.ts"),
  "utf8",
);

describe("inventory product inspection repository boundary", () => {
  it("keeps ordinary product saves on the legacy RPC and inspection saves on one wrapper", () => {
    expect(source).toContain("if (input.inspection !== undefined)");
    expect(source).toContain("repairdesk_inventory_product_save_with_inspection_v1");
    expect(source).toContain("repairdesk_create_inventory_product_v2");
    expect(source).toContain("repairdesk_update_inventory_product_v1");
    expect(source).toContain("isInventoryProductInspectionEnabledForStore(storeId)");
    expect(source).toContain("Promise.resolve({ data: null, error: null })");
  });

  it("enforces independent permission, rollout and exact catalog capability gates", () => {
    expect(source).toContain("assertInventoryProductInspectionEnabled(storeId)");
    expect(source).toContain('can(actor, "inventory:inspection")');
    expect(source).toContain("resolveDeviceInspectionCapabilities(");
    expect(source).toContain("input.category");
    expect(source).toContain("input.brand");
    expect(source).toContain("input.model");
    expect(source).toContain("unsupported_inspection_field");
    expect(source).toContain("inventory_device_inspections");
    expect(source).toContain('.order("inspected_at", { ascending: false })');
    expect(source).toContain('.order("created_at", { ascending: false })');
    expect(source).toContain('.order("id", { ascending: false })');
  });

  it("fails closed when the atomic wrapper omits the inspection id", () => {
    expect(source.match(/text\(result\.inspection_id\)/g)).toHaveLength(2);
    expect(source).toContain("!text(result.inspection_id)");
  });
});
