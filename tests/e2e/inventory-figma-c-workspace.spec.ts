import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { translateMessage } from "@/shared/i18n/messages";

test.skip(process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1", "Synthetic localhost only");
const evidence = resolve(
  process.cwd(),
  process.env.PLAYWRIGHT_BROWSER === "webkit"
    ? "artifacts/TASK-20260912-002-ui-consistency-framework/figma-run4/workspace-webkit"
    : "artifacts/TASK-20260912-002-ui-consistency-framework/figma-run4/workspace",
);
const product = {
  id: "00000000-0000-4000-8000-000000009404",
  sku: "C-FIGMA-SYNTHETIC",
  category: "phone",
  brand: "Samsung",
  model: "Galaxy S23",
  status: "in_stock",
  color: "黑色",
  storage_capacity: "256 GB",
  ram_capacity: "8 GB",
  condition: "A",
  list_price: 399.5,
  currency_code: "EUR",
  location: "SYNTHETIC A3",
  warranty_months: 12,
  notes: "Synthetic visual verification only",
  specifications: { network_variant: "EU" },
  created_at: "2026-09-13T10:00:00Z",
  updated_at: "2026-09-13T10:00:00Z",
  version: 1,
  identifiers: [{ kind: "imei1", value: "490154203237518", primary: true, source: "manual" }],
};

test.beforeEach(async ({ context, baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  await context.addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL! }]);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === new URL(baseURL!).origin
      ? route.continue()
      : route.abort(),
  );
  await context.route("**/api/repairdesk/inventory/sales/**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Synthetic sales disabled", code: "feature_disabled" },
    }),
  );
  await context.route("**/api/repairdesk/inventory/catalog/search", (route) =>
    route.fulfill({ json: { data: { items: [] } } }),
  );
  await context.route("**/api/repairdesk/inventory/products/edit-data", (route) =>
    route.fulfill({ json: { data: product } }),
  );
  await context.route("**/api/repairdesk/inventory/products/get", (route) =>
    route.fulfill({
      json: {
        data: {
          ...product,
          identifiers: [{ kind: "imei1", masked_value: "•••• 7518", primary: true }],
        },
      },
    }),
  );
  await context.route("**/api/repairdesk/inventory/products/list", (route) =>
    route.fulfill({
      json: {
        data: {
          items: [{ ...product, identifiers: undefined, masked_identifier: "•••• 7518" }],
          total: 1,
          facets: { brands: ["Samsung"], locations: ["SYNTHETIC A3"] },
        },
      },
    }),
  );
  await context.route("**/api/repairdesk/inventory/products/update", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "SYNTHETIC blocked write", code: "synthetic_unconfigured" },
    }),
  );
  await context.route("**/api/repairdesk/inventory/products/quick-create", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "SYNTHETIC blocked write", code: "synthetic_unconfigured" },
    }),
  );
  await mkdir(evidence, { recursive: true });
});

test("isolated startup renders the inventory list and new-product route without page errors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "商品售卖", exact: true })).toBeVisible();
  await expect(
    page
      .locator(`[data-inventory-product-results] a[href="/inventory/${product.id}"]:visible`)
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(evidence, "startup-inventory.png"),
    animations: "disabled",
  });
  await page.locator('[data-inventory-product-create-trigger="true"]:visible').first().click();
  await expect(page).toHaveURL(/\/inventory\/new$/);
  await expect(
    page.locator('[data-inventory-product-form-shell="fullscreen-workbench"]'),
  ).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  await page.screenshot({ path: resolve(evidence, "startup-new.png"), animations: "disabled" });
  expect(errors).toEqual([]);
});

