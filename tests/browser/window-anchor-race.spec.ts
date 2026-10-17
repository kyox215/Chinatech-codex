import {test,expect} from '@playwright/test';
import {buildInfiniteListFixture} from './helpers/infinite-list-fixture';

const entry=String.raw`
import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {WindowedListRows} from '@/components/windowed-list-rows';
const initial=Array.from({length:100},(_,id)=>({id:'DEMO-'+id,height:40}));
function Case(){const root=useRef(null),[items,setItems]=useState(initial);
 window.anchorReview={clone:()=>flushSync(()=>setItems(previous=>[...previous])),grow:()=>flushSync(()=>setItems(previous=>previous.map((item,index)=>index===0?{...item,height:item.height+100}:item)))};
 return <div id="scroller" ref={root} style={{height:400,overflow:'auto'}}><WindowedListRows items={items} total={1000} extent={100} estimate={40} rowKey={item=>item.id} scrollRoot={root} anchorSelector="a" render={(item,props)=><div {...props} style={{height:item.height,boxSizing:'border-box'}}><a href={'#'+item.id}>{item.id}</a><input aria-label={'Note '+item.id}/></div>}/></div>;
}createRoot(document.getElementById('root')).render(<Case/>);
`;
type ReviewWindow=Window&{anchorReview:{clone:()=>void;grow:()=>void}};
async function frame(page:import('@playwright/test').Page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
test.beforeEach(async({page})=>{await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:16px/20px sans-serif}input{font-size:16px}</style><div id="root"></div>');await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter:'',entry,seams:[]})});await expect(page.locator('[data-window-key]').first()).toBeVisible();await frame(page);});

test('a row commit before the scroll RAF preserves the actual latest scroll',async({page})=>{
 const observation=await page.evaluate(()=>{const node=document.getElementById('scroller')!;const before=node.scrollTop;node.scrollTop=120;node.dispatchEvent(new Event('scroll'));const intended=node.scrollTop;(window as unknown as ReviewWindow).anchorReview.clone();return{before,intended,afterLayout:node.scrollTop};});
 expect(observation.before).toBe(0);expect(observation.intended).toBe(120);expect(observation.afterLayout).toBe(observation.intended);await frame(page);expect(await page.locator('#scroller').evaluate(node=>node.scrollTop)).toBe(120);
});

test('same-position variable height growth compensates once and preserves the focused row',async({page})=>{
 await page.locator('#scroller').evaluate(node=>{node.scrollTop=120;node.dispatchEvent(new Event('scroll'));});await frame(page);
 await page.getByRole('textbox',{name:'Note DEMO-3',exact:true}).focus();
 const observation=await page.evaluate(()=>{const node=document.getElementById('scroller')!,target=node.querySelector('[data-window-key="DEMO-3"] a')!;const before={scroll:node.scrollTop,top:target.getBoundingClientRect().top};(window as unknown as ReviewWindow).anchorReview.grow();return{before,after:{scroll:node.scrollTop,top:target.getBoundingClientRect().top}};});
 console.log(JSON.stringify({case:'height',observation}));expect(observation.after.scroll-observation.before.scroll).toBe(100);expect(observation.after.top).toBe(observation.before.top);await frame(page);expect(await page.locator('#scroller').evaluate(node=>node.scrollTop)).toBe(220);await expect(page.getByRole('textbox',{name:'Note DEMO-3',exact:true})).toBeFocused();
});

test('a new user scroll plus layout growth before RAF keeps both changes',async({page})=>{
 await page.locator('#scroller').evaluate(node=>{node.scrollTop=120;node.dispatchEvent(new Event('scroll'));});await frame(page);
 const observation=await page.evaluate(()=>{const node=document.getElementById('scroller')!,target=node.querySelector('[data-window-key="DEMO-3"] a')!;const before={scroll:node.scrollTop,top:target.getBoundingClientRect().top};node.scrollTop=200;node.dispatchEvent(new Event('scroll'));(window as unknown as ReviewWindow).anchorReview.grow();return{before,after:{scroll:node.scrollTop,top:target.getBoundingClientRect().top}};});
 console.log(JSON.stringify({case:'scroll+height',observation}));expect(observation.after.scroll).toBe(300);expect(observation.after.top).toBe(observation.before.top-80);await frame(page);expect(await page.locator('#scroller').evaluate(node=>node.scrollTop)).toBe(300);
});

const neighborEntry=String.raw`
import React,{useRef,useState} from 'react';import {createRoot} from 'react-dom/client';import {WindowedListRows} from '@/components/windowed-list-rows';
const rows=start=>Array.from({length:50},(_,index)=>({id:'DEMO-'+(start+index)})),api=window.neighborReview={calls:0};
function Case(){const root=useRef(null),[items,setItems]=useState(rows(250)),[start,setStart]=useState(250),[pending,setPending]=useState(false),[error,setError]=useState(false);
 const read=()=>{api.calls++;setPending(true);api.finish=failed=>{if(!failed){setItems(previous=>[...rows(200),...previous]);setStart(200);}setError(failed);setPending(false);};};api.retry=()=>{setError(false);read();};
 return <div id="scroller" ref={root} style={{height:400,overflow:'auto'}}><WindowedListRows items={items} startIndex={start} total={1200} extent={300} estimate={40} rowKey={item=>item.id} scrollRoot={root} anchorSelector="a" initialAnchor={window.neighborRestore?'DEMO-250':undefined} initialOffset={320} onLoadPrevious={error?undefined:read} pending={pending} render={(item,props)=><div {...props} style={{height:40}}><a tabIndex={0} href={'#'+item.id}>{item.id}</a></div>}/></div>;
}createRoot(document.getElementById('root')).render(<Case/>);
`;
async function neighborCase(page:import('@playwright/test').Page,restore=true){await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:16px/20px sans-serif}</style><div id="root"></div>');await page.evaluate(value=>(window as unknown as Window&{neighborRestore:boolean}).neighborRestore=value,restore);await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter:'',entry:neighborEntry,seams:[]})});}
type NeighborWindow=Window&{neighborReview:{calls:number;finish:(failed:boolean)=>void;retry:()=>void}};
test('a restored partially visible prefix reads one neighbor and preserves the actual link pixel and focus',async({page})=>{
 await neighborCase(page);await expect.poll(()=>page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.calls)).toBe(1);const target=page.locator('[data-window-key="DEMO-250"] a');await expect(target).toBeFocused();const before=await target.evaluate(node=>node.getBoundingClientRect().top);expect(before).toBe(320);await frame(page);expect(await page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.calls)).toBe(1);
 await page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.finish(false));await expect(page.locator('[data-windowed-list]')).toHaveAttribute('data-window-cache','100');await frame(page);expect(await target.evaluate(node=>node.getBoundingClientRect().top)).toBe(before);await expect(target).toBeFocused();expect(await page.locator('[data-window-key]').evaluateAll(nodes=>nodes.some(node=>Number((node as HTMLElement).dataset.windowIndex)<250&&node.getBoundingClientRect().bottom>0))).toBe(true);expect(await page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.calls)).toBe(1);
});
test('a previous-batch error stays idle until explicit retry; an entirely offscreen window does not read neighbors',async({page})=>{
 await neighborCase(page);await expect.poll(()=>page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.calls)).toBe(1);await page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.finish(true));await frame(page);expect(await page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.calls)).toBe(1);await page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.retry());expect(await page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.calls)).toBe(2);await page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.finish(false));await expect(page.locator('[data-windowed-list]')).toHaveAttribute('data-window-cache','100');await frame(page);expect(await page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.calls)).toBe(2);
 await neighborCase(page,false);await frame(page);await frame(page);expect(await page.evaluate(()=>(window as unknown as NeighborWindow).neighborReview.calls)).toBe(0);
});

