import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

const screenshotDir = "screenshots/TASK-20260907-006-orders-keyboard-audit";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Money keyboard checks require the local mock server.",
);

for (const width of [390, 430, 768, 1024, 1280, 1440]) {
  const modes = width >= 1024 ? ["native", "virtual"] : ["virtual"];
  for (const mode of modes) {
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
        await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
        await page
          .context()
          .addCookies([
            { name: "repairdesk_locale", value: "it-IT", url: testInfo.project.use.baseURL! },
          ]);
        await page.goto(surface === "dialog" ? "/orders?workspace=new-order" : "/orders/new");
        await page.waitForLoadState("networkidle");
        await expect(page.locator('[data-new-order-root="true"]')).toBeVisible();

        if (mode === "virtual" && width >= 1024) {
          // This preference belongs to the isolated browser context and mock identity only.
          const bootstrap = await page.request.get("/api/repairdesk/shell/bootstrap");
          const payload = await bootstrap.json();
          const userId = payload.data.onboarding.userId;
          expect(userId).toBeTruthy();
          await page.evaluate((id) => {
            localStorage.setItem(`repairdesk:desktop-virtual-keyboard:v1:${id}`, "enabled");
            window.dispatchEvent(
              new Event("repairdesk:desktop-virtual-keyboard-preference-change"),
            );
          }, userId);
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
        } else {
          await expect(amount).toContainText("12.50");
          const keypad = page.locator('[data-money-keypad="true"]');
          await keypad.locator('[data-money-keypad-key="backspace"]').click();
          await page.keyboard.type("7");
          await expect(amount).toContainText("12.57");
          await page.keyboard.press("Delete");
          await page.keyboard.type("12.50");
          await expect(amount).toContainText("12.50");
        }

        await expect(quotation.locator('[data-order-workspace-money-strip="true"]')).toContainText(
          "12.50",
        );
        expect(
          await page.locator("html").evaluate((el) => el.scrollWidth <= window.innerWidth),
        ).toBe(true);
        mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({
          path: `${screenshotDir}/${testInfo.project.name}-${width}-${mode}${surface === "dialog" ? "-dialog" : ""}.png`,
        });

        if (mode === "virtual") {
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
  }
}
