import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const cache = new Map();
function mod(name) {
  if (cache.has(name)) return cache.get(name);
  let code = ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const m of [...code.matchAll(/from "\.\/([^";]+)"/g)]) code = code.replace(m[0], `from ${JSON.stringify(mod(m[1]))}`);
  const url = "data:text/javascript;base64," + Buffer.from(code).toString("base64"); cache.set(name, url); return url;
}
const { applyRetailWorkflow, retailWorkflowPermissions } = await import(mod("retail-workflow"));
const { emptyRetailUnit, createRetailUnit, applyRetailCommand, parseStoredRetailUnits, retailDueCents } = await import(mod("retail"));
const event = {id:"00000000-0000-4000-8000-000000000001",time:"2026-10-06 12:00:00",title:"Synthetic fact",detail:"Synthetic reason",actorId:"actor",actorName:"Synthetic"};
const settings = {revision:0,retailWarrantyMonths:12,shopName:"Synthetic",address:"Test",phone:"",paper:"a4",repairWarrantyMonths:6,suppliers:[],finance:[]};
const checks = {functional:true,ownership:true,data:true};
const draft = extra => ({...emptyRetailUnit(),id:"00000000-0000-4000-8000-000000000002",brand:"Apple",model:"Synthetic",serial:"SYNTHETIC-1",storeOwned:true,warrantyMonths:12,intakeDate:"2026-10-06",costCents:0,priceCents:10000,...extra});
const ready = extra => applyRetailWorkflow({type:"create_ready",unit:draft(extra),checks,settingsRevision:0},[],event,settings);
const warranty = {months:12,termsVersion:"retail-2026-10-v1",shopName:settings.shopName,address:settings.address,phone:settings.phone};
const checkout = (unit,extra={}) => ({type:"checkout",id:unit.id,version:unit.version,settingsRevision:0,sale:{customerPhone:"+393200000001",customerName:"Synthetic buyer",priceCents:10000,warranty},payments:[],paymentUnreceived:true,...extra});
const pay = (amountCents,method="cash") => ({amountCents,method,date:"2026-10-06"});
const roundtrip = unit => assert.deepEqual(parseStoredRetailUnits(JSON.stringify({version:1,units:[unit]}),[]),[JSON.parse(JSON.stringify(unit))]);

