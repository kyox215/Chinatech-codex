import { expect, test, type Locator, type Page } from '@playwright/test';
import { translate } from '../../lib/i18n/translate';
import type { Locale } from '../../lib/i18n/locale';

export async function activatePicker(locator: Locator) {
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}
export async function pickerText(page: Page, source: string) {
  return translate(source, (await page.locator('html').getAttribute('lang') ?? 'zh-CN') as Locale);
}
export function pickerRoot(input: Locator) {
  return input.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " search-combobox ")][1]');
}
export async function openDeviceExtras(page: Page) {
  const summary = page.locator('summary').filter({ hasText: await pickerText(page, '更多设备信息 · 颜色、SN / IMEI') });
  if (await summary.count()) {
    const details = summary.locator('..');
    if (await details.getAttribute('open') === null) await activatePicker(summary);
    await expect(details).toHaveAttribute('open', '');
  }
}
export async function openCatalogPicker(_page: Page, input: Locator) {
  await expect(input).toBeEditable();
  await activatePicker(input);
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  const root = pickerRoot(input);
  await expect(root.locator('.search-combobox__menu')).toBeVisible();
  return root;
}
export async function choosePickerFamily(page: Page, root: Locator, family: string) {
  const input = root.getByRole('combobox');
  await input.fill('');
  const group = root.getByRole('group', { name: await pickerText(page, '型号系列筛选'), exact: true });
  await activatePicker(group.getByRole('button', { name: family, exact: true }));
  await expect(group.getByRole('button', { name: family, exact: true })).toHaveAttribute('aria-pressed', 'true');
}
export async function choosePickerModel(_page: Page, root: Locator, model: string) {
  const input = root.getByRole('combobox');
  await input.fill('');
  await input.fill(model);
  await activatePicker(root.getByRole('option', { name: model, exact: true }));
  await expect(input).toHaveValue(model);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
}
export async function catalogModelInput(page: Page) {
  const label = await pickerText(page, page.url().includes('/repairs/') ? '型号' : '型号 / 商品名称');
  return page.getByRole('combobox', { name: label, exact: true });
}
export async function chooseCatalogDevice(page: Page, brand: string, family: string, model: string, input?: Locator) {
  const brandInput = input ?? page.getByRole('combobox', { name: await pickerText(page, '品牌'), exact: true });
  const brands = await openCatalogPicker(page, brandInput);
  await brandInput.fill('');
  await brandInput.fill(brand);
  await activatePicker(brands.getByRole('option', { name: brand, exact: true }));
  await expect(brandInput).toHaveValue(brand);
  await expect(brandInput).toHaveAttribute('aria-expanded', 'false');
  const models = await openCatalogPicker(page, await catalogModelInput(page));
  if (family) await choosePickerFamily(page, models, family);
  await choosePickerModel(page, models, model);
}
export async function manuallyChooseDevice(page: Page, input: Locator, model: string, brand?: string) {
  if (brand !== undefined) {
    const brandInput = page.getByRole('combobox', { name: await pickerText(page, '品牌'), exact: true });
    await openCatalogPicker(page, brandInput);
    await brandInput.fill(brand);
    await brandInput.press('Enter');
    await expect(brandInput).toHaveAttribute('aria-expanded', 'false');
    await expect(brandInput).toHaveValue(brand);
  }
  await openCatalogPicker(page, input);
  await input.fill(model);
  await input.press('Tab');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).toHaveValue(model);
}
