import { runEvidencePath } from "./helpers/evidence";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page, type Locator } from "@playwright/test";

test.skip(process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1", "Isolated synthetic fixture only.");
const screenshotDir = resolve(process.cwd(), runEvidencePath("inventory-create"));
test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});
test.beforeEach(async ({ context, baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  await context.addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL! }]);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === new URL(baseURL!).origin
      ? route.continue()
      : route.abort(),
  );
  // This story explicitly exercises the product-entry capability. Production flags
  // remain off; the browser fixture declares its own enabled contract.
  await context.route("**/api/repairdesk/shell/bootstrap", async (route) => {
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
  await context.route("**/api/repairdesk/inventory/sales/list", (route) =>
    route.fulfill({
      status: 403,
      json: { error: "Synthetic optional sales workflow disabled", code: "feature_disabled" },
    }),
  );
  await context.route("**/api/repairdesk/inventory/products/list", (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              id: "inv_mock_3",
              sku: "SYNTHETIC-TABLET",
              category: "tablet",
              brand: "Apple",
              model: "iPad Air 5",
              specification: "256 GB",
              masked_identifier: "•••• 2345",
              status: "in_stock",
              location: "Synthetic shelf",
              list_price: 599,
              currency_code: "EUR",
              updated_at: "2026-09-13T10:00:00Z",
              created_at: "2026-09-13T10:00:00Z",
              color: "Silver",
              ram_capacity: "8 GB",
              storage_capacity: "256 GB",
              condition: "A",
              specifications: {},
              identifiers: [],
              warranty_months: 12,
              notes: "Synthetic entry fixture",
              version: 1,
              lifecycle: {
                mode: "exact",
                status: "in_stock",
                confidence: "high",
                needs_review: false,
                allowed_actions: [],
              },
            },
          ],
          total: 1,
          facets: { brands: ["Apple"], locations: ["Synthetic shelf"] },
          lifecycle_projection: { mode: "exact", counts: { in_stock: 1 } },
        },
      },
    }),
  );
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(
    "inventory create opens one fullscreen task at " + viewport.width + "px",
    async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/inventory");
      await expect(
        page
          .getByRole("link", { name: /Apple iPad Air 5/ })
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await page.getByRole("button", { name: "快速录入商品" }).click();
      await expect(page).toHaveURL(/\/inventory\/new$/);
      await expect(
        page.locator('[data-inventory-product-form-shell="fullscreen-workbench"]'),
      ).toHaveCount(1);
      await expect(page.locator("[data-inventory-product-create-dialog]")).toHaveCount(0);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      if (viewport.width < 1024) {
        expect(
          await page.evaluate(() => document.activeElement?.matches("input, textarea, select")),
        ).toBe(false);
        await expect(page.locator("#product-brand")).toHaveJSProperty("tagName", "BUTTON");
      } else {
        await expect(page.locator("#product-brand")).toHaveJSProperty("tagName", "INPUT");
        await page.locator("#product-brand").click();
        await expect(page.locator('[data-inventory-catalog-command="desktop"]')).toBeVisible();
        await page.keyboard.press("Escape");
      }
      await expect(page.getByRole("button", { name: "摄像头扫码录入 IMEI 1" })).toBeVisible();
      await expect(page.locator('[data-ui="inventory-product-actions"]')).toBeInViewport({
        ratio: 1,
      });
      await assertNoHorizontalOverflow(page);
      await page.screenshot({
        path: resolve(screenshotDir, viewport.width + "-inventory-create-page.png"),
        fullPage: false,
        style: "nextjs-portal { visibility: hidden !important; }",
      });
      await page.getByRole("button", { name: "返回商品库存", exact: true }).click();
      await expect(page).toHaveURL(/\/inventory$/);
    },
  );
}

