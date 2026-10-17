import { test, expect, type Locator, type Page, type Request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { armCatalogPaintProbe, catalogPaintDiagnostics, installCatalogPaintProbe, type PickerProbe, type PickerTier } from './catalog-paint-probe';
import { activatePicker, openCatalogPicker, chooseCatalogDevice, choosePickerFamily, choosePickerModel, pickerRoot, pickerText, manuallyChooseDevice, fillCatalogQuery, pressCatalogKey, expectCatalogValue, catalogQueryInput, confirmCatalogManual, isBrowsePicker } from './catalog-picker';

async function setup(page: Page) {
  const response = await page.request.post('/api/preview-session', { data: { email: 'demo@chinatech.local', password: 'Preview2026!' } });
  expect(response.status()).toBe(200);
  const index = page.waitForResponse(response => response.url().includes('/api/catalog?kind=picker-index') && response.status() === 200);
  await page.goto('/app/repairs/new');
  const indexResponse = await index;
  await page.getByRole('combobox', { name: '联系电话', includeHidden: true }).fill('+393200001234');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  return { response: indexResponse, data: await indexResponse.json() };
}
function repairBrand(page: Page) { return page.locator('form.intake-form').getByRole('combobox', { name: '品牌', exact: true, includeHidden: true }); }
function repairModel(page: Page) { return page.locator('form.intake-form').getByRole('combobox', { name: '型号', exact: true, includeHidden: true }); }
async function selectBrand(page: Page, input: Locator, search: string, canonical = search) {
  const root = await openCatalogPicker(page, input);
  await fillCatalogQuery(page, input, '');
  await fillCatalogQuery(page, input, search);
  await activatePicker(root.getByRole('option', { name: canonical, exact: true }));
  await expectCatalogValue(input, canonical);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  return root;
}

test('focus during the first index request restarts the query and opens independent brand candidates', async ({ page }) => {
  const session = await page.request.post('/api/preview-session', { data: { email: 'demo@chinatech.local', password: 'Preview2026!' } });
  expect(session.status()).toBe(200);
  let calls = 0, hold = true;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/catalog?kind=picker-index*', async route => { calls++; if (hold) await held; await route.continue().catch(() => undefined); });
  await page.goto('/app/repairs/new');
  await page.getByRole('combobox', { name: '联系电话', includeHidden: true }).waitFor();
  await expect.poll(() => calls).toBeGreaterThan(0);
  const initialCalls = calls;
  const reloaded = page.waitForResponse(response => response.url().includes('kind=picker-index') && response.status() === 200);
  hold = false;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await reloaded;
  release();
  await page.getByRole('combobox', { name: '联系电话', includeHidden: true }).fill('+393200001234');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  const root = await openCatalogPicker(page, repairBrand(page));
  await expect(root.getByRole('option', { name: 'Apple', exact: true })).toBeVisible();
  expect(calls).toBe(initialCalls + 1);
  await expect(page.getByRole('dialog', { name: '选择设备', exact: true })).toHaveCount(0);
});

test('directory pending belongs to the open field; background preload and closed fields stay idle', async ({ page }) => {
  const session = await page.request.post('/api/preview-session', { data: { email: 'demo@chinatech.local', password: 'Preview2026!' } });
  expect(session.status()).toBe(200);
  let release!: () => void, calls = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/catalog?kind=picker-index*', async route => { calls++; await held; await route.continue().catch(() => undefined); });
  try {
    await page.goto('/app/repairs/new');
    await page.getByRole('combobox', { name: '联系电话', includeHidden: true }).fill('+393200001234');
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    const brand = repairBrand(page), root = pickerRoot(brand);
    const toggle = await isBrowsePicker(brand) ? brand : root.getByRole('button', { name: '显示品牌候选', exact: true });
    const progress = page.locator('[data-content-progress]:visible');
    test.info().annotations.push({ type: 'shared-progress-instances', description: String(await progress.count()) });
    await expect.poll(() => calls).toBeGreaterThan(0);
    await expect(toggle).not.toHaveAttribute('aria-busy', 'true');
    if (await progress.count()) await expect(progress).toHaveAttribute('data-active', 'false');
    await brand.click();
    await expect(toggle).toHaveAttribute('aria-busy', 'true');
    await expect(toggle.locator('svg.spin')).toHaveCount(1);
    expect(await toggle.evaluate(node => getComputedStyle(node, '::before').content)).toBe('none');
    if (await progress.count()) await expect(progress).toHaveAttribute('data-active', 'true');
    await pressCatalogKey(page, brand, 'Escape');
    await expect(toggle).not.toHaveAttribute('aria-busy', 'true');
    await expect(toggle.locator('svg.spin')).toHaveCount(0);
    if (await progress.count()) await expect(progress).toHaveAttribute('data-active', 'false');
    const loaded = page.waitForResponse(response => response.url().includes('kind=picker-index') && response.status() === 200);
    release();
    await loaded;
    await brand.click();
    await expect(root.getByRole('option', { name: 'Apple', exact: true })).toBeVisible();
    await expect(toggle).not.toHaveAttribute('aria-busy', 'true');
    await expect(toggle.locator('svg.spin')).toHaveCount(0);
    if (await progress.count()) await expect(progress).toHaveAttribute('data-active', 'false');
  } finally { release(); }
});

test('brand commits independently, query Escape preserves identity and a new canonical brand clears the new model', async ({ page }) => {
  await setup(page);
  let queries = 0;
  page.on('request', request => { if (request.url().includes('/api/catalog?')) queries++; });
  const brand = repairBrand(page), model = repairModel(page);
  await selectBrand(page, brand, '三星', 'Samsung');
  await expectCatalogValue(model, '');
  await expect(model).toHaveAttribute('aria-expanded', 'false');
  const models = await openCatalogPicker(page, model);
  await fillCatalogQuery(page, model, 'A13');
  await expect(models.getByRole('option', { name: /Galaxy A13/ })).toHaveCount(3);
  await choosePickerModel(page, models, 'Galaxy A13 4G (SM-A137)');
  await openCatalogPicker(page, brand);
  await fillCatalogQuery(page, brand, 'App');
  await expectCatalogValue(model, 'Galaxy A13 4G (SM-A137)');
  await pressCatalogKey(page, brand, 'Escape');
  await expectCatalogValue(brand, 'Samsung');
  await expectCatalogValue(model, 'Galaxy A13 4G (SM-A137)');
  await expect(brand).toBeFocused();
  await selectBrand(page, brand, '三星', 'Samsung');
  await expectCatalogValue(model, 'Galaxy A13 4G (SM-A137)');
  await selectBrand(page, brand, '苹果', 'Apple');
  await expectCatalogValue(model, '');
  await expect(page.getByRole('status').filter({ hasText: '已切换品牌，请重新选择型号。' })).toBeVisible();
  await activatePicker(page.getByRole('button', { name: '撤销品牌切换', exact: true }));
  await expectCatalogValue(brand, 'Samsung'); await expectCatalogValue(model, 'Galaxy A13 4G (SM-A137)');
  await selectBrand(page, brand, 'Apple');
  await manuallyChooseDevice(page, model, '原文新型号');
  await expect(page.getByRole('button', { name: '撤销品牌切换', exact: true })).toHaveCount(0);
  expect(queries).toBe(0);
});

test('optional series browsing and cross-series model-code searches preserve all A13 hardware versions', async ({ page }) => {
  await setup(page);
  const brand = repairBrand(page), model = repairModel(page);
  await selectBrand(page, brand, 'Samsung');
  const models = await openCatalogPicker(page, model);
  await choosePickerFamily(page, models, 'Galaxy S');
  await expect(models.getByRole('option', { name: /Galaxy A13/ })).toHaveCount(0);
  await fillCatalogQuery(page, model, 'A13');
  await expect(models.getByRole('group', { name: '型号系列筛选', exact: true })).toHaveCount(0);
  for (const name of ['Galaxy A13 4G (SM-A135)', 'Galaxy A13 4G (SM-A137)', 'Galaxy A13 5G']) {
    await expect(models.getByRole('option', { name, exact: true })).toBeVisible();
  }
  await fillCatalogQuery(page, model, 'SM-A136B');
  await expect(models.getByRole('option')).toHaveCount(1);
  await expect(models.getByRole('option', { name: 'Galaxy A13 5G', exact: true })).toHaveAccessibleDescription(/5G.*SM-A136B/);
  await fillCatalogQuery(page, model, '三星 SM-A136B');
  await expect(models.getByRole('option')).toHaveCount(1);
  await expect(models.getByRole('option', { name: 'Galaxy A13 5G', exact: true })).toBeVisible();
  await activatePicker(models.getByRole('option', { name: 'Galaxy A13 5G', exact: true }));
  await expectCatalogValue(model, 'Galaxy A13 5G');
  await expect(page.getByLabel('设备类别')).toHaveValue('手机');
});

test('desktop manual keys and blur commit; mobile explicit manual confirmation and dismissal preserve raw facts', async ({ page }) => {
  await setup(page);
  const brand = repairBrand(page), model = repairModel(page);
  const brands = await openCatalogPicker(page, brand);
  await fillCatalogQuery(page, brand, 'App');
  await pressCatalogKey(page, brand, 'ArrowDown');
  await (await catalogQueryInput(page, brand)).dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229 });
  await expect(await catalogQueryInput(page, brand)).toHaveValue('App');
  await expect(brand).toHaveAttribute('aria-expanded', 'true');
  await expect(brands.getByRole('option', { name: 'Apple', exact: true })).toBeVisible();
  await pressCatalogKey(page, brand, 'Escape');
  await expectCatalogValue(brand, '');
  await openCatalogPicker(page, brand);
  await fillCatalogQuery(page, brand, '手填原文品牌');
  await confirmCatalogManual(page, brand);
  await expectCatalogValue(brand, '手填原文品牌');
  await expect(brand).toHaveAttribute('aria-expanded', 'false');
  await manuallyChooseDevice(page, model, '原文型号 Tab');
  await openCatalogPicker(page, model);
  await fillCatalogQuery(page, model, '未确认查询');
  await pressCatalogKey(page, model, 'Escape');
  await expectCatalogValue(model, '原文型号 Tab');
  await openCatalogPicker(page, model);
  await fillCatalogQuery(page, model, '原文型号 blur');
  if (await isBrowsePicker(model)) await pressCatalogKey(page, model, 'Escape');
  else await activatePicker(page.getByRole('heading', { name: '送修设备', exact: true }));
  await expectCatalogValue(model, await isBrowsePicker(model) ? '原文型号 Tab' : '原文型号 blur');
  await expect(model).toHaveAttribute('aria-expanded', 'false');
  await openCatalogPicker(page, model);
  await fillCatalogQuery(page, model, '原文型号 Enter');
  await confirmCatalogManual(page, model);
  await expectCatalogValue(model, '原文型号 Enter');
  await expect(model).toHaveAttribute('aria-expanded', 'false');
});

