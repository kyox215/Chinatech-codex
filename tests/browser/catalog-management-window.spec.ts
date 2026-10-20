import { test, expect, type Page } from '@playwright/test';
import type { CatalogRow } from '../../lib/device-catalog';
const rows:CatalogRow[]=Array.from({length:750},(_,i)=>({id:`demo-window-${i}`,category:'phone',brand:'DEMO',family:'DEMO family',name:`DEMO Model ${i}`,releasedAt:null,year:null,generation:'',network:'unknown',platform:'',modelCodes:[`DEMO-CODE-${i}`],aliases:[],markets:[],status:'review',enabled:true,sourceUrls:[],checkedAt:null,notes:'DEMO full original '+i,version:1}));
async function setup(page:Page,holdState=false){
 const requests:{page:number;q:string;category:string}[]=[];let release=()=>{};
 const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/catalog?kind=state',async route=>{if(holdState)await gate;await route.fulfill({json:{revision:'seed',canManage:true,accountId:'preview',sessionId:'preview',storeId:'preview'}});});
 await page.route('**/api/catalog?kind=models*',async route=>{const params=new URL(route.request().url()).searchParams,number=Number(params.get('page')),q=params.get('q')??'',category=params.get('category')??'';requests.push({page:number,q,category});const all=rows.filter(row=>(!q||[row.name,...row.modelCodes].some(value=>value.includes(q)))&&(!category||row.category===category));await route.fulfill({json:{rows:all.slice((number-1)*50,number*50),page:number,pageSize:50,total:all.length,revision:'seed'}});});
 expect((await page.request.post('/api/preview-session',{data:{email:'demo@chinatech.local',password:'Preview2026!'}})).status()).toBe(200);
 await page.goto('/app/catalog');return{requests,release};
}
test('management first page starts before state finishes; search is debounced while clear and filters stay immediate',async({page})=>{
 const{requests,release}=await setup(page,true);await expect.poll(()=>requests.length).toBeGreaterThan(0);release();
 const table=page.locator('tbody[data-windowed-list]');await expect(table).toHaveAttribute('data-window-end','50');
 const search=page.getByRole('textbox',{name:'搜索型号或机型码',exact:true}),before=requests.length;
 await search.fill('DEMO-CODE-749');await expect(table).toHaveAttribute('data-window-total','1');await expect(table.locator('[data-window-key]')).toContainText('DEMO Model 749');
 expect(requests.slice(before).filter(value=>value.q==='DEMO-CODE-749')).toHaveLength(1);
 await page.getByRole('button',{name:'清空型号搜索',exact:true}).click();await expect(table).toHaveAttribute('data-window-end','50');await expect(table).toHaveAttribute('data-window-total','750');
 await page.getByRole('combobox',{name:'设备类别',exact:true}).selectOption('tablet');await expect(table).toHaveAttribute('data-window-total','0');
 expect(requests.at(-1)?.category).toBe('tablet');
});
test('twelve real footer appends bound full rows to 500 and old windows are fetched again while an editor draft survives',async({page})=>{
 test.setTimeout(60000);const{requests}=await setup(page);
 const table=page.locator('tbody[data-windowed-list]'),footer=page.getByRole('region',{name:'设备目录加载',exact:true});
 await expect(table).toHaveAttribute('data-window-end','50');
 for(let number=2;number<=13;number++){await page.evaluate(async()=>{window.scrollBy({top:-300,behavior:'instant'});await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});await footer.scrollIntoViewIfNeeded();await expect(table).toHaveAttribute('data-window-end',String(number*50));expect(Number(await table.getAttribute('data-window-cache'))).toBeLessThanOrEqual(500);}
 expect(await table.locator('[data-window-key]').count()).toBeLessThan(100);await expect(table).toHaveAttribute('data-window-start','150');
 await table.getByRole('button',{name:'编辑',exact:true}).last().click();const name=page.getByRole('textbox',{name:'目录完整型号',exact:true});await name.fill('DEMO unsaved original');
 const previous=requests.filter(value=>value.page===1).length;await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await expect.poll(()=>requests.filter(value=>value.page===1).length).toBeGreaterThan(previous);
 await expect(table).toHaveAttribute('data-window-start','0');await expect(name).toHaveValue('DEMO unsaved original');
 await page.getByRole('button',{name:'取消',exact:true}).click();await expect(name).toHaveCount(0);
});

test('a delayed management chunk preserves rows and shows the existing local B feedback until the editor is ready',async({page})=>{
 let release=()=>{},requests=0;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/_next/static/chunks/**',async route=>{if(route.request().url().includes('catalog-management')){const response=await route.fetch(),body=await response.text();if(body.includes('function CatalogEntryEditor(')){requests++;await gate;}await route.fulfill({response,body});return;}await route.continue();});
 try{await setup(page);const table=page.locator('tbody[data-windowed-list]');await expect(table).toHaveAttribute('data-window-end','50');expect(requests).toBe(0);
 await table.getByRole('button',{name:'编辑',exact:true}).first().click();await expect.poll(()=>requests).toBeGreaterThan(0);
 await expect(page.getByRole('status').filter({hasText:'正在处理…'})).toBeVisible();await expect(table).toHaveAttribute('data-window-end','50');
 release();await expect(page.getByRole('textbox',{name:'目录完整型号',exact:true})).toBeVisible();await expect(page.getByRole('status').filter({hasText:'正在处理…'})).toHaveCount(0);
 }finally{release();}
});
