import { expect, type Page } from "@playwright/test";
import type { InventoryProductDetail } from "@/lib/repairdesk/types";

const product: InventoryProductDetail = {
  id: "inv_mock_3",
  sku: "SYNTHETIC-TABLET",
  category: "tablet",
  brand: "Apple",
  model: "iPad Air 5",
  status: "in_stock",
  currency_code: "EUR",
  list_price: 599,
  updated_at: "2026-09-25T08:00:00Z",
  created_at: "2026-09-25T08:00:00Z",
  identifiers: [],
  version: 1,
  storage_capacity: "256 GB",
  notes: "Synthetic layout fixture",
  warranty_months: 12,
  finance_redacted: true,
};

/** Explicit synthetic capability for layout stories; never changes server authorization. */
export async function installInventoryLayoutFixture(page: Page, baseURL: string) {
  expect(process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP).toBe("1");
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL).hostname);
  await page.route("**/api/repairdesk/shell/bootstrap", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    expect(body.data?.storeContext?.permissions).toBeDefined();
    Object.assign(body.data.storeContext.permissions, {
      inventoryProductsUiEnabled: true,
      inventoryProductQuickCreateEnabled: true,
      canReadInventory: true,
      canCreateInventory: true,
      canUpdateInventory: true,
    });
    await route.fulfill({ response, json: body });
  });
  await page.route("**/api/repairdesk/inventory/products/list", async (route) => {
    await route.fulfill({
      json: { data: { items: [product], total: 1, facets: { brands: ["Apple"], locations: [] } } },
    });
  });
  await page.route("**/api/repairdesk/inventory/products/get", async (route) => {
    const { id } = route.request().postDataJSON() as { id: string };
    expect(id).toBe("inv_mock_3");
    await route.fulfill({ json: { data: product } });
  });
  for (const action of ["list", "summary"]) {
    await page.route(`**/api/repairdesk/inventory/sales/${action}`, (route) =>
      route.fulfill({
        status: 403,
        json: { error: "Synthetic optional sales workflow disabled", code: "feature_disabled" },
      }),
    );
  }
}
