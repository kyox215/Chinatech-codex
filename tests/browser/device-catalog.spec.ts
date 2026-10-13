import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openCatalogPicker,choosePickerFamily,choosePickerModel,pickerText,manuallyChooseDevice } from './catalog-picker';

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

type PickerTier='brand'|'series'|'model';
type PickerPaint={start:number;firstVisible:number;frame1:number;frame2:number;ms:number;trusted:boolean};
type PickerProbe={catalogArmed:PickerTier|null;catalogPanel:HTMLDialogElement|null;catalogSamples:Record<PickerTier,PickerPaint[]>};

test('preloaded tier results become visible within 200ms without a new catalog request',async({page},info)=>{
  test.setTimeout(120000);await setup(page);let requests=0;page.on('request',request=>{if(request.url().includes('/api/catalog?'))requests++;});
  await page.evaluate(()=>{
    const probe=window as unknown as PickerProbe;probe.catalogArmed=null;probe.catalogPanel=null;probe.catalogSamples={brand:[],series:[],model:[]};
    const visible=(element:HTMLElement|null)=>{
      if(!element)return false;const rect=element.getBoundingClientRect();const topLayer=element.closest('dialog[open]');
      if(rect.width<=0||rect.height<=0||rect.bottom<=0||rect.top>=innerHeight||rect.right<=0||rect.left>=innerWidth)return false;
      // Native top-layer dialogs escape body/ancestor overflow clipping.
      for(let parent:HTMLElement|null=element;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;const clip=parent.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowY)&&(rect.bottom<=clip.top||rect.top>=clip.bottom))return false;if(/auto|scroll|hidden|clip/.test(style.overflowX)&&(rect.right<=clip.left||rect.left>=clip.right))return false;if(parent===topLayer)break;}
      return true;
    };
    document.addEventListener('click',event=>{
      const tier=probe.catalogArmed;const panel=probe.catalogPanel;const button=event.target instanceof Element?event.target.closest('button[role="option"]'):null;
      if(!tier||!panel||!panel.open||!event.isTrusted||button?.closest('dialog')!==panel||button?.getAttribute('aria-label')!==({brand:'Apple',series:'iPhone',model:'iPhone 18 Pro'}[tier]))return;
      probe.catalogArmed=null;const start=performance.now();let firstVisible:number|undefined;let painting=false;let done=false;let poll=0;
      const condition=()=>{if(tier!=='model')return panel.open&&panel.isConnected&&visible(panel.querySelector<HTMLElement>('[role="option"][aria-label="'+(tier==='brand'?'iPhone':'iPhone 18 Pro')+'"]'));const input=document.querySelector<HTMLInputElement>('form.intake-form input[aria-label="型号"]');return (!panel.open||!panel.isConnected)&&input?.value==='iPhone 18 Pro'&&visible(input);};
      const queue=()=>{if(!poll&&!done)poll=requestAnimationFrame(()=>{poll=0;check();});};
      const check=()=>{if(done||painting)return;if(!condition()){queue();return;}firstVisible??=performance.now();painting=true;requestAnimationFrame(()=>{if(!condition()){painting=false;queue();return;}const frame1=performance.now();requestAnimationFrame(()=>{if(!condition()){painting=false;queue();return;}const frame2=performance.now();done=true;observer.disconnect();cancelAnimationFrame(poll);probe.catalogSamples[tier].push({start,firstVisible:firstVisible!,frame1,frame2,ms:frame2-start,trusted:event.isTrusted});});});};
      const observer=new MutationObserver(check);observer.observe(document,{subtree:true,childList:true,attributes:true});check();
    },true);
  });
  const arm=(tier:PickerTier)=>page.getByRole('dialog',{name:'选择设备',exact:true}).evaluate((element,value)=>{if(!(element instanceof HTMLDialogElement)||!element.open)throw new Error('Sampler requires the current open native picker');const probe=window as unknown as PickerProbe;probe.catalogPanel=element;probe.catalogArmed=value;},tier);
  const recorded=(tier:PickerTier,n:number)=>expect.poll(()=>page.evaluate(value=>(window as unknown as PickerProbe).catalogSamples[value].length,tier)).toBe(n);
  for(let i=0;i<30;i++){
    const dialog=await openCatalogPicker(page,page.locator('form.intake-form').getByRole('combobox',{name:'品牌',exact:true}));
    await dialog.getByRole('combobox').fill('Apple');await arm('brand');await dialog.getByRole('option',{name:'Apple',exact:true}).click();await expect(dialog.getByRole('option',{name:'iPhone',exact:true})).toBeVisible();await recorded('brand',i+1);
    await arm('series');await dialog.getByRole('option',{name:'iPhone',exact:true}).click();await expect(dialog.getByRole('option',{name:'iPhone 18 Pro',exact:true})).toBeVisible();await recorded('series',i+1);
    await arm('model');await dialog.getByRole('option',{name:'iPhone 18 Pro',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('form.intake-form').getByRole('combobox',{name:'型号',exact:true})).toHaveValue('iPhone 18 Pro');await recorded('model',i+1);
  }
  const points=await page.evaluate(()=>(window as unknown as PickerProbe).catalogSamples);
  const samples=Object.fromEntries(Object.entries(points).map(([tier,values])=>[tier,values.map(value=>value.ms)]));
  const p95=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
  const results=Object.fromEntries(Object.entries(samples).map(([name,values])=>[name,{n:values.length,p95:p95(values),max:Math.max(...values)}]));
  const evidence=JSON.stringify({network:'local preview, no throttling',metric:'browser-native trusted click to visible target retained across two native animation frames; excludes test RPC tail',points,samples,results,requests},null,2);
  mkdirSync('.local/device-catalog',{recursive:true});writeFileSync('.local/device-catalog/picker-performance-'+info.project.name+'.json',evidence);await info.attach('catalog-native-performance',{body:evidence,contentType:'application/json'});
  for(const values of Object.values(points)){expect(values).toHaveLength(30);for(const value of values){expect(value.trusted).toBe(true);expect(value.start).toBeLessThanOrEqual(value.firstVisible);expect(value.firstVisible).toBeLessThanOrEqual(value.frame1);expect(value.frame1).toBeLessThanOrEqual(value.frame2);}}
  for(const result of Object.values(results))expect(result.p95).toBeLessThanOrEqual(200);
  expect(requests).toBe(0);
});

