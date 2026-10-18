import { test, expect } from '@playwright/test';
import { activatePicker, openCatalogPicker, pickerRoot, fillCatalogQuery, isBrowsePicker } from './catalog-picker';
import { installCatalogPaintProbe, armCatalogPaintProbe, catalogPaintDiagnostics, type PickerProbe } from './catalog-paint-probe';

test('native paint observation keeps its field owner across a rebuilt menu and rejects unrelated or synthetic clicks', async ({ page }) => {
  const session = await page.request.post('/api/preview-session', { data: { email: 'demo@chinatech.local', password: 'Preview2026!' } });
  expect(session.status()).toBe(200);
  await page.goto('/app/repairs/new');
  await page.getByRole('combobox', { name: '联系电话', includeHidden: true }).fill('+393200001234');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  const form = page.locator('form.intake-form');
  const brand = form.getByRole('combobox', { name: '品牌', exact: true, includeHidden: true });
  const brands = await openCatalogPicker(page, brand);
  await fillCatalogQuery(page, brand, 'Samsung');
  await activatePicker(brands.getByRole('option', { name: 'Samsung', exact: true }));
  const model = form.getByRole('combobox', { name: '型号', exact: true, includeHidden: true });
  await openCatalogPicker(page, model);
  await fillCatalogQuery(page, model, '');
  const root = pickerRoot(model);
  const group = root.getByRole('group', { name: '型号系列筛选', exact: true });
  const all = group.getByRole('button', { name: '全部系列', exact: true });
  const family = group.getByRole('button', { name: 'Galaxy A', exact: true });
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(family).toHaveAttribute('aria-pressed', 'false');
  await installCatalogPaintProbe(page);
  await armCatalogPaintProbe(family, { tier: 'series', event: 'click', target: 'Galaxy A5 (2017)', pressed: 'Galaxy A' });
  const ownerToken = await page.evaluate(() => (window as unknown as PickerProbe).catalogArmed!.token);
  const receiptCount = async () => (await catalogPaintDiagnostics(page)).native.length;
  const rejected = async (since: number, trusted: boolean, matched: boolean) => {
    await expect.poll(async () => (await catalogPaintDiagnostics(page)).native.slice(since).find(row => row.event === 'click'))
      .toMatchObject({ token: ownerToken, trusted, matched, captured: false });
    expect((await catalogPaintDiagnostics(page)).armed?.token).toBe(ownerToken);
  };

  // This is a test-only second field: the same family label must not claim the real field's intent.
  await page.evaluate(() => {
    const foreign = document.createElement('div');
    foreign.className = 'search-combobox'; foreign.id = 'probe-unrelated-field';
    foreign.style.cssText = 'position:fixed;z-index:1000;bottom:4px;right:4px;background:white';
    foreign.innerHTML = '<input role="combobox" id="unrelated-probe-input"/><div role="group" aria-label="型号系列筛选"><button type="button" aria-pressed="false" style="min-width:90px;min-height:44px">Galaxy A</button></div>';
    document.body.append(foreign);
  });
  // Native modal focus/pointer isolation deliberately makes outside controls unreachable.
  if (await isBrowsePicker(model)) await root.locator('dialog header button').click();
  const foreignSince = await receiptCount();
  await activatePicker(page.locator('#probe-unrelated-field').getByRole('button', { name: 'Galaxy A', exact: true }));
  await rejected(foreignSince, true, false);
  expect(await page.evaluate(() => (window as unknown as PickerProbe).catalogSamples.series.length)).toBe(0);
  await expect(root.locator('.search-combobox__menu')).toHaveCount(0);

  // Opening the actual React control again creates new menu buttons under the same field owner.
  await openCatalogPicker(page, model);
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => (window as unknown as PickerProbe).catalogArmed?.source.isConnected)).toBe(false);
  const wrongSince = await receiptCount();
  await activatePicker(group.getByRole('button', { name: 'Galaxy F', exact: true }));
  await rejected(wrongSince, true, false);
  expect(await page.evaluate(() => (window as unknown as PickerProbe).catalogSamples.series.length)).toBe(0);
  await activatePicker(all);
  await expect(all).toHaveAttribute('aria-pressed', 'true');

  const syntheticSince = await receiptCount();
  await family.evaluate(element => (element as HTMLButtonElement).click());
  await rejected(syntheticSince, false, true);
  await expect(family).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => (window as unknown as PickerProbe).catalogSamples.series.length)).toBe(0);
  await activatePicker(all);
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(family).toHaveAttribute('aria-pressed', 'false');

  await activatePicker(family);
  await expect(family).toHaveAttribute('aria-pressed', 'true');
  await expect(root.getByRole('option', { name: 'Galaxy A5 (2017)', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as PickerProbe).catalogSamples.series.length)).toBe(1);
  const sample = await page.evaluate(() => (window as unknown as PickerProbe).catalogSamples.series[0]);
  const captures = (await catalogPaintDiagnostics(page)).native.filter(row => row.captured);
  expect(captures).toHaveLength(1);
  expect(captures[0]).toMatchObject({ token: ownerToken, trusted: true, matched: true, sourceConnected: false, rootConnected: true, inputMatches: true });
  expect(sample.trusted).toBe(true);
  expect(sample.event).toBe('click');
  expect(sample.start).toBeLessThanOrEqual(sample.firstVisible);
  expect(sample.firstVisible).toBeLessThanOrEqual(sample.frame1);
  expect(sample.frame1).toBeLessThanOrEqual(sample.frame2);
});
