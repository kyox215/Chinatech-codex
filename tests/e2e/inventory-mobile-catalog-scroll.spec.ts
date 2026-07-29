import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for inventory intake checks.");

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 900 },
]) {
  test(`quick product categories stay usable without horizontal scrolling at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/inventory/new");

    const phone = page.getByRole("radio", { name: /手机/ });
    const tablet = page.getByRole("radio", { name: /平板/ });
    await expect(phone).toBeVisible();
    await expect(tablet).toBeVisible();
    await expect(page.getByLabel("品牌")).toBeVisible();
    await expect(page.getByLabel("型号 / 商品名称")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await phone.focus();
    await page.keyboard.press("ArrowRight");
    await expect(tablet).toBeFocused();
    await expect(tablet).toHaveAttribute("aria-checked", "true");
    await expect(phone).toHaveAttribute("tabindex", "-1");
  });
}

async function assertNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("main, form, fieldset, [role='radiogroup']")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({
        tag: element.tagName,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })),
  }));
  expect(result.document).toBeLessThanOrEqual(result.viewport);
  expect(result.offenders).toEqual([]);
}
