import { test, expect, type Page } from '@playwright/test';
import { activatePicker, openCatalogPicker, chooseCatalogDevice, pickerRoot, pickerText, fillCatalogQuery, expectCatalogValue, manuallyChooseDevice } from './catalog-picker';

async function setup(page: Page, width = 375) {
  await page.setViewportSize({ width, height: 812 });
  const response = await page.request.post('/api/preview-session', { data: { email: 'demo@chinatech.local', password: 'Preview2026!' } });
  expect(response.status()).toBe(200);
  await page.goto('/app/repairs/new');
  await page.getByRole('combobox', { name: '联系电话' }).fill('+393200001234');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
}
const field = (page: Page, name: string) => page.locator(`form.intake-form [role=combobox][aria-label="${name}"]`);
async function noEditableFocus(page: Page) {
  expect(await page.evaluate(() => document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || (document.activeElement as HTMLElement | null)?.isContentEditable)).toBe(false);
}

test('mobile browse buttons open without editable focus; explicit search and cancellation preserve identity in three languages', async ({ page }, info) => {
  test.setTimeout(120000);
  await setup(page);
  for (const locale of ['zh-CN', 'it', 'en']) for (const width of [375, 390]) {
    await page.setViewportSize({ width, height: 812 });
    await page.getByLabel('语言 / Lingua / Language').selectOption(locale, { force: true });
    const brand = field(page, await pickerText(page, '品牌'));
    const model = field(page, await pickerText(page, '型号'));
    const brands = await openCatalogPicker(page, brand);
    await expect(brand).toHaveJSProperty('tagName', 'BUTTON');
    await expect(brands.getByRole('searchbox')).toHaveCount(0);
    await noEditableFocus(page);
    await activatePicker(brands.getByRole('option', { name: 'Apple', exact: true }));
    await expect(brand).toBeFocused(); await noEditableFocus(page);
    const models = await openCatalogPicker(page, model);
    const sheet = page.getByRole('dialog', { name: await pickerText(page, '型号'), exact: true });
    await expect(sheet).toBeVisible(); await noEditableFocus(page);
    await expect(models.getByRole('searchbox')).toHaveCount(0);
    await expect(models.getByRole('option').first()).toBeVisible();
    const triggerBox = (await model.boundingBox())!;
    expect(triggerBox.height).toBeGreaterThanOrEqual(44); expect(triggerBox.width).toBeGreaterThanOrEqual(44);
    await fillCatalogQuery(page, model, 'iPhone 16');
    await expect(models.getByRole('searchbox')).toBeFocused();
    expect(await models.getByRole('searchbox').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    await activatePicker(models.getByRole('option', { name: 'iPhone 16', exact: true }));
    await expect(model).toBeFocused(); await noEditableFocus(page);
    await expectCatalogValue(model, 'iPhone 16');
    await openCatalogPicker(page, model);
    await fillCatalogQuery(page, model, 'DEMO unconfirmed query');
    await models.getByRole('searchbox').press('Enter');
    await expectCatalogValue(model, 'iPhone 16');
    await expect(sheet).toBeVisible();
    await models.getByRole('searchbox').press('Escape');
    await expect(sheet).not.toBeVisible();
    await expect(model).toBeFocused(); await expectCatalogValue(model, 'iPhone 16');
    await openCatalogPicker(page, model);
    await expect(models.getByRole('searchbox')).toHaveCount(0);
    await expect(models.getByRole('option').first()).toBeVisible();
    await page.screenshot({ path: `.local/ui-proof/mobile-picker/${info.project.name}-${locale}-${width}-browse.png` });
    await sheet.getByRole('button').first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('mobile keyboard choice, inline blur, required focus, brand undo and explicit manual values preserve field ownership', async ({ page }) => {
  await setup(page);
  const brand = field(page, '品牌'), model = field(page, '型号');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await expect(brand).toBeFocused(); await expect(brand).toHaveAttribute('aria-invalid', 'true');
  await expect(brand).toHaveAccessibleDescription('请选择或填写设备品牌。');
  const brands = await openCatalogPicker(page, brand);
  const first = await brands.getByRole('option').first().getAttribute('aria-label');
  await brand.press('ArrowDown'); await brand.press('Enter');
  await expectCatalogValue(brand, first!); await expect(brand).toBeFocused(); await noEditableFocus(page);
  await chooseCatalogDevice(page, 'Apple', 'iPhone', 'iPhone 16');
  await openCatalogPicker(page, brand); await fillCatalogQuery(page, brand, 'DEMO only query');
  await page.getByRole('heading', { name: '送修设备', exact: true }).click();
  await expectCatalogValue(brand, 'Apple'); await expectCatalogValue(model, 'iPhone 16');
  await expect(brand).toHaveAttribute('aria-expanded', 'false');
  await openCatalogPicker(page, brand);
  await brands.getByRole('button', { name: '搜索／手动输入', exact: true }).click();
  await brands.getByRole('searchbox').press('Tab');
  expect(await brands.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await brands.getByRole('searchbox').fill('Samsung');
  await activatePicker(brands.getByRole('option', { name: 'Samsung', exact: true }));
  await expectCatalogValue(model, '');
  await page.getByRole('button', { name: '撤销品牌切换', exact: true }).click();
  await expectCatalogValue(brand, 'Apple'); await expectCatalogValue(model, 'iPhone 16');
  await manuallyChooseDevice(page, model, 'DEMO 原文型号 / 0 GB');
  await expectCatalogValue(model, 'DEMO 原文型号 / 0 GB');
  await page.getByRole('button', { name: '清空型号', exact: true }).click();
  await expectCatalogValue(model, ''); await expect(model).toBeFocused(); await noEditableFocus(page);
});

test('mobile sheet traps focus, keeps close visible on short viewports and resets searches across the desktop breakpoint', async ({ page }) => {
  await setup(page); await chooseCatalogDevice(page, 'Apple', 'iPhone', 'iPhone 16');
  let model = field(page, '型号');
  await openCatalogPicker(page, model);
  const sheet = page.getByRole('dialog', { name: '型号', exact: true });
  for (let i = 0; i < 24; i++) { await page.keyboard.press('Tab'); expect(await sheet.evaluate(node => node.contains(document.activeElement))).toBe(true); }
  await fillCatalogQuery(page, model, 'DEMO stale-query');
  await page.setViewportSize({ width: 375, height: 430 });
  const close = sheet.getByRole('button', { name: '关闭型号候选', exact: true });
  await expect(close).toBeInViewport({ ratio: 1 });
  const box = (await sheet.boundingBox())!; expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(431);
  await page.setViewportSize({ width: 1024, height: 812 });
  model = field(page, '型号'); await expect(model).toHaveJSProperty('tagName', 'INPUT');
  await openCatalogPicker(page, model);
  await expect(pickerRoot(model).getByRole('option', { name: 'iPhone 16', exact: true })).toBeVisible();
  await model.fill('DEMO second stale-query');
  await page.setViewportSize({ width: 390, height: 812 });
  model = field(page, '型号'); await openCatalogPicker(page, model);
  await expect(pickerRoot(model).getByRole('searchbox')).toHaveCount(0);
  await expect(pickerRoot(model).getByRole('option', { name: 'iPhone 16', exact: true })).toBeVisible();
  await expectCatalogValue(model, 'iPhone 16');
});
