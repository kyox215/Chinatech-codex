import { test, expect, type Locator, type Page } from "@playwright/test";

async function activate(page: Page, locator: Locator) {
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}

async function chooseRadio(page: Page, name: string, scope: Locator = page.locator("body")) {
  await activate(page, scope.getByRole("radio", { name, exact: true }).locator(".."));
}

async function choosePhone(page: Page) {
  await deviceStep(page);
  await activate(page, page.getByRole("combobox", { name: "品牌" }));
  await activate(page, page.getByRole("option", { name: "Apple", exact: true }));
  await activate(page, page.getByRole("combobox", { name: /^型号/ }));
  await activate(page, page.getByRole("option", { name: "iPhone 16", exact: true }));
}

test.beforeEach(async ({ page }) => {
  // This suite uses only the local fictional preview, never a cloud account.
  const response = await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  expect(response.status()).toBe(200);
});

async function deviceStep(page: Page) {
  await page.goto("/app/repairs/new");
  await page.getByRole("combobox", { name: "联系电话" }).fill("+393200001234");
  await activate(page, page.getByRole("button", { name: "下一步", exact: true }));
  await expect(page.getByRole("heading", { name: "送修设备" })).toBeVisible();
}

test("candidate selection survives the iOS canceled-pointer focus order", async ({ page }) => {
  await page.addInitScript(() => {
    // Model WebKit #322721: iOS can blur the active input even when pointerdown
    // was canceled. macOS WebKit emulation does not reproduce this natively.
    document.addEventListener("pointerdown", event => {
      if (event.defaultPrevented && event.target instanceof Element && event.target.closest('[role="option"]')) {
        (document.activeElement as HTMLElement | null)?.blur();
      }
    });
  });
  await deviceStep(page);
  const brand = page.getByRole("combobox", { name: "品牌" });
  await activate(page, brand);
  await activate(page, page.getByRole("option", { name: "Apple", exact: true }));
  await expect(brand).toHaveValue("Apple");
  await expect(brand).toHaveAttribute("aria-expanded", "false");
  const model = page.getByRole("combobox", { name: /^型号/ });
  await activate(page, model);
  await activate(page, page.getByRole("option", { name: "iPhone 16 Pro", exact: true }));
  await expect(model).toHaveValue("iPhone 16 Pro");
});

test("keyboard selection, IME confirmation, free text and dismissal", async ({ page }) => {
  await deviceStep(page);
  const brand = page.getByRole("combobox", { name: "品牌" });
  await brand.focus();
  await brand.press("ArrowDown");
  await brand.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, keyCode: 229 });
  await expect(brand).toHaveValue("");
  await expect(brand).toHaveAttribute("aria-expanded", "true");
  await brand.press("Enter");
  await expect(brand).toHaveValue("Apple");
  await expect(brand).toHaveAttribute("aria-expanded", "false");
  await brand.fill("手动品牌");
  await expect(page.getByRole("status").filter({ hasText: "没有匹配" })).toBeVisible();
  await brand.press("Escape");
  await expect(brand).toHaveValue("手动品牌");
  await expect(brand).toHaveAttribute("aria-expanded", "false");
  await activate(page, page.getByRole("button", { name: "显示品牌候选" }));
  await expect(brand).toHaveAttribute("aria-expanded", "true");
  await activate(page, page.getByRole("heading", { name: "送修设备" }));
  await expect(brand).toHaveAttribute("aria-expanded", "false");
  await brand.focus();
  await brand.press("Tab");
  await page.keyboard.press("Tab");
  await expect(brand).toHaveAttribute("aria-expanded", "false");
});

