import { test, expect } from "@playwright/test";

test("phone-sized computer catalog keeps series, models, and paging reachable in three languages", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const login = await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  expect(login.status()).toBe(200);
  await page.goto("/app/repairs/new");
  await page.getByRole("combobox", { name: "联系电话" }).fill("+393200001234");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByLabel("设备类别").selectOption({ label: "电脑" });
  await page.getByRole("combobox", { name: "品牌" }).fill("Lenovo");
  await page.getByRole("option", { name: "Lenovo", exact: true }).click();

  const brandClear = page.locator("form.intake-form .search-combobox").first().locator("button.input-control__clear");
  const model = page.locator("form.intake-form .search-combobox").nth(1).getByRole("combobox");
  const next = page.locator("form.intake-form button.button--primary").last();
  for (const locale of ["zh-CN", "it", "en"]) {
    await page.getByLabel("语言 / Lingua / Language").selectOption(locale, { force: true });
    await model.focus();
    const menu = page.locator(".search-combobox__menu:visible");
    await expect(menu).toBeVisible();
    await expect.poll(() => menu.getByRole("option").count()).toBeGreaterThan(0);
    const list = await menu.getByRole("listbox").boundingBox();
    const first = await menu.getByRole("option").first().boundingBox();
    const popup = await menu.boundingBox();
    const clear = await brandClear.boundingBox();
    const action = await next.boundingBox();
    expect(list).not.toBeNull(); expect(first).not.toBeNull(); expect(popup).not.toBeNull(); expect(clear).not.toBeNull(); expect(action).not.toBeNull();
    expect(list!.height).toBeGreaterThanOrEqual(44);
    expect(first!.height).toBeGreaterThanOrEqual(44);
    expect(popup!.y).toBeGreaterThanOrEqual(clear!.y + clear!.height);
    expect(popup!.y + popup!.height).toBeLessThanOrEqual(action!.y);
    const buttons = await menu.locator(":scope > div:last-child button").evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
    expect(buttons).toHaveLength(2);
    for (const button of buttons) { expect(button.width).toBeGreaterThanOrEqual(44); expect(button.height).toBeGreaterThanOrEqual(44); }
  }
  await model.fill("ThinkPad T14 Gen 5");
  await page.getByRole("option", { name: "ThinkPad T14 Gen 5 (Intel)", exact: true }).click();
  await expect(model).toHaveValue("ThinkPad T14 Gen 5 (Intel)");
});
