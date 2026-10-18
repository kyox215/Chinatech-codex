import { test, expect, type Locator, type Page } from "@playwright/test";
import { chooseCatalogDevice, openCatalogPicker, choosePickerFamily, choosePickerModel, pickerRoot, openDeviceExtras, fillCatalogQuery, pressCatalogKey, expectCatalogValue, catalogQueryInput, confirmCatalogManual, isBrowsePicker } from './catalog-picker';
import { translate } from "../../lib/i18n/translate";
import type { Locale } from "../../lib/i18n/locale";

async function activate(page: Page, locator: Locator) {
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}

async function chooseRadio(page: Page, name: string, scope: Locator = page.locator("body")) {
  await activate(page, scope.getByRole("radio", { name, exact: true }).locator(".."));
}

async function choosePhone(page: Page) {
  await deviceStep(page);
  await chooseCatalogDevice(page, 'Apple', 'iPhone', 'iPhone 16');
}

test.beforeEach(async ({ page }) => {
  // This suite uses only the local fictional preview, never a cloud account.
  const response = await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  expect(response.status()).toBe(200);
});

async function deviceStep(page: Page) {
  await page.goto("/app/repairs/new");
  await page.getByRole("combobox", { name: "联系电话", includeHidden: true }).fill("+393200001234");
  await activate(page, page.getByRole("button", { name: "下一步", exact: true }));
  await expect(page.getByRole("heading", { name: "送修设备" })).toBeVisible();
}

test("candidate selection survives the iOS canceled-pointer focus order", async ({ page }) => {
  await page.addInitScript(() => {
    // macOS WebKit emulation does not reproduce iOS WebKit #322721 itself.
    document.addEventListener("pointerdown", event => {
      if (event.defaultPrevented && event.target instanceof Element && event.target.closest('[role="option"]')) {
        (document.activeElement as HTMLElement | null)?.blur();
      }
    });
  });
  await deviceStep(page);
  const brand = page.getByRole("combobox", { name: "品牌", exact: true, includeHidden: true });
  const brands = await openCatalogPicker(page, brand);
  await activate(page, brands.getByRole("option", { name: "Apple", exact: true }));
  await expectCatalogValue(brand, "Apple");
  await expect(brand).toHaveAttribute("aria-expanded", "false");
  const model = page.getByRole("combobox", { name: "型号", exact: true, includeHidden: true });
  await expect(model).toHaveAttribute("aria-expanded", "false");
  const models = await openCatalogPicker(page, model);
  await choosePickerFamily(page, models, 'iPhone');
  await choosePickerModel(page, models, 'iPhone 16 Pro');
  await expectCatalogValue(model, "iPhone 16 Pro");
});