test("dirty leave uses one confirmation and restores list search", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/inventory");
  const search = page.locator('input[placeholder="搜索商品、SKU、型号"]:visible');
  await search.fill("Apple");
  await page.getByRole("button", { name: "快速录入商品" }).click();
  await selectCatalogValue(page, "product-brand", "搜索手机品牌或手动输入", "Apple");
  await page.getByRole("button", { name: "返回商品库存", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  const keep = confirmation.getByRole("button", { name: "继续填写" });
  const discard = confirmation.getByRole("button", { name: "放弃并离开" });
  await expect(keep).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(discard).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(keep).toBeFocused();
  await keep.click();
  await expect(page.locator("#product-brand")).toContainText("Apple");
  await page.getByRole("button", { name: "返回商品库存", exact: true }).click();
  await discard.click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(search).toHaveValue("Apple");
  await assertNoHorizontalOverflow(page);
});

test("mobile browse stays keyboard-free until explicit search and desktop stays editable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });
    await page.goto("/inventory/new");
    await page.getByRole("radio", { name: /游戏机/ }).click();
    const trigger = page.locator("#product-brand");
    await expect(trigger).toHaveAttribute("role", "combobox");
    await expect(trigger).toHaveJSProperty("tagName", "BUTTON");
    await trigger.click();
    const picker = page.locator('[data-inventory-catalog-picker="mobile"]');
    await expect(picker).toBeVisible();
    await expect(page.locator("[data-inventory-catalog-search]")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.activeElement?.matches("input, textarea, select")),
    ).toBe(false);
    await expect(page.locator("[data-inventory-catalog-search-action]")).toBeVisible();
    await assertPickerIsolation(page, picker);
    await page.locator("[data-inventory-catalog-search-action]").click();
    const search = page.getByPlaceholder("搜索游戏机品牌或手动输入");
    await expect(search).toBeFocused();
    await search.fill("Nintendo");
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: resolve(screenshotDir, width + "-catalog-manual-search.png"),
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/\/inventory\/new$/);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/inventory/new");
  const brand = page.locator("#product-brand");
  await brand.click();
  await expect(page.locator('[data-inventory-catalog-command="desktop"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-inventory-catalog-command="desktop"]')).toHaveCount(0);
  await brand.fill("Sony / PlayStation");
  await page.locator("#product-model").pressSequentially("Workshop Prototype");
  await expect(
    page.locator('[data-ui="inventory-product-catalog-transition-confirm"]'),
  ).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("catalog trigger changes exactly at the 1024px desktop boundary", async ({ page }) => {
  for (const width of [1023, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/inventory/new");
    const brand = page.locator("#product-brand");
    await expect(brand).toHaveAttribute("role", "combobox");
    await expect(brand).toHaveJSProperty("tagName", width < 1024 ? "BUTTON" : "INPUT");
    await brand.click();
    const picker = page.locator(
      width < 1024
        ? '[data-inventory-catalog-picker="mobile"]'
        : '[data-inventory-catalog-command="desktop"]',
    );
    await expect(picker).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
    await page.getByRole("button", { name: "返回商品库存", exact: true }).click();
    await expect(page).toHaveURL(/\/inventory$/);
  }
});

test("legacy route intent opens the same full-page task and retains scanning", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory?workspace=new-product");
  await expect(page).toHaveURL(/\/inventory\/new$/);
  await expect(
    page.locator('[data-inventory-product-form-shell="fullscreen-workbench"]'),
  ).toHaveCount(1);
  await expect(page.getByRole("button", { name: "摄像头扫码录入 IMEI 1" })).toBeVisible();
  await page.getByRole("button", { name: "返回商品库存", exact: true }).click();
  await expect(page).toHaveURL(/\/inventory$/);
});

test("successful mocked create navigates to canonical product detail", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/repairdesk/inventory/products/quick-create", async (route) => {
    writes++;
    expect(route.request().postDataJSON().input.category).toBe("tablet");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ok: true,
          code: "created",
          id: "inv_mock_3",
          sku: "SYNTHETIC-CREATE",
          created_at: "2026-09-13T10:00:00Z",
        },
      }),
    });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/inventory");
  await page.getByRole("button", { name: "快速录入商品" }).click();
  await page.getByRole("radio", { name: "平板", exact: true }).click();
  await page.locator("#product-brand").fill("Apple");
  await page.locator("#product-model").fill("iPad Air 5");
  await page.getByRole("button", { name: "保存并查看商品" }).click();
  await expect(page).toHaveURL(/\/inventory\/inv_mock_3$/);
  expect(writes).toBe(1);
});

async function assertNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const form of await page.locator("form").all()) {
    expect(await form.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
}
async function assertPickerIsolation(page: Page, picker: Locator) {
  await expect
    .poll(async () => {
      const rect = (await picker.boundingBox())!;
      return rect.y >= 0 && rect.y + rect.height <= (await page.evaluate(() => innerHeight + 2));
    })
    .toBe(true);
  await page.keyboard.press("Tab");
  expect(await picker.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  expect(await picker.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  expect(
    await page.locator('[data-ui="inventory-product-actions"]').evaluate((node) => {
      const r = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(r.x + r.width / 2, r.bottom - 2));
    }),
  ).toBe(false);
}
async function selectCatalogValue(page: Page, id: string, placeholder: string, value: string) {
  const trigger = page.locator("#" + id);
  await trigger.click();
  await page.locator("[data-inventory-catalog-search-action]").click();
  await page.getByPlaceholder(placeholder).fill(value);
  await page
    .getByRole("option", { name: new RegExp("^" + value + "(?:\\s|$)") })
    .first()
    .click();
  await expect(trigger).toContainText(value);
}
