import { runEvidencePath } from "./helpers/evidence";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { devices, expect, test, type Page } from "@playwright/test";
import { translateMessage } from "@/shared/i18n/messages";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Requires the isolated synthetic localhost server; all product saves are intercepted.",
);
const evidence = resolve(
  process.cwd(),
  runEvidencePath("artifacts/TASK-20260912-002-ui-consistency-framework/figma-run4/intake"),
);

test.beforeEach(async ({ context, baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  await context.addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL! }]);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === new URL(baseURL!).origin
      ? route.continue()
      : route.abort(),
  );
  await context.route("**/api/repairdesk/inventory/products/quick-create", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic save blocked", code: "synthetic_unconfigured" }),
    }),
  );
  await mkdir(evidence, { recursive: true });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
  { width: 1440, height: 900 },
]) {
  test.describe(`${viewport.width}px fullscreen`, () => {
    test.use({
      viewport,
      hasTouch: viewport.width < 1280,
      ...(viewport.width < 1280
        ? { userAgent: devices[viewport.width < 768 ? "iPhone 13" : "iPad Pro 11"].userAgent }
        : {}),
      contextOptions: { reducedMotion: "reduce" },
    });
    if (viewport.width < 1024) {
      test("touch catalog selection keeps the same draft through cancel and mock save", async ({
        page,
      }) => {
        let writes = 0;
        await page.route("**/api/repairdesk/inventory/products/quick-create", async (route) => {
          writes += 1;
          const input = route.request().postDataJSON().input;
          expect(input.brand).toBe("Apple");
          expect(input.model).toBe("iPhone 15");
          expect(input.warranty_months).toBe(18);
          await route.fulfill({
            status: writes === 1 ? 503 : 200,
            contentType: "application/json",
            body: JSON.stringify(
              writes === 1
                ? { error: "SYNTHETIC touch failure", code: "synthetic_failure" }
                : {
                    data: {
                      ok: true,
                      code: "created",
                      id: "inv_mock_3",
                      sku: "SYNTHETIC-TOUCH",
                      created_at: "2026-09-13T10:00:00Z",
                    },
                  },
            ),
          });
        });
        await page.goto("/inventory/new");
        for (const [id, value] of [
          ["product-brand", "Apple"],
          ["product-model", "iPhone 15"],
        ]) {
          const trigger = page.locator(`#${id}`);
          await expect(trigger).toHaveJSProperty("tagName", "BUTTON");
          await trigger.click();
          await page.locator("[data-inventory-catalog-search-action]").click();
          await page.locator("[data-inventory-catalog-search]").fill(value);
          await page
            .getByRole("option", { name: new RegExp(`^${value}(?:\\s|$)`) })
            .first()
            .click();
          await expect(trigger).toContainText(value);
          await expect(trigger).toBeFocused();
        }
        await page.locator("#product-imei1").fill("490154203237518");
        const warranty = page.locator("#product-warranty");
        await warranty.click();
        const manualWarranty = page.locator("#product-warranty-manual");
        await expect(manualWarranty).toHaveAttribute("data-numeric-keypad-trigger", "true");
        await manualWarranty.click();
        const keypad = page.locator("[data-numeric-keypad]");
        for (const key of ["1", "2", "1"])
          await keypad.locator(`[data-numeric-key="${key}"]`).click();
        await page.keyboard.press("Escape");
        await expect(keypad).toHaveCount(0);
        await expect(manualWarranty).toBeVisible();
        await expect(manualWarranty).toContainText("121");
        await page.keyboard.press("Escape");
        await expect(manualWarranty).toHaveCount(0);
        await expect(warranty).toBeFocused();
        await page.getByRole("button", { name: "保存并查看商品" }).click();
        await expect(warranty).toBeFocused();
        await expect(warranty).toBeInViewport({ ratio: 1 });
        await expect(warranty).toHaveAttribute("aria-invalid", "true");
        expect(writes).toBe(0);
        await warranty.click();
        await manualWarranty.click();
        for (const key of ["clear", "1", "8"])
          await keypad.locator(`[data-numeric-key="${key}"]`).click();
        await page.keyboard.press("Escape");
        await expect(keypad).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(manualWarranty).toHaveCount(0);
        await expect(warranty).toContainText("18");
        await page.getByRole("button", { name: "保存并查看商品" }).click();
        await assertFailureFeedbackVisible(page);
        await expect(page.locator("#product-imei1")).toHaveValue("490154203237518");
        await page.screenshot({
          path: resolve(evidence, `chromium-${viewport.width}-save-failure-visible.png`),
          animations: "disabled",
        });
        await page.getByRole("button", { name: "返回商品库存", exact: true }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "继续填写" }).click();
        await expect(page.locator("#product-model")).toContainText("iPhone 15");
        await expect(page.locator("#product-imei1")).toHaveValue("490154203237518");
        await page.getByRole("button", { name: "保存并查看商品" }).click();
        await expect(page).toHaveURL(/\/inventory\/inv_mock_3$/);
        expect(writes).toBe(2);
      });
    }
    for (const locale of ["zh-CN", "en", "it-IT"] as const) {
      test(`${locale}: one form, reachable actions, identifiers and manual entry`, async ({
        page,
        context,
        baseURL,
      }, testInfo) => {
        await context.addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL! }]);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("/inventory/new");
        const workspace = page.locator(
          '[data-inventory-product-form-shell="fullscreen-workbench"]',
        );
        await expect(workspace).toBeVisible();
        await expect(page.locator("[data-inventory-product-form-shell]")).toHaveCount(1);
        await expect(page.locator("[data-inventory-product-create-dialog]")).toHaveCount(0);
        const columns = await workspace.evaluate(
          (node) => getComputedStyle(node).gridTemplateColumns.split(" ").length,
        );
        const availableWidth = await workspace.evaluate((node) => node.parentElement!.clientWidth);
        expect(columns).toBe(availableWidth < 900 ? 1 : 2);
        const actions = page.locator('[data-ui="inventory-product-actions"]');
        await expect(actions).toHaveCount(1);
        await expect(actions.getByRole("button")).toHaveCount(2);
        const actionBox = (await actions.boundingBox())!;
        expect(actionBox.y).toBeGreaterThanOrEqual(0);
        expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(viewport.height);
        if (viewport.width >= 768) expect(actionBox.y).toBeLessThan(150);
        else expect(actionBox.y).toBeGreaterThan(viewport.height / 2);
        await expect(page.locator("#product-imei1")).toHaveAttribute("aria-required", "true");
        await expect(page.locator("#product-imei2")).toBeVisible();
        expect((await page.locator("#product-imei1").boundingBox())!.width).toBeGreaterThanOrEqual(
          150,
        );
        await expect(page.locator("#product-cost")).toHaveCount(0);
        await page.locator("#product-imei2").fill("490154203237518");
        await page.locator("#product-imei2").blur();
        await page.evaluate(() => window.scrollTo(0, 0));
        await assertNoOverflow(page);
        await page.screenshot({
          path: resolve(
            evidence,
            `${testInfo.project.name}-${viewport.width}-${locale}-intake.png`,
          ),
          fullPage: true,
        });

        const more = page.getByRole("button", {
          name: new RegExp(translateMessage(locale, "inventory2b4.quick.form.moreInformation")),
        });
        if ((await more.getAttribute("aria-expanded")) === "false") await more.click();
        await page
          .locator("#product-notes")
          .fill("SYNTHETIC note — long content retained across rotation");
        const notesHandle = await page.locator("#product-notes").elementHandle();
        await page.setViewportSize({
          width: viewport.width < 768 ? 430 : viewport.width === 820 ? 1180 : 820,
          height: viewport.width < 768 ? 650 : 650,
        });
        await expect(page.locator("#product-notes")).toHaveValue(
          "SYNTHETIC note — long content retained across rotation",
        );
        expect(
          await notesHandle!.evaluate((node) => node === document.getElementById("product-notes")),
        ).toBe(true);
        await expect(page.locator("#product-imei2")).toHaveValue("490154203237518");
        await page.locator("#product-notes").scrollIntoViewIfNeeded();
        await assertNoOverflow(page);
        await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
        expect(errors).toEqual([]);
      });
    }
  });
}