test("keyboard selection, IME confirmation, free text and dismissal", async ({ page }) => {
  await deviceStep(page);
  const brand = page.getByRole("combobox", { name: "品牌", exact: true, includeHidden: true });
  const root = await openCatalogPicker(page, brand);
  await fillCatalogQuery(page, brand, "App");
  await expect(root.getByRole("option", { name: "Apple", exact: true })).toBeVisible();
  await pressCatalogKey(page, brand, "ArrowDown");
  await (await catalogQueryInput(page, brand)).dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, keyCode: 229 });
  await expect(await catalogQueryInput(page, brand)).toHaveValue("App");
  await expect(brand).toHaveAttribute("aria-expanded", "true");
  await pressCatalogKey(page, brand, "Enter");
  await expectCatalogValue(brand, "Apple");
  await expect(brand).toHaveAttribute("aria-expanded", "false");
  const model = page.getByRole("combobox", { name: "型号", exact: true, includeHidden: true });
  const models = await openCatalogPicker(page, model);
  await choosePickerFamily(page, models, 'iPhone');
  await choosePickerModel(page, models, 'iPhone 16');
  await openCatalogPicker(page, brand);
  await fillCatalogQuery(page, brand, "手动品牌");
  await expect(root.getByRole("status").filter({ hasText: "没有匹配" })).toBeVisible();
  await pressCatalogKey(page, brand, "Escape");
  await expectCatalogValue(brand, "Apple");
  await expectCatalogValue(model, 'iPhone 16');
  await expect(brand).toBeFocused();
  await expect(brand).toHaveAttribute("aria-expanded", "false");
  await activate(page, await isBrowsePicker(brand) ? brand : page.getByRole("button", { name: "显示品牌候选", exact: true }));
  await expect(brand).toHaveAttribute("aria-expanded", "true");
  await pressCatalogKey(page, brand, "Escape");
  await brand.focus();
  await pressCatalogKey(page, brand, "Tab");
  if (!test.info().project.use.hasTouch) {
    await expect(page.getByRole("button", { name: "清空品牌", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "显示品牌候选", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
  }
  await expect(brand).toHaveAttribute("aria-expanded", "false");
});

test("pressing a candidate does not commit before click or block list scrolling", async ({ page }) => {
  await deviceStep(page);
  const brand = page.getByRole("combobox", { name: "品牌", exact: true, includeHidden: true });
  const root = await openCatalogPicker(page, brand);
  const apple = root.getByRole("option", { name: "Apple", exact: true });
  const canceled = await apple.evaluate(element => !element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch" })));
  expect(canceled).toBe(false);
  await expectCatalogValue(brand, "");
  await apple.dispatchEvent("pointercancel", { pointerType: "touch" });
  const list = root.getByRole("listbox", { name: "品牌候选", exact: true });
  await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await list.getByRole('option').count()).toBeLessThanOrEqual(16);
  await fillCatalogQuery(page, brand, 'Google');
  await activate(page, root.getByRole("option", { name: "Google", exact: true }));
  await expectCatalogValue(brand, 'Google');
  const model = page.getByRole('combobox', { name: '型号', exact: true, includeHidden: true });
  await openCatalogPicker(page, model);
  await fillCatalogQuery(page, model, 'Pixel synthetic');
  await confirmCatalogManual(page, model, 'Tab');
  await expectCatalogValue(model, 'Pixel synthetic');
  await expect(model).toHaveAttribute('aria-expanded', 'false');
});

test("a focused option activates once and returns to its closed independent input", async ({ page }) => {
  await deviceStep(page);
  const brand = page.getByRole("combobox", { name: "品牌", exact: true, includeHidden: true });
  const root = await openCatalogPicker(page, brand);
  const apple = root.getByRole("option", { name: "Apple", exact: true });
  await apple.focus(); await apple.press("Enter");
  await expectCatalogValue(brand, 'Apple');
  await expect(brand).toBeFocused();
  await expect(brand).toHaveAttribute('aria-expanded', 'false');
  const model = page.getByRole('combobox', { name: '型号', exact: true, includeHidden: true });
  const models = await openCatalogPicker(page, model);
  await choosePickerFamily(page, models, 'iPhone');
  await fillCatalogQuery(page, model, 'iPhone 16');
  const option = models.getByRole('option', { name: 'iPhone 16', exact: true });
  await option.focus(); await option.press('Enter');
  await expectCatalogValue(model, 'iPhone 16'); await expect(model).toBeFocused();
  await expect(model).toHaveAttribute('aria-expanded', 'false');
  await openCatalogPicker(page, brand);
  await activate(page, pickerRoot(brand).getByRole("option", { name: "Apple", exact: true }));
  await expect(brand).toHaveAttribute('aria-expanded', 'false');
  await expectCatalogValue(model, 'iPhone 16');
});

test("selected device facts save, reload and supplier choice saves to the same order", async ({ page }) => {
  await choosePhone(page);
  await activate(page, page.getByRole("button", { name: "下一步", exact: true }));
  await page.getByRole("button", { name: "屏幕", exact: true }).click();
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
  await activate(page, page.getByRole("main").getByRole("button", { name: "选择屏幕供应商", exact: true }));
  const supplier = page.getByRole("combobox", { name: "供应商（选填）", includeHidden: true });
  await activate(page, supplier);
  await activate(page, page.getByRole("option", { name: "MobileParts SRL", exact: true }));
  await expect(supplier).toHaveValue("MobileParts SRL");
  await activate(page, page.getByRole("dialog", { name: "供应商与配件" }).getByRole("button", { name: "保存", exact: true }));
  await expect(page.getByRole("dialog", { name: "供应商与配件" })).not.toBeVisible();
  await page.reload();
  await expect(page.locator("main")).toContainText("屏幕");
  await expect(page.locator("main")).toContainText("MobileParts SRL");
});

test("customer selection fills linked fields and category changes clear dependent models", async ({ page }) => {
  await page.goto("/app/repairs/new");
  const phone = page.getByRole("combobox", { name: "联系电话", includeHidden: true });
  await phone.fill("1029");
  await activate(page, page.getByRole("option", { name: /1029.*周先生/ }));
  await expect(page.getByLabel("客户称呼（选填）", { exact: true })).toHaveValue("周先生");
  await expect(page.getByLabel("电子邮件（选填）", { exact: true })).toHaveValue("zhou@example.com");
  await activate(page, page.getByRole("button", { name: "下一步", exact: true }));
  const brand = page.getByRole("combobox", { name: "品牌", includeHidden: true });
  const model = page.getByRole("combobox", { name: /^型号/, includeHidden: true });
  await chooseCatalogDevice(page, 'Apple', 'iPhone', 'iPhone 16');
  await page.getByRole('button', { name: '清空品牌', exact: true }).click();
  await expectCatalogValue(brand, '');
  await expectCatalogValue(model, "");
  await page.getByLabel("设备类别").selectOption({ label: "电脑" });
  await expectCatalogValue(brand, "");
  await chooseCatalogDevice(page, 'Lenovo', 'ThinkPad', 'ThinkPad T14 Gen 1 (Intel)');
  await expectCatalogValue(model, "ThinkPad T14 Gen 1 (Intel)");
});

test("colors close on repeat selection and preserve custom text", async ({ page }) => {
  await deviceStep(page);
  await openDeviceExtras(page);
  const summary = page.getByLabel("选择设备颜色");
  const owner = page.locator(".color-picker").filter({ has: summary });
  await expect(owner).toHaveCount(1);
  const details = owner.locator(":scope > details");
  await activate(page, summary);
  await chooseRadio(page, "未记录", owner);
  await expect(details).not.toHaveAttribute("open", "");
  await activate(page, summary);
  await chooseRadio(page, "黑色", owner);
  await expect(summary).toContainText("黑色");
  await activate(page, summary);
  await chooseRadio(page, "黑色", owner);
  await expect(details).not.toHaveAttribute("open", "");
  await activate(page, summary);
  await chooseRadio(page, "其他颜色", owner);
  await page.getByRole("textbox", { name: "其他颜色", exact: true }).fill("玫瑰金");
  await activate(page, summary);
  await chooseRadio(page, "其他颜色", owner);
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
  const brand = page.getByRole("combobox", { name: "品牌", includeHidden: true });
  await chooseCatalogDevice(page, 'Apple', 'iPhone', 'iPhone 16');
  await expectCatalogValue(brand, "Apple");
  const owner = page.locator(".color-picker").filter({ has: page.getByLabel("选择设备颜色") });
  await expect(owner).toHaveCount(1);
  await activate(page, page.getByLabel("选择设备颜色"));
  await chooseRadio(page, "其他颜色", owner);
  await page.getByRole("textbox", { name: "其他颜色", exact: true }).fill("玫瑰金");
  await page.getByLabel("商品类型", { exact: true }).selectOption("laptop");
  await expect(page.getByLabel("选择设备颜色")).toContainText("未记录");
  await expect(page.getByRole("textbox", { name: "其他颜色", exact: true })).toHaveCount(0);
});

test("color selection, repeat and popup Escape restore the summary before parent Escape", async ({ page }) => {
  await page.goto("/app/retail/units/demo-unit-1");
  const summaryPanel = page.getByRole("region", { name: "单机摘要", exact: true });
  await expect(summaryPanel).toBeVisible();
  await activate(page, summaryPanel.getByRole("button", { name: "编辑颜色", exact: true }));
  const editor = page.getByRole("region", { name: "编辑颜色", exact: true });
  const owner = editor.locator(".color-picker");
  await expect(owner).toHaveCount(1);
  const summary = owner.getByLabel("选择设备颜色", { exact: true });
  const details = owner.locator(":scope > details"), popup = owner.locator(":scope > .color-picker__palette");
  await activate(page, summary);
  await chooseRadio(page, "黑色", owner);
  await expect(popup).toHaveCount(0);
  await expect(summary).toContainText("黑色");
  await expect(summary).toBeFocused();
  await activate(page, summary);
  await chooseRadio(page, "黑色", owner);
  await expect(popup).toHaveCount(0);
  await expect(summary).toBeFocused();
  await summary.press("Enter"); await summary.press("Escape"); await summary.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await expect(popup).toHaveCount(1);
  const radio = owner.getByRole("radio", { name: "白色", exact: true });
  await radio.focus(); await radio.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(details).not.toHaveAttribute("open", "");
  await expect(editor).toBeVisible();
  await expect(summary).toBeFocused();
  await summary.press("Escape");
  await expect(editor).toHaveCount(0);
});

test("custom color is a real outside pointer target and its Escape reaches the editor", async ({ page }) => {
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 420 });
  await page.goto("/app/retail/units/demo-unit-1");
  const summaryPanel = page.getByRole("region", { name: "单机摘要", exact: true });
  await expect(summaryPanel).toBeVisible();
  await activate(page, summaryPanel.getByRole("button", { name: "编辑颜色", exact: true }));
  const editor = page.getByRole("region", { name: "编辑颜色", exact: true });
  const owner = editor.locator(".color-picker");
  await expect(owner).toHaveCount(1);
  const summary = owner.getByLabel("选择设备颜色", { exact: true });
  const popup = owner.locator(":scope > .color-picker__palette");
  await activate(page, summary);
  await chooseRadio(page, "其他颜色", owner);
  const custom = owner.getByRole("textbox", { name: "其他颜色", exact: true });
  await custom.fill("DEMO retained custom color");
  await activate(page, summary);
  await expect(popup).toBeVisible();
  await activate(page, custom);
  await expect(popup).toHaveCount(0);
  await expect(custom).toBeFocused();
  await expect(custom).toHaveValue("DEMO retained custom color");
  await custom.press("Escape");
  await expect(editor).toHaveCount(0);
});

