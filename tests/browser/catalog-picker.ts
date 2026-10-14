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
export async function openCatalogPicker(page: Page, outer: Locator) {
  await expect(outer).toHaveAttribute('readonly', '');
  await activatePicker(outer);
  const dialog = page.getByRole('dialog', { name: await pickerText(page, '选择设备'), exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
export async function choosePickerFamily(page: Page, dialog: Locator, family: string) {
  const search = dialog.getByRole('combobox');
  await search.fill(family);
  await activatePicker(dialog.getByRole('option', { name: family, exact: true }));
}
export async function choosePickerModel(page: Page, dialog: Locator, model: string) {
  await dialog.getByRole('combobox').fill(model);
  await activatePicker(dialog.getByRole('option', { name: model, exact: true }));
  await expect(dialog).not.toBeVisible();
}
export async function chooseCatalogDevice(page: Page, brand: string, family: string, model: string, outer = page.getByRole('combobox', { name: '品牌', exact: true })) {
  const dialog = await openCatalogPicker(page, outer);
  await dialog.getByRole('combobox').fill(brand);
  await activatePicker(dialog.getByRole('option', { name: brand, exact: true }));
  await choosePickerFamily(page, dialog, family);
  await choosePickerModel(page, dialog, model);
}
export async function manuallyChooseDevice(page: Page, outer: Locator, model: string, brand?: string) {
  const dialog = await openCatalogPicker(page, outer);
  const unrecorded = dialog.getByRole('button', { name: await pickerText(page, '品牌未记录'), exact: true });
  if (await unrecorded.count()) {
    if (brand) {
      await dialog.getByRole('combobox').fill(brand);
      await activatePicker(dialog.getByRole('button', { name: await pickerText(page, '使用手填品牌'), exact: true }));
    } else await activatePicker(unrecorded);
  }
  await activatePicker(dialog.getByRole('button', { name: await pickerText(page, '未收录系列 / 手动填写'), exact: true }));
  const commit = dialog.getByRole('button', { name: await pickerText(page, '使用手填型号'), exact: true });
  await expect(commit).toBeVisible();
  await dialog.getByRole('combobox').fill(model);
  await activatePicker(commit);
  await expect(dialog).not.toBeVisible();
  await expect(outer).toHaveValue(model);
}
