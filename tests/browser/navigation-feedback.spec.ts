import { test, expect } from "@playwright/test";

test("navigation shows pending until the real route response and then clears", async ({ page }) => {
  await page.goto("/");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/toolbox?*", async route => {
    if (route.request().headers()["rsc"] !== "1") return route.continue();
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  const link = page.locator("header").getByRole("link", { name: "工具箱", exact: true });
  await link.press("Enter");
  await expect(link.locator(".navigation-feedback")).toHaveAttribute("data-pending", "true");
  await expect(link.getByRole("status")).toHaveText("正在打开页面…");
  await page.screenshot({ path: `.local/ui-proof/controls/navigation-pending-${test.info().project.name}.png` });
  release();
  await expect(page).toHaveURL(/\/toolbox$/);
  await expect(page.getByRole("heading", { name: "工具箱", exact: true })).toBeVisible();
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(0);
});

test("a later navigation wins over a delayed previous destination", async ({ page }) => {
  await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  await page.goto("/");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/toolbox?*", async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
  await page.locator("header").getByRole("link", { name: "工具箱", exact: true }).click();
  await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(1);
  await page.locator("header").getByRole("link", { name: "工作台", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  release();
  await expect(page.getByRole("heading", { name: "工作台", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
});

test("native downloads show only requested feedback and remain dismissible", async ({ page }) => {
  await page.goto("/toolbox/windows");
  const link = page.getByRole("link", { name: "下载检测启动器", exact: true });
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await page.route(href!, route => route.fulfill({ body: "Synthetic browser download only", contentType: "application/octet-stream", headers: { "content-disposition": 'attachment; filename="synthetic.txt"' } }));
  await Promise.all([page.waitForEvent("download"), link.click()]);
  const notice = page.locator(".download-notice");
  await expect(notice.getByRole("status")).toHaveText("已发起下载，请查看浏览器的下载列表。");
  await expect(notice).not.toContainText("已完成");
  await notice.getByRole("button", { name: "关闭下载提示", exact: true }).click();
  await expect(notice).toHaveCount(0);
});
