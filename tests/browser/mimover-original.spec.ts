import {test,expect} from '@playwright/test';
import {mimoverOriginalRelease as release} from '../../lib/toolbox/mimover-original-release';
import {clonephoneRelease as currentRelease} from '../../lib/toolbox/clonephone-release';
import {translate} from '../../lib/i18n/translate';
for(const locale of ['zh-CN','it','en'] as const)for(const width of [1440,1024,390,375])test(`retired Mi Mover bookmark keeps only the current download ${locale} ${width}`,async({page,request})=>{
 await page.addInitScript(value=>localStorage.setItem('chinatech.language',value),locale);await page.setViewportSize({width,height:900});await page.goto('/toolbox/transfer#mimover-original');
 await expect(page.getByRole('heading',{level:1,name:translate('手机搬家',locale),exact:true})).toBeVisible();await expect(page.locator('#mimover-original')).toHaveCount(0);
 const current=page.locator('a[href$=".apk"]');await expect(current).toHaveCount(1);await expect(current).toHaveAttribute('href',currentRelease.apkPath);await expect(current).toHaveAttribute('download',currentRelease.filename);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const response=await request.get(release.apkPath);expect(response.status()).toBe(410);
});
test('retired packages stay unavailable without JavaScript',async({browser,baseURL})=>{const context=await browser.newContext({javaScriptEnabled:false});try{const page=await context.newPage();await page.goto(baseURL+'/toolbox/transfer#mimover-original');await expect(page.locator('#mimover-original')).toHaveCount(0);await expect(page.locator('a[href$=".apk"]')).toHaveCount(1);await expect(page.locator('a[href$=".apk"]')).toHaveAttribute('href',currentRelease.apkPath);expect((await context.request.get(release.apkPath)).status()).toBe(410);}finally{await context.close();}});
