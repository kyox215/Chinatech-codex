import {test, expect} from '@playwright/test';
import {retailUnits} from '../../lib/retail-fixtures';
import {measureHeadingLayout} from './heading-layout';

const cases = [
  {label: '同型号新建', route: `/app/retail/units/${retailUnits[1].id}`, target: `/app/retail/new?copy=${retailUnits[1].id}`, request: '**/app/retail/new?*'},
  {label: '关联工单', route: '/app/procurement/PO-2026-0101', target: '/app/repairs/CT-2026-0929', request: '**/app/repairs/CT-2026-0929?*'},
];

for (const item of cases) test(`手机页头${item.label}保留图标并在真实导航等待时原位显示单圈`, async ({page}, info) => {
  await page.request.post('/api/preview-session', {data: {email: 'demo@chinatech.local', password: 'Preview2026!'}});
  await page.setViewportSize({width: 375, height: 900});
  await page.goto(item.route);
  const action = page.getByRole('link', {name: item.label, exact: true});
  const slot = action.locator('.navigation-feedback');
  const icon = slot.locator('.navigation-feedback__icon');
  await expect(action).toBeVisible();
  await expect(slot).toBeVisible();
  await expect(icon.locator('svg')).toBeVisible();
  await expect(slot.locator('.spin')).not.toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const proof = `.local/ui-feedback/previews/mobile-toolbar-${info.project.name}-${item.label === '同型号新建' ? 'copy' : 'repair'}`;
  await page.screenshot({path: `${proof}-idle.png`, animations: 'disabled'});
  const {a: before, runningFinite: idleFinite} = await measureHeadingLayout(page, action);
  expect(idleFinite).toBe(0);
  const title = await page.locator('.module-title h2').innerText();
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route(item.request, async route => {
    if (route.request().headers()['rsc'] === '1') await gate;
    await route.continue();
  });
  try {
    await action.click();
    await expect(slot).toHaveAttribute('data-pending', 'true');
    await expect(slot).toBeVisible();
    await expect(slot.locator('.spin')).toBeVisible();
    await expect(slot.locator('.spin:visible')).toHaveCount(1);
    await expect(icon).not.toBeVisible();
    await expect(page.locator('.module-title h2')).toHaveText(title);
    await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
    const {a: pending, runningFinite: pendingFinite} = await measureHeadingLayout(page, action);
    expect(pendingFinite).toBe(0);
    expect(before).not.toBeNull(); expect(pending).not.toBeNull();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before![key] - pending![key])).toBeLessThan(0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `${proof}-pending.png`, animations: 'disabled'});
  } finally {release();}
  await expect(page).toHaveURL(`http://127.0.0.1:3121${item.target}`);
  await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(0);
});
