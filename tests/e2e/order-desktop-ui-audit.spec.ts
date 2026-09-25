import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
test.skip(!enabled, "Uses the isolated synthetic business environment.");

// Current desktop contract. Quote/edit/print/draft behavior is covered by
// order-quote-consistency, global-compact-edit, print-safari-reliability and
// new-order-draft-stability, rather than assertions against retired DOM panels.
test.beforeEach(async ({ context, baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
  await context.addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL! }]);
});

async function noHorizontalOverflow(page: Page) {
  const bounds = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(bounds.content).toBeLessThanOrEqual(bounds.width + 1);
}

for (const width of [1024, 1280, 1440, 1536, 1600]) {
  test(`desktop queue selection and detail return remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/orders");
    const list = page.locator('[data-order-desktop-list="true"]:visible');
    await expect(list).toHaveCount(1);
    await expect(page.locator('[data-order-mobile-list="true"]:visible')).toHaveCount(0);
    const rows = list.locator('[data-order-row="true"]');
    await expect(rows.nth(3)).toBeVisible();
    const row = rows.first();
    const checkbox = row.getByRole("checkbox").first();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await expect(page.getByRole("dialog", { name: "工单详情", exact: true })).toHaveCount(0);
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await row.click();
    const detail = page.getByRole("dialog", { name: "工单详情", exact: true });
    await expect(detail).toBeVisible();
    await expect(page).toHaveURL(/\/orders$/);
    await expect(detail.locator('[data-order-panel="finance"]:visible')).toBeVisible();
    const geometry = await detail.boundingBox();
    expect(geometry).not.toBeNull();
    expect(geometry!.x).toBeGreaterThanOrEqual(-1);
    expect(geometry!.x + geometry!.width).toBeLessThanOrEqual(width + 1);
    await noHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();
    await expect(page).not.toHaveURL(/workspace=/);
    await expect(list).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test(`new order validates required fields and closes cleanly at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/orders");
    await page.locator('[data-order-list-new-button="true"]').click();
    const dialog = page.getByRole("dialog", { name: "新建维修工单", exact: true });
    await expect(dialog).toBeVisible();
    for (const section of ["customer", "device-info", "quotation"]) {
      await expect(dialog.locator(`[data-new-order-section="${section}"]`)).toBeVisible();
    }
    await dialog.getByRole("button", { name: "创建工单", exact: true }).click();
    await expect(dialog.locator("#new-order-validation-summary")).toBeVisible();
    await expect(dialog.locator('[aria-invalid="true"]').first()).toBeVisible();
    await expect(page).toHaveURL(/\/orders$/);
    await noHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/workspace=/);
    await expect(page.locator('[data-order-desktop-list="true"]:visible')).toBeVisible();
  });
}
