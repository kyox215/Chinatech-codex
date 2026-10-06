import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import ts from "typescript";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const configPath=process.env.CT_LOCAL_CONFIG;
if(!configPath || !path.isAbsolute(configPath))throw new Error("Explicit local fixture configuration required.");
const config=JSON.parse(readFileSync(configPath,"utf8"));
const env=JSON.parse(readFileSync(path.join(root,".local/backend/env.private.json"),"utf8"));
const local=(value,port,protocol)=>{const url=new URL(value);assert.ok(["localhost","127.0.0.1"].includes(url.hostname) && url.port===port && (!protocol || url.protocol===protocol),"Only the isolated rebuild localhost stack is accepted.");return url;};
local(config.API_URL,"55421","http:");local(config.DB_URL,"55422");local(env.SUPABASE_URL,"55421","http:");local(env.APP_DATABASE_URL,"55422");
assert.equal(new URL(config.API_URL).host,new URL(env.SUPABASE_URL).host,"Candidate environment must match the isolated backend.");
const api=process.env.CT_RETAIL_WORKFLOW_API_URL || "http://127.0.0.1:3117";local(api,"3117","http:");
const origin=api.replace("127.0.0.1","localhost");
const sql=postgres(config.DB_URL,{max:1,prepare:false});
const admin=createClient(config.API_URL,config.SECRET_KEY||config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const suffix=randomBytes(6).toString("hex"),password="Ct"+randomBytes(20).toString("hex"),stores=[randomUUID(),randomUUID()],sessions=[],checks=[];
const settings={revision:0,shopName:"Synthetic workflow "+suffix,address:"Synthetic",phone:"",paper:"a4",repairWarrantyMonths:6,retailWarrantyMonths:12,suppliers:[],finance:[]};
const all=["retail.view","retail.edit","retail.inspect","retail.price","retail.sell","sale.payment","sale.reconcile","sale.deliver","sale.debt","sale.refund","sale.aftersales","financial.read","financial.edit","customers.view","customers.edit"];
const completeChecks={functional:true,ownership:true,data:true};
const compiled=new Map();
function moduleURL(name){if(compiled.has(name))return compiled.get(name);let code=ts.transpileModule(readFileSync(path.join(root,"lib",name+".ts"),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;code=code.replace(/from "\.\/([^";]+)"/g,(_,source)=>`from ${JSON.stringify(moduleURL(source))}`);const url="data:text/javascript;base64,"+Buffer.from(code).toString("base64");compiled.set(name,url);return url;}
const {emptyRetailUnit}=await import(moduleURL("retail"));
const romeDay=(date=new Date())=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome",dateStyle:"short"}).format(date);
function pass(label){checks.push(label);console.log("PASS "+label);}
function expect(response,status){assert.equal(response.status,status,response.data?.message||"Unexpected API status");return response.data;}
async function request(who,endpoint,body,method=body===undefined?"GET":"POST"){
 const response=await fetch(api+endpoint,{method,redirect:"manual",headers:{Origin:origin,...(body===undefined?{}:{"Content-Type":"application/json"}),...(who?{Cookie:[...who.cookies].map(([k,v])=>`${k}=${v}`).join("; ")}: {})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(who)for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(";")[0],index=pair.indexOf("=");who.cookies.set(pair.slice(0,index),pair.slice(index+1));}
 return {status:response.status,data:await response.json()};
}
async function user(label,role,storeId,permissions){const email=`ct-workflow-${label}-${suffix}@example.test`;const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);const who={id:data.user.id,cookies:new Map(),storeId,memberId:randomUUID()};sessions.push(who);await sql`insert into chinatech_v2.store_memberships(id,store_id,user_id,role,membership_status,permissions) values(${who.memberId},${storeId},${who.id},${role},'active',${permissions})`;expect(await request(who,"/api/auth/login",{email,password}),200);return who;}
const state=async who=>expect(await request(who,"/api/backend/state"),200);
const command=(who,kind,payload,requestId=randomUUID(),storeId=who?.storeId ?? stores[0])=>request(who,"/api/backend/command",{storeId,memberId:who?.memberId ?? randomUUID(),kind,payload,requestId});
const workflow=(who,payload,id)=>command(who,"retail.workflow",payload,id);
async function inventory(){const units=await sql`select id,data from chinatech_v2_private.retail_units where store_id=${stores[0]} order by id`;const customers=await sql`select normalized_phone,data from chinatech_v2_private.customers where store_id=${stores[0]} order by normalized_phone`;const [count]=await sql`select (select count(*)::int from chinatech_v2_private.command_receipts where store_id=${stores[0]}) receipts,(select count(*)::int from chinatech_v2_private.audit_events where store_id=${stores[0]}) audit,(select revision::int from chinatech_v2_private.store_state where store_id=${stores[0]}) revision`;return {units,customers,...count};}
async function rejected(who,payload,status=400){const before=await inventory();expect(await workflow(who,payload),status);assert.deepEqual(await inventory(),before);}
const newUnit=(extra={})=>({...emptyRetailUnit(),id:randomUUID(),brand:"Apple",model:"Synthetic workflow",serial:"WF-"+randomUUID(),storeOwned:true,intakeDate:romeDay(),priceCents:10000,costCents:null,refurbCents:null,...extra});
const createReady=(unit,extra={})=>({type:"create_ready",unit,checks:completeChecks,settingsRevision:0,...extra});
const getUnit=async(who,id)=>(await state(who)).retail.find(unit=>unit.id===id);
const currentWarranty=unit=>({months:unit.warrantyMonths,termsVersion:"retail-2026-10-v1",shopName:settings.shopName,address:settings.address,phone:settings.phone});
const checkout=(unit,extra={})=>({type:"checkout",id:unit.id,version:unit.version,settingsRevision:0,sale:{customerPhone:"+393330007701",customerName:"Synthetic",priceCents:10000,warranty:currentWarranty(unit)},payments:[],paymentUnreceived:true,...extra});
const actual=(amountCents,method="cash",date=romeDay())=>({amountCents,method,date});
const photo="data:image/png;base64,iVBORw0KGgo=";
let owner,limited,other,faultActive=false,success=false,cleanupComplete=false;
const fault="ct_workflow_fault_"+suffix;
async function readyUnit(extra={}){const unit=newUnit(extra);expect(await workflow(owner,createReady(unit)),200);return getUnit(owner,unit.id);}
async function oldCommand(unitId,value){const unit=await getUnit(owner,unitId);expect(await command(owner,"retail",{type:"command",id:unit.id,version:unit.version,command:value}),200);return getUnit(owner,unitId);}
async function grant(permissions){await sql`update chinatech_v2.store_memberships set permissions=${permissions},revision=revision+1 where id=${limited.memberId} and store_id=${stores[0]}`;}
async function removeFault(){await sql.unsafe(`drop trigger if exists ${fault} on chinatech_v2_private.audit_events`);await sql.unsafe(`drop function if exists chinatech_v2_private.${fault}()`);faultActive=false;}

try{
 for(const id of stores){await sql`insert into chinatech_v2.stores(id,name) values(${id},'Synthetic workflow integration')`;await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${id},${sql.json(settings)})`;}
 owner=await user("owner","owner",stores[0],all);limited=await user("limited","technician",stores[0],all);other=await user("other","owner",stores[1],all);
 // Every rejected workflow must leave records, receipts, events, customers and revision untouched.
 for(let bits=0;bits<7;bits++)await rejected(owner,createReady(newUnit(),{checks:{functional:!!(bits&1),ownership:!!(bits&2),data:!!(bits&4)}}));
 for(const extra of [{storeOwned:false},{priceCents:0},{priceCents:null}])await rejected(owner,createReady(newUnit(extra)));
 const created=newUnit({warrantyMonths:18,costCents:null,batteryPercent:0});const createdRequest=randomUUID();const result=expect(await workflow(owner,createReady(created,{photos:[photo],note:"  Synthetic original inspection  "}),createdRequest),200);let unit=result.retail.find(row=>row.id===created.id);
 assert.equal(unit.status,"available");assert.equal(unit.warrantyMonths,18);assert.equal(unit.costCents,null);assert.equal(unit.batteryPercent,0);assert.deepEqual(unit.photos,[photo]);assert.deepEqual(unit.sales,[]);assert.equal(unit.events.find(e=>e.id===createdRequest+":inspect").detail,"  Synthetic original inspection  ");
 assert.equal(unit.events[0].actorId,owner.memberId);assert.notEqual(unit.code,created.code);assert.match(unit.events[0].time,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);assert.equal(unit.events[0].time.slice(0,10),romeDay());
 pass("all inspection combinations, ownership and positive price gates; custom warranty/null cost/photo/original note and server actor/time/code");
 await rejected(owner,createReady(newUnit(),{photos:["https://invalid.example/photo"]}));await rejected(owner,createReady(newUnit(),{actorId:"forged"}));
 for(const warrantyMonths of [null,6]){const custom=await readyUnit({warrantyMonths});assert.equal(custom.warrantyMonths,warrantyMonths);}
 const plain=newUnit({photos:[photo],inspection:completeChecks,priceCents:null});let normal=expect(await command(owner,"retail",{type:"create",unit:plain,photos:[photo]}),200).retail.find(row=>row.id===plain.id);assert.equal(normal.status,"inspecting");assert.deepEqual(normal.inspection,{functional:false,ownership:false,data:false});assert.deepEqual(normal.photos,[photo]);assert.deepEqual(normal.sales,[]);
 pass("ordinary create keeps only explicit current photos and never copies checks or availability");
 for(const photos of [[photo],[],null]){const before=await inventory();expect(await command(owner,"retail",{type:"command",id:normal.id,version:normal.version,photos,command:{type:"inspect",checks:completeChecks}}),400);assert.deepEqual(await inventory(),before);}
 pass("legacy command rejects any top-level photos without unit customer receipt audit or revision writes");
 const inline={type:"inspect_approve",id:normal.id,version:normal.version,checks:completeChecks,priceCents:10000,note:"  Synthetic inline note  "};
 await rejected(owner,{...inline,checks:{...completeChecks,data:false}});await rejected(owner,{...inline,priceCents:0});
 normal=expect(await workflow(owner,inline),200).retail.find(row=>row.id===normal.id);assert.equal(normal.status,"available");assert.equal(normal.priceCents,10000);assert.equal(normal.events.find(e=>e.title==="单机操作：inspect").detail,"  Synthetic inline note  ");await rejected(owner,inline,409);
 pass("inline missing price and inspection approve atomically; partial invalid facts roll back and stale version conflicts");
 for(const permission of ["retail.view","retail.edit","retail.inspect","retail.price","financial.edit"]){await grant(all.filter(value=>value!==permission));await rejected(limited,createReady(newUnit({costCents:permission==="financial.edit"?0:null})),403);}
 await grant(["retail.view","retail.edit","retail.inspect","retail.price"]);const projected=expect(await workflow(limited,createReady(newUnit())),200);assert.equal(projected.retail.find(row=>row.id===created.id).costCents,null);
 const costUnit=await readyUnit({costCents:1234,refurbCents:0});const view=(await state(limited)).retail.find(row=>row.id===costUnit.id);assert.equal(view.costCents,null);assert.equal(view.refurbCents,null);assert.equal((await getUnit(owner,costUnit.id)).costCents,1234);
 await rejected(null,createReady(newUnit()),401);await rejected(other,{type:"inspect_approve",id:normal.id,version:normal.version,checks:completeChecks},404);const beforeCross=await inventory();expect(await command(other,"retail.workflow",createReady(newUnit()),randomUUID(),stores[0]),403);assert.deepEqual(await inventory(),beforeCross);
 pass("each create subpermission, cost projections, anonymous and cross-store writes fail closed");
 const paidUnit=await readyUnit();const requestId=randomUUID();const full=checkout(paidUnit,{payments:[actual(10000)],paymentUnreceived:undefined,delivery:{deliveryDate:romeDay()}});let saleState=expect(await workflow(owner,full,requestId),200);let sold=saleState.retail.find(row=>row.id===paidUnit.id);const sale=sold.sales[0];assert.equal(sale.id,requestId+":sale");assert.equal(sale.paidCents,10000);assert.equal(sale.paymentOpeningCents,0);assert.equal(sale.paymentUnreceived,false);assert.equal(sale.delivered,true);assert.equal(sale.payments.length,1);assert.equal(sale.payments[0].actorId,owner.memberId);assert.equal(sale.product.id,paidUnit.id);assert.deepEqual(sale.warranty,currentWarranty(paidUnit));assert.equal(saleState.operation.replayed,false);
 const committed=await inventory();const replay=expect(await workflow(owner,full,requestId),200);assert.equal(replay.operation.replayed,true);assert.deepEqual(await inventory(),committed);expect(await workflow(owner,{...full,sale:{...full.sale,customerName:"Synthetic changed"}},requestId),409);assert.deepEqual(await inventory(),committed);
 pass("full actual receipt and delivery freeze sale snapshots; identical request replays once and changed payload conflicts");
 const mixedUnit=await readyUnit();const mixed=checkout(mixedUnit,{payments:[actual(4000,"card"),actual(6000,"transfer")],paymentUnreceived:undefined});sold=expect(await workflow(owner,mixed),200).retail.find(row=>row.id===mixedUnit.id);assert.equal(sold.sales[0].paidCents,10000);assert.equal(sold.sales[0].payments.length,2);assert.equal(sold.sales[0].delivered,false);
 const noneUnit=await readyUnit();sold=expect(await workflow(owner,checkout(noneUnit)),200).retail.find(row=>row.id===noneUnit.id);assert.equal(sold.sales[0].paidCents,0);assert.equal(sold.sales[0].paymentUnreceived,true);assert.deepEqual(sold.sales[0].payments,[]);
 pass("mixed multiple payment methods and explicit unpaid checkout retain distinct exact money and delivery facts");
 const debtUnit=await readyUnit();const debt={reason:"Synthetic debt",owner:"Synthetic owner",followUp:romeDay(new Date(Date.now()+86400000))};const debtPayload=checkout(debtUnit,{payments:[actual(1000)],paymentUnreceived:undefined,delivery:{deliveryDate:romeDay(),debt}});sold=expect(await workflow(owner,debtPayload),200).retail.find(row=>row.id===debtUnit.id);assert.equal(sold.sales[0].paidCents,1000);assert.equal(sold.sales[0].delivered,true);assert.deepEqual(sold.sales[0].debtDelivery,debt);
 pass("partial payment and authorized actual debt delivery commit exact reason owner and follow-up facts");
 const invalidUnit=await readyUnit();const invalidBase=checkout(invalidUnit);
 for(const payments of [[actual(0)],[actual(-1)],[actual(10001)],[actual(1,"invalid")],[actual(1,"cash","2026-02-30")],[actual(1,"cash","2027-12-31")],[actual(9000),actual(1001)]])await rejected(owner,{...invalidBase,payments,paymentUnreceived:undefined});
 for(const extra of [{paymentUnreceived:undefined},{payments:[actual(1)]},{delivery:{deliveryDate:romeDay()}},{delivery:{deliveryDate:romeDay(),debt:{...debt,reason:""}}},{sale:{...invalidBase.sale,warranty:{...invalidBase.sale.warranty,shopName:"Changed"}}},{settingsRevision:1}])await rejected(owner,{...invalidBase,...extra},extra.settingsRevision!==undefined || extra.sale ?409:400);
 const beforeInvalid=await inventory();expect(await workflow(owner,invalidBase,"invalid:request"),400);assert.deepEqual(await inventory(),beforeInvalid);await rejected(owner,{...invalidBase,payments:[{...actual(1),actorId:"forged"}],paymentUnreceived:undefined});
 pass("invalid amount method date unpaid/payment contradiction delivery debt warranty settings and forged receipt reject with no side effects");
 for(const permission of ["retail.view","retail.sell","sale.payment","sale.deliver","sale.debt"]){await grant(all.filter(value=>value!==permission));const denied=checkout(invalidUnit,{payments:[actual(1000)],paymentUnreceived:undefined,delivery:{deliveryDate:romeDay(),debt}});await rejected(limited,denied,403);}
 await grant(["retail.view","retail.sell"]);const withoutMoney=await readyUnit();expect(await workflow(limited,checkout(withoutMoney)),200);await grant(["retail.view"]);await rejected(limited,checkout(invalidUnit),403);
 const pendingPrice=newUnit({priceCents:null});let pUnit=expect(await command(owner,"retail",{type:"create",unit:pendingPrice}),200).retail.find(row=>row.id===pendingPrice.id);for(const permission of ["retail.inspect","retail.price"]){await grant(all.filter(value=>value!==permission));await rejected(limited,{type:"inspect_approve",id:pUnit.id,version:pUnit.version,checks:completeChecks,priceCents:10000},403);}
 pass("every checkout and inline price subpermission checked live; explicit unpaid requires no payment permission and revocation denies submission");
 const raceUnit=await readyUnit();const racing=await Promise.all([workflow(owner,checkout(raceUnit,{payments:[actual(10000)],paymentUnreceived:undefined})),workflow(owner,checkout(raceUnit))]);assert.deepEqual(racing.map(row=>row.status).sort(),[200,409]);assert.equal((await getUnit(owner,raceUnit.id)).sales.length,1);
 pass("different concurrent requests against one version commit exactly one sale");
 const rollbackUnit=await readyUnit();const rollbackId=randomUUID(),rollbackPayload=checkout(rollbackUnit,{payments:[actual(10000)],paymentUnreceived:undefined,delivery:{deliveryDate:romeDay()}});
 await sql.unsafe(`create function chinatech_v2_private.${fault}() returns trigger language plpgsql as $$begin if new.kind='retail.workflow' and new.store_id='${stores[0]}'::uuid and new.request_id='${rollbackId}'::uuid then raise exception 'Synthetic audit failure'; end if; return new; end$$`);await sql.unsafe(`create trigger ${fault} before insert on chinatech_v2_private.audit_events for each row execute function chinatech_v2_private.${fault}()`);faultActive=true;
 const beforeFault=await inventory();expect(await workflow(owner,rollbackPayload,rollbackId),503);assert.deepEqual(await inventory(),beforeFault);await removeFault();expect(await workflow(owner,rollbackPayload,rollbackId),200);const afterRetry=await inventory();expect(await workflow(owner,rollbackPayload,rollbackId),200);assert.deepEqual(await inventory(),afterRetry);
 pass("forced late audit failure rolls back unit sale payments customer projection receipt and revision; identical retry commits only once");
 // Existing standalone commands remain the path for later real receipts and returned/refunded resale.
 let later=await getUnit(owner,noneUnit.id);const laterSale=later.sales[0];later=await oldCommand(later.id,{type:"payment",saleId:laterSale.id,entryId:randomUUID(),amountCents:10000,method:"cash",date:laterSale.time.slice(0,10)});assert.equal(later.sales[0].paidCents,10000);
 later=await oldCommand(later.id,{type:"deliver",saleId:laterSale.id,deliveryDate:laterSale.time.slice(0,10)});later=await oldCommand(later.id,{type:"return",saleId:laterSale.id,date:laterSale.time.slice(0,10),reason:"Synthetic return",received:true});
 const beforeBlocked=await inventory();expect(await command(owner,"retail",{type:"command",id:later.id,version:later.version,command:{type:"reinspect",note:"Synthetic reinspect"}}),400);assert.deepEqual(await inventory(),beforeBlocked);
 later=await oldCommand(later.id,{type:"refund",saleId:laterSale.id,entryId:randomUUID(),amountCents:10000,method:"cash",date:laterSale.time.slice(0,10),note:"Synthetic refund reason"});later=await oldCommand(later.id,{type:"reinspect",note:"  Synthetic original reinspect  "});assert.equal(later.status,"inspecting");assert.equal(later.events.at(-1).detail,"  Synthetic original reinspect  ");assert.equal(later.sales[0].product.id,noneUnit.id);assert.equal(later.sales[0].payments.length,1);assert.equal(later.sales[0].refunds.length,1);
 pass("later standalone receipt delivery return refund and reinspect preserve old snapshots and enforce settled return gate");
 if(process.env.CT_RETAIL_UI==="1"){
  const {chromium,expect:uiExpect}=await import("@playwright/test");const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});let stage="login";
  const apiState=async()=>{const response=await page.request.get(origin+"/api/backend/state");assert.equal(response.status(),200);return response.json();};
  const draftData=async(formName)=>page.evaluate(async formName=>{
   const db=await new Promise((resolve,reject)=>{const request=indexedDB.open("chinatech-device-recovery",2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
   try{return await new Promise((resolve,reject)=>{const tx=db.transaction("drafts","readonly"),request=tx.objectStore("drafts").getAll();request.onsuccess=()=>resolve(request.result.filter(row=>row.form===formName).sort((a,b)=>b.updatedAt-a.updatedAt)[0]?.data);request.onerror=()=>reject(request.error);});}finally{db.close();}
  },formName);
  async function openActions(){const toggle=page.locator('[data-retail-group="actions"] > button[aria-controls]');if(await toggle.isVisible() && await toggle.getAttribute("aria-expanded")==="false")await toggle.click();}
  try{
   await page.goto(origin+"/login");await page.getByRole("textbox",{name:"电子邮件",exact:true}).fill(`ct-workflow-owner-${suffix}@example.test`);await page.getByLabel("密码",{exact:true}).fill(password);await page.getByRole("button",{name:"登录工作台",exact:true}).click();await page.waitForURL(/\/app\/dashboard$/);
   stage="new draft";await page.goto(origin+"/app/retail/new");await page.getByRole("radio",{name:"新机",exact:true}).locator("..").click();await page.getByRole("combobox",{name:"型号 / 商品名称 *",exact:true}).fill("Synthetic formal "+suffix);await page.getByRole("combobox",{name:"保存方式",exact:true}).selectOption("available");await page.getByLabel("标价",{exact:true}).fill("100");await page.getByRole("combobox",{name:"商家保修期限",exact:true}).selectOption("none");
   const checkLabels=["功能检测已完成","门店自有及账号锁已核验","数据处理核验已完成"];
   for(const name of checkLabels)await page.getByRole("checkbox",{name,exact:true}).check();
   await uiExpect.poll(async()=>{const data=await draftData("retail-new::");return Boolean(data?.draft.storeOwned && Object.values(data.checks).every(Boolean));}).toBe(true);
   stage="new restore";await page.reload();await page.getByRole("button",{name:"恢复草稿",exact:true}).click();
   for(const name of checkLabels)await uiExpect(page.getByRole("checkbox",{name,exact:true})).not.toBeChecked();
   await page.getByRole("combobox",{name:"保存方式",exact:true}).selectOption("inspecting");await uiExpect(page.getByRole("checkbox",{name:/我确认这是门店自有/})).not.toBeChecked();await page.getByRole("combobox",{name:"保存方式",exact:true}).selectOption("available");
   pass("formal browser device draft restores inputs but clears all inspection and store ownership confirmations");
   stage="create ready";for(const name of checkLabels)await page.getByRole("checkbox",{name,exact:true}).check();await page.locator("footer").getByRole("button",{name:"建档并设为可售",exact:true}).click();await page.waitForURL(/\/app\/retail\/units\//);const savedId=page.url().split("/").at(-1);
   await page.reload();await uiExpect.poll(async()=>{const unit=(await apiState()).retail.find(row=>row.id===savedId);return unit?.status;}).toBe("available");let persisted=(await apiState()).retail.find(row=>row.id===savedId);assert.equal(persisted.priceCents,10000);assert.equal(persisted.warrantyMonths,null);assert.equal(persisted.sales.length,0);assert.equal(persisted.model,"Synthetic formal "+suffix);
   pass("formal browser creates ready unit with explicit checks and no extra warranty; save and page refresh read same real API facts");
   stage="checkout draft";await openActions();await page.getByRole("button",{name:"登记售出",exact:true}).click();let form=page.getByRole("region",{name:"登记成交",exact:true});await form.getByRole("combobox",{name:"客户手机号 *",exact:true}).fill("+393330007702");await form.getByRole("combobox",{name:"本次收款情况",exact:true}).selectOption("none");await form.getByRole("combobox",{name:"实际交付情况",exact:true}).selectOption("delivered");await form.getByLabel("欠款原因",{exact:true}).fill("Synthetic recover debt");await form.getByLabel("跟进责任人",{exact:true}).fill("Synthetic recover owner");await form.getByLabel("欠款跟进日",{exact:true}).fill(romeDay(new Date(Date.now()+86400000)));await form.getByRole("checkbox",{name:"明确授权本次欠款放行",exact:true}).check();await form.getByRole("checkbox",{name:"已核对商品、成交、实际收款、交付及保修条款",exact:true}).check();await uiExpect.poll(async()=>{const data=await draftData("retail-checkout:"+savedId);return data?.debtOwner;}).toBe("Synthetic recover owner");
   stage="checkout restore";await page.reload();await openActions();await page.getByRole("button",{name:"登记售出",exact:true}).click();form=page.getByRole("region",{name:"登记成交",exact:true});await form.getByRole("button",{name:"恢复草稿",exact:true}).click();await uiExpect(form.getByRole("combobox",{name:"客户手机号 *",exact:true})).toHaveValue("+393330007702");for(const name of ["本次收款情况","实际交付情况"])await uiExpect(form.getByRole("combobox",{name,exact:true})).toHaveValue("");await uiExpect(form.getByRole("checkbox",{name:"已核对商品、成交、实际收款、交付及保修条款",exact:true})).not.toBeChecked();
   await form.getByRole("combobox",{name:"本次收款情况",exact:true}).selectOption("none");await form.getByRole("combobox",{name:"实际交付情况",exact:true}).selectOption("delivered");await uiExpect(form.getByRole("checkbox",{name:"明确授权本次欠款放行",exact:true})).not.toBeChecked();await uiExpect(form.getByLabel("欠款原因",{exact:true})).toHaveValue("Synthetic recover debt");
   pass("formal checkout draft restores contact and debt inputs but clears payment delivery agreement and debt authorization selections");
   stage="checkout actual receipt";await form.getByRole("combobox",{name:"本次收款情况",exact:true}).selectOption("full");await uiExpect(form.getByLabel("收款金额",{exact:true})).toHaveValue("100.00");await uiExpect(form.getByRole("combobox",{name:"收款方式",exact:true})).toHaveValue("");await form.getByRole("combobox",{name:"收款方式",exact:true}).selectOption("cash");await form.getByRole("checkbox",{name:"已核对商品、成交、实际收款、交付及保修条款",exact:true}).check();await form.getByRole("button",{name:"确认登记成交",exact:true}).click();await uiExpect(form).toHaveCount(0);
   await page.reload();await uiExpect.poll(async()=>{const unit=(await apiState()).retail.find(row=>row.id===savedId);return unit?.sales.length;}).toBe(1);persisted=(await apiState()).retail.find(row=>row.id===savedId);assert.equal(persisted.status,"sold");assert.equal(persisted.sales[0].paidCents,10000);assert.equal(persisted.sales[0].payments.length,1);assert.equal(persisted.sales[0].payments[0].method,"cash");assert.equal(persisted.sales[0].delivered,true);assert.equal(persisted.sales[0].paymentUnreceived,false);assert.equal(persisted.sales[0].warranty.months,null);
   const saleToggle=page.locator('[data-retail-group="sales"] > button[aria-controls]');if(await saleToggle.isVisible() && await saleToggle.getAttribute("aria-expanded")==="false")await saleToggle.click();await uiExpect(page.getByRole("button",{name:"打印销售与保修单",exact:true})).toHaveCount(1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);mkdirSync(path.join(root,".local/retail-density"),{recursive:true});await page.screenshot({path:path.join(root,".local/retail-density/workflow-formal-synthetic.png"),fullPage:true});
   pass("formal browser submits actual full payment and delivery once, refreshes exact API ledger and exposes existing sale print path");
  }catch(reason){throw new Error(`Synthetic formal browser failed at ${stage}: ${String(reason).replaceAll(password,"[redacted]")}`);}finally{await browser.close();}
 }
 success=true;
} finally {
 if(faultActive)await removeFault();
 for(const who of sessions)await request(who,"/api/auth/logout",undefined,"POST").catch(()=>{});
 // Exact synthetic IDs only; account and table scope were established above before writes.
 const tables=await sql`select c.table_schema,c.table_name from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name where c.column_name='store_id' and c.table_schema in ('chinatech_v2','chinatech_v2_private') and t.table_type='BASE TABLE'`;
 let pending=[...tables];for(let round=0;round<6 && pending.length;round++){const remaining=[];for(const table of pending){assert.match(table.table_schema,/^chinatech_v2(?:_private)?$/);assert.match(table.table_name,/^[a-z_]+$/);try{await sql.unsafe(`delete from "${table.table_schema}"."${table.table_name}" where store_id in ($1::uuid,$2::uuid)`,stores);}catch(reason){if(reason.code!=="23503")throw reason;remaining.push(table);}}pending=remaining;}assert.equal(pending.length,0,"Synthetic scoped rows must all be removed.");
 await sql`delete from chinatech_v2.stores where id in ${sql(stores)}`;
 const userIds=sessions.map(who=>who.id);if(userIds.length){await sql`delete from chinatech_v2_private.session_audit where actor_id in ${sql(userIds)} or target_user_id in ${sql(userIds)}`;await sql`delete from chinatech_v2.accounts where id in ${sql(userIds)}`;}
 for(const who of sessions){const {error}=await admin.auth.admin.deleteUser(who.id);assert.ifError(error);}
 const [left]=await sql`select count(*)::int count from chinatech_v2.stores where id in ${sql(stores)}`;assert.equal(left.count,0);cleanupComplete=true;await sql.end();
 mkdirSync(path.join(root,".local/retail-density"),{recursive:true});writeFileSync(path.join(root,".local/retail-density/workflow-api.json"),JSON.stringify({status:success?"PASS":"FAILED",timestamp:new Date().toISOString(),count:checks.length,checks,target:"isolated localhost API 3117 / backend 55421 / database 55422",productionWrites:0,syntheticCleanupComplete:cleanupComplete},null,2));
}
console.log(`PASS ${checks.length} isolated workflow API groups; exact synthetic cleanup completed`);
