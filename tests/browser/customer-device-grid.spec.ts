import{test,expect}from'@playwright/test';import{readFileSync}from'node:fs';import{buildInfiniteListFixture}from'./helpers/infinite-list-fixture';
const entry=String.raw`
import React,{useState}from'react';import{createRoot}from'react-dom/client';import{CustomerDeviceGrid}from'@/components/customers/customer-device-grid';
const all=Array.from({length:500},(_,i)=>({id:'DEMO-'+i,category:'phone',model:'DEMO model '+i,serial:'SN-'+i,recordCount:1,latestAt:'2026-10-17',previews:[]}));
function Case(){const[total,setTotal]=useState(700);window.gridReview={setTotal};const items=all.slice(0,Math.min(500,total));return <CustomerDeviceGrid total={total} startIndex={0} items={items} version={'DEMO-'+total} render={item=><article className="customer-device-card" data-device-id={item.id} style={{minHeight:132}}><strong>{item.model}</strong><details><summary>Records {item.id}</summary></details></article>}/>;}
createRoot(document.getElementById('root')).render(<Case/>);
`;
async function mount(page:import('@playwright/test').Page,width:number){await page.setViewportSize({width,height:900});await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+readFileSync('app/globals.css','utf8')+'</style><div id="root"></div>');await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter:'',entry,seams:[]})});await expect(page.locator('[data-windowed-list]')).toHaveCount(1);}
test('device card rows preserve responsive columns, bounded DOM and unique-result auto-fit width',async({page})=>{
 for(const width of[1440,1024,390,375]){await mount(page,width);const frame=page.locator('.customer-device-window'),cards=page.locator('[data-device-id]');expect(await cards.count()).toBeLessThan(100);expect(await frame.getAttribute('data-device-cache')).toBe('500');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);const capacity=await frame.evaluate(node=>Math.max(1,Math.floor((node.clientWidth+12)/312))),first=await cards.first().boundingBox(),second=await cards.nth(1).boundingBox();expect(first&&second).toBeTruthy();if(capacity>1)expect(second!.y).toBe(first!.y);else expect(second!.y).toBeGreaterThan(first!.y);
  await page.evaluate(()=>(window as unknown as{gridReview:{setTotal:(n:number)=>void}}).gridReview.setTotal(1));await expect(cards).toHaveCount(1);const full=await frame.boundingBox(),only=await cards.first().boundingBox();expect(Math.abs(full!.width-only!.width)).toBeLessThanOrEqual(1);await expect(cards.first().locator('summary')).toBeVisible();
 }
});
