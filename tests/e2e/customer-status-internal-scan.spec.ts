import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_CUSTOMER_STATUS_INTERNAL_SCAN === "1";
const evidenceDir = ".ai-company/memory/tasks/TASK-20260724-010-qr-scan-routing-security/evidence";

test.skip(!enabled, "Set REPAIRDESK_E2E_CUSTOMER_STATUS_INTERNAL_SCAN=1 for this regression.");

test("staff in-app scan masks the bearer and opens the protected order route", async ({
  page,
  browserName,
}) => {
  const token = `v2.1.${"P".repeat(22)}.1.${"S".repeat(43)}`;
  const nonStatusTraffic: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("/customer-status-links/staff-resolve")) return;
    if (request.url().includes("/api/public/order-status")) return;
    nonStatusTraffic.push(request.url(), request.postData() ?? "");
  });
  await page.route("**/api/repairdesk/customer-status-links/staff-resolve", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ task_path: "/orders/order-qr-1?from=orders" }),
    }),
  );
  await page.route("**/api/public/order-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: {
          store: { name: "Chinatech" },
          order: {
            public_no: "R-QR-1",
            device: "Apple iPhone",
            stage: "repair",
            stage_label: "Riparazione in corso",
            progress_percent: 72,
            last_updated_at: "2026-07-24T12:00:00.000Z",
            next_action: "Attendi il completamento della riparazione.",
          },
        },
      }),
    }),
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "订单扫码查询" }).click();
  const scanner = page.getByRole("dialog", { name: "订单扫码查询" });
  await scanner
    .getByPlaceholder("无法扫码时，可手动输入或粘贴")
    .fill(`https://www.chinatech.in/r#${token}`);
  await scanner.getByRole("button", { name: "识别内容" }).click();

  await expect(scanner.getByText("维修工单二维码", { exact: true })).toBeVisible();
  await expect(scanner.getByText("敏感链接已隐藏")).toBeVisible();
  await expect(scanner.getByRole("button", { name: "查看此订单" })).toBeVisible();
  await expect(scanner.getByRole("button", { name: "复制" })).toHaveCount(0);
  expect(await scanner.textContent()).not.toContain(token);
  await page.screenshot({
    path: `${evidenceDir}/staff-scan-masked-${browserName}-390.png`,
    fullPage: false,
  });

  await scanner.getByRole("button", { name: "查看此订单" }).click();
  await expect(page).toHaveURL(/\/orders\/order-qr-1\?from=orders$/);
  expect(nonStatusTraffic.every((value) => !value.includes(token))).toBe(true);
  const storedValues = await page.evaluate(() =>
    Object.values(sessionStorage).filter((value) => typeof value === "string"),
  );
  expect(storedValues.every((value) => !value.includes(token))).toBe(true);
  expect(page.url()).not.toContain(token);
});

test("bare bearer and ?q input never become an ordinary order search", async ({ page }) => {
  const token = `v2.1.${"Q".repeat(22)}.1.${"R".repeat(43)}`;
  const businessTraffic: string[] = [];

  page.on("request", (request) => {
    if (request.resourceType() === "document") return;
    if (request.url().includes("/customer-status-links/")) return;
    if (request.url().includes("/api/public/order-status")) return;
    businessTraffic.push(request.url(), request.postData() ?? "");
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/orders?q=${encodeURIComponent(token)}`, { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\?q=/);
  expect(businessTraffic.every((value) => !value.includes(token))).toBe(true);

  await page.getByRole("button", { name: "订单扫码查询" }).click();
  const scanner = page.getByRole("dialog", { name: "订单扫码查询" });
  await scanner.getByPlaceholder("无法扫码时，可手动输入或粘贴").fill(token);
  await scanner.getByRole("button", { name: "识别内容" }).click();

  await expect(scanner.getByText("敏感链接已隐藏")).toBeVisible();
  await expect(scanner.getByRole("button", { name: "复制" })).toHaveCount(0);
  await expect(scanner.getByRole("button", { name: "查看此订单" })).toBeVisible();
  expect(await scanner.textContent()).not.toContain(token);
  expect(businessTraffic.every((value) => !value.includes(token))).toBe(true);

  const storageAndHistory = await page.evaluate(() => ({
    storage: Object.values(sessionStorage),
    history: JSON.stringify(window.history.state),
  }));
  expect(storageAndHistory.storage.every((value) => !value.includes(token))).toBe(true);
  expect(storageAndHistory.history).not.toContain(token);
});
