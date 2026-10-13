import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openCatalogPicker,choosePickerFamily,choosePickerModel,pickerText } from './catalog-picker';

async function setup(page: import('@playwright/test').Page) {
  const response=await page.request.post('/api/preview-session',{data:{email:'demo@chinatech.local',password:'Preview2026!'}});expect(response.status()).toBe(200);
  const index=page.waitForResponse(response=>response.url().includes('/api/catalog?kind=picker-index')&&response.status()===200);
  await page.goto('/app/repairs/new');await index;
  await page.getByRole('combobox',{name:'联系电话'}).fill('+393200001234');await page.getByRole('button',{name:'下一步',exact:true}).click();
}

test('focus during the first index request restarts the query and opens the picker',async({page})=>{
  const session=await page.request.post('/api/preview-session',{data:{email:'demo@chinatech.local',password:'Preview2026!'}});expect(session.status()).toBe(200);
  let calls=0;let hold=true;let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/catalog?kind=picker-index*',async route=>{calls++;if(hold)await held;await route.continue().catch(()=>undefined);});
  await page.goto('/app/repairs/new');await page.getByRole('combobox',{name:'联系电话'}).waitFor();await expect.poll(()=>calls).toBeGreaterThan(0);const initialCalls=calls;
  const reloaded=page.waitForResponse(response=>response.url().includes('kind=picker-index')&&response.status()===200);
  hold=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await reloaded;release();
  await page.getByRole('combobox',{name:'联系电话'}).fill('+393200001234');await page.getByRole('button',{name:'下一步',exact:true}).click();
  const dialog=await openCatalogPicker(page,page.locator('form.intake-form').getByRole('combobox',{name:'品牌',exact:true}));
  await expect(dialog.getByRole('option',{name:'Apple',exact:true})).toBeVisible();expect(calls).toBe(initialCalls+1);
});

test('catalog chooses brand then series then model atomically and preserves values on cancellation',async({page})=>{
  await setup(page);let queries=0;page.on('request',request=>{if(request.url().includes('/api/catalog?'))queries++;});
  const outerBrand=page.locator('form.intake-form').getByRole('combobox',{name:'品牌',exact:true});const outerModel=page.locator('form.intake-form').getByRole('combobox',{name:'型号',exact:true});
  const dialog=await openCatalogPicker(page,outerBrand);await dialog.getByRole('combobox').fill('Samsung');await dialog.getByRole('option',{name:'Samsung',exact:true}).click();
  await expect(outerBrand).toHaveValue('');await expect(dialog.getByRole('combobox',{name:'系列'})).toBeVisible();await choosePickerFamily(page,dialog,'Galaxy A');await dialog.getByRole('combobox').fill('Galaxy A13');await expect(dialog.getByRole('option')).toHaveCount(3);await choosePickerModel(page,dialog,'Galaxy A13 4G (SM-A137)');
  await expect(outerBrand).toHaveValue('Samsung');await expect(outerModel).toHaveValue('Galaxy A13 4G (SM-A137)');expect(queries).toBe(0);
  const edit=await openCatalogPicker(page,outerBrand);await edit.getByRole('combobox').fill('Apple');await edit.getByRole('option',{name:'Apple',exact:true}).click();await edit.getByRole('button',{name:'取消',exact:true}).click();await expect(outerBrand).toHaveValue('Samsung');await expect(outerModel).toHaveValue('Galaxy A13 4G (SM-A137)');await expect(outerBrand).toBeFocused();
});