const groupsEntry=String.raw`
import React,{useRef,useState} from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{WindowedListRows}from'@/components/windowed-list-rows';
function Case(){const root=useRef(null),[height,setHeight]=useState(40);window.groupAnchor={grow:()=>flushSync(()=>setHeight(value=>value+100))};const a=Array.from({length:6},(_,id)=>({id:'A-'+id,height:id===0?height:40})),b=Array.from({length:100},(_,id)=>({id:'B-'+id,height:40}));return <div id="scroller" ref={root} style={{height:400,overflow:'auto'}}>{[a,b].map((items,index)=><WindowedListRows key={index} items={items} total={items.length} estimate={40} rowKey={item=>item.id} scrollRoot={root} render={(item,props)=><div {...props} style={{height:item.height}}>{item.id}</div>}/>)}</div>;}createRoot(document.getElementById('root')).render(<Case/>);
`;
test('two visible groups share one scroll compensation rather than repeating another group layout movement',async({page})=>{
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:16px/20px sans-serif}</style><div id="root"></div>');await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter:'',entry:groupsEntry,seams:[]})});await expect(page.locator('[data-window-key="B-0"]')).toBeVisible();await frame(page);await page.locator('#scroller').evaluate(node=>{node.scrollTop=80;node.dispatchEvent(new Event('scroll'));});await frame(page);
 const observed=await page.evaluate(()=>{const node=document.getElementById('scroller')!,a=node.querySelector('[data-window-key="A-2"]')!,b=node.querySelector('[data-window-key="B-0"]')!,before={scroll:node.scrollTop,a:a.getBoundingClientRect().top,b:b.getBoundingClientRect().top};(window as unknown as{groupAnchor:{grow:()=>void}}).groupAnchor.grow();return{before,after:{scroll:node.scrollTop,a:a.getBoundingClientRect().top,b:b.getBoundingClientRect().top}};});console.log(JSON.stringify({case:'two-groups',observed}));expect(observed.after.scroll).toBe(180);expect(observed.after.a).toBe(observed.before.a);expect(observed.after.b).toBe(observed.before.b);await frame(page);expect(await page.locator('#scroller').evaluate(node=>node.scrollTop)).toBe(180);
});