test('computer candidates stay windowed and anchored in all three languages at four widths', async ({ page }, info) => {
  test.setTimeout(120000);
  await setup(page);
  const index = page.waitForResponse(response => response.url().includes('kind=picker-index') && response.url().includes('category=computer') && response.status() === 200);
  await page.getByLabel('设备类别').selectOption({ label: '电脑' });
  await index;
  for (const locale of ['zh-CN', 'it', 'en']) for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await page.getByLabel('语言 / Lingua / Language').selectOption(locale, { force: true });
    const brand = page.locator('form.intake-form').getByRole('combobox', { name: await pickerText(page, '品牌'), exact: true, includeHidden: true });
    await selectBrand(page, brand, 'Lenovo');
    const model = page.locator('form.intake-form').getByRole('combobox', { name: await pickerText(page, '型号'), exact: true, includeHidden: true });
    const root = await openCatalogPicker(page, model);
    await choosePickerFamily(page, root, 'ThinkPad');
    await expect(root.getByRole('option').first()).toBeVisible();
    expect(await root.getByRole('option').count()).toBeLessThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const controls = await root.locator('button,input').evaluateAll(nodes => nodes.map(node => ({ height: node.getBoundingClientRect().height, font: parseFloat(getComputedStyle(node).fontSize) })).filter(row => row.height > 0));
    for (const control of controls) expect(control.height).toBeGreaterThanOrEqual(44);
    if (width < 768) expect(await model.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    const box = (await root.locator('.search-combobox__menu').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(812);
    await fillCatalogQuery(page, model, 'ThinkPad T14 Gen 5');
    await expect(root.getByRole('option', { name: 'ThinkPad T14 Gen 5 (Intel)', exact: true })).toBeVisible();
    await page.screenshot({ path: '.local/device-catalog/separated-' + info.project.name + '-' + locale + '-' + width + '.png' });
    await choosePickerModel(page, root, 'ThinkPad T14 Gen 5 (Intel)');
    await expectCatalogValue(model, 'ThinkPad T14 Gen 5 (Intel)');
  }
});

type AuthorizationTick = { timerId: number; sequence: number; registeredAt: number; at: number };
type AuthorizationProbe = { catalogAuthorizationTimers: { id: number; registeredAt: number }[]; catalogAuthorizationTicks: AuthorizationTick[] };

test('preloaded independent choices paint within 200ms with zero new-data GETs and only verified native authorization ticks', async ({ page }, info) => {
  test.setTimeout(120000);
  // Observe the actual catalog interval without moving Date, performance or RAF.
  await page.addInitScript(() => {
    const probe = window as unknown as AuthorizationProbe;
    probe.catalogAuthorizationTimers = []; probe.catalogAuthorizationTicks = [];
    const nativeInterval = window.setInterval.bind(window);
    let sequence = 0;
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout !== 30000 || typeof handler !== 'function' || handler.name !== 'revalidate') return nativeInterval(handler, timeout, ...args);
      const registeredAt = Date.now(); let timerId = 0;
      timerId = nativeInterval(function(this: unknown, ...values: unknown[]) {
        probe.catalogAuthorizationTicks.push({ timerId, sequence: ++sequence, registeredAt, at: Date.now() });
        return Reflect.apply(handler, this, values);
      }, timeout, ...args);
      probe.catalogAuthorizationTimers.push({ id: timerId, registeredAt });
      return timerId;
    }) as typeof window.setInterval;
  });
  const observationStarted = Date.now(); const warmed = await setup(page);
  expect(warmed.data.revision).toBe('seed'); expect(warmed.data.complete).toBe(true);
  const currentScope = [1, warmed.data.scope.accountId, warmed.data.scope.sessionId, warmed.data.scope.storeId, warmed.data.scope.memberId, warmed.data.scope.memberRevision];
  expect(currentScope).toEqual([1, 'preview', 'preview', 'preview', 'preview', 0]);
  expect((await page.evaluate(() => (window as unknown as AuthorizationProbe).catalogAuthorizationTimers)).length).toBeGreaterThan(0);
  const requests: Request[] = [];
  const observe = (request: Request) => { if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/catalog') requests.push(request); };
  page.on('request', observe);
  await installCatalogPaintProbe(page);
  const arm = armCatalogPaintProbe;
  const recorded = async (tier: PickerTier, n: number) => {
    try { await expect.poll(() => page.evaluate(value => (window as unknown as PickerProbe).catalogSamples[value].length, tier)).toBe(n); }
    catch (reason) { const diagnostics = JSON.stringify(await catalogPaintDiagnostics(page), null, 2); mkdirSync(info.outputDir, { recursive: true }); writeFileSync(info.outputPath('catalog-paint-diagnostic.json'), diagnostics); await info.attach('catalog-paint-diagnostic', { body: diagnostics, contentType: 'application/json' }); throw reason; }
  };
  const brand = repairBrand(page), model = repairModel(page);
  for (let i = 0; i < 30; i++) {
    await brand.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await arm(brand, { tier: 'brand', event: 'pointerdown', target: 'Apple' });
    await activatePicker(brand);
    await recorded('brand', i + 1);
    if (i === 0) {
      await fillCatalogQuery(page, brand, 'Samsung');
      await activatePicker(pickerRoot(brand).getByRole('option', { name: 'Samsung', exact: true }));
    } else await pressCatalogKey(page, brand, 'Escape');
    const root = await openCatalogPicker(page, model);
    await fillCatalogQuery(page, model, '');
    const group = root.getByRole('group', { name: '型号系列筛选', exact: true });
    await activatePicker(group.getByRole('button', { name: '全部系列', exact: true }));
    const family = group.getByRole('button', { name: 'Galaxy A', exact: true });
    await expect(group.getByRole('button', { name: '全部系列', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(family).toHaveAttribute('aria-pressed', 'false');
    await arm(family, { tier: 'series', event: 'click', target: 'Galaxy A5 (2017)', pressed: 'Galaxy A' });
    await activatePicker(family);
    await recorded('series', i + 1);
    await fillCatalogQuery(page, model, '');
    await (await catalogQueryInput(page, model)).focus();
    await arm(await catalogQueryInput(page, model), { tier: 'model', event: 'input', target: 'Galaxy A13 4G (SM-A137)', count: 3, query: 'A13' });
    await page.keyboard.insertText('A13');
    await recorded('model', i + 1);
    await activatePicker(root.getByRole('option', { name: 'Galaxy A13 4G (SM-A137)', exact: true }));
    await expectCatalogValue(model, 'Galaxy A13 4G (SM-A137)');
    await expect(model).toHaveAttribute('aria-expanded', 'false');
  }
  const points = await page.evaluate(() => (window as unknown as PickerProbe).catalogSamples);
  const samples = Object.fromEntries(Object.entries(points).map(([tier, values]) => [tier, values.map(value => value.ms)]));
  const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
  const results = Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, { n: values.length, p95: p95(values), max: Math.max(...values) }]));
  await expect.poll(() => requests.filter(request => new URL(request.url()).searchParams.has('knownRevision')).length, { timeout: 45000 }).toBeGreaterThanOrEqual(1);
  let newDataRequests = 0;
  const authorizationChecks = [];
  for (let index = 0; index < requests.length; index++) {
    const request = requests[index], url = new URL(request.url());
    if (!url.searchParams.has('knownRevision')) { newDataRequests++; continue; }
    expect([...url.searchParams.entries()].sort()).toEqual([['category', warmed.data.category], ['kind', 'picker-index'], ['knownRevision', 'seed']].sort());
    const requestScope = JSON.parse(request.headers()['x-ct-catalog-scope']); expect(requestScope).toEqual(currentScope);
    const response = await request.response(); expect(response).not.toBeNull(); expect(response!.status()).toBe(200);
    const body = await response!.json();
    expect(body.unchanged).toBe(true); expect(body.revision).toBe('seed'); expect(body.scope).toEqual(warmed.data.scope);
    expect(body.formatVersion).toBe(1); expect(body.category).toBe(warmed.data.category); expect(body.brand).toBe(''); expect(body.family).toBe('');
    authorizationChecks.push({ url: url.pathname + url.search, requestScope, status: response!.status(), revision: body.revision, unchanged: body.unchanged, startedAt: request.timing().startTime });
  }
  page.off('request', observe);
  const nativeAuthorization = await page.evaluate(() => ({ timers: (window as unknown as AuthorizationProbe).catalogAuthorizationTimers, ticks: (window as unknown as AuthorizationProbe).catalogAuthorizationTicks }));
  const consumedTicks = new Set<number>();
  for (const check of authorizationChecks) {
    const tick = nativeAuthorization.ticks.find(tick => !consumedTicks.has(tick.sequence) && check.startedAt >= tick.at && check.startedAt - tick.at <= 1000);
    expect(tick, 'Each authorization GET must consume one real 30-second catalog tick; clicks cannot create extras').toBeDefined();
    expect(tick!.at - tick!.registeredAt).toBeGreaterThanOrEqual(29500);
    consumedTicks.add(tick!.sequence);
  }
  expect(consumedTicks.size).toBe(authorizationChecks.length);
  const observationWindowMs = Date.now() - observationStarted; expect(observationWindowMs).toBeGreaterThanOrEqual(30000);
  const paintDiagnostics = await catalogPaintDiagnostics(page);
  const evidence = JSON.stringify({ paintDiagnostics, network: 'local preview, no throttling', metric: 'browser-native trusted pointerdown/click/input to unobscured visible target retained across two native animation frames; excludes test RPC tail', points, samples, results, requests: requests.length, newDataRequests, authorizationChecks, nativeAuthorization, observationWindowMs }, null, 2);
  mkdirSync('.local/device-catalog', { recursive: true });
  writeFileSync('.local/device-catalog/separated-performance-' + info.project.name + '.json', evidence);
  await info.attach('catalog-native-performance', { body: evidence, contentType: 'application/json' });
  for (const [tier, values] of Object.entries(points)) {
    expect(values).toHaveLength(30);
    for (const value of values) { expect(value.trusted).toBe(true); expect(value.start).toBeLessThanOrEqual(value.firstVisible); expect(value.firstVisible).toBeLessThanOrEqual(value.frame1); expect(value.frame1).toBeLessThanOrEqual(value.frame2); const receipts = paintDiagnostics.native.filter(receipt => receipt.captured && receipt.token === value.token); expect(receipts).toHaveLength(1); expect(receipts[0].trusted).toBe(true); expect(receipts[0].tier).toBe(tier); expect(receipts[0].at).toBe(value.start); }
  }
  for (const result of Object.values(results)) expect(result.p95).toBeLessThanOrEqual(200);
  expect(newDataRequests).toBe(0);
  expect(authorizationChecks).toHaveLength(requests.length);
});