test("an open color popup inherits a disabled fieldset without changing value or unlocking it", async ({ page }) => {
  await page.goto("/app/retail/units/demo-unit-1");
  const summaryPanel = page.getByRole("region", { name: "单机摘要", exact: true });
  await expect(summaryPanel).toBeVisible();
  await activate(page, summaryPanel.getByRole("button", { name: "编辑颜色", exact: true }));
  const editor = page.getByRole("region", { name: "编辑颜色", exact: true });
  const owner = editor.locator(".color-picker");
  await expect(owner).toHaveCount(1);
  const summary = owner.getByLabel("选择设备颜色", { exact: true });
  await activate(page, summary);
  const fieldset = editor.locator("fieldset.form-fields");
  const blue = owner.getByRole("radio", { name: "蓝色", exact: true });
  const black = owner.getByRole("radio", { name: "黑色", exact: true });
  await expect(blue).toBeChecked();
  await fieldset.evaluate(element => element.setAttribute("disabled", ""));
  await expect(fieldset).toHaveAttribute("disabled", "");
  await expect(fieldset.locator(".color-picker__palette")).toHaveCount(1);
  await expect(black).toBeDisabled();
  const label = black.locator("..");
  expect(await label.evaluate(element => { const r = element.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === element || element.contains(hit); })).toBe(true);
  const box = (await label.boundingBox())!;
  // A real native pointer gesture tests disabled inheritance; locator activation
  // correctly refuses a disabled radio and is not used to bypass that guard.
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(blue).toBeChecked();
  await expect(black).not.toBeChecked();
  await expect(summary).toContainText("蓝色");
  await summary.press("Escape");
  await expect(owner.locator(":scope > .color-picker__palette")).toHaveCount(0);
  await expect(editor).toBeVisible();
  await expect(fieldset).toHaveAttribute("disabled", "");
});

