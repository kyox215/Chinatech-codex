import { mkdirSync } from "node:fs";

import { expect, test, type Locator } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_EDIT_SAVE === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_EDIT_SAVE=1 for combined order save checks.");

test("ordinary details and quote save once with sequential version handoff", async ({ page }) => {
  test.setTimeout(60_000);
  mkdirSync("screenshots", { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });

  const requestOrder: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    if (request.url().includes("/api/repairdesk/order/patch")) requestOrder.push("routine");
    if (request.url().includes("/api/repairdesk/order/finance")) requestOrder.push("finance");
  });

  await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
  const detail = page.locator('[data-order-detail-root="true"][data-order-detail-surface="page"]');
  await expect(detail).toBeVisible();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const hero = detail.locator('[data-order-hero="true"]');
  await hero.getByRole("button", { name: "编辑" }).click();

  const issueInput = detail.locator('textarea[aria-label="故障描述"]:visible').first();
  const quoteInput = detail.getByLabel("报价项目 1 金额");
  const currentPrice =
    Number((await quoteInput.inputValue()).replace(/[^0-9,.]/g, "").replace(",", ".")) || 75;
  const updatedIssue = "Mock combined save verification";
  const updatedPrice = (currentPrice + 1).toFixed(2);
  await issueInput.fill(updatedIssue);
  await quoteInput.fill(updatedPrice);

  const routineResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/repairdesk/order/patch"),
  );
  const financeResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/repairdesk/order/finance"),
  );

  await hero.getByRole("button", { name: "保存" }).click();
  const routineResponse = await routineResponsePromise;
  const financeResponse = await financeResponsePromise;
  expect(routineResponse.ok()).toBe(true);
  expect(financeResponse.ok()).toBe(true);
  expect(requestOrder).toEqual(["routine", "finance"]);

  const routinePayload = (await routineResponse.json()) as {
    data: { updated_at: string };
  };
  const financeRequest = financeResponse.request().postDataJSON() as {
    input: { expected_updated_at: string };
  };
  expect(financeRequest.input.expected_updated_at).toBe(routinePayload.data.updated_at);

  await expect(page.getByText("普通资料与报价已保存")).toBeVisible();
  await expect(hero.getByRole("button", { name: "编辑" })).toBeVisible();
  await expect(page.getByText("普通资料与报价需要分别保存")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.querySelector("[data-nextjs-dialog], .vite-error-overlay")
          ? "ERROR_OVERLAY"
          : "OK",
      ),
    )
    .toBe("OK");

  await detail.screenshot({ path: "screenshots/order-detail-combined-save-desktop.png" });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(detail).toBeVisible();
  await expect.poll(() => hasVisibleMatch(detail.getByText(updatedIssue))).toBe(true);
  await expect
    .poll(() => hasVisibleMatch(detail.getByText(new RegExp(updatedPrice.replace(".", "[.,]")))))
    .toBe(true);
});

async function hasVisibleMatch(locator: Locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    if (
      await locator
        .nth(index)
        .isVisible()
        .catch(() => false)
    )
      return true;
  }
  return false;
}
