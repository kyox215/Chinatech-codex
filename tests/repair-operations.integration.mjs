import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import ts from "typescript";

const root=fileURLToPath(new URL("../",import.meta.url));
const compiled=new Map();
function domainURL(path) {
  if(compiled.has(path))return compiled.get(path);
  let code=ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  code=code.replace(/from "(\.\.?\/[^\"]+)"/g,(_,source)=>`from "${domainURL(resolve(dirname(path),source+".ts"))}"`);
  const url="data:text/javascript;base64,"+Buffer.from(code).toString("base64");compiled.set(path,url);return url;
}
const intakeDomain=await import(domainURL(resolve(root,"lib/repair-intake-record.ts")));
const requirementDomain=await import(domainURL(resolve(root,"lib/repair-requirements.ts")));
const procurementDomain=await import(domainURL(resolve(root,"lib/procurement.ts")));
const workflowDomain=await import(domainURL(resolve(root,"lib/repair-workflow.ts")));
const config=JSON.parse(readFileSync(process.env.CT_LOCAL_CONFIG??process.env.REPAIR_OPERATIONS_CONFIG??fileURLToPath(new URL("../.local/backend/connection.private.json",import.meta.url)),"utf8"));
const api=process.env.REPAIR_OPERATIONS_API_URL??"http://127.0.0.1:3144";
const origin=process.env.REPAIR_OPERATIONS_ORIGIN??"http://localhost:3144";
for(const [value,port] of [[config.API_URL,"55421"],[config.DB_URL,"55422"],[api,"3144"],[origin,"3144"]]) {
  const target=new URL(value);assert.ok(["127.0.0.1","localhost"].includes(target.hostname) && target.port===port,"Only the isolated local rebuild stack and candidate port 3144 are accepted.");
}
const sql=postgres(config.DB_URL,{max:1,prepare:false});
const admin=createClient(config.API_URL,config.SECRET_KEY||config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const suffix=randomBytes(6).toString("hex"),password="Ct"+randomBytes(20).toString("hex");
const stores=[randomUUID(),randomUUID()],sessions=[],checks=[];
const permissions=["retail.view","retail.edit","retail.inspect","retail.price","retail.sell","sale.payment","sale.reconcile","sale.deliver","sale.debt","sale.refund","sale.aftersales","financial.read","financial.edit","repairs.view","repairs.edit","customers.view","customers.edit","settings.edit","staff.manage"];
const suppliers=[{id:"supplier-a",name:"Synthetic A",phone:"",website:"",active:true},{id:"supplier-b",name:"Synthetic B",phone:"",website:"",active:true}];
const initialSettings={revision:0,shopName:"Repair operations test",address:"Synthetic address",phone:"",paper:"a4",repairWarrantyMonths:6,retailWarrantyMonths:12,suppliers,finance:[]};
const failName="repair_ops_fail_"+suffix;
let failureTrigger=false;
function pass(name){checks.push(name);console.log("PASS "+name);}
async function request(who,path,body,method=body===undefined?"GET":"POST") {
  const response=await fetch(api+path,{method,redirect:"manual",headers:{Origin:origin,...(body===undefined?{}:{"Content-Type":"application/json"}),...(who?{Cookie:[...who.cookies].map(([key,value])=>key+"="+value).join("; ")}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  if(who)for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(";")[0],at=pair.indexOf("=");who.cookies.set(pair.slice(0,at),pair.slice(at+1));}
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
  return {status:response.status,data};
}
async function user(label,role,storeId,allowed) {
  const email=`ct-repair-ops-${label}-${suffix}@example.test`;
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:"Synthetic "+label}});assert.ifError(error);
  const [member]=await sql`insert into chinatech_v2.store_memberships(store_id,user_id,role,membership_status,permissions) values(${storeId},${data.user.id},${role},'active',${allowed}) returning id`;
  const who={id:data.user.id,memberId:member.id,email,cookies:new Map(),storeId};
  const result=await request(who,"/api/auth/login",{email,password});assert.equal(result.status,200,"local login");sessions.push(who);return who;
}
async function state(who){const result=await request(who,"/api/backend/state");assert.equal(result.status,200,JSON.stringify(result.data));return result.data;}
async function rawCommand(who,kind,payload,requestId=randomUUID(),storeId=who.storeId){return request(who,"/api/backend/command",{kind,payload,requestId,storeId,memberId:who.memberId});}
async function command(who,kind,payload,requestId=randomUUID(),storeId=who.storeId){const result=await rawCommand(who,kind,payload,requestId,storeId);if(result.status===200&&result.data.delta)result.data={...await state(who),operation:result.data.operation};return result;}
async function page(who,scope){const result=await request(who,"/api/backend/state?"+new URLSearchParams({scope}));assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.scope,scope);return result.data;}
function ok(result){assert.equal(result.status,200,JSON.stringify(result.data));return result.data;}
function requirements(snapshot,id){return requirementDomain.currentRepairRequirements(intakeDomain.intakeDirectoryEntry(snapshot.intakes.find(row=>row.id===id)),snapshot.workflows[id]);}
async function workflow(who,id,value){const snapshot=await state(who);return command(who,"repair.workflow",{id,revision:snapshot.workflows[id]?.revision??0,command:value});}
async function setRequirement(who,id,title,mode,confirmed=false) {
  const snapshot=await state(who),item=requirements(snapshot,id).find(item=>item.title===title);
  assert.ok(item,"requirement exists");return ok(await command(who,"repair.workflow",{id,revision:snapshot.workflows[id]?.revision??0,command:{type:"requirement",item:{...item,mode,confirmed},note:"Synthetic scope review"}}));
}
async function createIntake(who,label,withRequirements=false) {
  const id="LOCAL-"+randomBytes(8).toString("hex").toUpperCase();
  const services={screen:{quality:withRequirements?"assembled":"",technology:withRequirements?"oled":""},battery:{quality:withRequirements?"original":"",appleService:""},port:{quality:""}};
  const data={id,createdAt:"2026-10-02 00:00:00",updatedAt:"2026-10-02 00:00:00",previewAt:"2026-10-02 00:00",customerName:"Synthetic "+label,phone:"+39333"+String(Number.parseInt(suffix.slice(0,6),16)).padStart(8,"0"),email:"",category:"手机",brand:"Apple",model:"Synthetic phone",color:"",serial:label+suffix,issue:withRequirements?"屏幕、电池":"Synthetic issue",...(withRequirements?{faults:["屏幕","电池"],issueNote:""}:{}),accessories:[],services,priority:"普通",photoCount:0,custody:"customer"};
  ok(await command(who,"intake.save",{data,revision:0,signatureCount:0,photos:[]}));return id;
}
async function createCart(who,id,label,supplierId="supplier-a",requirementId,quantity=2,cost=null,required=true) {
  const snapshot=await state(who),intake=snapshot.intakes.find(row=>row.id===id),item=requirements(snapshot,id).find(item=>item.id===requirementId);
  const record={id:"PO-"+suffix+"-"+label,repairId:id,item:"Synthetic "+label,supplier:suppliers.find(item=>item.id===supplierId)?.name??"Unknown",supplierId,quantity,unitCostCents:cost,expectedAt:"",reference:"",events:[],required,specification:"Reviewed synthetic specification",...(item?{requirementId:item.id,requirementRevision:item.revision}:{})};
  const payload={type:"create-cart",record,intakeRevision:intake.revision,workflowRevision:snapshot.workflows[id]?.revision??0};
  return {record,payload,result:await command(who,"procurement",payload)};
}
async function batch(who,action,ids,supplierId="supplier-a",quantities,requestId=randomUUID()) {
  const snapshot=await state(who);
  const payload={action,supplierId,items:ids.map((id,index)=>({id,revision:snapshot.procurement.find(row=>row.id===id).events.length,...(quantities?{quantity:quantities[index]}:{})}))};
  return {payload,requestId,result:await command(who,"procurement.batch",payload,requestId)};
}
try {
  for(const id of stores){await sql`insert into chinatech_v2.stores(id,name) values(${id},'Synthetic repair operations')`;await sql`insert into chinatech_v2_private.store_state(store_id,settings) values(${id},${sql.json(initialSettings)})`;}
  const owner=await user("owner","owner",stores[0],permissions);
  const tech=await user("tech","technician",stores[0],["repairs.view","repairs.edit","customers.view"]);
  const viewer=await user("viewer","viewer",stores[0],["repairs.view"]);
  const other=await user("other","owner",stores[1],permissions);
  assert.equal((await request(null,"/api/backend/command",{kind:"procurement.batch",payload:{},requestId:randomUUID(),storeId:stores[0],memberId:owner.memberId})).status,401);
  assert.equal((await command(viewer,"procurement.batch",{action:"ordered",supplierId:"supplier-a",items:[]})).status,403);
  assert.equal((await command(owner,"procurement.batch",{action:"ordered",supplierId:"supplier-a",items:[]},randomUUID(),stores[1])).status,403);
  pass("anonymous, read-only and cross-store batch writes denied");

  const repair=await createIntake(owner,"linked",true),second=await createIntake(owner,"second"),foreign=await createIntake(other,"foreign");
  await setRequirement(owner,repair,"屏幕","parts");
  let added=await createCart(owner,repair,"screen","supplier-a","intake:屏幕",2,4321);ok(added.result);
  let snapshot=added.result.data,screen=snapshot.procurement.find(row=>row.id===added.record.id);
  assert.equal(procurementDomain.procurementStatus(screen),"cart");assert.equal(screen.events[0].actorId,owner.memberId);
  assert.equal(workflowDomain.workflowGroup(intakeDomain.intakeDirectoryEntry(snapshot.intakes.find(row=>row.id===repair)),snapshot.procurement,snapshot.workflows[repair]),"processing");
  const noCost=(await state(tech)).procurement.find(row=>row.id===screen.id);assert.equal(noCost.unitCostCents,null);
  pass("create-cart atomically adds a server-attributed event without moving to purchase or leaking cost");

  for(const [change,expected] of [[{intakeRevision:0},409],[{workflowRevision:0},409],[{record:{...added.record,supplierId:"missing"}},409],[{record:{...added.record,requirementId:"intake:电池",requirementRevision:1}},409]]) {
    const payload={...added.payload,...change,record:{...(change.record??added.record),id:"PO-"+randomUUID()}};
    assert.equal((await command(owner,"procurement",payload)).status,expected);
  }
  const costGuess=await createCart(tech,second,"cost-guess","supplier-a",undefined,1,4321);assert.equal(costGuess.result.status,403);
  assert.equal((await command(owner,"repair.workflow",{id:repair,revision:snapshot.workflows[repair].revision,command:{type:"not_a_command",outcome:"notified",note:"forged"}})).status,400);
  assert.equal((await command(owner,"repair.workflow",{id:repair,revision:snapshot.workflows[repair].revision,command:{type:"pickup_notice",outcome:"notified",note:"forged",actorId:"forged"}})).status,400);
  pass("stale intake/workflow, pending demand, unknown supplier, cost guesses and forged workflow inputs denied");

  const freshRepair=await createIntake(owner,"initial-demand-race",true);
  snapshot=await state(owner);const firstItem=requirements(snapshot,freshRepair).find(item=>item.title==="屏幕"),firstIntake=snapshot.intakes.find(row=>row.id===freshRepair);
  ok(await command(owner,"intake.save",{data:{...firstIntake,model:"Changed while first requirement editor was open"},revision:firstIntake.revision,signatureCount:0,photos:[]}));
  assert.equal((await command(owner,"repair.workflow",{id:freshRepair,revision:0,command:{type:"requirement",item:{...firstItem,mode:"parts",confirmed:false},note:"Stale initial source"}})).status,400);
  assert.equal((await state(owner)).workflows[freshRepair],undefined);
  pass("first requirement confirmation rejects an outdated intake fingerprint even when demand revision is still one");

  const legacyDraft={...(await state(tech)).procurement.find(row=>row.id===screen.id),item:"Synthetic renamed screen"};
  for(const key of ["supplierId","requirementId","requirementRevision","specification"])delete legacyDraft[key];
  ok(await command(tech,"procurement",{type:"edit",record:legacyDraft,revision:screen.events.length}));
  screen=(await state(owner)).procurement.find(row=>row.id===screen.id);
  assert.equal(screen.supplierId,"supplier-a");assert.equal(screen.requirementId,"intake:屏幕");assert.equal(screen.specification,added.record.specification);assert.equal(screen.unitCostCents,4321);
  ok(await command(owner,"procurement",{type:"append",id:screen.id,revision:screen.events.length,event:{id:randomUUID(),time:"1999-01-01 00:00:00",type:"cart_added",note:"Synthetic readd",quantity:0}}));
  await setRequirement(owner,repair,"屏幕","parts",true);
  pass("old edit payload preserves supplier, requirement, specification and hidden cost");

  const a1=(await createCart(owner,second,"a1")).record,a2=(await createCart(owner,second,"a2")).record,b1=(await createCart(owner,second,"b1","supplier-b")).record;
  const foreignRecord=(await createCart(other,foreign,"foreign")).record;
  snapshot=await state(owner);
  const selected=id=>({id,revision:snapshot.procurement.find(row=>row.id===id).events.length});
  const invalid=[
    [{action:"ordered",supplierId:"supplier-a",items:[]},400],
    [{action:"ordered",supplierId:"supplier-a",items:Array.from({length:101},()=>selected(a1.id))},400],
    [{action:"ordered",supplierId:"supplier-a",items:[selected(a1.id),selected(a1.id)]},400],
    [{action:"ordered",supplierId:"supplier-a",items:[selected(a1.id),selected(b1.id)]},409],
    [{action:"ordered",supplierId:"supplier-a",items:[selected(a1.id),{...selected(a2.id),revision:999}]},409],
    [{action:"ordered",supplierId:"supplier-a",items:[selected(a1.id),{id:foreignRecord.id,revision:1}]},404],
    [{action:"ordered",supplierId:"supplier-a",items:[{...selected(a1.id),quantity:1}]},400],
    [{action:"arrival",supplierId:"supplier-a",items:[{...selected(a1.id),quantity:1}]},400],
  ];
  for(const [payload,expected] of invalid){const before=await state(owner);assert.equal((await command(owner,"procurement.batch",payload)).status,expected);assert.deepEqual((await state(owner)).procurement,before.procurement);}
  pass("empty, 101-row, duplicate, mixed-supplier, stale, foreign and invalid-quantity batches leave all records unchanged");

  const ordered=await batch(owner,"ordered",[screen.id,a1.id]);ok(ordered.result);
  snapshot=ordered.result.data;
  assert.equal(snapshot.procurement.find(row=>row.id===a2.id).events.length,1);assert.equal(snapshot.procurement.find(row=>row.id===b1.id).events.length,1);
  for(const id of [screen.id,a1.id]){const event=snapshot.procurement.find(row=>row.id===id).events.at(-1);assert.equal(event.batchId,ordered.requestId);assert.equal(event.actorId,owner.memberId);}
  ok(await command(owner,"procurement.batch",ordered.payload,ordered.requestId));
  assert.equal((await command(owner,"procurement.batch",{...ordered.payload,items:ordered.payload.items.slice(0,1)},ordered.requestId)).status,409);
  const receipt=ok(await request(owner,"/api/backend/operation?"+new URLSearchParams({storeId:stores[0],memberId:owner.memberId,requestId:ordered.requestId})));
  assert.equal(receipt.status,"committed");assert.equal(receipt.operation.requestId,ordered.requestId);
  const [receiptCount]=await sql`select count(*)::int count from chinatech_v2_private.command_receipts where store_id=${stores[0]} and request_id=${ordered.requestId}`;assert.equal(receiptCount.count,1);
  pass("selected same-supplier orders commit once and response-loss receipt recovery preserves unselected rows");

  const firstArrival=await batch(owner,"arrival",[screen.id],"supplier-a",[1]);ok(firstArrival.result);
  ok(await command(owner,"procurement.batch",firstArrival.payload,firstArrival.requestId));
  assert.equal(procurementDomain.arrivedQuantity((await state(owner)).procurement.find(row=>row.id===screen.id)),1);
  for(const quantity of [-1,0,1.5,2])assert.equal((await batch(owner,"arrival",[screen.id],"supplier-a",[quantity])).result.status,400);
  ok((await batch(owner,"arrival",[screen.id],"supplier-a",[1])).result);
  snapshot=await state(owner);let summary=procurementDomain.repairPartsSummary(snapshot.procurement,repair,requirements(snapshot,repair));
  assert.equal(summary.allRequiredReady,false);assert.ok(summary.unresolvedRequirements>0);
  assert.equal((await workflow(owner,repair,{type:"arrival_notice",outcome:"notified",note:"Must remain blocked"})).status,400);
  await setRequirement(owner,repair,"电池","none",true);
  snapshot=await state(owner);summary=procurementDomain.repairPartsSummary(snapshot.procurement,repair,requirements(snapshot,repair));assert.equal(summary.allRequiredReady,true);
  snapshot=ok(await workflow(owner,repair,{type:"arrival_notice",outcome:"notified",note:"Synthetic arrival call"}));
  assert.equal(snapshot.workflows[repair].events.at(-1).actorId,owner.memberId);
  assert.equal(workflowDomain.workflowGroup(intakeDomain.intakeDirectoryEntry(snapshot.intakes.find(row=>row.id===repair)),snapshot.procurement,snapshot.workflows[repair]),"arrival");
  pass("partial receipts retry once, pending battery blocks completeness, explicit no-purchase unblocks arrival notification");

  snapshot=ok(await workflow(owner,repair,{type:"stage",status:"ready",note:"Synthetic repair completion"}));
  snapshot=ok(await workflow(owner,repair,{type:"pickup_notice",outcome:"notified",note:"Synthetic pickup call"}));const firstCycle=snapshot.workflows[repair].readyCycle;
  assert.equal((await workflow(owner,repair,{type:"followup",flag:"collectedUnpaid",value:true,note:"Missing actual handback"})).status,400);
  snapshot=ok(await workflow(owner,repair,{type:"followup",flag:"collectedUnpaid",value:true,note:"Synthetic explicit handback and unpaid",delivered:true,unpaid:true}));
  assert.equal(snapshot.workflows[repair].handedOver.actorId,owner.memberId);assert.equal(snapshot.workflows[repair].status,"ready");
  await workflow(owner,repair,{type:"stage",status:"repairing",note:"Synthetic reopened repair"});
  snapshot=ok(await workflow(owner,repair,{type:"stage",status:"ready",note:"Synthetic repaired again"}));
  assert.notEqual(snapshot.workflows[repair].readyCycle,firstCycle);assert.equal(workflowDomain.pickupNotice(snapshot.workflows[repair]),"未通知取机");
  assert.equal(snapshot.workflows[repair].followUp.collectedUnpaid,true);
  snapshot=ok(await workflow(owner,repair,{type:"stage",status:"cancelled",note:"Synthetic cancellation with outstanding debt"}));
  assert.equal(snapshot.workflows[repair].followUp.collectedUnpaid,true);assert.equal(snapshot.workflows[repair].handedOver.unpaid,true);
  assert.equal(workflowDomain.workflowGroup(intakeDomain.intakeDirectoryEntry(snapshot.intakes.find(row=>row.id===repair)),snapshot.procurement,snapshot.workflows[repair]),"cancelled");
  snapshot=ok(await workflow(owner,repair,{type:"followup",flag:"collectedUnpaid",value:false,note:"Synthetic explicit debt follow-up ended"}));
  assert.equal(snapshot.workflows[repair].followUp.collectedUnpaid,false);assert.equal(snapshot.workflows[repair].handedOver.unpaid,true);
  pass("pickup cycle resets notice while debt survives repair and cancellation; explicit close retains actual handback history");

  snapshot=await state(owner);const oldIntake=snapshot.intakes.find(row=>row.id===repair),beforeRequirements=snapshot.workflows[repair].requirements;
  ok(await command(owner,"intake.save",{data:{...oldIntake,model:"Synthetic model updated"},revision:oldIntake.revision,signatureCount:0,photos:[]}));
  snapshot=await state(owner);assert.deepEqual(snapshot.workflows[repair].requirements,beforeRequirements);
  await setRequirement(owner,repair,"屏幕","parts");snapshot=await state(owner);
  const changedRequirement=requirements(snapshot,repair).find(item=>item.title==="屏幕"),currentRecord=snapshot.procurement.find(row=>row.id===screen.id);
  snapshot=ok(await command(owner,"procurement",{type:"link_requirement",id:screen.id,revision:currentRecord.events.length,requirementId:changedRequirement.id,requirementRevision:changedRequirement.revision,note:"Synthetic compatibility reviewed after model change"}));
  assert.equal(snapshot.procurement.find(row=>row.id===screen.id).events.at(-1).type,"requirement_linked");assert.equal(procurementDomain.arrivedQuantity(snapshot.procurement.find(row=>row.id===screen.id)),2);
  pass("old intake save preserves operational requirements and explicit relink records reviewed changed demand without changing arrival facts");

  const customRepair=await createIntake(owner,"custom-demand");
  snapshot=await state(owner);const customDirectory=intakeDomain.intakeDirectoryEntry(snapshot.intakes.find(row=>row.id===customRepair));
  const customItem={id:"project:camera",title:"Synthetic camera",request:"Synthetic compatible camera",revision:1,mode:"parts",confirmed:false,deviceFingerprint:customDirectory.deviceFingerprint};
  snapshot=ok(await workflow(owner,customRepair,{type:"requirement",item:customItem,note:"Synthetic custom project"}));
  const camera=await createCart(owner,customRepair,"camera","supplier-a",customItem.id,1);ok(camera.result);
  const glue=await createCart(owner,customRepair,"camera-glue","supplier-a",customItem.id,1);ok(glue.result);
  await setRequirement(owner,customRepair,customItem.title,"parts",true);
  ok((await batch(owner,"ordered",[camera.record.id,glue.record.id])).result);
  ok((await batch(owner,"arrival",[camera.record.id,glue.record.id],"supplier-a",[1,1])).result);
  snapshot=await state(owner);assert.equal(procurementDomain.repairPartsSummary(snapshot.procurement,customRepair,requirements(snapshot,customRepair)).allRequiredReady,true);
  const beforeCustom=requirements(snapshot,customRepair)[0],customIntake=snapshot.intakes.find(row=>row.id===customRepair),customWorkflowRevision=snapshot.workflows[customRepair].revision;
  ok(await command(owner,"intake.save",{data:{...customIntake,model:"Synthetic changed custom device"},revision:customIntake.revision,signatureCount:0,photos:[]}));
  snapshot=await state(owner);const invalidated=requirements(snapshot,customRepair)[0];
  assert.equal(invalidated.mode,"pending");assert.equal(invalidated.confirmed,false);assert.ok(invalidated.revision>beforeCustom.revision);assert.notEqual(invalidated.deviceFingerprint,beforeCustom.deviceFingerprint);
  assert.equal(procurementDomain.repairPartsSummary(snapshot.procurement,customRepair,requirements(snapshot,customRepair)).allRequiredReady,false);
  assert.equal((await command(owner,"repair.workflow",{id:customRepair,revision:customWorkflowRevision,command:{type:"requirement",item:beforeCustom,note:"Synthetic stale device confirmation"}})).status,400);
  await setRequirement(owner,customRepair,customItem.title,"parts");
  pass("custom project device fingerprint invalidates confirmed scope after model change and rejects stale confirmation");
  snapshot=await state(owner);const reviewed=requirements(snapshot,customRepair)[0],cameraNow=snapshot.procurement.find(row=>row.id===camera.record.id);
  snapshot=ok(await command(owner,"procurement",{type:"link_requirement",id:cameraNow.id,revision:cameraNow.events.length,requirementId:reviewed.id,requirementRevision:reviewed.revision,note:"Synthetic camera compatibility reviewed"}));
  assert.equal(procurementDomain.repairPartsSummary(snapshot.procurement,customRepair,[{...reviewed,confirmed:true}]).allRequiredReady,false);
  assert.equal((await workflow(owner,customRepair,{type:"requirement",item:{...reviewed,confirmed:true},note:"Synthetic one of two rows reviewed"})).status,400);
  assert.equal((await workflow(owner,customRepair,{type:"arrival_notice",outcome:"notified",note:"Synthetic stale second required allocation"})).status,400);
  const glueNow=snapshot.procurement.find(row=>row.id===glue.record.id);
  ok(await command(owner,"procurement",{type:"link_requirement",id:glueNow.id,revision:glueNow.events.length,requirementId:reviewed.id,requirementRevision:reviewed.revision,note:"Synthetic second allocation compatibility reviewed"}));
  await setRequirement(owner,customRepair,customItem.title,"parts",true);
  snapshot=await state(owner);assert.equal(procurementDomain.repairPartsSummary(snapshot.procurement,customRepair,requirements(snapshot,customRepair)).allRequiredReady,true);
  pass("two required allocations cannot confirm completeness or notify after only one is relinked; both reviewed references restore readiness");

  const optionalRepair=await createIntake(owner,"optional-only");snapshot=await state(owner);
  const optionalDirectory=intakeDomain.intakeDirectoryEntry(snapshot.intakes.find(row=>row.id===optionalRepair));
  const optionalItem={...customItem,id:"project:optional",title:"Synthetic optional scope",deviceFingerprint:optionalDirectory.deviceFingerprint};
  ok(await workflow(owner,optionalRepair,{type:"requirement",item:optionalItem,note:"Synthetic optional project"}));
  const optional=await createCart(owner,optionalRepair,"optional","supplier-a",optionalItem.id,1,null,false);ok(optional.result);
  snapshot=await state(owner);assert.equal(procurementDomain.repairPartsSummary(snapshot.procurement,optionalRepair,requirements(snapshot,optionalRepair)).allRequiredReady,false);
  await setRequirement(owner,optionalRepair,optionalItem.title,"parts",true);
  snapshot=await state(owner);const optionalSummary=procurementDomain.repairPartsSummary(snapshot.procurement,optionalRepair,requirements(snapshot,optionalRepair));
  assert.equal(optionalSummary.total,0);assert.equal(optionalSummary.allRequiredReady,true);
  assert.equal(workflowDomain.workflowGroup(intakeDomain.intakeDirectoryEntry(snapshot.intakes.find(row=>row.id===optionalRepair)),snapshot.procurement,snapshot.workflows[optionalRepair]),"processing");
  assert.equal((await workflow(owner,optionalRepair,{type:"arrival_notice",outcome:"notified",note:"Synthetic optional-only does not create arrival notice"})).status,400);
  pass("optional-only project needs explicit completeness confirmation but no mandatory arrival or arrival notification is invented");

  snapshot=await state(owner);
  ok(await command(owner,"settings.save",{revision:snapshot.settings.revision,settings:{...snapshot.settings,suppliers:snapshot.settings.suppliers.map(item=>item.id==="supplier-a"?{...item,active:false}:item)}}));
  assert.equal((await batch(owner,"ordered",[a2.id])).result.status,409);
  ok((await batch(owner,"arrival",[a1.id],"supplier-a",[1])).result);
  snapshot=await state(owner);ok(await command(owner,"settings.save",{revision:snapshot.settings.revision,settings:{...snapshot.settings,suppliers:snapshot.settings.suppliers.map(item=>({...item,active:true}))}}));
  pass("disabled supplier prevents new orders while existing real arrivals remain writable");

  const legacyRecord={id:"PO-legacy-"+suffix,repairId:second,item:"Legacy supplier mapping",supplier:"Synthetic legacy exact",quantity:1,unitCostCents:null,expectedAt:"",reference:"",events:[],required:true};
  ok(await command(owner,"procurement",{type:"create",record:legacyRecord}));
  snapshot=await state(owner);assert.equal(snapshot.procurement.find(row=>row.id===legacyRecord.id).supplierId,undefined);
  const legacySupplier={id:"legacy-exact",name:legacyRecord.supplier,phone:"",website:"",active:true};
  ok(await command(owner,"settings.save",{revision:snapshot.settings.revision,settings:{...snapshot.settings,suppliers:[...snapshot.settings.suppliers,legacySupplier]}}));
  ok(await command(owner,"procurement",{type:"append",id:legacyRecord.id,revision:0,event:{id:randomUUID(),time:"1999-01-01 00:00:00",type:"cart_added",note:"Reviewed old record",quantity:0}}));
  const legacyOrdered=await batch(owner,"ordered",[legacyRecord.id],legacySupplier.id);ok(legacyOrdered.result);
  assert.equal(legacyOrdered.result.data.procurement.find(row=>row.id===legacyRecord.id).supplierId,legacySupplier.id);
  const ambiguousRecord={...legacyRecord,id:"PO-unmatched-"+suffix,supplier:"synthetic a"};
  ok(await command(owner,"procurement",{type:"create",record:ambiguousRecord}));
  ok(await command(owner,"procurement",{type:"append",id:ambiguousRecord.id,revision:0,event:{id:randomUUID(),time:"1999-01-01 00:00:00",type:"cart_added",note:"Legacy literal name",quantity:0}}));
  assert.equal((await batch(owner,"ordered",[ambiguousRecord.id],"supplier-a")).result.status,409);
  pass("legacy supplier names map only by unique exact match and never by fuzzy or case-folded guesses");

  const a3=(await createCart(owner,second,"a3")).record;
  await sql.unsafe(`create function chinatech_v2_private.${failName}() returns trigger language plpgsql as $$ begin if new.store_id='${stores[0]}'::uuid and new.id='${a3.id}' then raise exception 'synthetic repair operations failure'; end if; return new; end $$`);
  await sql.unsafe(`create trigger ${failName} before update on chinatech_v2_private.procurement_records for each row execute function chinatech_v2_private.${failName}()`);failureTrigger=true;
  const beforeFailure=await state(owner),failed=await batch(owner,"ordered",[a2.id,a3.id]);assert.equal(failed.result.status,503);
  const afterFailure=await state(owner);assert.deepEqual(afterFailure.procurement,beforeFailure.procurement);assert.equal(afterFailure.revision,beforeFailure.revision);
  const [absentReceipt]=await sql`select count(*)::int count from chinatech_v2_private.command_receipts where store_id=${stores[0]} and request_id=${failed.requestId}`;assert.equal(absentReceipt.count,0);
  await sql.unsafe(`drop trigger ${failName} on chinatech_v2_private.procurement_records`);await sql.unsafe(`drop function chinatech_v2_private.${failName}()`);failureTrigger=false;
  ok(await command(owner,"procurement.batch",failed.payload,failed.requestId));
  pass("injected database failure rolls back entire batch, revision and receipt; exact retry succeeds once");

  // Seed only this run's local store to exercise the successful boundary without 100 setup HTTP requests.
  const hundred=Array.from({length:100},(_,index)=>({...legacyRecord,id:`PO-limit-${suffix}-${index}`,supplier:"Synthetic A",supplierId:"supplier-a",events:[{id:randomUUID(),type:"cart_added",quantity:0,time:"2026-10-02 00:00:00",note:"Synthetic fixture",actorId:owner.memberId}]}));
  await sql`insert into chinatech_v2_private.procurement_records(store_id,id,repair_id,data)
    select ${stores[0]},fixture.id,${second},fixture.data from jsonb_to_recordset(${sql.json(hundred.map(record=>({id:record.id,data:record})))}::jsonb) as fixture(id text,data jsonb)`;
  await sql`update chinatech_v2_private.store_state set revision=revision+1 where store_id=${stores[0]}`;
  const hundredResult=await batch(owner,"ordered",hundred.map(row=>row.id));ok(hundredResult.result);
  for(const record of hundred){const saved=hundredResult.result.data.procurement.find(row=>row.id===record.id);assert.equal(saved.events.length,2);assert.equal(saved.events.at(-1).batchId,hundredResult.requestId);}
  pass("exactly 100 allocated rows commit in one successful batch");

  // Root-only page projection/command dependency integration against this run's isolated store.
  snapshot=await state(owner);const template=snapshot.intakes.find(row=>row.id===second);
  const pageIntakes=Array.from({length:61},(_,i)=>{
    const id="LOCAL-"+suffix.toUpperCase()+i.toString(16).padStart(4,"0").toUpperCase();
    return {id,data:{...template,id,serial:"Synthetic paged "+i,model:"Synthetic paged model",revision:1},workflow:{revision:1,status:i===0?"ready_notified":"ready",custody:"customer",notice:null,events:[{id:"ready-"+i,time:template.updatedAt,type:"stage",label:"Synthetic ready",note:"Synthetic page fixture"}],updatedAt:template.updatedAt,...(i===0?{}:{readyCycle:"cycle-"+i,...(i<60?{pickupNotice:{cycle:"cycle-"+i,outcome:"notified"}}:{})})}};
  });
  await sql`insert into chinatech_v2_private.repair_intakes(store_id,id,customer_id,device_id,data,signatures,workflow)
    select ${stores[0]},fixture.id,source.customer_id,source.device_id,fixture.data,'[]'::jsonb,fixture.workflow
    from jsonb_to_recordset(${sql.json(pageIntakes)}::jsonb) fixture(id text,data jsonb,workflow jsonb)
    cross join chinatech_v2_private.repair_intakes source where source.store_id=${stores[0]} and source.id=${second}`;
  const pageParts=pageIntakes.map((row,i)=>({...legacyRecord,id:"PO-page-"+suffix+"-"+i,repairId:row.id,supplier:"Synthetic A",supplierId:"supplier-a",unitCostCents:555,events:[{id:"cart-"+i,type:"cart_added",quantity:0,time:template.updatedAt,note:"Synthetic page fixture",actorId:owner.memberId}]}));
  await sql`insert into chinatech_v2_private.procurement_records(store_id,id,repair_id,data)
    select ${stores[0]},fixture.id,fixture.repair_id,fixture.data from jsonb_to_recordset(${sql.json(pageParts.map(row=>({id:row.id,repair_id:row.repairId,data:row})))}::jsonb) fixture(id text,repair_id text,data jsonb)`;
  await sql`update chinatech_v2_private.store_state set revision=revision+1 where store_id=${stores[0]}`;
  let projection=await page(owner,"/app/repairs?q=Synthetic+paged&group=workflow");
  assert.equal(projection.views.repairs.groups.length,7);let readyGroup=projection.views.repairs.groups.find(row=>row.key==="ready");assert.equal(readyGroup.count,61);assert.equal(readyGroup.rows.length,50);
  projection=await page(owner,"/app/repairs?q=Synthetic+paged&contact_ready=unnotified");readyGroup=projection.views.repairs.groups.find(row=>row.key==="ready");assert.equal(readyGroup.count,1);assert.equal(readyGroup.pageCount,1);assert.equal(readyGroup.rows[0].id,pageIntakes[60].id);
  projection=await page(owner,"/app/repairs?q=Synthetic+paged&contact_ready=notified");assert.equal(projection.views.repairs.groups.find(row=>row.key==="ready").count,60);
  assert.equal(workflowDomain.pickupNotice(projection.workflows[pageIntakes[0].id]),"已通知取机（旧记录）");
  pass("root repair projection retains seven groups and legacy ready facts; contact filtering precedes 50-row pagination");
  projection=await page(owner,"/app/repairs?q="+freshRepair);const pendingRow=projection.views.repairs.groups.flatMap(group=>group.rows).find(row=>row.id===freshRepair);
  assert.equal(pendingRow.parts.summary.unresolvedRequirements,2);assert.equal(pendingRow.repair.requirements.length,2);assert.ok(pendingRow.repair.deviceFingerprint);assert.equal(pendingRow.repair.intakeRevision,2);
  const listed=await page(owner,"/app/procurement?filter=cart");assert.equal(listed.procurement.length,50);
  const batchScope="/app/procurement-batch?action=ordered&supplier=supplier-a";
  projection=await page(tech,batchScope);assert.equal(projection.procurement.length,50);assert.ok(projection.views.procurementBatch.total>=61);assert.equal(projection.views.procurementBatch.counts["supplier-a"],projection.views.procurementBatch.total);
  const allocated=[...projection.procurement],allDirectory=[...projection.directory];const firstPageId=projection.procurement[0].id;
  for(let pageNumber=2;pageNumber<=projection.views.procurementBatch.pageCount;pageNumber++){const next=await page(tech,batchScope+"&page="+pageNumber);assert.ok(next.procurement.length<=50);allocated.push(...next.procurement);allDirectory.push(...next.directory);}
  assert.equal(new Set(allocated.map(row=>row.id)).size,allocated.length);assert.equal(allocated.length,projection.views.procurementBatch.total);
  for(const record of pageParts){assert.ok(allocated.some(row=>row.id===record.id));assert.ok(allDirectory.some(row=>row.id===record.repairId));}assert.ok(allocated.every(row=>row.unitCostCents===null));
  const inventory=await page(tech,"/app/procurement-batch?action=ordered");assert.equal(inventory.procurement.length,0);assert.equal(inventory.views.procurementBatch.counts["supplier-a"],allocated.length);
  const otherProjection=await page(other,batchScope);assert.ok(otherProjection.procurement.every(row=>!pageParts.some(ours=>ours.id===row.id)));
  const secondPageId=allocated[50].id,selectedIds=[firstPageId,secondPageId];
  const requestId=randomUUID(),payload={action:"ordered",supplierId:"supplier-a",items:selectedIds.map(id=>({id,revision:allocated.find(row=>row.id===id).events.length}))};
  const delta=ok(await rawCommand(tech,"procurement.batch",payload,requestId));assert.equal(delta.delta,true);assert.deepEqual(delta.procurement.map(row=>row.id).sort(),selectedIds.toSorted());assert.ok(delta.procurement.every(row=>row.unitCostCents===null));for(const record of delta.procurement)assert.ok(delta.intakes.some(row=>row.id===record.repairId));
  const recovered=ok(await request(tech,"/api/backend/operation?"+new URLSearchParams({storeId:stores[0],memberId:tech.memberId,requestId})));assert.deepEqual(recovered.snapshot.procurement.map(row=>row.id).sort(),selectedIds.toSorted());assert.ok(recovered.snapshot.procurement.every(row=>row.events.at(-1).batchId===requestId));
  projection=await page(owner,"/app/procurement?filter=cart");assert.equal(projection.scope,"/app/procurement?filter=cart");assert.equal(projection.procurement.length,50);
  pass("root supplier pagination counts and visits all allocations with financial/store projection; cross-page selection commits and recovery returns only both selected records");

  await sql`update chinatech_v2.store_memberships set permissions=${["repairs.view"]},revision=revision+1 where store_id=${stores[0]} and id=${tech.memberId}`;
  assert.equal((await batch(tech,"arrival",[a2.id],"supplier-a",[1])).result.status,403);
  assert.equal((await state(tech)).procurement.find(row=>row.id===screen.id).unitCostCents,null);
  pass("revocation is checked on the actual batch command and financial projection remains protected");
  console.log(JSON.stringify({status:"PASS",count:checks.length,checks,timestamp:new Date().toISOString()}));
} finally {
  if(failureTrigger){await sql.unsafe(`drop trigger if exists ${failName} on chinatech_v2_private.procurement_records`).catch(()=>{});await sql.unsafe(`drop function if exists chinatech_v2_private.${failName}()`).catch(()=>{});}
  for(const who of sessions)await request(who,"/api/auth/logout",undefined,"POST").catch(()=>{});
  // Keep isolated synthetic history for reproducibility; never remove production data.
  await sql.end();
}
