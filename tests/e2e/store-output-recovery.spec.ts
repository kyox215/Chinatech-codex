import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const viewports = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for output recovery checks.");

test.describe("customer-output identity recovery", () => {
  for (const viewport of viewports) {
    test(`recovers a blocked order message at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.setViewportSize(viewport);
      let identityIsIncomplete = true;

      await page.route("**/api/repairdesk/settings/store", async (route) => {
        const response = await route.fetch();
        const payload = (await response.json()) as {
          data?: Record<string, unknown>;
        };
        if (payload.data) {
          payload.data.store_name = "Repair Lab Test";
          payload.data.store_address = identityIsIncomplete ? "" : "Via Test 12, Siracusa";
          payload.data.store_phone = identityIsIncomplete ? "" : "+39 000 000000";
          payload.data.store_whatsapp = "";
          payload.data.store_email = "";
          payload.data.message_signature = identityIsIncomplete
            ? ""
            : "Repair Lab Test · Assistenza";
          payload.data.print_footer = identityIsIncomplete
            ? ""
            : "Grazie per aver scelto Repair Lab Test.";
        }
        await route.fulfill({ response, json: payload });
      });

      await gotoReady(page, "/orders");
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

      if (viewport.width < 1024) {
        const firstOrder = page
          .locator('[data-order-mobile-list="true"] a[href^="/orders/"]')
          .first();
        await expect(firstOrder).toBeVisible({ timeout: 15_000 });
        await firstOrder.click();
        await expect(page).toHaveURL(/\/orders\/[^/?]+/, { timeout: 20_000 });
      } else {
        await clickFirstVisible(
          page.getByRole("button", { name: /查看工单详情 R\d+/ }),
          "工单详情",
        );
      }

      await clickFirstVisible(page.getByRole("button", { name: "WhatsApp" }), "WhatsApp");
      const dialog = page.getByRole("dialog", { name: "预览 WhatsApp 通知" });
      await expect(dialog).toBeVisible();

      const recovery = dialog.getByRole("alert");
      const settingsLink = recovery.getByRole("link", {
        name: "前往店铺资料（在新标签页打开）",
      });
      const recheck = recovery.getByRole("button", { name: "重新检查资料" });
      const messageBody = dialog.getByRole("textbox", { name: "通知内容" });
      const primaryAction = dialog.getByRole("button", { name: "确认并打开 WhatsApp" });

      await expect(recovery).toContainText("请先补齐当前店铺资料");
      await expect(settingsLink).toHaveAttribute("href", "/settings?section=store");
      await expect(settingsLink).toHaveAttribute("target", "_blank");
      await expect(settingsLink).toHaveAttribute("rel", /noopener/);
      await expect(recheck).toBeVisible();
      await expect(messageBody).toBeDisabled();
      await expect(primaryAction).toBeDisabled();
      await expectNoPageOverflow(page, viewport.width);

      if (viewport.width === 390) {
        const linkBox = await settingsLink.boundingBox();
        const recheckBox = await recheck.boundingBox();
        expect(linkBox?.height ?? 0).toBeGreaterThanOrEqual(43);
        expect(recheckBox?.height ?? 0).toBeGreaterThanOrEqual(43);
      }

      await page.screenshot({
        path: `screenshots/responsive-density/settings/output-recovery-${viewport.width}x${viewport.height}.png`,
        fullPage: false,
        mask: [messageBody, ...visibleLocators(dialog.getByRole("combobox"))],
      });

      identityIsIncomplete = false;
      await recheck.click();
      await expect(recovery).toHaveCount(0);
      await expect(messageBody).toBeEnabled();
      await expect(primaryAction).toBeEnabled();

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      const parentDetailDialog = page.getByRole("dialog", { name: "工单详情" });
      if (await parentDetailDialog.isVisible().catch(() => false)) {
        await page.keyboard.press("Escape");
        await expect(parentDetailDialog).toHaveCount(0);
      }
      await expect
        .poll(() => page.evaluate(() => window.getComputedStyle(document.body).pointerEvents))
        .not.toBe("none");
    });
  }
});

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
}

async function clickFirstVisible(locator: Locator, label: string) {
  await expect
    .poll(
      async () => {
        const count = await locator.count();
        for (let index = 0; index < count; index += 1) {
          if (
            await locator
              .nth(index)
              .isVisible()
              .catch(() => false)
          )
            return index;
        }
        return -1;
      },
      { message: `Visible control for ${label}`, timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(0);

  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return;
    }
  }
  throw new Error(`No visible control found for ${label}`);
}

async function expectNoPageOverflow(page: Page, width: number) {
  const documentWidth = await page.evaluate(() =>
    Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
      document.scrollingElement?.scrollWidth ?? 0,
    ),
  );
  expect(documentWidth, `output recovery overflow at ${width}px`).toBeLessThanOrEqual(width + 1);
}

function visibleLocators(locator: Locator) {
  return [locator.first(), locator.nth(1)];
}