for (const width of [390, 430, 768, 820, 1024, 1180, 1440]) {
  for (const locale of ["zh-CN", "en", "it-IT"] as const) {
    test(`${width}px ${locale}: shared edit presentation preserves values and single labels`, async ({
      page,
      context,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height: width < 768 ? 932 : 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await context.addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL! }]);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/inventory/${product.id}/edit`);
      await expect(
        page.locator('[data-inventory-product-form-shell="fullscreen-workbench"]'),
      ).toHaveCount(1);
      await expect(page.locator("#product-imei1")).toHaveValue("490154203237518");
      await expect(page.locator("#product-price")).toHaveValue("399.5");
      await expect(
        page.getByRole("heading", {
          name: translateMessage(locale, "inventory2b4.quick.form.identity"),
          exact: true,
        }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("heading", {
          name: translateMessage(locale, "inventory2b4.quick.form.salesInformation"),
          exact: true,
        }),
      ).toHaveCount(1);
      await expect(page.locator("[data-inventory-color-palette] button[aria-pressed]")).toHaveCount(
        7,
      );
      await expect(
        page.getByRole("button", {
          name: translateMessage(locale, "inventory2b4.quick.edit.save"),
          exact: true,
        }),
      ).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.evaluate(() =>
        document.querySelectorAll("nextjs-portal").forEach((node) => node.remove()),
      );
      await page.screenshot({
        path: resolve(evidence, `edit-${width}-${locale}.png`),
        fullPage: true,
        animations: "disabled",
      });
      expect(errors).toEqual([]);
    });
  }
}

test("real desktop links restore list context after edit failure, retry, cancel and reopen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const commands: Record<string, unknown>[] = [];
  await page.route("**/api/repairdesk/inventory/products/update", (route) => {
    commands.push(route.request().postDataJSON().input);
    return route.fulfill(
      commands.length === 1
        ? { status: 503, json: { error: "SYNTHETIC retry", code: "synthetic_failure" } }
        : { json: { data: { ok: true, code: "updated", id: product.id, version: 2 } } },
    );
  });
  await page.goto("/inventory");
  const search = page.getByPlaceholder("搜索商品、SKU、型号").filter({ visible: true });
  await search.fill(product.sku);
  await page
    .locator(`[data-inventory-product-results] a[href="/inventory/${product.id}"]:visible`)
    .first()
    .click();
  await page.getByRole("button", { name: "编辑商品", exact: true }).click();
  await expect(page.locator("#product-price")).toHaveValue("399.5");
  await page.locator("#product-price").fill("444.50");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "继续编辑", exact: true })
    .click();
  await expect(page.locator("#product-price")).toHaveValue("444.50");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect.poll(() => commands.length).toBe(1);
  await expect(page.locator("#product-price")).toHaveValue("444.50");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/inventory/${product.id}$`));
  expect(commands[0].idempotency_key).toBe(commands[1].idempotency_key);
  await page.getByRole("link", { name: "返回商品库存", exact: true }).click();
  await expect(search).toHaveValue(product.sku);
  expect(page.url()).not.toContain(product.sku);
  await page
    .locator(`[data-inventory-product-results] a[href="/inventory/${product.id}"]:visible`)
    .first()
    .click();
  await page.getByRole("button", { name: "编辑商品", exact: true }).click();
  await expect(page.locator("#product-price")).toHaveValue("399.5");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("link", { name: "返回商品库存", exact: true }).click();
  await expect(search).toHaveValue(product.sku);
});

test("IMEI 2 opens the existing scanner and its fallback commits only to IMEI 2", async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(new DOMException("Synthetic unavailable camera", "NotAllowedError")),
    });
  });
  await page.goto(`/inventory/${product.id}/edit`);
  const target = page.getByRole("button", { name: "摄像头扫码录入 IMEI 2", exact: true });
  await target.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("无法识别时可手动输入").fill("990000000000010");
  await dialog.getByRole("button", { name: "填入手动编号", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#product-imei2")).toHaveValue("990000000000010");
  await expect(page.locator("#product-imei1")).toHaveValue("490154203237518");
  await expect(target).toBeFocused();
  await page.screenshot({
    path: resolve(evidence, "scanner-imei2-target.png"),
    animations: "disabled",
  });
});

test("English More colors and category confirmation preserve and clear only the promised draft fields", async ({
  page,
  context,
  baseURL,
}) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await context.addCookies([{ name: "repairdesk_locale", value: "en", url: baseURL! }]);
  await page.goto(`/inventory/${product.id}/edit`);
  const gray = page.locator("[data-inventory-color-palette] button[aria-pressed]").nth(1);
  await gray.click();
  await expect(gray).toHaveAttribute("aria-pressed", "true");
  await gray.click();
  const more = page.getByRole("combobox", { name: "Color: More / custom", exact: true });
  await more.click();
  await expect(page.locator("#product-color-manual")).toHaveValue("");
  await expect(page.getByRole("option")).toHaveCount(3);
  await page.locator("#product-color-manual").fill("Custom 用户色");
  await page
    .locator("[data-inventory-manual-entry]")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await more.click();
  await expect(page.locator("#product-color-manual")).toHaveValue("Custom 用户色");
  await page
    .locator("[data-inventory-manual-entry]")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("radio", { name: "Phone", exact: true }).click();
  await expect(page.locator('[data-ui="inventory-product-category-confirm"]')).toHaveCount(0);
  await page.getByRole("radio", { name: "Tablet", exact: true }).click();
  const confirmation = page.locator('[data-ui="inventory-product-category-confirm"]');
  await expect(confirmation).toHaveCount(1);
  await expect(confirmation).toContainText("Saved inspection records are retained");
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
  await page.screenshot({
    path: resolve(evidence, "category-confirmation-430-en.png"),
    animations: "disabled",
  });
  await confirmation.getByRole("button", { name: "Continue editing", exact: true }).click();
  await expect(page.locator("#product-imei1")).toHaveValue("490154203237518");
  await more.click();
  await expect(page.locator("#product-color-manual")).toHaveValue("Custom 用户色");
  await page
    .locator("[data-inventory-manual-entry]")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("radio", { name: "Tablet", exact: true }).click();
  await confirmation.getByRole("button", { name: "Clear and switch", exact: true }).click();
  await expect(page.locator("#product-imei1")).toHaveValue("");
  await expect(page.locator("#product-price")).toHaveValue("399.5");
  await expect(page.locator("#product-location")).toHaveValue("SYNTHETIC A3");
});
