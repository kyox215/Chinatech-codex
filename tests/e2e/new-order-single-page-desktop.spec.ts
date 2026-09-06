import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { translateMessage as tr } from "@/shared/i18n/messages";
import type { AppLocale } from "@/shared/i18n/locales";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Local synthetic business fixture only.",
);
const evidenceDir = process.env.NEW_ORDER_V7_EVIDENCE_DIR;
async function shot(page: Page, name: string) {
  if (!evidenceDir) return;
  mkdirSync(evidenceDir, { recursive: true });
  await page.addStyleTag({ content: "nextjs-portal { visibility: hidden !important }" });
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
  });
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: `${evidenceDir}/${name}.png`,
    fullPage: false,
    animations: "disabled",
  });
}
async function overflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}
async function fillOrder(page: Page, locale: AppLocale, selectCustomer = false) {
  const mobile = (await page.locator("[data-new-order-mobile-app]").count()) > 0;
  if (mobile && (await page.locator('[data-new-order-mobile-panel="customer"]').count()) === 0)
    await page.locator('[data-mobile-edit="customer"]').click();
  const phone = page.getByRole("combobox", { name: tr(locale, "orders2b1.new.lookup.phoneAria") });
  if (await phone.evaluate((node) => node.tagName === "INPUT")) await phone.fill("2025550100");
  else {
    await phone.click();
    await page.keyboard.type("2025550100");
    await page.keyboard.press("Enter");
  }
  if (selectCustomer) await page.getByRole("option", { name: /Demo Customer A/ }).click();
  else if (mobile)
    await page
      .getByRole("button", { name: tr(locale, "orders2b1.keypad.done"), exact: true })
      .click();
  await page.locator('[data-new-order-field="device-custody"] button').first().click();
  if (mobile) await page.locator('[data-mobile-edit="device"]').click();
  await page.locator("#new-order-device-brand").fill("Apple");
  await page.locator("#new-order-device-model").fill("iPhone 15 Pro");
  if (mobile)
    await page
      .getByRole("button", { name: tr(locale, "orders2b1.keypad.done"), exact: true })
      .click();
  await page.locator("[data-fault-category]").first().getByRole("button").first().click();
}
for (const [width, locale] of [
  [320, "zh-CN"],
  [390, "zh-CN"],
  [430, "zh-CN"],
  [768, "it-IT"],
  [1024, "en"],
  [1280, "it-IT"],
  [1440, "zh-CN"],
] as const) {
  test(`single-page workbench ${locale} ${width}`, async ({ page }) => {
    test.setTimeout(60000);
    await page
      .context()
      .addCookies([
        { name: "repairdesk_locale", value: locale, url: String(test.info().project.use.baseURL) },
      ]);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/repairdesk/customers/intake-search", (route) =>
      route.fulfill({
        json: {
          data: [
            {
              customer: {
                id: "v7-demo-customer",
                name: "Demo Customer A",
                phone_e164: "2025550100",
                phone_raw: "2025550100",
                contact_phones: [],
                consent_marketing: false,
                consent_sms: false,
              },
              exactMatch: true,
              phoneMatchKind: "exact_primary",
              nameMatchKind: "exact",
              historyDevices: [],
            },
          ],
        },
      }),
    );
    await page.goto("/orders/new");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-new-order-single-page="true"]')).toBeVisible();
    await expect(page.locator("[data-fault-category]")).toHaveCount(12);
    await expect(
      page.locator('[data-new-order-field="device-custody"] [aria-pressed="true"]'),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: tr(locale, "orders2b1.new.create"), exact: true })
      .click({ force: true });
    expect(await page.evaluate(() => document.activeElement?.matches("input, textarea"))).toBe(
      false,
    );
    await fillOrder(page, locale, true);
    const price = page.getByLabel(tr(locale, "orders2b1.new.quoteAria", { index: 1 }), {
      exact: true,
    });
    if (await price.evaluate((node) => node.tagName === "INPUT")) await price.fill("85");
    else {
      await price.click();
      await page.locator('[data-money-keypad-key="8"]').click();
      await page.locator('[data-money-keypad-key="5"]').click();
      await page.keyboard.press("Escape");
    }
    await expect(page.locator('[data-new-order-section="supplements"]')).toBeVisible();
    const brand = page.locator("#new-order-device-brand");
    if (width >= 768)
      expect(
        await brand.evaluate((node) => {
          const style = getComputedStyle(node);
          return node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        }),
      ).toBeGreaterThan(90);
    await overflow(page);
    await page.evaluate(() => scrollTo(0, 0));
    await shot(page, `new-order-${locale}-${width}`);
    if (width === 390 && evidenceDir)
      await page.screenshot({
        path: `${evidenceDir}/new-order-zh-CN-390-full.png`,
        fullPage: true,
        animations: "disabled",
      });
    expect(errors).toEqual([]);
  });
}
test("created order retains partial photos without another create or uncertain reupload", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .context()
    .addCookies([
      { name: "repairdesk_locale", value: "zh-CN", url: String(test.info().project.use.baseURL) },
    ]);
  let creates = 0;
  const uploads: string[] = [];
  await page.route("**/api/repairdesk/customers/intake-search", (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.route("**/api/repairdesk/orders/create", (route) => {
    creates += 1;
    expect(route.request().postDataJSON().issue_description).toBe("Synthetic intake note");
    return route.fulfill({ json: { data: { id: "ord_1" } } });
  });
  await page.route("**/api/repairdesk/order/get", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.capabilities.canUploadPhoto = true;
    await route.fulfill({ response, json: payload });
  });
  await page.route("**/api/repairdesk/order/attachment/upload", async (route) => {
    uploads.push(route.request().postDataJSON().input.file_name);
    if (uploads.length === 2) await route.abort("failed");
    else await route.fulfill({ json: { data: {} } });
  });
  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await fillOrder(page, "zh-CN");
  await page.locator('[data-mobile-edit="notes"]').click();
  await page
    .getByRole("textbox", { name: tr("zh-CN", "orders.newFlow.notes"), exact: true })
    .fill("Synthetic intake note");
  await page
    .getByRole("button", { name: tr("zh-CN", "orders2b1.keypad.done"), exact: true })
    .click();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
    "base64",
  );
  await page.locator('[data-new-order-section="supplements"] input[type="file"]').setInputFiles(
    ["one", "two", "three"].map((name) => ({
      name: `${name}.png`,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await page
    .getByRole("button", { name: tr("zh-CN", "orders2b1.new.create"), exact: true })
    .click();
  await expect(page.locator('[data-photo-state="uncertain"]')).toHaveCount(1);
  await expect(page.locator('[data-photo-state="uploaded"]')).toHaveCount(1);
  expect(creates).toBe(1);
  await expect(
    page.locator('[data-new-order-offline-status="true"]').filter({ visible: true }),
  ).not.toContainText("尚未创建");
  await page.getByRole("button", { name: tr("zh-CN", "orders.newFlow.retryPhotos") }).click();
  await expect(page.locator('[data-photo-state="uploaded"]')).toHaveCount(2);
  expect(uploads).toEqual(["one.png", "two.png", "three.png"]);
  expect(creates).toBe(1);
  await shot(page, "photos-partial-created-390");
  await page.locator('[data-new-order-section="supplements"]').scrollIntoViewIfNeeded();
  await shot(page, "photos-partial-thumbnails-390");
  await page.getByRole("button", { name: tr("zh-CN", "orders.newFlow.viewOrder") }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: tr("zh-CN", "common.cancel"), exact: true }).click();
  await expect(page.locator('[data-photo-state="uncertain"]')).toHaveCount(1);
  expect(creates).toBe(1);
});
test("created order with denied photo capability stays read-only and sends zero uploads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .context()
    .addCookies([
      { name: "repairdesk_locale", value: "zh-CN", url: String(test.info().project.use.baseURL) },
    ]);
  let creates = 0;
  let detailReads = 0;
  let uploads = 0;
  await page.route("**/api/repairdesk/customers/intake-search", (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.route("**/api/repairdesk/orders/create", (route) => {
    creates += 1;
    return route.fulfill({ json: { data: { id: "ord_1" } } });
  });
  await page.route("**/api/repairdesk/order/get", async (route) => {
    detailReads += 1;
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.capabilities.canUploadPhoto = false;
    await route.fulfill({ response, json: payload });
  });
  await page.route("**/api/repairdesk/order/attachment/upload", async (route) => {
    uploads += 1;
    await route.fulfill({ json: { data: {} } });
  });
  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-new-order-mobile-app]")).toBeVisible();
  await fillOrder(page, "zh-CN");
  await page.locator('[data-new-order-section="supplements"] input[type="file"]').setInputFiles({
    name: "synthetic-permission-front.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: tr("zh-CN", "orders2b1.new.create"), exact: true })
    .click();
  const result = page.locator('[data-new-order-photo-result="true"]');
  await expect(result).toContainText(tr("zh-CN", "orders.newFlow.photoBlocked"));
  expect(creates).toBe(1);
  expect(uploads).toBe(0);
  await expect(page.locator('[data-mobile-edit="customer"]')).toBeDisabled();
  await expect(page.locator('[data-mobile-edit="device"]')).toBeDisabled();
  await expect(
    page.getByRole("button", { name: tr("zh-CN", "orders2b1.new.create"), exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('[data-photo-state="pending"]')).toHaveCount(1);
  const firstDetailReads = detailReads;
  await result
    .getByRole("button", { name: tr("zh-CN", "orders.newFlow.retryPhotos"), exact: true })
    .click();
  await expect.poll(() => detailReads).toBe(firstDetailReads + 1);
  await expect(result).toContainText(tr("zh-CN", "orders.newFlow.photoBlocked"));
  expect(creates).toBe(1);
  expect(uploads).toBe(0);
  await overflow(page);
  await page.evaluate(() => scrollTo(0, 0));
  await shot(page, "photos-permission-denied-created-390");
});
test("real capture fallback preserves previews and uploads front back and other before opening detail", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .context()
    .addCookies([
      { name: "repairdesk_locale", value: "zh-CN", url: String(test.info().project.use.baseURL) },
    ]);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Synthetic camera unavailable", "NotAllowedError");
    };
  });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
    "base64",
  );
  const attachments: Array<Record<string, unknown>> = [];
  let creates = 0;
  await page.route("**/api/repairdesk/customers/intake-search", (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.route("**/api/repairdesk/orders/create", (route) => {
    creates += 1;
    return route.fulfill({ json: { data: { id: "ord_1" } } });
  });
  await page.route("**/api/repairdesk/order/get", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.capabilities.canUploadPhoto = true;
    payload.data.attachments = attachments;
    await route.fulfill({ response, json: payload });
  });
  await page.route("**/api/repairdesk/order/attachment/upload", (route) => {
    const input = route.request().postDataJSON().input;
    const attachment = {
      ...input,
      id: `synthetic-${attachments.length}`,
      order_id: "ord_1",
      store_id: "store_demo",
      storage_bucket: "synthetic",
      storage_path: "synthetic",
      signed_url: `data:image/png;base64,${input.data_base64}`,
      created_at: "2026-09-06T19:00:00Z",
      updated_at: "2026-09-06T19:00:00Z",
    };
    attachments.push(attachment);
    return route.fulfill({ json: { data: { attachment } } });
  });
  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await fillOrder(page, "zh-CN");

  for (const kind of ["device_front", "device_back", "other"] as const) {
    await page
      .getByRole("button", {
        name: `${tr("zh-CN", "common.capture")} ${tr("zh-CN", `attachment.kind.${kind}`)}`,
        exact: true,
      })
      .click();
    const camera = page.getByRole("dialog").filter({ has: page.locator('input[type="file"]') });
    await expect(camera).toBeVisible();
    await camera
      .locator('input[type="file"]')
      .setInputFiles({ name: `${kind}.png`, mimeType: "image/png", buffer: png });
    await expect(camera).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator('[data-new-order-section="supplements"] img')
          .evaluateAll((images) =>
            images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
          ),
      )
      .toBe(true);
  }
  await page.locator('[data-new-order-section="supplements"]').scrollIntoViewIfNeeded();
  await shot(page, "photos-staged-capture-390");
  await page
    .getByRole("button", { name: tr("zh-CN", "orders2b1.new.create"), exact: true })
    .click();
  await expect(page).toHaveURL(/\/orders\/ord_1$/);
  expect(creates).toBe(1);
  expect(attachments.map((item) => item.kind)).toEqual(["device_front", "device_back", "other"]);
  await page.locator('[data-order-detail-tab="photos"]').click();
  const images = page.locator('[data-order-detail-photo-slots="true"] img');
  await expect(images).toHaveCount(3);
  await expect
    .poll(() =>
      images.evaluateAll((nodes) =>
        nodes.every((node) => (node as HTMLImageElement).naturalWidth > 0),
      ),
    )
    .toBe(true);
  await shot(page, "photos-created-detail-390");
});
for (const width of [1024, 1280, 1440])
  test(`desktop list and detail dialog ${width}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/orders");
    await page.waitForLoadState("networkidle");
    await overflow(page);
    await shot(page, `order-list-${width}`);
    await page.goto("/orders?workspace=order-detail&orderId=ord_1&source=orders");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-order-detail-dialog-shell="true"]')).toBeVisible();
    await overflow(page);
    await expect(page.locator('[data-order-detail-view-switcher="true"] [role="tab"]')).toHaveCount(
      3,
    );
    await shot(page, `order-detail-dialog-${width}`);
    await page.locator('[data-order-detail-tab="photos"]').click();
    await expect(
      page.locator('[data-order-panel="photos"]').filter({ visible: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.locator('[data-order-detail-tab="photos"]').evaluate((tab) => {
          const indicator = tab.querySelector("span");
          if (!indicator) return false;
          const tabBounds = tab.getBoundingClientRect();
          const indicatorBounds = indicator.getBoundingClientRect();
          return (
            Math.abs(tabBounds.x - indicatorBounds.x) < 1 &&
            Math.abs(tabBounds.width - indicatorBounds.width) < 1
          );
        }),
      )
      .toBe(true);
    await shot(page, `order-desktop-photos-${width}`);
  });