test("list create and legacy intent use the fullscreen route; dirty cancel restores the list search", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inventory");
  const create = page.locator('[data-inventory-product-create-trigger="true"]:visible').first();
  await expect(create).toBeVisible();
  const search = page.locator('input[placeholder="搜索商品、SKU、型号"]:visible');
  await search.fill("SYNTHETIC-RETURN-SEARCH");
  await create.click();
  await expect(page).toHaveURL(/\/inventory\/new$/);
  await page.locator("#product-imei1").fill("490154203237518");
  await page.getByRole("button", { name: "返回商品库存", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: resolve(evidence, "chromium-dirty-leave-confirmation.png"),
    animations: "disabled",
  });
  await confirmation.getByRole("button", { name: "继续填写" }).click();
  await expect(page.locator("#product-imei1")).toHaveValue("490154203237518");
  await page.getByRole("button", { name: "返回商品库存", exact: true }).click();
  await confirmation.getByRole("button", { name: "放弃并离开" }).click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(search).toHaveValue("SYNTHETIC-RETURN-SEARCH");
  expect(page.url()).not.toContain("SYNTHETIC");
  await page.getByRole("button", { name: "打开全局搜索" }).click();
  await page.getByRole("option", { name: /快速录入商品/ }).click();
  await expect(page).toHaveURL(/\/inventory\/new$/);
  await expect(
    page.locator('[data-inventory-product-form-shell="fullscreen-workbench"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "返回商品库存", exact: true }).click();
  await expect(search).toHaveValue("SYNTHETIC-RETURN-SEARCH");
  await page.goto("/inventory?workspace=new-product");
  await expect(page).toHaveURL(/\/inventory\/new$/);
});

test("failed save retains the draft and retry key, success goes to existing detail, continue clears identifiers once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const commands: Record<string, unknown>[] = [];
  await page.route("**/api/repairdesk/inventory/products/quick-create", async (route) => {
    commands.push(route.request().postDataJSON().input);
    await route.fulfill({
      status: commands.length === 1 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        commands.length === 1
          ? { error: "SYNTHETIC failure", code: "synthetic_failure" }
          : {
              data: {
                ok: true,
                code: "created",
                id: "inv_mock_3",
                sku: "SYNTHETIC-SKU",
                created_at: "2026-09-13T10:00:00Z",
              },
            },
      ),
    });
  });
  await page.goto("/inventory/new");
  await fillDesktopPhone(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole("button", { name: "保存并查看商品" }).click();
  await assertFailureFeedbackVisible(page);
  await expect(page.locator("#product-imei1")).toHaveValue("490154203237518");
  await page.screenshot({
    path: resolve(evidence, "chromium-save-failure-draft-retained.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "保存并查看商品" }).click();
  await expect(page).toHaveURL(/\/inventory\/inv_mock_3$/);
  expect(commands).toHaveLength(2);
  expect(commands[0].idempotency_key).toEqual(expect.any(String));
  expect(commands[0].idempotency_key).toBe(commands[1].idempotency_key);
  await page.goto("/inventory/new");
  await fillDesktopPhone(page);
  await page.getByRole("button", { name: "保存并继续录入" }).click();
  await expect(page.locator("#product-imei1")).toHaveValue("");
  await expect(page.locator("#product-brand")).toHaveValue("SyntheticBrand");
  await expect(page).toHaveURL(/\/inventory\/new$/);
  expect(commands).toHaveLength(3);
});

test("legacy intent remains fail-closed with create permission absent", async ({ page }) => {
  await page.route("**/api/repairdesk/shell/bootstrap", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.storeContext.permissions.canCreateInventory = false;
    await route.fulfill({ response, json: body });
  });
  await page.goto("/inventory?workspace=new-product");
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.locator('[data-inventory-product-create-trigger="true"]')).toHaveCount(0);
  await expect(page.locator("#product-imei1")).toHaveCount(0);
});

async function fillDesktopPhone(page: Page) {
  await page.locator("#product-brand").fill("SyntheticBrand");
  await page.locator("#product-model").fill("SyntheticModel");
  await page.keyboard.press("Escape");
  await page.locator("#product-imei1").fill("490154203237518");
}

async function assertFailureFeedbackVisible(page: Page) {
  const error = page.getByTestId("inventory-product-page-frame").getByRole("alert");
  await expect(error).toHaveCount(1);
  await expect(error).toBeInViewport({ ratio: 1 });
  const header = page.locator('[data-ui="inventory-product-workspace-header"]');
  const errorBox = (await error.boundingBox())!;
  const headerBox = (await header.boundingBox())!;
  expect(errorBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
}

async function assertNoOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
}
