import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = path.join(process.cwd(), "screenshots", "TASK-20260726-002-eu-phone-catalog");

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for inventory catalog checks.");
test.skip(
  true,
  "The legacy six-step EU phone catalog intake was retired from /inventory/new; the new quick-entry category and overflow contract has dedicated coverage.",
);

for (const viewport of [
  { width: 1440, height: 900, name: "desktop-1440" },
  { width: 390, height: 844, name: "mobile-390" },
]) {
  test(`${viewport.name} selects a canonical model and color swatch without overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/inventory/new");
    await expect(page.getByRole("heading", { name: "选择商品来源" })).toBeVisible();

    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "下一步" }).click();

    const brand = page.getByRole("combobox", { name: "品牌 *" });
    await brand.click();
    await page.getByRole("option", { name: "Apple" }).click();

    const model = page.getByRole("combobox", { name: "型号 *" });
    await model.click();
    await page.getByRole("option", { name: /iPhone 15 Pro 2023/ }).click();

    await page.getByRole("radio", { name: "256 GB" }).click();
    await page.getByRole("radio", { name: "颜色：原色钛金属" }).click();

    await expect(page.getByRole("radio", { name: "颜色：原色钛金属，已选择" })).toBeVisible();
    await expect(page.getByText(/色块用于辨认外观/)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceDir, `inventory-phone-catalog-${viewport.name}.png`),
      fullPage: viewport.width >= 1024,
    });
  });
}