test('periodic authorization reuses the version and clears independent candidates after denial', async ({ page }) => {
  await page.clock.install();
  await setup(page);
  let requests = 0;
  page.on('request', request => { if (request.url().includes('/api/catalog?kind=picker-index')) requests++; });
  const checked = page.waitForResponse(response => response.url().includes('kind=picker-index') && new URL(response.url()).searchParams.get('knownRevision') === 'seed');
  await page.clock.fastForward(30000);
  const response = await checked;
  expect(response.status()).toBe(200); expect((await response.json()).unchanged).toBe(true);
  expect(JSON.parse(response.request().headers()['x-ct-catalog-scope'])).toEqual([1, 'preview', 'preview', 'preview', 'preview', 0]);
  const root = await openCatalogPicker(page, repairBrand(page));
  await expect(root.getByRole('option', { name: 'Apple', exact: true })).toBeVisible(); expect(requests).toBe(1);
  await page.route('**/api/catalog?kind=picker-index*', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: '请先登录后查看设备目录。' }) }));
  const denied = page.waitForResponse(response => response.url().includes('kind=picker-index') && response.status() === 401);
  await page.clock.fastForward(30000); await denied;
  await expect(root.getByRole('alert')).toContainText('请先登录后查看设备目录。');
  await expect(root.getByRole('option', { name: 'Apple', exact: true })).toHaveCount(0); expect(requests).toBe(2);
  await page.clock.fastForward(30000); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(root.getByRole('alert')).toContainText('请先登录后查看设备目录。'); expect(requests).toBe(2);
});