test('phone computer catalog shows a windowed full-series search in all three languages',async({page},info)=>{
  test.setTimeout(120000);await page.setViewportSize({width:375,height:812});await setup(page);
  const index=page.waitForResponse(response=>response.url().includes('kind=picker-index')&&response.url().includes('category=computer')&&response.status()===200);
  await page.getByLabel('设备类别').selectOption({label:'电脑'});await index;
  for(const locale of ['zh-CN','it','en']) for(const width of [1440,1024,390,375]){
    await page.setViewportSize({width,height:812});
    await page.getByLabel('语言 / Lingua / Language').selectOption(locale,{force:true});
    const outer=page.locator('form.intake-form').getByRole('combobox',{name:await pickerText(page,'品牌'),exact:true});
    const dialog=await openCatalogPicker(page,outer);await dialog.getByRole('combobox').fill('Lenovo');await dialog.getByRole('option',{name:'Lenovo',exact:true}).click();await choosePickerFamily(page,dialog,'ThinkPad');
    await expect(dialog.getByRole('option').first()).toBeVisible();expect(await dialog.getByRole('option').count()).toBeLessThanOrEqual(16);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const controls=await dialog.locator('button,input').evaluateAll(nodes=>nodes.map(node=>({height:node.getBoundingClientRect().height,font:parseFloat(getComputedStyle(node).fontSize)})).filter(row=>row.height>0));
    for(const control of controls)expect(control.height).toBeGreaterThanOrEqual(44);
    if(width<768)expect(await dialog.getByRole('combobox').evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    await dialog.getByRole('combobox').fill('ThinkPad T14 Gen 5');await expect(dialog.getByRole('option',{name:'ThinkPad T14 Gen 5 (Intel)',exact:true})).toBeVisible();
    await page.screenshot({path:'.local/device-catalog/picker-'+info.project.name+'-'+locale+'-'+width+'.png'});
    await choosePickerModel(page,dialog,'ThinkPad T14 Gen 5 (Intel)');
    await expect(page.locator('form.intake-form').getByRole('combobox',{name:await pickerText(page,'型号'),exact:true})).toHaveValue('ThinkPad T14 Gen 5 (Intel)');
  }
});

test('preloaded tier results become visible within 200ms without a new catalog request',async({page},info)=>{
  test.setTimeout(120000);await setup(page);let requests=0;page.on('request',request=>{if(request.url().includes('/api/catalog?'))requests++;});
  await page.evaluate(()=>{document.addEventListener('click',()=>{(window as unknown as {catalogClick:number}).catalogClick=performance.now();},true);});
  const samples:{brand:number[];series:number[];model:number[]}={brand:[],series:[],model:[]};
  const elapsed=()=>page.evaluate(()=>new Promise<number>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now()-(window as unknown as {catalogClick:number}).catalogClick)))));
  for(let i=0;i<30;i++){
    const dialog=await openCatalogPicker(page,page.locator('form.intake-form').getByRole('combobox',{name:'品牌',exact:true}));
    await dialog.getByRole('combobox').fill('Apple');await dialog.getByRole('option',{name:'Apple',exact:true}).click();await expect(dialog.getByRole('option',{name:'iPhone',exact:true})).toBeVisible();samples.brand.push(await elapsed());
    await dialog.getByRole('option',{name:'iPhone',exact:true}).click();await expect(dialog.getByRole('option',{name:'iPhone 18 Pro',exact:true})).toBeVisible();samples.series.push(await elapsed());
    await dialog.getByRole('option',{name:'iPhone 18 Pro',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('form.intake-form').getByRole('combobox',{name:'型号',exact:true})).toHaveValue('iPhone 18 Pro');samples.model.push(await elapsed());
  }
  const p95=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
  const results=Object.fromEntries(Object.entries(samples).map(([name,values])=>[name,{n:values.length,p95:p95(values),max:Math.max(...values)}]));
  mkdirSync('.local/device-catalog',{recursive:true});writeFileSync('.local/device-catalog/picker-performance-'+info.project.name+'.json',JSON.stringify({network:'local preview, no throttling',metric:'native click to visible result and two animation frames',samples,results,requests},null,2));
  for(const result of Object.values(results))expect(result.p95).toBeLessThanOrEqual(200);
  expect(requests).toBe(0);
});