test('periodic authorization reuses the version and clears candidates after denial',async({page})=>{
  await page.clock.install();await setup(page);let requests=0;page.on('request',request=>{if(request.url().includes('/api/catalog?kind=picker-index'))requests++;});
  const checked=page.waitForResponse(response=>response.url().includes('kind=picker-index')&&new URL(response.url()).searchParams.get('knownRevision')==='seed');
  await page.clock.fastForward(30000);const response=await checked;expect(response.status()).toBe(200);expect((await response.json()).unchanged).toBe(true);expect(JSON.parse(response.request().headers()['x-ct-catalog-scope'])).toEqual([1,'preview','preview','preview','preview',0]);
  const dialog=await openCatalogPicker(page,page.locator('form.intake-form').getByRole('combobox',{name:'品牌',exact:true}));await expect(dialog.getByRole('option',{name:'Apple',exact:true})).toBeVisible();expect(requests).toBe(1);
  await page.route('**/api/catalog?kind=picker-index*',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({message:'请先登录后查看设备目录。'})}));
  const denied=page.waitForResponse(response=>response.url().includes('kind=picker-index')&&response.status()===401);await page.clock.fastForward(30000);await denied;
  await expect(dialog.getByRole('alert')).toContainText('请先登录后查看设备目录。');await expect(dialog.getByRole('option',{name:'Apple',exact:true})).toHaveCount(0);expect(requests).toBe(2);
  await page.clock.fastForward(30000);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(dialog.getByRole('alert')).toContainText('请先登录后查看设备目录。');expect(requests).toBe(2);
});

test('historical raw models stay in manual entry and do not mix into another series',async({page})=>{
  const login=await page.request.post('/api/preview-session',{data:{email:'demo@chinatech.local',password:'Preview2026!'}});expect(login.status()).toBe(200);
  await page.goto('/app/retail/new');await page.getByRole('radio',{name:'新机',exact:true}).locator('..').click();
  const raw='Galaxy A13 legacy-original';await manuallyChooseDevice(page,page.getByRole('combobox',{name:'型号 / 商品名称',exact:true}),raw,'Samsung');
  await page.getByRole('checkbox',{name:/我确认这是门店自有/}).check();await page.getByRole('button',{name:'创建独立档案',exact:true}).click();await page.waitForURL('**/app/retail/units/**');
  await page.goto('/app/retail/new');await page.getByRole('radio',{name:'新机',exact:true}).locator('..').click();
  const dialog=await openCatalogPicker(page,page.getByRole('combobox',{name:'品牌',exact:true}));await dialog.getByRole('combobox').fill('Samsung');await dialog.getByRole('option',{name:'Samsung',exact:true}).click();await choosePickerFamily(page,dialog,'Galaxy S');await dialog.getByRole('combobox').fill(raw);await expect(dialog.getByRole('option',{name:raw,exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'系列 · Galaxy S',exact:true}).click();await dialog.getByRole('button',{name:'未收录系列 / 手动填写',exact:true}).click();await dialog.getByRole('combobox').fill(raw);await expect(dialog.getByRole('option',{name:raw,exact:true})).toBeVisible();await dialog.getByRole('option',{name:raw,exact:true}).click();await expect(page.getByRole('combobox',{name:'型号 / 商品名称',exact:true})).toHaveValue(raw);
});
