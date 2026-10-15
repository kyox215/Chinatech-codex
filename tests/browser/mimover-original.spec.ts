import {test,expect} from '@playwright/test';
import {mimoverOriginalRelease as release} from '../../lib/toolbox/mimover-original-release';
import {translate} from '../../lib/i18n/translate';
for(const locale of ['zh-CN','it','en'] as const)for(const width of [1440,1024,390,375])test(`Mi Mover gated download ${locale} ${width}`,async({page,request})=>{
 await page.addInitScript(value=>localStorage.setItem('chinatech.language',value),locale);await page.setViewportSize({width,height:900});await page.goto('/toolbox/transfer#mimover-original');
 const card=page.locator('#mimover-original');await expect(card.getByRole('status')).toHaveText(translate('版本校验接入中，下载暂未开放。',locale));await expect(card.locator('a')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const response=await request.get(release.apkPath);expect(response.status()).toBe(410);
});
test('retired packages stay unavailable without JavaScript',async({browser,baseURL})=>{const context=await browser.newContext({javaScriptEnabled:false});try{const page=await context.newPage();await page.goto(baseURL+'/toolbox/transfer');await expect(page.locator('#mimover-original a[download]')).toHaveCount(0);expect((await context.request.get(release.apkPath)).status()).toBe(410);}finally{await context.close();}});