const fractionalEntry=String.raw`
import React,{useRef,useState}from'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{WindowedListRows}from'@/components/windowed-list-rows';
function Case(){const root=useRef(null),[items,setItems]=useState(Array.from({length:100},(_,id)=>({id:'F-'+id,height:40})));window.fractionalAnchor={grow:()=>flushSync(()=>setItems(previous=>previous.map((item,index)=>index===30?{...item,height:item.height+.5}:item)))};return <div id="fractional-scroller" ref={root} style={{height:400,overflow:'auto',marginTop:.84375}}><WindowedListRows items={items} total={1000} extent={100} estimate={40} rowKey={item=>item.id} scrollRoot={root} anchorSelector="a" initialAnchor="F-40" initialOffset={180} render={(item,props)=><div {...props} style={{height:item.height,boxSizing:'border-box'}}><a href={'#'+item.id}>{item.id}</a></div>}/></div>;}createRoot(document.getElementById('root')).render(<Case/>);
`;
test('fractional restore and successive half-pixel row changes do not accumulate integer-scroll rounding drift',async({page})=>{
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:16px/20px sans-serif}</style><div id="root"></div>');await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter:'',entry:fractionalEntry,seams:[]})});const target=page.locator('[data-window-key="F-40"] a');await expect(target).toBeFocused();await frame(page);expect(Math.round(await target.evaluate(node=>node.getBoundingClientRect().top))).toBe(180);
 for(let i=0;i<8;i++){await page.evaluate(()=>(window as unknown as{fractionalAnchor:{grow:()=>void}}).fractionalAnchor.grow());await frame(page);expect(Math.round(await target.evaluate(node=>node.getBoundingClientRect().top))).toBe(180);await expect(target).toBeFocused();}
});