test("pressing a candidate does not commit before click or block list scrolling", async ({ page }) => {
  await deviceStep(page);
  const brand = page.getByRole("combobox", { name: "品牌" });
  await activate(page, brand);
  const apple = page.getByRole("option", { name: "Apple", exact: true });
  const canceled = await apple.evaluate(element => !element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch" })));
  expect(canceled).toBe(false);
  await expect(brand).toHaveValue("");
  await apple.dispatchEvent("pointercancel", { pointerType: "touch" });
  const menu = page.locator(".search-combobox__menu");
  await menu.evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await menu.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await activate(page, page.getByRole("option", { name: "Google", exact: true }));
  await expect(brand).toHaveValue("Google");
});

test("a focused option activates once and returns to the closed input", async ({ page }) => {
  await deviceStep(page);
  const brand = page.getByRole("combobox", { name: "品牌" });
  await activate(page, brand);
  const apple = page.getByRole("option", { name: "Apple", exact: true });
  await apple.focus();
  await apple.press("Enter");
  await expect(brand).toHaveValue("Apple");
  await expect(brand).toBeFocused();
  await expect(brand).toHaveAttribute("aria-expanded", "false");
  await activate(page, brand);
  await expect(brand).toHaveAttribute("aria-expanded", "true");
  await activate(page, page.getByRole("option", { name: "Apple", exact: true }));
  await expect(brand).toHaveAttribute("aria-expanded", "false");
});

test("selected device facts save, reload and supplier choice saves to the same order", async ({ page }) => {
  await choosePhone(page);
  await activate(page, page.getByRole("button", { name: "下一步", exact: true }));
  await page.getByLabel("故障补充 / 自定义故障").fill("触控选项回归测试");
  await activate(page, page.getByRole("button", { name: "下一步", exact: true }));
  await page.getByRole("checkbox", { name: /已与客户核对接机信息/ }).check();
  await activate(page, page.getByRole("button", { name: "保存并预览" }));
  await expect(page.getByRole("heading", { name: "接机信息已保存" })).toBeVisible();
  await page.getByRole("link", { name: "查看工单", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/repairs\/LOCAL-/);
  await expect(page.locator("main")).toContainText("iPhone 16");
  await page.reload();
  await expect(page.locator("main")).toContainText("触控选项回归测试");
  await activate(page, page.getByRole("main").getByRole("button", { name: "添加配件", exact: true }));
  await page.getByLabel("配件名称", { exact: true }).fill("回归测试屏幕");
  const supplier = page.getByRole("combobox", { name: "供应商" });
  await activate(page, supplier);
  await activate(page, page.getByRole("option", { name: "MobileParts SRL", exact: true }));
  await expect(supplier).toHaveValue("MobileParts SRL");
  await activate(page, page.getByRole("dialog", { name: "供应商与配件" }).getByRole("button", { name: "加入采购车", exact: true }));
  await expect(page.getByRole("combobox", { name: "供应商" })).toHaveCount(0);
  await activate(page, page.getByRole("button", { name: "关闭配件操作" }));
  await page.reload();
  await expect(page.locator("main")).toContainText("回归测试屏幕");
  await expect(page.locator("main")).toContainText("MobileParts SRL");
});

test("customer selection fills linked fields and category changes clear dependent models", async ({ page }) => {
  await page.goto("/app/repairs/new");
  const phone = page.getByRole("combobox", { name: "联系电话" });
  await phone.fill("1029");
  await activate(page, page.getByRole("option", { name: /1029.*周先生/ }));
  await expect(page.getByLabel("客户称呼（选填）")).toHaveValue("周先生");
  await expect(page.getByLabel("电子邮件（选填）")).toHaveValue("zhou@example.com");
  await activate(page, page.getByRole("button", { name: "下一步", exact: true }));
  const brand = page.getByRole("combobox", { name: "品牌" });
  const model = page.getByRole("combobox", { name: /^型号/ });
  await activate(page, brand);
  await activate(page, page.getByRole("option", { name: "Apple", exact: true }));
  await activate(page, model);
  await activate(page, page.getByRole("option", { name: "iPhone 16", exact: true }));
  await brand.fill("");
  await activate(page, page.getByRole("option", { name: "Samsung", exact: true }));
  await expect(model).toHaveValue("");
  await page.getByLabel("设备类别").selectOption({ label: "电脑" });
  await expect(brand).toHaveValue("");
  await activate(page, brand);
  await activate(page, page.getByRole("option", { name: "Lenovo", exact: true }));
  await activate(page, model);
  await activate(page, page.getByRole("option", { name: "ThinkPad T14", exact: true }));
  await expect(model).toHaveValue("ThinkPad T14");
});

test("colors close on repeat selection and preserve custom text", async ({ page }) => {
  await deviceStep(page);
  const summary = page.getByLabel("选择设备颜色");
  const details = page.locator(".color-picker details");
  await activate(page, summary);
  await chooseRadio(page, "未记录", details);
  await expect(details).not.toHaveAttribute("open", "");
  await activate(page, summary);
  await chooseRadio(page, "黑色", details);
  await expect(summary).toContainText("黑色");
  await activate(page, summary);
  await chooseRadio(page, "黑色", details);
  await expect(details).not.toHaveAttribute("open", "");
  await activate(page, summary);
  await chooseRadio(page, "其他颜色", details);
  await page.getByRole("textbox", { name: "其他颜色", exact: true }).fill("玫瑰金");
  await activate(page, summary);
  await chooseRadio(page, "其他颜色", details);
  await expect(details).not.toHaveAttribute("open", "");
  await expect(page.getByRole("textbox", { name: "其他颜色", exact: true })).toHaveValue("玫瑰金");
});

test("screen technology repeat selection returns and multi choices toggle", async ({ page }) => {
  await choosePhone(page);
  await activate(page, page.getByRole("button", { name: "下一步", exact: true }));
  await activate(page, page.getByRole("button", { name: "展开屏幕细分故障" }));
  const dialog = page.getByRole("dialog", { name: "屏幕细分故障选项" });
  await chooseRadio(page, "组装", dialog);
  await chooseRadio(page, "未指定", dialog);
  await expect(dialog.getByText("屏幕 · 维修需求", { exact: true })).toBeVisible();
  await activate(page, dialog.getByRole("checkbox", { name: "碎裂", exact: true }).locator(".."));
  await expect(dialog.getByRole("checkbox", { name: "碎裂", exact: true })).toBeChecked();
  await activate(page, dialog.getByRole("button", { name: "组装类型 · 未指定" }));
  await chooseRadio(page, "OLED", dialog);
  await activate(page, dialog.getByRole("button", { name: "组装类型 · OLED" }));
  await chooseRadio(page, "OLED", dialog);
  await expect(dialog.getByText("屏幕 · 维修需求", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "碎裂", exact: true })).toBeChecked();
  await activate(page, dialog.getByRole("checkbox", { name: "碎裂", exact: true }).locator(".."));
  await expect(dialog.getByRole("checkbox", { name: "碎裂", exact: true })).not.toBeChecked();
  await dialog.getByRole("button", { name: "完成", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("retail catalog and color state follow the selected category", async ({ page }) => {
  await page.goto("/app/retail/new");
  await chooseRadio(page, "翻新机");
  const brand = page.getByRole("combobox", { name: "品牌" });
  await activate(page, brand);
  await activate(page, page.getByRole("option", { name: "Apple", exact: true }));
  await expect(brand).toHaveValue("Apple");
  await activate(page, page.getByLabel("选择设备颜色"));
  await chooseRadio(page, "其他颜色", page.locator(".color-picker details"));
  await page.getByRole("textbox", { name: "其他颜色", exact: true }).fill("玫瑰金");
  await page.getByLabel("商品类型", { exact: true }).selectOption("laptop");
  await expect(page.getByLabel("选择设备颜色")).toContainText("未记录");
  await expect(page.getByRole("textbox", { name: "其他颜色", exact: true })).toHaveCount(0);
});

test("affected choices fit desktop and phone layouts", async ({ page }) => {
  await deviceStep(page);
  for (const width of test.info().project.use.hasTouch ? [390, 375] : [1440, 1024]) {
    await page.setViewportSize({ width, height: test.info().project.use.hasTouch ? 812 : 1000 });
    const brand = page.getByRole("combobox", { name: "品牌" });
    await activate(page, brand);
    await expect(page.getByRole("option", { name: "Apple", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const bounds = await page.getByRole("option", { name: "Apple", exact: true }).boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    if (width < 768) expect(await brand.evaluate(element => getComputedStyle(element).fontSize)).toBe("16px");
    await page.screenshot({ path: `.local/ui-proof/controls/${test.info().project.name}-${width}.png` });
    await brand.press("Escape");
  }
  await page.goto("/app/retail/new");
  await chooseRadio(page, "翻新机");
  for (const width of test.info().project.use.hasTouch ? [390, 375] : [1440, 1024]) {
    await page.setViewportSize({ width, height: test.info().project.use.hasTouch ? 812 : 1000 });
    const brand = page.getByRole("combobox", { name: "品牌" });
    await activate(page, brand);
    await expect(page.getByRole("option", { name: "Apple", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const bounds = await page.getByRole("option", { name: "Apple", exact: true }).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `.local/ui-proof/controls/retail-${test.info().project.name}-${width}.png` });
    await brand.press("Escape");
  }
});