test("affected choices fit desktop and phone layouts", async ({ page }) => {
  await deviceStep(page);
  for (const width of test.info().project.use.hasTouch ? [390, 375] : [1440, 1024]) {
    await page.setViewportSize({ width, height: test.info().project.use.hasTouch ? 812 : 1000 });
    const brand = page.getByRole("combobox", { name: "品牌", includeHidden: true });
    await openCatalogPicker(page, brand);
    await expect(page.getByRole("option", { name: "Apple", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const bounds = await page.getByRole("option", { name: "Apple", exact: true }).boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    if (width < 768) expect(await brand.evaluate(element => getComputedStyle(element).fontSize)).toBe("16px");
    await page.screenshot({ path: `.local/ui-proof/controls/${test.info().project.name}-${width}.png` });
    await pressCatalogKey(page, brand, 'Escape');
  }
  await page.goto("/app/retail/new");
  await chooseRadio(page, "翻新机");
  for (const width of test.info().project.use.hasTouch ? [390, 375] : [1440, 1024]) {
    await page.setViewportSize({ width, height: test.info().project.use.hasTouch ? 812 : 1000 });
    const brand = page.getByRole("combobox", { name: "品牌", includeHidden: true });
    await openCatalogPicker(page, brand);
    await expect(page.getByRole("option", { name: "Apple", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const bounds = await page.getByRole("option", { name: "Apple", exact: true }).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `.local/ui-proof/controls/retail-${test.info().project.name}-${width}.png` });
    await pressCatalogKey(page, brand, 'Escape');
  }
});

async function expectAnchoredColor(owner: Locator) {
  await expect(owner.locator(":scope > .color-picker__palette")).toBeVisible();
  const geometry = await owner.evaluate(element => {
    const popup = element.querySelector<HTMLElement>(":scope > .color-picker__palette")!;
    const summary = element.querySelector("summary")!;
    const box = popup.getBoundingClientRect(), anchor = summary.getBoundingClientRect();
    return { position: getComputedStyle(popup).position, localOwner: popup.offsetParent === element, left: box.left, right: box.right, top: box.top, bottom: box.bottom, anchorTop: anchor.top, anchorBottom: anchor.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  expect(geometry.position).toBe("absolute");
  expect(geometry.localOwner).toBe(true);
  expect(geometry.left).toBeGreaterThanOrEqual(12);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth - 12);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(geometry.bottom <= geometry.anchorTop || geometry.top >= geometry.anchorBottom).toBe(true);
}

async function anchorLanguage(page: Page, locale: Locale) {
  const t = (text: string, values?: Record<string, string | number>) => translate(text, locale, values);
  if (locale === "zh-CN") { await expect(page.locator("html")).toHaveAttribute("lang", locale); return t; }
  const select = page.getByLabel("语言 / Lingua / Language", { exact: true });
  let openedDrawer = false, openedAccount = false;
  if (!await select.isVisible()) {
    const menu = page.locator(".page-menu-button");
    if (await page.evaluate(() => innerWidth < 768) && await menu.getAttribute("aria-expanded") !== "true") { await activate(page, menu); openedDrawer = true; }
    const account = page.locator(".sidebar-account");
    if (await account.getAttribute("open") === null) { await activate(page, account.locator("summary")); openedAccount = true; }
  }
  await select.selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  if (openedDrawer) {
    await activate(page, page.locator(".app-sidebar__close"));
    await expect.poll(() => page.locator("#app-sidebar").evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
  } else if (openedAccount) await activate(page, page.locator(".sidebar-account > summary"));
  return t;
}

test("retail summary color follows common document scrolling and escapes only its open panel", async ({ page }) => {
  await page.setViewportSize({ width: test.info().project.use.hasTouch ? 390 : 1440, height: 1000 });
  await page.goto("/app/retail/units/demo-unit-1");
  const t = await anchorLanguage(page, test.info().project.use.hasTouch ? "zh-CN" : "en");
  const panel = page.getByRole("region", { name: t("单机摘要"), exact: true });
  await activate(page, panel.getByRole("button", { name: t("编辑{v0}", { v0: t("颜色") }), exact: true }));
  const owner = page.getByRole("region", { name: t("编辑{v0}", { v0: t("颜色") }), exact: true }).locator(".color-picker");
  const summary = owner.getByLabel(t("选择设备颜色"), { exact: true });
  const popup = owner.locator(":scope > .color-picker__palette");
  const radius = await panel.evaluate(element => getComputedStyle(element).borderRadius);
  await summary.evaluate(element => element.scrollIntoView({ block: "start" }));
  await activate(page, summary);
  await expect(popup).toBeVisible();
  await expectAnchoredColor(owner);
  expect(await panel.evaluate(element => getComputedStyle(element).overflow)).toBe("visible");
  const before = await owner.evaluate(element => ({ ownerTop: element.getBoundingClientRect().top, popupTop: element.querySelector(".color-picker__palette")!.getBoundingClientRect().top, style: element.querySelector(".color-picker__palette")!.getAttribute("style") }));
  const scrollDelta = await page.evaluate(() => { const delta = window.scrollY >= 16 ? -16 : 16; window.scrollBy(0, delta); return delta; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));
  const after = await owner.evaluate(element => ({ ownerTop: element.getBoundingClientRect().top, popupTop: element.querySelector(".color-picker__palette")!.getBoundingClientRect().top, style: element.querySelector(".color-picker__palette")!.getAttribute("style") }));
  expect(after.ownerTop - before.ownerTop).toBe(-scrollDelta);
  expect(after.popupTop - before.popupTop).toBe(after.ownerTop - before.ownerTop);
  expect(after.style).toBe(before.style);
  await summary.press("Escape");
  expect(await panel.evaluate(element => getComputedStyle(element).overflow)).toBe("hidden");
  await page.setViewportSize({ width: test.info().project.use.hasTouch ? 375 : 1024, height: 420 });
  await activate(page, summary);
  await expectAnchoredColor(owner);
  await chooseRadio(page, t("其他颜色"), owner);
  await expect(owner.getByRole("textbox", { name: t("其他颜色"), exact: true })).toBeVisible();
  expect(await panel.evaluate(element => getComputedStyle(element).overflow)).toBe("hidden");
  expect(await panel.evaluate(element => getComputedStyle(element).borderRadius)).toBe(radius);
});

test("retail creation color remains reachable across short-screen resize and form overflow", async ({ page }) => {
  await page.setViewportSize({ width: test.info().project.use.hasTouch ? 375 : 1024, height: 420 });
  await page.goto("/app/retail/new");
  const t = await anchorLanguage(page, test.info().project.use.hasTouch ? "it" : "zh-CN");
  await chooseRadio(page, t("翻新机"));
  const owner = page.locator(".color-picker");
  await expect(owner).toHaveCount(1);
  const summary = owner.getByLabel(t("选择设备颜色"), { exact: true });
  expect(await owner.evaluate(element => getComputedStyle(element.closest("form")!).overflow)).toBe("visible");
  await activate(page, summary);
  await expectAnchoredColor(owner);
  await page.setViewportSize({ width: test.info().project.use.hasTouch ? 390 : 767, height: 420 });
  await expect.poll(async () => owner.evaluate(element => {
    const popup = element.querySelector<HTMLElement>(".color-picker__palette")!, box = popup.getBoundingClientRect();
    return box.left >= 12 && box.right <= innerWidth - 12;
  })).toBe(true);
  await expectAnchoredColor(owner);
  await chooseRadio(page, t("黑色"), owner);
  await expect(summary).toContainText(t("黑色"));
  await expect(owner.locator(":scope > .color-picker__palette")).toHaveCount(0);
});

test("repair device color preserves short-screen internal scrolling and native selection", async ({ page }) => {
  await page.setViewportSize({ width: test.info().project.use.hasTouch ? 375 : 1024, height: 420 });
  await deviceStep(page);
  await openDeviceExtras(page);
  const owner = page.locator(".color-picker");
  const summary = owner.getByLabel("选择设备颜色", { exact: true });
  await summary.evaluate(element => element.scrollIntoView({ block: "center" }));
  await activate(page, summary);
  await expectAnchoredColor(owner);
  const popup = owner.locator(":scope > .color-picker__palette");
  const geometry = await popup.evaluate(element => {
    const anchor = element.parentElement!.querySelector("summary")!.getBoundingClientRect(), box = element.getBoundingClientRect();
    return { summary: { x: anchor.x, y: anchor.y, width: anchor.width, height: anchor.height }, popup: { x: box.x, y: box.y, width: box.width, height: box.height }, viewport: { width: innerWidth, height: innerHeight }, spaceAbove: anchor.top, spaceBelow: innerHeight - anchor.bottom, rootScrollTop: document.scrollingElement?.scrollTop, maxHeight: getComputedStyle(element).maxHeight, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight };
  });
  await test.info().attach("repair-color-scroll-geometry", { body: JSON.stringify(geometry, null, 2), contentType: "application/json" });
  expect(Math.max(geometry.spaceAbove, geometry.spaceBelow), JSON.stringify(geometry)).toBeLessThan(geometry.scrollHeight);
  expect(await popup.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  await popup.evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await popup.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await chooseRadio(page, "其他颜色", owner);
  const custom = owner.getByRole("textbox", { name: "其他颜色", exact: true });
  await custom.fill("DEMO 自定义颜色");
  await activate(page, summary);
  await expectAnchoredColor(owner);
  await summary.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(custom).toHaveValue("DEMO 自定义颜色");
});