test('loading failures preserve raw queries and permit manual confirmation without reporting no match', async ({ page }) => {
  await setup(page);
  const brand = repairBrand(page), model = repairModel(page);
  await selectBrand(page, brand, 'Apple');
  const root = await openCatalogPicker(page, model);
  await fillCatalogQuery(page, model, '原文 网络失败');
  await page.route('**/api/catalog?kind=picker-index*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '设备目录暂不可用，请稍后重试。' }) }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(root.getByRole('alert')).toContainText('设备目录暂不可用');
  await expect(await catalogQueryInput(page, model)).toHaveValue('原文 网络失败');
  await expect(root.getByRole('status').filter({ hasText: '没有匹配' })).toHaveCount(0);
  await confirmCatalogManual(page, model);
  await expectCatalogValue(model, '原文 网络失败');
  await expect(model).toHaveAttribute('aria-expanded', 'false');
});

test('historical raw models require the separate store-original area and keep their bytes across languages', async ({ page }) => {
  const login = await page.request.post('/api/preview-session', { data: { email: 'demo@chinatech.local', password: 'Preview2026!' } }); expect(login.status()).toBe(200);
  await page.goto('/app/retail/new'); await page.getByRole('radio', { name: '新机', exact: true }).locator('..').click();
  const raw = 'Galaxy A13 legacy-original';
  await manuallyChooseDevice(page, page.getByRole('combobox', { name: '型号 / 商品名称', exact: true, includeHidden: true }), raw, 'Samsung');
  await page.getByRole('checkbox', { name: /我确认这是门店自有/ }).check(); await page.getByRole('button', { name: '创建独立档案', exact: true }).click(); await page.waitForURL('**/app/retail/units/**');
  await page.reload(); await expect(page.getByRole('region', { name: '单机摘要', exact: true })).toContainText(raw);
  await page.goto('/app/retail/new'); await page.getByRole('radio', { name: '新机', exact: true }).locator('..').click();
  await selectBrand(page, page.getByRole('combobox', { name: '品牌', exact: true, includeHidden: true }), 'Samsung');
  const model = page.getByRole('combobox', { name: '型号 / 商品名称', exact: true, includeHidden: true });
  const root = await openCatalogPicker(page, model); await choosePickerFamily(page, root, 'Galaxy S'); await fillCatalogQuery(page, model, raw);
  await expect(root.getByRole('option', { name: raw, exact: true })).toHaveCount(0);
  await activatePicker(root.getByRole('button', { name: '门店原文', exact: true }));
  const historical = root.getByRole('option', { name: raw, exact: true });
  await expect(historical).toBeVisible(); await expect(historical).toHaveAccessibleDescription('门店原文 · 实物仍须核对');
  await activatePicker(historical);
  for (const locale of ['it', 'en', 'zh-CN']) { await page.getByLabel('语言 / Lingua / Language').selectOption(locale, { force: true }); await expect(page.getByRole('combobox', { name: await pickerText(page, '型号 / 商品名称'), exact: true, includeHidden: true })).toHaveValue(raw); }
});

test('existing single-field brand correction preserves its model and cancel creates no history', async ({ page }) => {
  const login = await page.request.post('/api/preview-session', { data: { email: 'demo@chinatech.local', password: 'Preview2026!' } }); expect(login.status()).toBe(200);
  await page.goto('/app/retail/new'); await page.getByRole('radio', { name: '新机', exact: true }).locator('..').click();
  await chooseCatalogDevice(page, 'Samsung', '', 'Galaxy A13 4G (SM-A137)');
  await page.getByRole('checkbox', { name: /我确认这是门店自有/ }).check(); await page.getByRole('button', { name: '创建独立档案', exact: true }).click(); await page.waitForURL('**/app/retail/units/**');
  const createdId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
  const before = await page.evaluate(() => localStorage.getItem('chinatech.m1.retail.v1'));
  await page.getByRole('button', { name: '编辑品牌', exact: true }).click();
  let editor = page.getByRole('region', { name: '编辑品牌', exact: true });
  await selectBrand(page, editor.getByRole('combobox', { name: '品牌', exact: true, includeHidden: true }), 'Apple');
  await editor.getByRole('button', { name: '取消', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('chinatech.m1.retail.v1'))).toBe(before);
  await page.getByRole('button', { name: '编辑品牌', exact: true }).click(); editor = page.getByRole('region', { name: '编辑品牌', exact: true });
  await selectBrand(page, editor.getByRole('combobox', { name: '品牌', exact: true, includeHidden: true }), 'Apple');
  await editor.getByRole('button', { name: '继续确认', exact: true }).click(); await editor.getByRole('button', { name: '确认保存', exact: true }).click();
  await expect(editor).toHaveCount(0); await page.reload();
  const unit = await page.evaluate(id => JSON.parse(localStorage.getItem('chinatech.m1.retail.v1')!).units.find((row: { id: string }) => row.id === id), createdId);
  expect(unit.brand).toBe('Apple'); expect(unit.model).toBe('Galaxy A13 4G (SM-A137)');
  expect(unit.events.at(-1).title).toBe('更正品牌');
  await page.getByRole('button', { name: '编辑型号 / 商品名称', exact: true }).click();
  const modelEditor = page.getByRole('region', { name: '编辑型号 / 商品名称', exact: true });
  const modelInput = modelEditor.getByRole('combobox', { name: '型号 / 商品名称', exact: true, includeHidden: true });
  const models = await openCatalogPicker(page, modelInput);
  await choosePickerModel(page, models, 'iPhone 16');
  await modelEditor.getByRole('button', { name: '继续确认', exact: true }).click();
  await modelEditor.getByRole('button', { name: '确认保存', exact: true }).click();
  await expect(modelEditor).toHaveCount(0); await page.reload();
  const corrected = await page.evaluate(id => JSON.parse(localStorage.getItem('chinatech.m1.retail.v1')!).units.find((row: { id: string }) => row.id === id), createdId);
  expect(corrected.brand).toBe('Apple'); expect(corrected.model).toBe('iPhone 16');
  expect(corrected.events.length).toBe(unit.events.length + 1);
});

test('identity queries preserve a pending signature but a confirmed brand switch and undo require a fresh signature', async ({ page }) => {
  await setup(page);
  await chooseCatalogDevice(page, 'Apple', '', 'iPhone 16');
  await activatePicker(page.getByRole('button', { name: '下一步', exact: true }));
  await activatePicker(page.getByRole('button', { name: '屏幕', exact: true }));
  await activatePicker(page.getByRole('button', { name: '下一步', exact: true }));
  await activatePicker(page.getByRole('button', { name: '客户签字', exact: true }));
  const signature = page.getByRole('region', { name: '客户签字', exact: true });
  await signature.getByLabel('签署阅读语言', { exact: true }).selectOption('zh');
  const pad = signature.getByRole('application', { name: '客户手写签字区域', exact: true });
  await pad.focus(); await pad.press('Space');
  for (let i = 0; i < 5; i++) await pad.press('ArrowRight');
  await pad.press('Space');
  await signature.getByRole('checkbox', { name: '已核对接机资料并阅读所显示条款。', exact: true }).check();
  await activatePicker(signature.getByRole('button', { name: '确认签名', exact: true }));
  await expect(page.getByRole('img', { name: '待保存客户签名', exact: true })).toBeVisible();
  await activatePicker(page.getByRole('button', { name: '修改设备', exact: true }));
  const brand = repairBrand(page);
  await openCatalogPicker(page, brand); await fillCatalogQuery(page, brand, 'Samsung'); await pressCatalogKey(page, brand, 'Escape');
  await activatePicker(page.getByRole('button', { name: '下一步', exact: true }));
  await activatePicker(page.getByRole('button', { name: '下一步', exact: true }));
  await expect(page.getByRole('img', { name: '待保存客户签名', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: /已与客户核对接机信息/ }).check();
  await activatePicker(page.getByRole('button', { name: '修改设备', exact: true }));
  await selectBrand(page, brand, 'Samsung');
  await activatePicker(page.getByRole('button', { name: '撤销品牌切换', exact: true }));
  await expectCatalogValue(brand, 'Apple'); await expectCatalogValue(repairModel(page), 'iPhone 16');
  await activatePicker(page.getByRole('button', { name: '下一步', exact: true }));
  await activatePicker(page.getByRole('button', { name: '下一步', exact: true }));
  await expect(page.getByRole('img', { name: '待保存客户签名', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '客户签字', exact: true })).toBeEnabled();
  await expect(page.getByRole('checkbox', { name: /已与客户核对接机信息/ })).not.toBeChecked();
});