const nestedEntry=String.raw`
import React,{useRef,useState}from'react';import{createRoot}from'react-dom/client';import{WindowedListRows}from'@/components/windowed-list-rows';
const outer=Array.from({length:100},(_,i)=>({id:'OUT-'+i})),inner=Array.from({length:100},(_,i)=>({id:'IN-'+i}));
function Inner(){const root=useRef(null);return<div ref={root} id="inner-scroller" style={{height:80,overflow:'auto'}}><WindowedListRows scrollRoot={root} items={inner} total={window.innerTrueEnd?100:1000} estimate={40} rowKey={r=>r.id} render={(row,props)=><div {...props} style={{height:40}}><a href={'#'+row.id}>{row.id}</a><a href={'#phone-'+row.id} aria-label={'Phone '+row.id}>Phone</a></div>}/></div>;}
function Case(){const root=useRef(null);return <><button id="outside">Outside</button><div ref={root} id="outer-scroller" style={{height:400,overflow:'auto'}}><WindowedListRows scrollRoot={root} items={outer} total={1000} estimate={160} rowKey={r=>r.id} render={(row,props)=><section {...props} style={{height:160}}><button>{row.id}</button>{row.id==='OUT-0'?<details open><summary>Records OUT-0</summary><Inner/></details>:null}</section>}/></div></>;}
createRoot(document.getElementById('root')).render(<Case/>);
`;
async function nestedCase(page:import('@playwright/test').Page,trueEnd=false){await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:16px/20px sans-serif}input{font-size:16px;width:100px}</style><div id="root"></div>');await page.addScriptTag({content:'window.innerTrueEnd='+String(trueEnd)});await page.addScriptTag({content:buildInfiniteListFixture(process.cwd(),{adapter:'',entry:nestedEntry,seams:[]})});await expect(page.getByRole('button',{name:'OUT-0',exact:true})).toBeVisible();await frame(page);}
test('nested record window pins its containing device row until focus leaves the outer row',async({page})=>{
 await nestedCase(page);const target=page.getByRole('link',{name:'Phone IN-0',exact:true});await target.focus();const initiated=await page.locator('#outer-scroller').evaluate(node=>{node.scrollTop=1800;node.dispatchEvent(new Event('scroll'));return node.scrollTop;});await frame(page);const pinnedTop=await page.locator('#outer-scroller').evaluate(node=>node.scrollTop);console.log(JSON.stringify({nestedPinned:{initiated,afterFrame:pinnedTop}}));expect(pinnedTop).toBe(1800);await expect(target).toBeFocused();await expect(page.locator('[data-window-key="OUT-0"]')).toHaveCount(1);await page.locator('#outside').evaluate(node=>(node as HTMLButtonElement).focus({preventScroll:true}));await frame(page);const after=await page.locator('#outer-scroller').evaluate(node=>({top:node.scrollTop,focus:document.activeElement?.id}));console.log(JSON.stringify({nestedBlur:after}));expect(after.top).toBe(1800);await expect(page.locator('[data-window-key="OUT-0"]')).toHaveCount(0);
});
test('nested record Tab and Shift-Tab do not trigger the parent device row navigator',async({page})=>{
 await nestedCase(page);const inner=page.locator('#inner-scroller');const last=await inner.locator('[data-window-index]').evaluateAll(nodes=>Math.max(...nodes.map(node=>Number((node as HTMLElement).dataset.windowIndex))));const current=page.getByRole('link',{name:'Phone IN-'+last,exact:true});await current.focus();await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'IN-'+(last+1),exact:true})).toBeFocused();await inner.evaluate(node=>{node.scrollTop=1200;node.dispatchEvent(new Event('scroll'));});await frame(page);await expect(inner.locator('[data-window-key="IN-'+last+'"]')).toHaveCount(0);await page.keyboard.press('Shift+Tab');await expect(page.getByRole('link',{name:'Phone IN-'+last,exact:true})).toBeFocused();await expect(page.getByRole('button',{name:'OUT-'+(last+1),exact:true})).not.toBeFocused();
});
test('nested true record boundary continues to the logical next device and first reverse reaches its summary',async({page})=>{
 await nestedCase(page,true);const inner=page.locator('#inner-scroller');await inner.evaluate(node=>{node.scrollTop=4000;node.dispatchEvent(new Event('scroll'));});await frame(page);const last=page.getByRole('link',{name:'Phone IN-99',exact:true});await last.focus();await page.locator('#outer-scroller').evaluate(node=>{node.scrollTop=1800;node.dispatchEvent(new Event('scroll'));});await frame(page);expect(await page.locator('#outer-scroller').evaluate(node=>node.scrollTop)).toBe(1800);await expect(last).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'OUT-1',exact:true})).toBeFocused();
 await nestedCase(page,true);await page.getByRole('link',{name:'IN-0',exact:true}).focus();await page.keyboard.press('Shift+Tab');await expect(page.locator('summary',{hasText:'Records OUT-0'})).toBeFocused();
});
