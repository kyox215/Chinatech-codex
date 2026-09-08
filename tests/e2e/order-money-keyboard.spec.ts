import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

const screenshotDir = "screenshots/TASK-20260908-003-responsive-virtual-keypad";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Money keyboard checks require the local mock server.",
);

const scenarios = [
  ...[390, 1024, 1280, 1440].map((width) => ({
    name: `desktop-${width}`,
    width,
    touch: false,
    platform: "",
    userAgent: undefined,
    mode: "native",
  })),
  {
    name: "touch-windows",
    width: 390,
    touch: true,
    platform: "Win32",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36",
    mode: "native",
  },
  {
    name: "iphone",
    width: 390,
    touch: true,
    platform: "iPhone",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1",
    mode: "virtual",
  },
  {
    name: "android-phone",
    width: 430,
    touch: true,
    platform: "Linux armv8l",
    userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0.0.0 Mobile Safari/537.36",
    mode: "virtual",
  },
  {
    name: "android-tablet",
    width: 768,
    touch: true,
    platform: "Linux armv8l",
    userAgent: "Mozilla/5.0 (Linux; Android 15; Tablet) Chrome/140.0.0.0 Safari/537.36",
    mode: "virtual",
  },
  {
    name: "ipad",
    width: 768,
    touch: true,
    platform: "iPad",
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1",
    mode: "virtual",
  },
  {
    name: "ipados-desktop-ua",
    width: 1024,
    touch: true,
    platform: "MacIntel",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15",
    mode: "virtual",
  },
  {
    name: "unknown-touch",
    width: 390,
    touch: true,
    platform: "",
    userAgent: "UnknownBrowser/1.0",
    mode: "virtual",
  },
];

for (const scenario of scenarios) {
  const { width, mode } = scenario;
  test.describe(scenario.name, () => {
    test.use({
      viewport: { width, height: width < 768 ? 844 : 1000 },
      hasTouch: scenario.touch,
      ...(scenario.userAgent ? { userAgent: scenario.userAgent } : {}),
    });
    for (const surface of width === 1440 ? ["page", "dialog"] : ["page"]) {
      test(`${width}px ${mode} ${surface} money input supports physical typing without saving an order`, async ({
        page,
      }, testInfo) => {
        const errors: string[] = [];
        const mutations: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/api/**", (route) => {
          const method = route.request().method();
          const path = new URL(route.request().url()).pathname;
          const isReadPost =
            method === "POST" &&
            [
              "/api/repairdesk/orders/queue-summary",
              "/api/repairdesk/orders/list-page",
              "/api/repairdesk/order/get",
              "/api/repairdesk/customers/list-page",
              "/api/repairdesk/inventory/summary",
            ].includes(path);
          if (!["GET", "HEAD", "OPTIONS"].includes(method) && !isReadPost) {
            mutations.push(route.request().url());
            return route.abort();
          }
          return route.continue();
        });
        await page.addInitScript(({ touch, platform }) => {
          if (platform || touch)
            Object.defineProperty(navigator, "platform", { get: () => platform });
          Object.defineProperty(navigator, "maxTouchPoints", { get: () => (touch ? 5 : 0) });
          // A previous desktop override must not change the new device policy.
          localStorage.setItem("repairdesk:desktop-virtual-keyboard:v1:mock-user", "enabled");
        }, scenario);
        await page
          .context()
          .addCookies([
            { name: "repairdesk_locale", value: "it-IT", url: testInfo.project.use.baseURL! },
          ]);
        await page.goto(surface === "dialog" ? "/orders?workspace=new-order" : "/orders/new");
        await page.waitForLoadState("networkidle");
        await expect(page.locator('[data-new-order-root="true"]')).toBeVisible();

        if (scenario.touch) {
          expect(await page.evaluate(() => navigator.maxTouchPoints)).toBe(5);
          expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
        }

        const quotation = page.locator('[data-new-order-section="quotation"]');
        await quotation.locator('[data-fault-category="liquid"] > button').first().click();
        const amount = quotation.getByRole(mode === "native" ? "textbox" : "button", {
          name: "Importo voce preventivo 1",
          exact: true,
        });
        await amount.click();
        await page.keyboard.type("12,50");

        if (mode === "native") {
          await expect(amount).toHaveValue("12.50");
          await amount.press("ControlOrMeta+A");
          await page.keyboard.type("0.05");
          await expect(amount).toHaveValue("0.05");
          await amount.press("ControlOrMeta+A");
          await page.keyboard.type("12.50");
          await expect(page.locator('[data-money-keypad-trigger="true"]')).toHaveCount(0);
          await expect(page.locator('[data-virtual-keyboard-dock="true"]')).toHaveCount(0);
        } else {
          await expect(amount).toContainText("12.50");
          const keypad = page.locator('[data-money-keypad="true"]');
          await keypad.locator('[data-money-keypad-key="backspace"]').click();
          await page.keyboard.type("7");
          await expect(amount).toContainText("12.57");
          await page.keyboard.press("Delete");
          await page.keyboard.type("12.50");
          await expect(amount).toContainText("12.50");
          await keypad.locator('[data-money-keypad-key="clear"]').click();
          await expect(amount).toContainText("0");
          for (const key of ["1", "2", ".", "5", "0"]) {
            await keypad.locator(`[data-money-keypad-key="${key}"]`).click();
          }
          await expect(amount).toContainText("12.50");
          await keypad.locator('[data-money-keypad-key="backspace"]').click();
          await expect(amount).toContainText("12.5");
          await keypad.locator('[data-money-keypad-key="0"]').click();
        }

        await expect(quotation.locator('[data-order-workspace-money-strip="true"]')).toContainText(
          "12.50",
        );
        expect(
          await page.locator("html").evaluate((el) => el.scrollWidth <= window.innerWidth),
        ).toBe(true);
        mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({
          path: `${screenshotDir}/${testInfo.project.name}-${scenario.name}-${mode}${surface === "dialog" ? "-dialog" : ""}.png`,
        });

        if (mode === "virtual") {
          await page
            .locator('[data-money-keypad="true"]')
            .getByRole("button", { name: "Fine", exact: true })
            .click();
          await expect(page.locator('[data-money-keypad="true"]')).toHaveCount(0);
          await expect(amount).toBeFocused();
          await amount.click();
          await page.keyboard.press("Enter");
          await expect(page.locator('[data-money-keypad="true"]')).toHaveCount(0);
          await expect(amount).toBeFocused();
          await amount.click();
          await page.keyboard.press("Escape");
          await expect(page.locator('[data-money-keypad="true"]')).toHaveCount(0);
          await expect(amount).toBeFocused();
        }

        if (surface === "dialog")
          await expect(page.locator('[data-new-order-dialog="true"]')).toBeVisible();
        expect(errors).toEqual([]);
        expect(mutations).toEqual([]);
      });
    }
  });
}
