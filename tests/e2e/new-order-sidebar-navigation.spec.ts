import { expect, test, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for new order navigation checks.");
test.setTimeout(90_000);

test("desktop sidebar can leave the new-order page from clean and dirty states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await gotoReady(page, "/orders/new");
  await expect(page.locator('[data-new-order-root="true"]')).toBeVisible();
  await clickSidebarLink(page, "/customers");
  await expectRoute(page, /\/customers$/);
  await expect(page.locator('[data-new-order-root="true"]')).toHaveCount(0);
  await expect(documentPointerLock(page)).resolves.not.toBe("none");

  await gotoReady(page, "/orders/new");
  await page.getByPlaceholder("例如 iPhone 13").fill("iPhone 13");
  await expect(page.getByPlaceholder("例如 iPhone 13")).toHaveValue("iPhone 13");
  await clickSidebarLink(page, "/settings");
  await confirmDiscardNavigation(page);
  await expectRoute(page, /\/settings$/);
  await expect(page.locator('[data-new-order-root="true"]')).toHaveCount(0);
  await expect(documentPointerLock(page)).resolves.not.toBe("none");
});

test("desktop sidebar can leave the new-order page while customer lookup results are open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoReady(page, "/orders/new");
  await page.route("**/api/repairdesk/customers/intake-search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            customer: {
              id: "customer-sidebar-nav",
              name: "Marco Navigation",
              phone_e164: "+393459331472",
              phone_raw: "3459331472",
              contact_phones: ["3459331472"],
              consent_marketing: false,
              consent_sms: true,
              preferred_channel: "whatsapp",
              language: "it",
              created_at: "2026-07-17T10:00:00.000Z",
              updated_at: "2026-07-17T10:00:00.000Z",
            },
            historyDevices: [],
          },
        ],
      }),
    });
  });

  const nameInput = page.getByPlaceholder("搜索客户姓名（可选）");
  await nameInput.fill("Marco");
  await expect(page.getByText("Marco Navigation")).toBeVisible();

  await clickSidebarLink(page, "/orders");
  await confirmDiscardNavigation(page);
  await expectRoute(page, /\/orders$/);
  await expect(page.locator('[data-new-order-root="true"]')).toHaveCount(0);
  await expect(documentPointerLock(page)).resolves.not.toBe("none");
});

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page
    .waitForFunction(() => !document.body.innerText.includes("Compiling"), null, {
      timeout: 30_000,
    })
    .catch(() => undefined);
}

async function clickSidebarLink(page: Page, href: string) {
  const link = page.locator(`[data-sidebar="sidebar"] a[href="${href}"]`);
  await expect(link).toHaveCount(1);
  await expect(link).toBeVisible();
  await expect(async () => {
    const result = await link.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const target = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return target === element || element.contains(target);
    });
    expect(result).toBe(true);
  }).toPass({ timeout: 5_000 });
  await link.click();
}

async function expectRoute(page: Page, pattern: RegExp) {
  await expect(page).toHaveURL(pattern, { timeout: 30_000 });
}

async function confirmDiscardNavigation(page: Page) {
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByText(/新建工单草稿有未保存修改/)).toBeVisible();
  await page.getByRole("button", { name: "放弃修改" }).click();
}

async function documentPointerLock(page: Page) {
  return page.evaluate(() => document.body.style.pointerEvents);
}
