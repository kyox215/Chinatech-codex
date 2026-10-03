import { test, expect, type Page } from "@playwright/test";

async function filters(page: Page) {
  const toggle = page.getByRole("button", { name: /^筛选/ });
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
}

test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } })).status()).toBe(200);
});

test("collapsed groups mount no rows, retain empty groups, and expand the full filtered count", async ({ page }) => {
  await page.goto("/app/repairs");
  await expect(page.locator(".repair-group-toggle")).toHaveCount(7);
  await expect(page.locator(".repair-module-row")).toHaveCount(0);
  const count = (await page.locator(".repair-group-toggle small").allTextContents()).reduce((sum, value) => sum + Number(value), 0);
  expect(count).toBeGreaterThan(0);
  await page.locator("#repair-group-cancelled").click();
  await expect(page.locator("#repair-group-rows-cancelled .section-empty")).toContainText("暂无符合条件的工单");
  await expect(page.locator(".repair-module-row")).toHaveCount(0);
  await page.getByRole("button", { name: "展开全部分组", exact: true }).click();
  await expect(page.locator(".repair-module-row")).toHaveCount(count);
  for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole("button", { name: "收起全部分组", exact: true }).click();
  await expect(page.locator(".repair-module-row")).toHaveCount(0);
  await filters(page);
  await page.getByLabel("工单分组", { exact: true }).selectOption("none");
  await expect(page.locator(".repair-module-row")).toHaveCount(count);
  await page.getByLabel("搜索维修工单", { exact: true }).fill("不存在的合成工单");
  await expect(page.locator(".repair-module-row")).toHaveCount(0);
  await expect(page.getByText("没有符合条件的工单", { exact: true })).toBeVisible();
  const resetBox = await page.locator(".module-empty").getByRole("button", { name: "清除筛选", exact: true }).boundingBox();
  expect(resetBox!.height).toBeGreaterThanOrEqual(44);
  expect(resetBox!.width).toBeGreaterThanOrEqual(44);
  await page.getByLabel("工单分组", { exact: true }).selectOption("workflow");
  await expect(page.locator(".repair-group-toggle")).toHaveCount(7);
  await expect(page.locator(".repair-group-toggle small")).toHaveText(Array(7).fill("0"));
});

test("procurement moves into an unmounted group while dialog stays open, then closes to the new row", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("chinatech.m1.procurement.v1")) localStorage.setItem("chinatech.m1.procurement.v1", JSON.stringify({
      version: 1,
      records: [{ id: "PERF-P1", repairId: "CT-2026-0927", item: "合成性能验证配件", supplier: "合成供应商", quantity: 1, unitCostCents: null, expectedAt: "", reference: "", events: [] }],
      repairUpdates: {},
    }));
  });
  await page.goto("/app/repairs");
  await filters(page);
  await page.getByLabel("工单分组", { exact: true }).selectOption("parts");
  await page.locator("#repair-group-draft").click();
  const action = page.getByRole("button", { name: "CT-2026-0927 配件操作", exact: true });
  await action.click();
  const dialog = page.getByRole("dialog", { name: "供应商与配件", exact: true });
  await dialog.getByRole("button", { name: "标记已加购物车", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator("#repair-group-cart small")).toHaveText("1");
  await expect(page.locator("#repair-group-rows-cart .repair-module-row")).toHaveCount(0);
  await expect(page.locator("#repair-group-draft small")).toHaveText("0");
  await dialog.getByRole("button", { name: "关闭配件操作", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#repair-group-cart")).toHaveAttribute("aria-expanded", "true");
  await expect(action).toBeFocused();
  await action.click();
  await dialog.getByRole("button", { name: "标记已下单", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator("#repair-group-ordered small")).toHaveText("1");
  await expect(page.locator("#repair-group-rows-ordered .repair-module-row")).toHaveCount(0);
  await dialog.getByRole("button", { name: "关闭配件操作", exact: true }).click();
  await expect(action).toBeFocused();
  await expect(page.locator("#repair-group-ordered")).toHaveAttribute("aria-expanded", "true");
  await page.reload();
  await expect(page.locator("#repair-group-purchase small")).toHaveText("1");
  await page.locator("#repair-group-purchase").click();
  await expect(action).toBeVisible();
});

test("stage save mounts the previously collapsed destination, restores focus and persists", async ({ page }) => {
  await page.goto("/app/repairs");
  await page.locator("#repair-group-processing").click();
  const readyBefore=Number(await page.locator("#repair-group-ready small").innerText());
  const stage = page.getByRole("button", { name: "CT-2026-0929 更改维修阶段", exact: true });
  await expect(page.locator("#repair-group-rows-ready .repair-module-row")).toHaveCount(0);
  await stage.click();
  const dialog = page.getByRole("dialog", { name: "更改维修阶段", exact: true });
  await dialog.getByRole("button", { name: "待取机", exact: true }).click();
  await dialog.getByRole("button", { name: "保存阶段", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#repair-group-ready")).toHaveAttribute("aria-expanded", "true");
  await expect(stage).toBeFocused();
  await expect(page.locator("#repair-group-rows-processing").getByRole("button", { name: "CT-2026-0929 更改维修阶段", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".repair-module-row")).toHaveCount(0);
  await expect(page.locator("#repair-group-ready small")).toHaveText(String(readyBefore+1));
  await page.locator("#repair-group-ready").click();
  await expect(stage).toHaveText("待取机");
});