test("all eight inspection combinations require three true facts before availability and leave inputs unchanged",()=>{
 for(let bits=0;bits<8;bits++) {
  const unit=draft();const before=JSON.stringify(unit);const workflow={type:"create_ready",unit,checks:{functional:!!(bits&1),ownership:!!(bits&2),data:!!(bits&4)},settingsRevision:0};
  if(bits===7) {const result=applyRetailWorkflow(workflow,[],event,settings);assert.equal(result.status,"available");assert.equal(result.events.length,3);roundtrip(result);}
  else assert.throws(()=>applyRetailWorkflow(workflow,[],event,settings),/三项检查/);
  assert.equal(JSON.stringify(unit),before);
 }
});
test("plain create discards inherited photos/checks/sales; explicit current attachments do not approve",()=>{
 const source=draft({photos:["inherited"],inspection:checks});const created=createRetailUnit(source,[],event);
 assert.deepEqual(created.photos,[]);assert.deepEqual(created.inspection,{functional:false,ownership:false,data:false});assert.equal(created.status,"inspecting");
 const attached=applyRetailCommand(created,{type:"photos",photos:["data:image/png;base64,iVBORw0KGgo="]},{...event,id:"photos"},created.version,[]);
 assert.deepEqual(attached.photos,["data:image/png;base64,iVBORw0KGgo="]);assert.equal(attached.status,"inspecting");assert.deepEqual(attached.sales,[]);
 const result=applyRetailWorkflow({type:"create_ready",unit:source,photos:["data:image/png;base64,iVBORw0KGgo="],checks,settingsRevision:0},[],event,settings);assert.deepEqual(result.photos,["data:image/png;base64,iVBORw0KGgo="]);roundtrip(result);
});
test("missing price can be completed with inspection, zero is not sellable and valid existing price cannot be overwritten",()=>{
 for(const priceCents of [null,0]) {
 const unit=createRetailUnit(draft({priceCents}),[],event);const result=applyRetailWorkflow({type:"inspect_approve",id:unit.id,version:1,checks,priceCents:10000,note:"Original note"},[unit],event,settings);assert.equal(result.priceCents,10000);assert.equal(result.status,"available");assert.equal(result.events.at(-2).detail,"Original note");roundtrip(result);
 assert.throws(()=>applyRetailWorkflow({type:"inspect_approve",id:unit.id,version:1,checks,priceCents:0},[unit],event,settings),/有效售价/);
 }
 const unit=createRetailUnit(draft(),[],event);assert.throws(()=>applyRetailWorkflow({type:"inspect_approve",id:unit.id,version:1,checks,priceCents:1},[unit],event,settings),/已有有效售价/);
});
test("checkout unpaid, partial and mixed full receipt record exact facts with optional actual delivery",()=>{
 const unit=ready();
 for(const [payments,delivery] of [[[],undefined],[[pay(3000)],undefined],[[pay(3000),pay(7000,"card")],{deliveryDate:"2026-10-06"}]]) {
 const result=applyRetailWorkflow(checkout(unit,{payments,paymentUnreceived:payments.length?undefined:true,delivery}),[unit],event,settings);const sale=result.sales[0];assert.equal(sale.paidCents,payments.reduce((n,p)=>n+p.amountCents,0));assert.equal(sale.paymentUnreceived,payments.length===0);assert.equal(sale.payments.length,payments.length);assert.equal(sale.delivered,!!delivery);assert.equal(retailDueCents(sale),10000-sale.paidCents);roundtrip(result);
 }
 assert.deepEqual(unit.sales,[]);
});
test("checkout validates all payments before returning, rejects overpayment/zero/missing method and does not mutate source",()=>{
 const unit=ready();const before=JSON.stringify(unit);
 for(const payments of [[pay(10001)],[pay(0)],[pay(1,"invalid")],[pay(9000),pay(1001)]]) assert.throws(()=>applyRetailWorkflow(checkout(unit,{payments,paymentUnreceived:undefined}),[unit],event,settings));
 assert.equal(JSON.stringify(unit),before);assert.throws(()=>applyRetailWorkflow(checkout(unit,{paymentUnreceived:undefined}),[unit],event,settings),/实际收款/);assert.throws(()=>applyRetailWorkflow(checkout(unit,{payments:[pay(1)]}),[unit],event,settings),/实际收款/);
});
test("debt delivery requires debt permission and full reason/owner/date, settled delivery rejects debt",()=>{
 const unit=ready();const debt={reason:"Original reason",owner:"Synthetic",followUp:"2026-10-07"};const workflow=checkout(unit,{payments:[pay(1000)],paymentUnreceived:undefined,delivery:{deliveryDate:"2026-10-06",debt}});
 assert.ok(retailWorkflowPermissions(workflow).includes("sale.debt"));const result=applyRetailWorkflow(workflow,[unit],event,settings);assert.deepEqual(result.sales[0].debtDelivery,debt);roundtrip(result);
 for(const bad of [undefined,{...debt,reason:""},{...debt,followUp:"2026-10-05"}]) assert.throws(()=>applyRetailWorkflow({...workflow,delivery:{deliveryDate:"2026-10-06",debt:bad}},[unit],event,settings));
 assert.throws(()=>applyRetailWorkflow({...workflow,payments:[pay(10000)]},[unit],event,settings),/不需欠款/);
});
test("sale freezes product/warranty/history and keeps unknown distinct from zero",()=>{
 const unit=ready({batteryPercent:0,ramGb:null,refurbCents:null});const result=applyRetailWorkflow(checkout(unit,{payments:[pay(10000)],paymentUnreceived:undefined}),[unit],event,settings);const sale=result.sales[0];assert.equal(sale.product.batteryPercent,0);assert.equal(sale.product.ramGb,null);assert.equal(sale.costCents,0);assert.equal(sale.refurbCents,null);assert.deepEqual(sale.warranty,warranty);assert.equal(sale.payments[0].actorName,event.actorName);assert.ok(result.events.some(e=>e.id===sale.payments[0].eventId));roundtrip(result);
});
test("version/settings/warranty/identity/reservation and retired-return gates stay enforced",()=>{
 const unit=ready();const workflow=checkout(unit);for(const extra of [{version:0},{settingsRevision:1},{sale:{...workflow.sale,warranty:{...warranty,months:1}}}]) assert.throws(()=>applyRetailWorkflow({...workflow,...extra},[unit],event,settings));
 assert.throws(()=>applyRetailWorkflow({type:"create_ready",unit:draft(),checks,settingsRevision:0},[unit],event,settings));
 for (const warrantyMonths of [null,6,18]) assert.equal(applyRetailWorkflow({type:"create_ready",unit:draft({warrantyMonths}),checks,settingsRevision:0},[],event,settings).warrantyMonths,warrantyMonths);
 const reserved=applyRetailCommand(unit,{type:"reserve",name:"Other",phone:"+393200000002",until:"2026-10-07",note:""},{...event,id:"reservation"},unit.version,[unit]);assert.throws(()=>applyRetailWorkflow(checkout(reserved),[reserved],event,settings),/预留买家/);
 const sold=applyRetailWorkflow(checkout(unit,{payments:[pay(10000)],paymentUnreceived:undefined}),[unit],event,settings);const returned=applyRetailCommand(sold,{type:"return",saleId:sold.sales[0].id,date:"2026-10-06",reason:"Original return",received:true},{...event,id:"return"},sold.version,[sold]);assert.throws(()=>applyRetailCommand(returned,{type:"reinspect"},{...event,id:"reinspect"},returned.version,[returned]),/退款尚未结清/);
});
test("workflow rejects fabricated actor/status/receipt fields and requires permissions for every fact",()=>{
 const unit=ready();assert.throws(()=>retailWorkflowPermissions({...checkout(unit),actorId:"fake"}));assert.throws(()=>retailWorkflowPermissions(checkout(unit,{payments:[{...pay(1),entryId:"fake"}],paymentUnreceived:undefined})));
 assert.deepEqual(retailWorkflowPermissions(checkout(unit)),["retail.view","retail.sell"]);assert.ok(retailWorkflowPermissions({type:"create_ready",unit:draft(),checks,settingsRevision:0}).includes("financial.edit"));
});
test("inspection/state notes retain original text, payment note optional, refund reason required",()=>{
 const draftUnit=createRetailUnit(draft(),[],event);
 const inspect=applyRetailCommand(draftUnit,{type:"inspect",checks,note:"  Original inspection  "},{...event,id:"inspect"},draftUnit.version,[]);assert.equal(inspect.events.at(-1).detail,"  Original inspection  ");
 const approve=applyRetailCommand(inspect,{type:"approve",note:"  Explicit approval  "},{...event,id:"approve"},inspect.version,[]);assert.equal(approve.events.at(-1).detail,"  Explicit approval  ");
 assert.throws(()=>applyRetailCommand(approve,{type:"pause",note:" "},{...event,id:"pause"},approve.version,[]),/原因/);
 const pause=applyRetailCommand(approve,{type:"pause",note:"  Original reason  "},{...event,id:"pause"},approve.version,[]);assert.equal(pause.events.at(-1).detail,"  Original reason  ");
 const reinspection=applyRetailCommand(pause,{type:"reinspect",note:"  Original reinspection  "},{...event,id:"reinspect"},pause.version,[]);assert.equal(reinspection.events.at(-1).detail,"  Original reinspection  ");
 const unit=ready();const sold=applyRetailWorkflow(checkout(unit),[unit],event,settings);const saleId=sold.sales[0].id;
 const paid=applyRetailCommand(sold,{type:"payment",saleId,entryId:"ordinary-payment",...pay(10000)},{...event,id:"ordinary-payment"},sold.version,[]);assert.equal(paid.sales[0].payments[0].note,"");
 assert.throws(()=>applyRetailCommand(paid,{type:"refund",saleId,entryId:"refund",...pay(1)},{...event,id:"refund"},paid.version,[]),/款项备注/);
});
test("checkout never reopens an existing sale and rejects invalid base request IDs or suffix collisions",()=>{
 const unit=ready();const sold=applyRetailWorkflow(checkout(unit,{payments:[pay(10000)],paymentUnreceived:undefined}),[unit],event,settings);const before=JSON.stringify(sold);
 // Even a caller with the fresh unit version cannot replay a sale into a new zero opening.
 assert.throws(()=>applyRetailWorkflow(checkout(sold,{payments:[pay(1000)],paymentUnreceived:undefined}),[sold],event,settings),/操作标识/);assert.equal(JSON.stringify(sold),before);
 const validOtherEvent={...event,id:"00000000-0000-4000-8000-000000000099"};
 const existingElsewhere={...sold,id:"00000000-0000-4000-8000-000000000088",serial:"DIFFERENT",sales:sold.sales.map(sale=>({...sale,id:validOtherEvent.id+":sale"}))};
 assert.throws(()=>applyRetailWorkflow(checkout(unit),[unit,existingElsewhere],validOtherEvent,settings),/操作标识/);
 for(const id of ["",event.id+":sale",event.id+":payment:0","arbitrary",null,"f".repeat(101),"00000000-0000-0000-0000-000000000000"]) assert.throws(()=>applyRetailWorkflow(checkout(unit),[unit],{...event,id},settings),/请求标识/);
 // A forged existing event with a new valid base request's step suffix must fail before persistence.
 const collision={...unit,events:[...unit.events,{...validOtherEvent,id:validOtherEvent.id+":sale"}]};const collisionBefore=JSON.stringify(collision);
 assert.throws(()=>applyRetailWorkflow(checkout(collision),[collision],validOtherEvent,settings),/重复操作/);assert.equal(JSON.stringify(collision),collisionBefore);
 const changed=applyRetailWorkflow(checkout(unit),[unit],validOtherEvent,settings);assert.notEqual(changed.sales[0].id,sold.sales[0].id);assert.equal(changed.sales[0].paymentOpeningCents,0);roundtrip(changed);
});
